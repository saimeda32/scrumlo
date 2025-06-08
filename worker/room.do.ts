/// <reference types="@cloudflare/workers-types" />
import { DurableObject } from "cloudflare:workers";
import type { Env } from "./index";
import type {
  ClientMsg,
  ServerMsg,
  EndedMsg,
  CursorsMsg,
  Member,
  EstimateView,
  RetroView,
  PickView,
  PickMode,
  Phase,
  Activity,
} from "../shared/protocol";
import {
  DECKS,
  RETRO_TEMPLATES,
  RETRO_VOTE_BUDGET,
  RETRO_REACTIONS,
  RETRO_ZONE_W as ZONE_W,
  RETRO_CANVAS_H as CANVAS_H,
} from "../shared/protocol";

const IDLE_MS = 30 * 60 * 1000; // 30 min with no activity → the room ends
const EMPTY_GRACE_MS = 2 * 60 * 1000; // 2 min after the last person leaves (reconnect grace)

/** Numeric value of a deck card, or null for ?/☕/t-shirt sizes. "½" → 0.5. */
function cardToNum(card: string): number | null {
  if (card === "½") return 0.5;
  const n = Number(card);
  return Number.isFinite(n) ? n : null;
}

type EstimateState = {
  story: string;
  deck: string;
  phase: Phase;
  votes: Record<string, string>; // memberId -> card
  rationales: Record<string, string>; // memberId -> one-line "what are you pricing?"
  // Convergence trail: one entry per reveal of the CURRENT story, in order. Lets the
  // room watch the spread shrink across re-votes. Reset on restart/new-deck, kept on re-estimate.
  history: { lo: number; hi: number; n: number }[];
  // The locked outcome for this story: agreed value + the reason. Reset on restart/new-deck.
  decision: { value: string; note: string } | null;
  // Backlog: stories queued to estimate next, and a log of ones already decided.
  queue: string[];
  log: { story: string; value: string; note: string }[];
};

type RetroCard = {
  id: string;
  column: string;
  text: string;
  authorId: string; // server-only; sent as a name only when the room is non-anonymous
  voters: string[]; // memberIds who dot-voted this card
  reactions: Record<string, string[]>; // emoji -> memberIds
  order: number; // legacy column ordering (kept for tolerance)
  groupId: string | null; // cards sharing a groupId are clustered
  x: number; // free position on the canvas (board coords)
  y: number;
};

type RetroState = {
  template: string;
  cards: RetroCard[];
  anonymous: boolean; // hide authors (default true)
  spotlightId: string | null; // facilitator focusing the room on a card
  discussed: string[]; // card ids the random picker has already surfaced
};

