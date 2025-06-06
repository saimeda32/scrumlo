/// <reference types="@cloudflare/workers-types" />
import { DurableObject } from "cloudflare:workers";
import type { Env } from "./index";
import type {
  ClientMsg,
  ServerMsg,
  Member,
  EstimateView,
  RetroView,
  PickView,
  PickMode,
  Phase,
  Activity,
} from "../shared/protocol";
import { DECKS, RETRO_TEMPLATES, RETRO_VOTE_BUDGET } from "../shared/protocol";

type EstimateState = {
  story: string;
  deck: string;
  phase: Phase;
  votes: Record<string, string>; // memberId -> card
};

type RetroCard = {
  id: string;
  column: string;
  text: string;
  authorId: string; // server-only; never sent to other clients (anonymity)
  voters: string[]; // memberIds who dot-voted this card
};

type RetroState = {
  template: string;
  cards: RetroCard[];
};

type PickState = {
  mode: PickMode;
  items: string[];
  result: string[];
  nonce: number;
};

/**
 * One RoomDO per room. Authoritative, in-memory, ephemeral.
 *
 * Presence is derived from the live WebSocket set + each socket's serialized
 * attachment (Member). Vote VALUES (estimation) and card AUTHORS (retro) are
 * withheld server-side — that redaction is what a peer/CRDT model couldn't enforce.
 *
 * Authoritative state is write-through to ctx.storage (decision C4): every
 * mutation is persisted BEFORE the next event runs, and rehydrated in the
 * constructor — so a round survives WebSocket-Hibernation evictions that
 * re-create this object (resetting instance fields) between events.
 */
