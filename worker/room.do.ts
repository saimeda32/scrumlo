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
  RetroPhase,
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
const MAX_CONNECTIONS = 60; // hard cap on concurrent sockets per room (DoS guard; targets ~20)

/** Numeric value of a deck card, or null for ?/☕/t-shirt sizes. "½" → 0.5. */
function cardToNum(card: string): number | null {
  if (card === "½") return 0.5;
  const n = Number(card);
  return Number.isFinite(n) ? n : null;
}

type EstimateState = {
  story: string;
  deck: string;
  customDeck: string[]; // card values when deck === "custom"
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
  action?: boolean; // promoted to an action item
  owner?: string | null; // action-item owner, if assigned
  x: number; // free position on the canvas (board coords)
  y: number;
};

type RetroState = {
  template: string;
  cards: RetroCard[];
  anonymous: boolean; // hide authors (default true)
  spotlightId: string | null; // facilitator focusing the room on a card
  discussed: string[]; // card ids the random picker has already surfaced
  phase: RetroPhase; // facilitated phase (brainstorm hides others' notes)
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
    customDeck: [],
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
  private cursors = new Map<string, { x: number; y: number; drag?: { cardId: string; x: number; y: number } }>();
  private cursorTimer: number | null = null; // coalesces cursor fan-out to ~1 send / 50ms
  private lastActivityAt = Date.now(); // for idle-TTL; in-memory (hibernation resets it, which is fine)
  private buckets = new Map<string, { t: number; at: number }>(); // per-member token bucket (flood guard)
  private departed: Record<string, number> = {}; // memberId -> left-at; votes pruned after grace (durable, survives hibernation)
  private retro: RetroState = {
    template: "ssc",
    cards: [],
    anonymous: true,
    spotlightId: null,
    discussed: [],
    phase: "brainstorm",
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
        this.estimate.customDeck ??= [];
      }
      const r = await ctx.storage.get<RetroState>("retro");
      if (r) {
        this.retro = r;
        this.retro.anonymous ??= true; // tolerate state from before authorship/reactions
        this.retro.phase ??= "brainstorm";
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
      this.departed = (await ctx.storage.get<Record<string, number>>("departed")) ?? {};
      this.lastActivityAt = (await ctx.storage.get<number>("lastActivityAt")) ?? Date.now();
    });
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put("estimate", this.estimate);
    await this.ctx.storage.put("retro", this.retro);
    await this.ctx.storage.put("pick", this.pick);
    await this.ctx.storage.put("clients", this.clients);
    await this.ctx.storage.put("activity", this.activity);
    await this.ctx.storage.put("departed", this.departed);
    await this.ctx.storage.put("lastActivityAt", this.lastActivityAt);
    if (this.timerEndsAt === null) await this.ctx.storage.delete("timerEndsAt");
    else await this.ctx.storage.put("timerEndsAt", this.timerEndsAt);
    if (this.timerDurationMs === null) await this.ctx.storage.delete("timerDurationMs");
    else await this.ctx.storage.put("timerDurationMs", this.timerDurationMs);
    if (this.facilitatorId === null) await this.ctx.storage.delete("facilitator");
    else await this.ctx.storage.put("facilitator", this.facilitatorId);
  }

  async fetch(_request: Request): Promise<Response> {
    // Member cap: refuse new connections past a sane room size so one actor can't
    // open thousands of sockets to exhaust a room's Durable Object.
    if (this.ctx.getWebSockets().length >= MAX_CONNECTIONS) {
      return new Response("room is full", { status: 503 });
    }
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

    // Flood guard: a participant on a shared link can't hammer the room. A token
    // bucket (burst 60, refill 30/s) comfortably covers cursors + real interaction
    // but throttles a griefer spamming addCard/vote/spin.
    if (me && !this.allow(me.id)) return;

    // Live cursors: high-frequency + ephemeral, so they bypass the persist/snapshot
    // path entirely and fan out as a tiny dedicated message.
    if (msg.t === "cursor") {
      if (!me) return;
      const drag =
        msg.drag && typeof msg.drag.cardId === "string"
          ? { cardId: msg.drag.cardId, x: Math.round(Number(msg.drag.x) || 0), y: Math.round(Number(msg.drag.y) || 0) }
          : undefined;
      this.cursors.set(me.id, { x: Math.round(Number(msg.x) || 0), y: Math.round(Number(msg.y) || 0), drag });
      this.scheduleCursorFlush();
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
        // They're back within the grace window — cancel any pending vote prune.
        if (this.departed[memberId] !== undefined) {
          delete this.departed[memberId];
          await this.ctx.storage.put("departed", this.departed);
        }
        break;
      }

      // ---- estimation ----
      case "vote": {
        if (!me) return;
        if (this.estimate.phase !== "voting") return;
        const deck = this.deckCards();
        if (!deck.includes(msg.card)) return;
        this.estimate.votes[me.id] = msg.card;
        this.maybeAutoReveal();
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
      case "estimateQueueRemove": {
        if (!this.isFacilitator(me)) return;
        const i = Math.trunc(Number(msg.index));
        if (i >= 0 && i < this.estimate.queue.length) this.estimate.queue.splice(i, 1);
        break;
      }
      case "estimateQueueReorder": {
        if (!this.isFacilitator(me)) return;
        const from = Math.trunc(Number(msg.from));
        const to = Math.trunc(Number(msg.to));
        const q = this.estimate.queue;
        if (from >= 0 && from < q.length && to >= 0 && to < q.length && from !== to) {
          const [moved] = q.splice(from, 1);
          q.splice(to, 0, moved);
        }
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
        this.estimate.story = String(msg.story ?? "").trim().slice(0, 200);
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
      case "setCustomDeck": {
        if (!this.isFacilitator(me)) return;
        const cards = (Array.isArray(msg.cards) ? msg.cards : [])
          .map((s) => String(s ?? "").trim().slice(0, 6))
          .filter(Boolean);
        const unique = [...new Set(cards)].slice(0, 16);
        if (unique.length < 2) return; // a deck needs at least two choices
        this.estimate.customDeck = unique;
        this.estimate.deck = "custom";
        this.estimate.votes = {};
        this.estimate.rationales = {};
        this.estimate.history = [];
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
        // Only take the baton when no facilitator is currently PRESENT — prevents an
        // attacker from wresting control from an active facilitator and then ending or
        // redirecting the room. A real handoff still happens automatically on leave.
        const present = this.membersFrom(this.ctx.getWebSockets());
        if (this.facilitatorId !== null && present.some((m) => m.id === this.facilitatorId)) return;
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
        // End only when ~30% of currently-PRESENT members agree (floor of 2), so a
        // couple of throwaway tabs can't nuke a meeting full of real people, but a
        // genuine chunk of the room still can.
        const present = this.membersFrom(this.ctx.getWebSockets());
        const presentIds = new Set(present.map((m) => m.id));
        this.reports = this.reports.filter((r) => presentIds.has(r.id));
        const threshold = Math.max(2, Math.ceil(present.length * 0.3));
        if (this.reports.length >= threshold) await this.terminate();
        return;
      }

      // ---- shared timer (facilitator-run countdown) ----
      case "timerStart": {
        if (!this.isFacilitator(me)) return;
        const secs = Math.max(5, Math.min(60 * 60, Math.floor(Number(msg.seconds) || 0)));
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
        this.retro.phase = "brainstorm"; // a fresh board starts a fresh facilitation
        break;
      }
      case "retroSetPhase": {
        if (!this.isFacilitator(me)) return;
        if (!["brainstorm", "group", "vote", "discuss"].includes(msg.phase)) return;
        this.retro.phase = msg.phase as RetroPhase;
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
        // During blind brainstorm you can only move your OWN notes (others' are masked).
        if (this.retro.phase === "brainstorm" && card.authorId !== me.id) return;
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
        if (this.retro.phase === "brainstorm" && card.authorId !== me.id) return;
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
        if (this.retro.phase === "brainstorm") return; // no grouping masked notes
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
        // Snap the dropped sticky into a tidy cascade on top of its new group so
        // the cluster reads as a stack on the free canvas, not a random overlap.
        const stackN = this.retro.cards.filter((c) => c.groupId === gid && c.id !== card.id).length;
        card.x = Math.round(onto.x + 16 * stackN);
        card.y = Math.round(onto.y + 16 * stackN);
        this.dissolveSingletonGroups(wasGroup);
        break;
      }
      case "retroSetAction": {
        // Promote/demote a sticky as an action item, with an optional owner. This
        // is the one artifact that outlives the room (it lands in the export).
        if (!me) return;
        const card = this.retro.cards.find((c) => c.id === msg.cardId);
        if (!card) return;
        card.action = !!msg.on;
        if (!card.action) card.owner = null;
        else if (msg.owner !== undefined) card.owner = (String(msg.owner ?? "").trim().slice(0, 40)) || null;
        break;
      }
      case "retroVote": {
        if (!me) return;
        const card = this.retro.cards.find((c) => c.id === msg.cardId);
        if (!card) return;
        const i = card.voters.indexOf(me.id);
        if (i >= 0) {
          card.voters.splice(i, 1); // toggle off (always allowed, e.g. to reclaim a dot)
        } else {
          if (this.retro.phase !== "vote") return; // dots are only cast in the vote phase
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
        if (this.retro.phase === "brainstorm") return; // notes are masked — nothing to spotlight
        if (msg.cardId === null) this.retro.spotlightId = null;
        else if (this.retro.cards.some((c) => c.id === msg.cardId)) this.retro.spotlightId = msg.cardId;
        break;
      }
      case "retroPickRandom": {
        // Discuss cards in random order, each once — picked → spotlight it + mark discussed.
        if (!this.isFacilitator(me)) return;
        if (this.retro.phase === "brainstorm") return; // can't surface a masked note
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
    this.lastActivityAt = Date.now(); // durable idle clock (persisted in persist())
    await this.persist();
    await this.broadcast();
    await this.armAlarm();
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const gone = ws.deserializeAttachment() as Member | null;
    if (gone) {
      this.cursors.delete(gone.id);
      this.buckets.delete(gone.id);
      // Record the departure durably; the alarm prunes their votes if they don't
      // return within the grace window (survives hibernation, unlike a setTimeout).
      this.departed[gone.id] = Date.now();
      await this.ctx.storage.put("departed", this.departed);
    }
    // Their leaving may complete an estimate round (everyone still here has voted).
    this.maybeAutoReveal(ws);
    await this.persist();
    await this.broadcast(ws);
    this.broadcastCursors(); // their cursor disappears for everyone
    await this.armAlarm();
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.broadcast(ws);
  }

  /** Auto-reveal once every present member has voted (a real group, not a solo). */
  private maybeAutoReveal(exclude?: WebSocket): void {
    if (this.estimate.phase !== "voting") return;
    const present = this.membersFrom(this.ctx.getWebSockets().filter((w) => w !== exclude));
    if (present.length >= 2 && present.every((m) => this.estimate.votes[m.id] !== undefined)) {
      this.recordReveal();
    }
  }

  /** Drop a departed member's votes/rationales/reactions. Returns whether anything changed. */
  private pruneMember(id: string): boolean {
    let changed = false;
    if (this.estimate.votes[id] !== undefined) {
      delete this.estimate.votes[id];
      changed = true;
    }
    if (this.estimate.rationales[id] !== undefined) {
      delete this.estimate.rationales[id];
      changed = true;
    }
    for (const c of this.retro.cards) {
      const vi = c.voters.indexOf(id);
      if (vi >= 0) {
        c.voters.splice(vi, 1);
        changed = true;
      }
      for (const e of Object.keys(c.reactions)) {
        const ri = c.reactions[e].indexOf(id);
        if (ri >= 0) {
          c.reactions[e].splice(ri, 1);
          changed = true;
        }
      }
    }
    return changed;
  }

  /** Set the storage alarm to the earliest pending deadline (idle TTL, empty grace, or a prune). */
  private async armAlarm(): Promise<void> {
    let next: number;
    if (this.ctx.getWebSockets().length === 0) {
      next = Date.now() + EMPTY_GRACE_MS;
    } else {
      next = this.lastActivityAt + IDLE_MS;
      for (const at of Object.values(this.departed)) next = Math.min(next, at + EMPTY_GRACE_MS);
    }
    await this.ctx.storage.setAlarm(next);
  }

  /**
   * Durable alarm: prune departed members past grace, end empty/idle rooms. Re-checks
   * reality rather than trusting the alarm (an empty room always dies; idle is measured
   * against the persisted lastActivityAt so it survives hibernation).
   */
  async alarm(): Promise<void> {
    if (this.ctx.getWebSockets().length === 0) {
      await this.terminate();
      return;
    }
    const now = Date.now();
    const presentIds = new Set(this.membersFrom(this.ctx.getWebSockets()).map((m) => m.id));
    let changed = false;
    for (const [id, at] of Object.entries(this.departed)) {
      if (presentIds.has(id)) {
        delete this.departed[id]; // they came back
      } else if (now - at >= EMPTY_GRACE_MS) {
        if (this.pruneMember(id)) changed = true;
        delete this.departed[id];
      }
    }
    if (now - this.lastActivityAt >= IDLE_MS) {
      await this.terminate();
      return;
    }
    if (changed) {
      this.maybeAutoReveal();
      await this.persist();
      await this.broadcast();
    } else {
      await this.ctx.storage.put("departed", this.departed);
    }
    await this.armAlarm();
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
    await this.ctx.storage.deleteAlarm(); // don't let a stale alarm fire on a reborn DO
    await this.ctx.storage.deleteAll(); // no DB residue; the room is gone
  }

  // ---- helpers ----

  private isFacilitator(me: Member | null): boolean {
    return !!me && me.id === this.facilitatorId;
  }

  /** The active deck's card values — a built-in or the facilitator's custom sequence. */
  private deckCards(): string[] {
    if (this.estimate.deck === "custom" && this.estimate.customDeck.length) return this.estimate.customDeck;
    return DECKS[this.estimate.deck] ?? DECKS.fib;
  }

  /** Token bucket per member: returns false (drop) when the bucket is empty. */
  private allow(id: string): boolean {
    const CAP = 60;
    const REFILL = 30; // tokens per second
    const now = Date.now();
    const b = this.buckets.get(id) ?? { t: CAP, at: now };
    b.t = Math.min(CAP, b.t + ((now - b.at) / 1000) * REFILL);
    b.at = now;
    if (b.t < 1) {
      this.buckets.set(id, b);
      return false;
    }
    b.t -= 1;
    this.buckets.set(id, b);
    return true;
  }

  /**
   * Coalesce cursor fan-out: many pointer messages can arrive within one frame, so
   * we flush at most once per ~50ms instead of broadcasting on every message. This
   * turns an N-senders × N-sockets storm into one batched send per tick.
   */
  private scheduleCursorFlush(): void {
    if (this.cursorTimer !== null) return;
    this.cursorTimer = setTimeout(() => {
      this.cursorTimer = null;
      this.broadcastCursors();
    }, 50) as unknown as number;
  }

  /** Fan out live cursors as a tiny dedicated message (never a full snapshot). */
  private broadcastCursors(): void {
    const sockets = this.ctx.getWebSockets();
    const nameById = new Map(this.membersFrom(sockets).map((m) => [m.id, m.name]));
    const cursors = [...this.cursors.entries()]
      .filter(([id]) => nameById.has(id))
      .map(([id, p]) => ({ id, name: nameById.get(id)!, x: p.x, y: p.y, ...(p.drag ? { drag: p.drag } : {}) }));
    // Send each socket everyone ELSE's cursor — never its own (a client should
    // see only the native OS pointer for itself, not a duplicated colored one).
    for (const w of sockets) {
      // Skip clients whose send buffer is already backed up — dropping a cursor
      // frame for a slow socket is harmless and keeps fast clients smooth.
      if (w.bufferedAmount > 512 * 1024) continue;
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
    // Dedupe by member id: duplicating a tab copies the sessionStorage clientId, so
    // two live sockets can resolve to the SAME member — count them once so presence,
    // the auto-reveal quorum, and picker odds aren't doubled.
    const byId = new Map<string, Member>();
    for (const w of sockets) {
      const m = w.deserializeAttachment() as Member | null;
      if (m && typeof m.id === "string" && !byId.has(m.id)) byId.set(m.id, m);
    }
    return [...byId.values()];
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

    // ---- SHARED work: computed ONCE per event, not once per socket ----
    // A 20-person room used to rebuild + stringify the whole room 20×; now the heavy,
    // identical-for-everyone parts are built once and only per-person fields are patched.
    const estimateShared = {
      story: this.estimate.story,
      deck: this.estimate.deck,
      customDeck: this.estimate.deck === "custom" ? this.estimate.customDeck : [],
      phase: this.estimate.phase,
      voted: votedIds,
      votes: revealed ? { ...this.estimate.votes } : null,
      rationales: Object.keys(this.estimate.rationales).length ? { ...this.estimate.rationales } : null,
      history: this.estimate.history,
      typing: [...this.typing],
      decision: this.estimate.decision,
      queue: this.estimate.queue,
      log: this.estimate.log,
    };

    const groupTotals = new Map<string, { votes: number; size: number }>();
    for (const c of this.retro.cards) {
      if (!c.groupId) continue;
      const g = groupTotals.get(c.groupId) ?? { votes: 0, size: 0 };
      g.votes += c.voters.length;
      g.size += 1;
      groupTotals.set(c.groupId, g);
    }

    // Base card data with the membership arrays kept alongside so the per-socket pass
    // is a cheap O(1) `.includes` rather than re-filtering reactions and re-counting.
    const baseCards = this.retro.cards.map((c) => ({
      id: c.id,
      column: c.column,
      text: c.text,
      authorId: c.authorId,
      // Anonymous hides authors — except in Discuss, where seeing who raised a theme
      // helps the conversation (names are revealed once voting's done).
      author:
        this.retro.anonymous && this.retro.phase !== "discuss" ? null : (nameById.get(c.authorId) ?? null),
      votes: c.voters.length,
      voters: c.voters,
      reactions: RETRO_REACTIONS.filter((e) => (c.reactions[e]?.length ?? 0) > 0).map((e) => ({
        emoji: e,
        count: c.reactions[e].length,
        members: c.reactions[e],
      })),
      discussed: this.retro.discussed.includes(c.id),
      order: c.order ?? 0,
      groupId: c.groupId ?? null,
      groupVotes: c.groupId ? (groupTotals.get(c.groupId)?.votes ?? c.voters.length) : c.voters.length,
      groupSize: c.groupId ? (groupTotals.get(c.groupId)?.size ?? 1) : 1,
      action: !!c.action,
      owner: c.owner ?? null,
      x: c.x ?? 0,
      y: c.y ?? 0,
    }));

    for (const w of sockets) {
      // me === null → a spectator (connected, no name yet). They still get a
      // read-only snapshot (you="") so the room renders before they commit a name.
      const me = w.deserializeAttachment() as Member | null;
      const meId = me?.id ?? null;

      const estimate: EstimateView = {
        ...estimateShared,
        yourVote: meId ? (this.estimate.votes[meId] ?? null) : null,
      };

      // Blind brainstorm: until the facilitator reveals, you only see your own
      // notes — everyone else's text/author/reactions are withheld at the SERVER
      // (not just hidden in CSS), so early ideas can't anchor the room.
      const blind = this.retro.phase === "brainstorm";
      let used = 0;
      const cards = baseCards.map((b) => {
        const masked = blind && b.authorId !== meId;
        const youVoted = meId ? b.voters.includes(meId) : false;
        if (youVoted) used++;
        return {
          id: b.id,
          column: b.column,
          text: masked ? "" : b.text,
          mine: meId ? b.authorId === meId : false,
          author: masked ? null : b.author,
          votes: b.votes,
          youVoted,
          reactions: masked
            ? []
            : b.reactions.map((r) => ({
                emoji: r.emoji,
                count: r.count,
                mine: meId ? r.members.includes(meId) : false,
              })),
          discussed: b.discussed,
          order: b.order,
          groupId: b.groupId,
          groupVotes: b.groupVotes,
          groupSize: b.groupSize,
          action: masked ? false : b.action,
          owner: masked ? null : b.owner,
          masked,
          x: b.x,
          y: b.y,
        };
      });

      const retro: RetroView = {
        template: this.retro.template,
        columns: tpl.columns,
        cards,
        votesLeft: meId ? RETRO_VOTE_BUDGET - used : RETRO_VOTE_BUDGET,
        anonymous: this.retro.anonymous,
        spotlightId: this.retro.spotlightId,
        phase: this.retro.phase,
      };

      const snapshot: ServerMsg = {
        t: "snapshot",
        v: 1,
        you: meId ?? "",
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