type PickState = {
  mode: PickMode;
  items: string[];
  result: string[];
  nonce: number;
  recent: string[]; // already-picked names/items, excluded until the pool is exhausted
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
  private estimate: EstimateState = {
    story: "",
    deck: "fib",
    phase: "voting",
    votes: {},
    rationales: {},
    history: [],
    decision: null,
    queue: [],
    log: [],
  };
  // Transient presence — who is mid-typing a rationale. Never persisted (it's live-only).
  private typing = new Set<string>();
  // Live cursor positions on the retro canvas (memberId -> board coords). Live-only.
  private cursors = new Map<string, { x: number; y: number }>();
  private retro: RetroState = {
    template: "ssc",
    cards: [],
    anonymous: true,
    spotlightId: null,
    discussed: [],
  };
  private pick: PickState = { mode: "person", items: [], result: [], nonce: 0, recent: [] };
  private activity: Activity = "estimate";
  private facilitatorId: string | null = null;
  private clients: Record<string, string> = {}; // clientId -> memberId (survives reconnect)
  private timerEndsAt: number | null = null;
  private timerDurationMs: number | null = null;
  private reports: { id: string; at: number }[] = []; // abuse reports (in-memory, ephemeral)

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const e = await ctx.storage.get<EstimateState>("estimate");
      if (e) {
        this.estimate = e;
        this.estimate.history ??= []; // tolerate state persisted before convergence trail
        this.estimate.decision ??= null;
        this.estimate.queue ??= [];
        this.estimate.log ??= [];
      }
      const r = await ctx.storage.get<RetroState>("retro");
      if (r) {
        this.retro = r;
        this.retro.anonymous ??= true; // tolerate state from before authorship/reactions
        this.retro.spotlightId ??= null;
        this.retro.discussed ??= [];
        const htpl = RETRO_TEMPLATES[this.retro.template] ?? RETRO_TEMPLATES.ssc;
        this.retro.cards.forEach((c, i) => {
          c.reactions ??= {};
          c.order ??= i;
          if (c.groupId === undefined) c.groupId = null;
          if (typeof c.x !== "number" || typeof c.y !== "number") {
            const zi = Math.max(0, htpl.columns.findIndex((z) => z.id === c.column));
            c.x = zi * ZONE_W + 22;
            c.y = 96 + ((c.order ?? i) % 12) * 88;
          }
        });
      }
      const p = await ctx.storage.get<PickState>("pick");
      if (p) {
        this.pick = p;
        this.pick.recent ??= [];
      }
      this.clients = (await ctx.storage.get<Record<string, string>>("clients")) ?? {};
      this.activity = (await ctx.storage.get<Activity>("activity")) ?? "estimate";
      this.facilitatorId = (await ctx.storage.get<string>("facilitator")) ?? null;
      this.timerEndsAt = (await ctx.storage.get<number>("timerEndsAt")) ?? null;
      this.timerDurationMs = (await ctx.storage.get<number>("timerDurationMs")) ?? null;
    });
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put("estimate", this.estimate);
    await this.ctx.storage.put("retro", this.retro);
    await this.ctx.storage.put("pick", this.pick);
    await this.ctx.storage.put("clients", this.clients);
    await this.ctx.storage.put("activity", this.activity);
    if (this.timerEndsAt === null) await this.ctx.storage.delete("timerEndsAt");
    else await this.ctx.storage.put("timerEndsAt", this.timerEndsAt);
    if (this.timerDurationMs === null) await this.ctx.storage.delete("timerDurationMs");
    else await this.ctx.storage.put("timerDurationMs", this.timerDurationMs);
    if (this.facilitatorId === null) await this.ctx.storage.delete("facilitator");
    else await this.ctx.storage.put("facilitator", this.facilitatorId);
  }

  async fetch(_request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server); // hibernation-aware (NOT server.accept())
    await this.ctx.storage.setAlarm(Date.now() + IDLE_MS);
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

    // Live cursors: high-frequency + ephemeral, so they bypass the persist/snapshot
    // path entirely and fan out as a tiny dedicated message.
    if (msg.t === "cursor") {
      if (!me) return;
      this.cursors.set(me.id, { x: Math.round(Number(msg.x) || 0), y: Math.round(Number(msg.y) || 0) });
      await this.broadcastCursors();
      return;
    }

    switch (msg.t) {
      case "hello": {
        const name = String(msg.name ?? "").trim().slice(0, 40) || "anon";
        const clientId = String(msg.clientId ?? "") || crypto.randomUUID();
        // Reuse this client's member id across reconnects so seat/baton/votes survive.
        let memberId = this.clients[clientId];
        if (!memberId) {
          memberId = crypto.randomUUID();
          this.clients[clientId] = memberId;
        }
        const member: Member = { id: memberId, name };
        ws.serializeAttachment(member);
        if (this.facilitatorId === null) this.facilitatorId = memberId;
        break;
      }

      // ---- estimation ----
      case "vote": {
        if (!me) return;
        if (this.estimate.phase !== "voting") return;
        const deck = DECKS[this.estimate.deck] ?? DECKS.fib;
        if (!deck.includes(msg.card)) return;
        this.estimate.votes[me.id] = msg.card;
        // Auto-reveal once everyone present has voted (needs a real group, not a solo).
        const present = this.membersFrom(this.ctx.getWebSockets());
        if (present.length >= 2 && present.every((m) => this.estimate.votes[m.id] !== undefined)) {
          this.recordReveal();
        }
        break;
      }
      case "reveal": {
        if (!this.isFacilitator(me)) return;
        this.recordReveal();
        break;
      }
      case "restart": {
        if (!this.isFacilitator(me)) return;
        this.estimate.phase = "voting";
        this.estimate.votes = {};
        this.estimate.rationales = {};
        this.estimate.history = []; // new story → fresh convergence trail
        this.estimate.decision = null;
        this.typing.clear();
        break;
      }
      case "reestimate": {
        // Close the loop: reopen voting on the SAME story, clear the cards, but keep the
        // rationales so the room re-votes knowing why people disagreed.
        if (!this.isFacilitator(me)) return;
        this.estimate.phase = "voting";
        this.estimate.votes = {};
        break;
      }
      case "setRationale": {
        if (!me) return;
        this.estimate.rationales[me.id] = String(msg.text ?? "").trim().slice(0, 120);
        break;
      }
      case "lockDecision": {
        if (!this.isFacilitator(me)) return;
        const value = String(msg.value ?? "").trim().slice(0, 12);
        const note = String(msg.note ?? "").trim().slice(0, 140);
        this.estimate.decision = value ? { value, note } : null; // "" → unlock
        break;
      }
      case "estimateQueueAdd": {
        if (!this.isFacilitator(me)) return;
        const stories = (Array.isArray(msg.stories) ? msg.stories : [])
          .map((s) => String(s ?? "").trim().slice(0, 200))
          .filter(Boolean)
          .slice(0, 100);
        // first one fills an empty current story; the rest queue up
        for (const st of stories) {
          if (!this.estimate.story && this.estimate.queue.length === 0) this.estimate.story = st;
          else this.estimate.queue.push(st);
        }
        this.estimate.queue = this.estimate.queue.slice(0, 200);
        break;
      }
      case "estimateNextStory": {
        if (!this.isFacilitator(me)) return;
        // log the current story's outcome (if decided), then load the next one fresh
        if (this.estimate.story && this.estimate.decision) {
          this.estimate.log.push({
            story: this.estimate.story,
            value: this.estimate.decision.value,
            note: this.estimate.decision.note,
          });
        }
        this.estimate.story = this.estimate.queue.shift() ?? "";
        this.estimate.votes = {};
        this.estimate.rationales = {};
        this.estimate.history = [];
        this.estimate.decision = null;
        this.estimate.phase = "voting";
        this.typing.clear();
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
        this.estimate.rationales = {};
        this.estimate.history = []; // different scale → trail no longer comparable
        this.estimate.decision = null;
        this.estimate.phase = "voting";
        break;
      }
      case "typing": {
        // Live presence while an outlier composes a rationale. Transient, not persisted.
        if (!me) return;
        if (msg.on) this.typing.add(me.id);
        else this.typing.delete(me.id);
        break;
      }

      // A spectator asking for the current state (no mutation): just send snapshots.
      case "sync": {
        await this.broadcast();
        return;
      }

      // ---- facilitation: anyone can take over the baton (ephemeral, low-stakes) ----
      case "claimFacilitator": {
        if (!me) return;
        this.facilitatorId = me.id;
        break;
      }
      case "endRoom": {
        if (!this.isFacilitator(me)) return;
        await this.terminate();
        return;
      }
      case "reportRoom": {
        if (!me) return;
        if (this.isFacilitator(me)) {
          await this.terminate(); // facilitator report = end the room
          return;
        }
        const now = Date.now();
        this.reports = this.reports.filter((r) => now - r.at < 60_000 && r.id !== me.id);
        this.reports.push({ id: me.id, at: now });
        if (this.reports.length >= 2) await this.terminate(); // 2 distinct reporters / 60s
        return;
      }

      // ---- shared timer (facilitator-run countdown) ----
      case "timerStart": {
        if (!this.isFacilitator(me)) return;
        const secs = Math.max(5, Math.min(60 * 60, Math.floor(msg.seconds)));
        this.timerEndsAt = Date.now() + secs * 1000;
        this.timerDurationMs = secs * 1000;
        break;
      }
      case "timerStop": {
        if (!this.isFacilitator(me)) return;
        this.timerEndsAt = null;
        this.timerDurationMs = null;
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
        this.retro.spotlightId = null;
        this.retro.discussed = [];
        break;
      }
      case "retroAddCard": {
        if (!me) return;
        const tpl = RETRO_TEMPLATES[this.retro.template];
        if (!tpl || !tpl.columns.some((c) => c.id === msg.column)) return;
        const text = String(msg.text ?? "").trim().slice(0, 280);
        if (!text) return;
        if (this.retro.cards.length >= 300) return; // hard cap
        const tplA = RETRO_TEMPLATES[this.retro.template] ?? RETRO_TEMPLATES.ssc;
        const inZone = this.retro.cards.filter((c) => c.column === msg.column).length;
        const zi = Math.max(0, tplA.columns.findIndex((c) => c.id === msg.column));
        this.retro.cards.push({
          id: crypto.randomUUID(),
          column: msg.column,
          text,
          authorId: me.id,
          voters: [],
          reactions: {},
          order: inZone,
          groupId: null,
          x: zi * ZONE_W + 22 + (inZone % 3) * 14,
          y: 96 + (inZone % 12) * 88,
        });
        break;
      }
      case "retroMoveXY": {
        // Free placement on the canvas. The sticky's zone (column) follows its x band.
        if (!me) return;
        const card = this.retro.cards.find((c) => c.id === msg.cardId);
        if (!card) return;
        const tplM = RETRO_TEMPLATES[this.retro.template] ?? RETRO_TEMPLATES.ssc;
        card.x = Math.max(0, Math.min(Math.round(Number(msg.x) || 0), tplM.columns.length * ZONE_W));
        card.y = Math.max(0, Math.min(Math.round(Number(msg.y) || 0), CANVAS_H));
        const zi2 = Math.max(0, Math.min(Math.floor(card.x / ZONE_W), tplM.columns.length - 1));
        card.column = tplM.columns[zi2].id;
        card.groupId = null; // free placement ungroups
        break;
      }
      case "retroMoveCard": {
        // Collaborative rearrange: any participant can drag a sticky within or across columns.
        // Moving to a column also pulls the card OUT of any group it was in.
        if (!me) return;
        const tpl = RETRO_TEMPLATES[this.retro.template];
        if (!tpl || !tpl.columns.some((c) => c.id === msg.toColumn)) return;
        const card = this.retro.cards.find((c) => c.id === msg.cardId);
        if (!card) return;
        const wasGroup = card.groupId;
        card.column = msg.toColumn;
        card.groupId = null;
        const col = this.retro.cards
          .filter((c) => c.column === msg.toColumn && c.id !== card.id)
          .sort((a, b) => a.order - b.order);
        const idx = Math.max(0, Math.min(Math.trunc(Number(msg.toIndex)) || 0, col.length));
        col.splice(idx, 0, card);
        col.forEach((c, i) => (c.order = i)); // renumber the target column
        this.dissolveSingletonGroups(wasGroup);
        break;
      }
      case "retroGroupCard": {
        // Stack one sticky onto another → they share a groupId (votes display summed client-side).
        if (!me) return;
        if (msg.cardId === msg.ontoCardId) return;
        const card = this.retro.cards.find((c) => c.id === msg.cardId);
        const onto = this.retro.cards.find((c) => c.id === msg.ontoCardId);
        if (!card || !onto) return;
        const gid = onto.groupId ?? crypto.randomUUID();
        onto.groupId = gid;
        const wasGroup = card.groupId;
        card.groupId = gid;
        card.column = onto.column; // a group lives in one column
        card.order = onto.order + 0.5; // sit next to its new groupmate
        const col = this.retro.cards
          .filter((c) => c.column === onto.column)
          .sort((a, b) => a.order - b.order);
        col.forEach((c, i) => (c.order = i));
        this.dissolveSingletonGroups(wasGroup);
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
      case "retroEditCard": {
        if (!me) return;
        const card = this.retro.cards.find((c) => c.id === msg.cardId);
        if (!card) return;
        if (card.authorId !== me.id && !this.isFacilitator(me)) return; // author or facilitator
        const text = String(msg.text ?? "").trim().slice(0, 280);
        if (text) card.text = text;
        break;
      }
      case "retroDeleteCard": {
        if (!me) return;
        const card = this.retro.cards.find((c) => c.id === msg.cardId);
        if (!card) return;
        if (card.authorId !== me.id && !this.isFacilitator(me)) return;
        this.retro.cards = this.retro.cards.filter((c) => c.id !== msg.cardId);
        if (this.retro.spotlightId === msg.cardId) this.retro.spotlightId = null;
        this.retro.discussed = this.retro.discussed.filter((id) => id !== msg.cardId);
        break;
      }
      case "retroReact": {
        if (!me) return;
        if (!RETRO_REACTIONS.includes(msg.emoji as (typeof RETRO_REACTIONS)[number])) return;
        const card = this.retro.cards.find((c) => c.id === msg.cardId);
        if (!card) return;
        const list = (card.reactions[msg.emoji] ??= []);
        const i = list.indexOf(me.id);
        if (i >= 0) list.splice(i, 1);
        else list.push(me.id);
        if (list.length === 0) delete card.reactions[msg.emoji];
        break;
      }
      case "retroSetAnonymous": {
        if (!this.isFacilitator(me)) return;
        this.retro.anonymous = !!msg.on;
        break;
      }
      case "retroSpotlight": {
        if (!this.isFacilitator(me)) return;
        if (msg.cardId === null) this.retro.spotlightId = null;
        else if (this.retro.cards.some((c) => c.id === msg.cardId)) this.retro.spotlightId = msg.cardId;
        break;
      }
      case "retroPickRandom": {
        // Discuss cards in random order, each once — picked → spotlight it + mark discussed.
        if (!this.isFacilitator(me)) return;
        const done = new Set(this.retro.discussed);
        const pool = this.retro.cards.filter((c) => !done.has(c.id));
        if (pool.length === 0) return; // all discussed → no-op (client offers reset)
        const pick = pool[Math.floor(Math.random() * pool.length)];
        this.retro.spotlightId = pick.id;
        this.retro.discussed.push(pick.id);
        break;
      }
      case "retroResetDiscussed": {
        if (!this.isFacilitator(me)) return;
        this.retro.discussed = [];
        this.retro.spotlightId = null;
        break;
      }

      // ---- picker (facilitator drives the spin) ----
      case "pickSetMode": {
        if (!this.isFacilitator(me)) return;
        if (msg.mode !== "person" && msg.mode !== "order" && msg.mode !== "list") return;
        this.pick.mode = msg.mode;
        this.pick.result = [];
        this.pick.recent = []; // new pool → fresh rotation
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
        if (this.pick.mode === "order") {
          const a = [...names];
          for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
          }
          this.pick.result = a;
        } else {
          // person / list: pick one, never repeating until the pool is exhausted.
          const all = this.pick.mode === "person" ? names : this.pick.items;
          let pool = all.filter((n) => !this.pick.recent.includes(n));
          if (pool.length === 0) {
            this.pick.recent = [];
            pool = all;
          }
          const winner = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
          this.pick.result = winner ? [winner] : [];
          if (winner) this.pick.recent.push(winner);
        }
        this.pick.nonce++;
        break;
      }
      case "pickClear": {
        if (!this.isFacilitator(me)) return;
        this.pick.result = [];
        this.pick.recent = []; // start the rotation fresh
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
    await this.ctx.storage.setAlarm(Date.now() + IDLE_MS); // any activity resets the idle clock
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const gone = ws.deserializeAttachment() as Member | null;
    if (gone) this.cursors.delete(gone.id);
    await this.broadcast(ws);
    await this.broadcastCursors(); // their cursor disappears for everyone
    const remaining = this.ctx.getWebSockets().filter((w) => w !== ws).length;
    // Empty room → short grace (reconnect window) then evaporate; otherwise idle TTL.
    await this.ctx.storage.setAlarm(Date.now() + (remaining === 0 ? EMPTY_GRACE_MS : IDLE_MS));
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.broadcast(ws);
  }

  /** Idle TTL / empty-grace fired: end the room. */
  async alarm(): Promise<void> {
    await this.terminate();
  }

  /** End the room now: tell everyone, close sockets, delete all state. */
  private async terminate(): Promise<void> {
    const ended = JSON.stringify({ t: "ended", v: 1 } satisfies EndedMsg);
    for (const w of this.ctx.getWebSockets()) {
      try {
        w.send(ended);
        w.close(1000, "room ended");
      } catch {
        // ignore
      }
    }
    await this.ctx.storage.deleteAll(); // no DB residue; the room is gone
  }

  // ---- helpers ----

  private isFacilitator(me: Member | null): boolean {
    return !!me && me.id === this.facilitatorId;
  }

  /** Fan out live cursors as a tiny dedicated message (never a full snapshot). */
  private async broadcastCursors(): Promise<void> {
    const sockets = this.ctx.getWebSockets();
    const nameById = new Map(this.membersFrom(sockets).map((m) => [m.id, m.name]));
    const cursors = [...this.cursors.entries()]
      .filter(([id]) => nameById.has(id))
      .map(([id, p]) => ({ id, name: nameById.get(id)!, x: p.x, y: p.y }));
    // Send each socket everyone ELSE's cursor — never its own (a client should
    // see only the native OS pointer for itself, not a duplicated colored one).
    for (const w of sockets) {
      const me = w.deserializeAttachment() as Member | null;
      const mine = me?.id;
      const forThem = mine ? cursors.filter((c) => c.id !== mine) : cursors;
      try {
        w.send(JSON.stringify({ t: "cursors", v: 1, cursors: forThem } satisfies CursorsMsg));
      } catch {
        /* ignore */
      }
    }
  }

  /** Flip to revealed and append this round's spread to the convergence trail. */
  private recordReveal(): void {
    this.estimate.phase = "revealed";
    const nums = Object.values(this.estimate.votes)
      .map(cardToNum)
      .filter((n): n is number => n !== null);
    if (nums.length) {
      this.estimate.history.push({ lo: Math.min(...nums), hi: Math.max(...nums), n: nums.length });
    }
  }

  /** A group of one isn't a group — clear its lone member's groupId. */
  private dissolveSingletonGroups(gid: string | null): void {
    if (!gid) return;
    const members = this.retro.cards.filter((c) => c.groupId === gid);
    if (members.length === 1) members[0].groupId = null;
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
    const nameById = new Map(members.map((m) => [m.id, m.name]));

    let mutated = false;

    // Move the facilitator baton only on a REAL leave (holder gone from the
    // live socket set) — a fresh joiner never displaces the first joiner.
    if (this.facilitatorId === null || !presentIds.has(this.facilitatorId)) {
      this.facilitatorId = members[0]?.id ?? null;
      mutated = true;
    }

    // Votes and retro cards are NOT pruned on disconnect: with stable clientId
    // identity, a member who drops and reconnects keeps their vote. Estimation
    // votes are cleared explicitly on restart / reveal-then-restart.

    if (mutated) await this.persist();

    const revealed = this.estimate.phase === "revealed";
    const votedIds = Object.keys(this.estimate.votes);
    const tpl = RETRO_TEMPLATES[this.retro.template] ?? RETRO_TEMPLATES.ssc;
    const pick: PickView = this.pick; // same view for everyone (not redacted)

    for (const w of sockets) {
      // me === null → a spectator (connected, no name yet). They still get a
      // read-only snapshot (you="") so the room renders before they commit a name.
      const me = w.deserializeAttachment() as Member | null;

      const estimate: EstimateView = {
        story: this.estimate.story,
        deck: this.estimate.deck,
        phase: this.estimate.phase,
        voted: votedIds,
        yourVote: me ? (this.estimate.votes[me.id] ?? null) : null,
        votes: revealed ? { ...this.estimate.votes } : null,
        // Rationales aren't secret like votes (they carry no number) — send them whenever
        // they exist so a re-vote can show last round's takes. Empty {} → nothing to show.
        rationales: Object.keys(this.estimate.rationales).length ? { ...this.estimate.rationales } : null,
        history: this.estimate.history,
        typing: [...this.typing],
        decision: this.estimate.decision,
        queue: this.estimate.queue,
        log: this.estimate.log,
      };

      const retro: RetroView = {
        template: this.retro.template,
        columns: tpl.columns,
        cards: this.retro.cards.map((c) => ({
          id: c.id,
          column: c.column,
          text: c.text,
          mine: me ? c.authorId === me.id : false,
          author: this.retro.anonymous ? null : (nameById.get(c.authorId) ?? null),
          votes: c.voters.length,
          youVoted: me ? c.voters.includes(me.id) : false,
          reactions: RETRO_REACTIONS.filter((e) => (c.reactions[e]?.length ?? 0) > 0).map((e) => ({
            emoji: e,
            count: c.reactions[e].length,
            mine: me ? c.reactions[e].includes(me.id) : false,
          })),
          discussed: this.retro.discussed.includes(c.id),
          order: c.order ?? 0,
          groupId: c.groupId ?? null,
          x: c.x ?? 0,
          y: c.y ?? 0,
        })),
        votesLeft: me
          ? RETRO_VOTE_BUDGET - this.retro.cards.filter((c) => c.voters.includes(me.id)).length
          : RETRO_VOTE_BUDGET,
        anonymous: this.retro.anonymous,
        spotlightId: this.retro.spotlightId,
      };

      const snapshot: ServerMsg = {
        t: "snapshot",
        v: 1,
        you: me?.id ?? "",
        facilitator: this.facilitatorId,
        members,
        activity: this.activity,
        estimate,
        retro,
        pick,
        timerEndsAt: this.timerEndsAt,
        timerDurationMs: this.timerDurationMs,
      };
      try {
        w.send(JSON.stringify(snapshot));
      } catch {
        // socket closing; ignore
      }
    }
  }
}