export class RoomDO extends DurableObject<Env> {
  private estimate: EstimateState = { story: "", deck: "fib", phase: "voting", votes: {} };
  private retro: RetroState = { template: "ssc", cards: [] };
  private pick: PickState = { mode: "person", items: [], result: [], nonce: 0 };
  private activity: Activity = "estimate";
  private facilitatorId: string | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const e = await ctx.storage.get<EstimateState>("estimate");
      if (e) this.estimate = e;
      const r = await ctx.storage.get<RetroState>("retro");
      if (r) this.retro = r;
      const p = await ctx.storage.get<PickState>("pick");
      if (p) this.pick = p;
      this.activity = (await ctx.storage.get<Activity>("activity")) ?? "estimate";
      this.facilitatorId = (await ctx.storage.get<string>("facilitator")) ?? null;
    });
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put("estimate", this.estimate);
    await this.ctx.storage.put("retro", this.retro);
    await this.ctx.storage.put("pick", this.pick);
    await this.ctx.storage.put("activity", this.activity);
    if (this.facilitatorId === null) await this.ctx.storage.delete("facilitator");
    else await this.ctx.storage.put("facilitator", this.facilitatorId);
  }

  async fetch(_request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server); // hibernation-aware (NOT server.accept())
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    let msg: ClientMsg;
    try {
      const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
      msg = JSON.parse(text) as ClientMsg;
    } catch {
      return;
    }

    const me = ws.deserializeAttachment() as Member | null;

    switch (msg.t) {
      case "hello": {
        const name = String(msg.name ?? "").trim().slice(0, 40) || "anon";
        const member: Member = { id: crypto.randomUUID(), name };
        ws.serializeAttachment(member);
        if (this.facilitatorId === null) this.facilitatorId = member.id;
        break;
      }

      // ---- estimation ----
      case "vote": {
        if (!me) return;
        if (this.estimate.phase !== "voting") return;
        const deck = DECKS[this.estimate.deck] ?? DECKS.fib;
        if (!deck.includes(msg.card)) return;
        this.estimate.votes[me.id] = msg.card;
        break;
      }
      case "reveal": {
        if (!this.isFacilitator(me)) return;
        this.estimate.phase = "revealed";
        break;
      }
      case "restart": {
        if (!this.isFacilitator(me)) return;
        this.estimate.phase = "voting";
        this.estimate.votes = {};
        break;
      }
      case "setStory": {
        if (!this.isFacilitator(me)) return;
        this.estimate.story = String(msg.story ?? "").slice(0, 200);
        break;
      }
      case "setDeck": {
        if (!this.isFacilitator(me)) return;
        if (!DECKS[msg.deck]) return;
        this.estimate.deck = msg.deck;
        this.estimate.votes = {};
        this.estimate.phase = "voting";
        break;
      }

      // ---- activity + retro ----
      case "switchActivity": {
        if (!this.isFacilitator(me)) return;
        if (msg.activity !== "estimate" && msg.activity !== "retro" && msg.activity !== "pick")
          return;
        this.activity = msg.activity;
        break;
      }
      case "retroSetTemplate": {
        if (!this.isFacilitator(me)) return;
        if (!RETRO_TEMPLATES[msg.template]) return;
        this.retro.template = msg.template;
        this.retro.cards = []; // changing template resets the board
        break;
      }
      case "retroAddCard": {
        if (!me) return;
        const tpl = RETRO_TEMPLATES[this.retro.template];
        if (!tpl || !tpl.columns.some((c) => c.id === msg.column)) return;
        const text = String(msg.text ?? "").trim().slice(0, 280);
        if (!text) return;
        if (this.retro.cards.length >= 300) return; // hard cap
        this.retro.cards.push({
          id: crypto.randomUUID(),
          column: msg.column,
          text,
          authorId: me.id,
          voters: [],
        });
        break;
      }
      case "retroVote": {
        if (!me) return;
        const card = this.retro.cards.find((c) => c.id === msg.cardId);
        if (!card) return;
        const i = card.voters.indexOf(me.id);
        if (i >= 0) {
          card.voters.splice(i, 1); // toggle off (always allowed)
        } else {
          const used = this.retro.cards.filter((c) => c.voters.includes(me.id)).length;
          if (used >= RETRO_VOTE_BUDGET) return; // out of dots
          card.voters.push(me.id);
        }
        break;
      }
      case "retroDeleteCard": {
        if (!me) return;
        const card = this.retro.cards.find((c) => c.id === msg.cardId);
        if (!card) return;
        if (card.authorId !== me.id && !this.isFacilitator(me)) return;
        this.retro.cards = this.retro.cards.filter((c) => c.id !== msg.cardId);
        break;
      }

      // ---- picker (facilitator drives the spin) ----
      case "pickSetMode": {
        if (!this.isFacilitator(me)) return;
        if (msg.mode !== "person" && msg.mode !== "order" && msg.mode !== "list") return;
        this.pick.mode = msg.mode;
        this.pick.result = [];
        break;
      }
      case "pickAddItem": {
        if (!this.isFacilitator(me)) return;
        const text = String(msg.text ?? "").trim().slice(0, 60);
        if (!text) return;
        if (this.pick.items.length >= 50) return;
        this.pick.items.push(text);
        break;
      }
      case "pickRemoveItem": {
        if (!this.isFacilitator(me)) return;
        if (msg.index >= 0 && msg.index < this.pick.items.length) {
          this.pick.items.splice(msg.index, 1);
        }
        break;
      }
      case "pickSpin": {
        if (!this.isFacilitator(me)) return;
        const names = this.membersFrom(this.ctx.getWebSockets()).map((m) => m.name);
        if (this.pick.mode === "person") {
          this.pick.result = names.length ? [names[Math.floor(Math.random() * names.length)]] : [];
        } else if (this.pick.mode === "order") {
          const a = [...names];
          for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
          }
          this.pick.result = a;
        } else {
          const items = this.pick.items;
          this.pick.result = items.length
            ? [items[Math.floor(Math.random() * items.length)]]
            : [];
        }
        this.pick.nonce++;
        break;
      }
      case "pickClear": {
        if (!this.isFacilitator(me)) return;
        this.pick.result = [];
        this.pick.nonce++;
        break;
      }

      default:
        return;
    }

    // Persist the mutation BEFORE broadcasting, so a hibernation eviction
    // before the next event can't roll it back.
    await this.persist();
    await this.broadcast();
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.broadcast(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.broadcast(ws);
  }

  // ---- helpers ----

  private isFacilitator(me: Member | null): boolean {
    return !!me && me.id === this.facilitatorId;
  }

  private membersFrom(sockets: WebSocket[]): Member[] {
    return sockets
      .map((w) => w.deserializeAttachment() as Member | null)
      .filter((m): m is Member => m !== null);
  }

  private async broadcast(exclude?: WebSocket): Promise<void> {
    const sockets = this.ctx.getWebSockets().filter((w) => w !== exclude);
    const members = this.membersFrom(sockets);
    const presentIds = new Set(members.map((m) => m.id));

    let mutated = false;

    // Move the facilitator baton only on a REAL leave (holder gone from the
    // live socket set) — a fresh joiner never displaces the first joiner.
    if (this.facilitatorId === null || !presentIds.has(this.facilitatorId)) {
      this.facilitatorId = members[0]?.id ?? null;
      mutated = true;
    }

    // Prune estimation votes from members who left (their card shouldn't surface).
    // Retro cards are the TEAM's content and intentionally persist past a leave.
    for (const id of Object.keys(this.estimate.votes)) {
      if (!presentIds.has(id)) {
        delete this.estimate.votes[id];
        mutated = true;
      }
    }

    if (mutated) await this.persist();

    const revealed = this.estimate.phase === "revealed";
    const votedIds = Object.keys(this.estimate.votes);
    const tpl = RETRO_TEMPLATES[this.retro.template] ?? RETRO_TEMPLATES.ssc;
    const pick: PickView = this.pick; // same view for everyone (not redacted)

    for (const w of sockets) {
      const me = w.deserializeAttachment() as Member | null;
      if (!me) continue;

      const estimate: EstimateView = {
        story: this.estimate.story,
        deck: this.estimate.deck,
        phase: this.estimate.phase,
        voted: votedIds,
        yourVote: this.estimate.votes[me.id] ?? null,
        votes: revealed ? { ...this.estimate.votes } : null,
      };

      const retro: RetroView = {
        template: this.retro.template,
        columns: tpl.columns,
        cards: this.retro.cards.map((c) => ({
          id: c.id,
          column: c.column,
          text: c.text,
          mine: c.authorId === me.id,
          votes: c.voters.length,
          youVoted: c.voters.includes(me.id),
        })),
        votesLeft:
          RETRO_VOTE_BUDGET - this.retro.cards.filter((c) => c.voters.includes(me.id)).length,
      };

      const snapshot: ServerMsg = {
        t: "snapshot",
        v: 1,
        you: me.id,
        facilitator: this.facilitatorId,
        members,
        activity: this.activity,
        estimate,
        retro,
        pick,
      };
      try {
        w.send(JSON.stringify(snapshot));
      } catch {
        // socket closing; ignore
      }
    }
  }
}
