import { WebSocket as ReconnectingWebSocket } from "partysocket";
import type { ClientMsg, ServerMsg, Snapshot, Activity, PickMode } from "../../shared/protocol";
import { PROTOCOL_VERSION } from "../../shared/protocol";

/** A server frame is only trusted if it's a versioned object with a string `t`. */
function isServerEnvelope(x: unknown): x is { t: string; v: number } {
  return (
    !!x &&
    typeof x === "object" &&
    typeof (x as { t?: unknown }).t === "string" &&
    typeof (x as { v?: unknown }).v === "number"
  );
}

/** Light shape check so a malformed snapshot can't crash the view on dispatch. */
function isSnapshot(x: ServerMsg): x is Snapshot {
  const s = x as Snapshot;
  return (
    x.t === "snapshot" &&
    Array.isArray(s.members) &&
    typeof s.activity === "string" &&
    !!s.estimate &&
    !!s.retro &&
    !!s.pick
  );
}

export type RoomClient = {
  join: (name: string) => void;
  // estimation
  vote: (card: string) => void;
  reveal: () => void;
  restart: () => void;
  reestimate: () => void;
  setStory: (story: string) => void;
  setDeck: (deck: string) => void;
  setCustomDeck: (cards: string[]) => void;
  setRationale: (text: string) => void;
  typing: (on: boolean) => void;
  cursor: (x: number, y: number, drag?: { cardId: string; x: number; y: number } | null) => void;
  emote: (emoji: string) => void;
  spotlightPick: () => void;
  lockDecision: (value: string, note: string) => void;
  estimateQueueAdd: (stories: string[]) => void;
  estimateQueueRemove: (index: number) => void;
  estimateQueueReorder: (from: number, to: number) => void;
  estimateNextStory: () => void;
  claimFacilitator: () => void;
  endRoom: () => void;
  reportRoom: () => void;
  timerStart: (seconds: number) => void;
  timerStop: () => void;
  // activity + retro
  switchActivity: (activity: Activity) => void;
  retroSetTemplate: (template: string) => void;
  retroAddCard: (column: string, text: string) => void;
  retroVote: (cardId: string) => void;
  retroDeleteCard: (cardId: string) => void;
  retroReact: (cardId: string, emoji: string) => void;
  retroMoveCard: (cardId: string, toColumn: string, toIndex: number) => void;
  retroMoveXY: (cardId: string, x: number, y: number) => void;
  retroEditCard: (cardId: string, text: string) => void;
  retroGroupCard: (cardId: string, ontoCardId: string) => void;
  retroSetAction: (cardId: string, on: boolean, owner?: string | null) => void;
  retroSetPhase: (phase: "brainstorm" | "group" | "vote" | "discuss") => void;
  pulseVote: (dim: string, value: number) => void;
  pulseReveal: () => void;
  pulseReset: () => void;
  pollSetMode: (mode: "open" | "choice" | "cloud") => void;
  pollSetMulti: (on: boolean) => void;
  pollSetPrompt: (prompt: string) => void;
  pollSubmit: (text: string) => void;
  pollVote: (id: string) => void;
  pollRemove: (id: string) => void;
  pollClear: () => void;
  retroSetAnonymous: (on: boolean) => void;
  retroSetBlind: (on: boolean) => void;
  retroSpotlight: (cardId: string | null) => void;
  retroPickRandom: () => void;
  retroResetDiscussed: () => void;
  // picker
  pickSetMode: (mode: PickMode) => void;
  pickAddItem: (text: string) => void;
  pickRemoveItem: (index: number) => void;
  pickSpin: () => void;
  pickClear: () => void;
  close: () => void;
};

// A stable per-tab id for this room, so a reconnect restores the same member
// (seat, facilitator baton, votes). sessionStorage = lives for the tab session,
// cleared when the tab closes · on-ethos with "no durable identity".
function clientIdFor(room: string): string {
  const key = `scrumlo-cid-${room}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return crypto.randomUUID(); // private mode / storage blocked
  }
}

export function createRoomClient(
  room: string,
  onSnapshot: (snapshot: Snapshot) => void,
  onStatus: (connected: boolean) => void,
  onEnded: () => void,
  onCursors?: (
    cursors: { id: string; name: string; x: number; y: number; drag?: { cardId: string; x: number; y: number } }[],
  ) => void,
  onEmote?: (emoji: string, from: string) => void,
  onSpotlight?: (name: string, by: string, nonce: number) => void,
  onSkew?: () => void, // server speaks a different protocol version (deploy in progress)
): RoomClient {
  const clientId = clientIdFor(room);
  const proto = location.protocol === "https:" ? "wss" : "ws";
  // partysocket auto-reconnects with backoff and fires "open" again each time.
  const ws = new ReconnectingWebSocket(
    `${proto}://${location.host}/ws?room=${encodeURIComponent(room)}`,
  );

  // Render-first: connect as a spectator immediately. We only send "hello" (become
  // a participant who can act) once the user picks a name. The name is persisted in
  // sessionStorage so a PAGE REFRESH auto-rejoins (the clientId restores the same
  // seat/votes/baton) instead of dropping the user back to spectating.
  const nameKey = `scrumlo-name-${room}`;
  let joinedName: string | null = (() => {
    try {
      return sessionStorage.getItem(nameKey);
    } catch {
      return null;
    }
  })();

  // Client-side flood guard (defense-in-depth; the server enforces the real limit).
  // A token bucket caps outgoing messages so a runaway loop or stuck key can't spam
  // the room; control messages (hello/sync/endRoom) always go through.
  const CAP = 50;
  const REFILL = 25; // tokens/sec
  let tokens = CAP;
  let tokenAt = performance.now();
  const send = (m: ClientMsg) => {
    if (ws.readyState !== ReconnectingWebSocket.OPEN) return;
    // Cursors are already rate-limited at the source and coalesced server-side, so
    // they bypass this bucket; otherwise a long drag could drain it and drop a vote.
    if (m.t !== "hello" && m.t !== "sync" && m.t !== "endRoom" && m.t !== "cursor") {
      const now = performance.now();
      tokens = Math.min(CAP, tokens + ((now - tokenAt) / 1000) * REFILL);
      tokenAt = now;
      if (tokens < 1) return; // drop excess
      tokens -= 1;
    }
    ws.send(JSON.stringify(m));
  };

  ws.addEventListener("open", () => {
    onStatus(true);
    // Hello if we've already named ourselves (incl. reconnects); otherwise ask for
    // a read-only snapshot so the room renders while we spectate.
    if (joinedName) send({ t: "hello", v: 1, name: joinedName, clientId });
    else send({ t: "sync", v: 1 });
  });
  ws.addEventListener("close", () => onStatus(false));
  ws.addEventListener("message", (e) => {
    try {
      const parsed: unknown = JSON.parse(e.data as string);
      if (!isServerEnvelope(parsed)) return; // ignore non-envelope frames
      if (parsed.v !== PROTOCOL_VERSION) {
        onSkew?.(); // a deploy bumped the protocol; ask the user to refresh
        return;
      }
      const msg = parsed as ServerMsg;
      if (msg.t === "snapshot") {
        if (isSnapshot(msg)) onSnapshot(msg); // a malformed snapshot can't crash the view
      } else if (msg.t === "cursors") onCursors?.(msg.cursors);
      else if (msg.t === "emote") onEmote?.(msg.emoji, msg.from);
      else if (msg.t === "spotlight") onSpotlight?.(msg.name, msg.by, msg.nonce);
      else if (msg.t === "ended") {
        onEnded();
        ws.close(); // stop reconnecting to a room that's gone
      }
    } catch {
      // ignore malformed frames
    }
  });

  return {
    join: (name) => {
      joinedName = name;
      try {
        sessionStorage.setItem(nameKey, name);
      } catch {
        /* private mode · still works for this session in memory */
      }
      send({ t: "hello", v: 1, name, clientId });
    },
    vote: (card) => send({ t: "vote", v: 1, card }),
    reveal: () => send({ t: "reveal", v: 1 }),
    restart: () => send({ t: "restart", v: 1 }),
    reestimate: () => send({ t: "reestimate", v: 1 }),
    setStory: (story) => send({ t: "setStory", v: 1, story }),
    setDeck: (deck) => send({ t: "setDeck", v: 1, deck }),
    setCustomDeck: (cards) => send({ t: "setCustomDeck", v: 1, cards }),
    setRationale: (text) => send({ t: "setRationale", v: 1, text }),
    typing: (on) => send({ t: "typing", v: 1, on }),
    cursor: (x, y, drag) => send({ t: "cursor", v: 1, x, y, drag: drag ?? null }),
    emote: (emoji) => send({ t: "emote", v: 1, emoji }),
    spotlightPick: () => send({ t: "spotlightPick", v: 1 }),
    lockDecision: (value, note) => send({ t: "lockDecision", v: 1, value, note }),
    estimateQueueAdd: (stories) => send({ t: "estimateQueueAdd", v: 1, stories }),
    estimateQueueRemove: (index) => send({ t: "estimateQueueRemove", v: 1, index }),
    estimateQueueReorder: (from, to) => send({ t: "estimateQueueReorder", v: 1, from, to }),
    estimateNextStory: () => send({ t: "estimateNextStory", v: 1 }),
    claimFacilitator: () => send({ t: "claimFacilitator", v: 1 }),
    endRoom: () => send({ t: "endRoom", v: 1 }),
    reportRoom: () => send({ t: "reportRoom", v: 1 }),
    timerStart: (seconds) => send({ t: "timerStart", v: 1, seconds }),
    timerStop: () => send({ t: "timerStop", v: 1 }),
    switchActivity: (activity) => send({ t: "switchActivity", v: 1, activity }),
    retroSetTemplate: (template) => send({ t: "retroSetTemplate", v: 1, template }),
    retroAddCard: (column, text) => send({ t: "retroAddCard", v: 1, column, text }),
    retroVote: (cardId) => send({ t: "retroVote", v: 1, cardId }),
    retroDeleteCard: (cardId) => send({ t: "retroDeleteCard", v: 1, cardId }),
    retroReact: (cardId, emoji) => send({ t: "retroReact", v: 1, cardId, emoji }),
    retroMoveCard: (cardId, toColumn, toIndex) =>
      send({ t: "retroMoveCard", v: 1, cardId, toColumn, toIndex }),
    retroMoveXY: (cardId, x, y) => send({ t: "retroMoveXY", v: 1, cardId, x, y }),
    retroEditCard: (cardId, text) => send({ t: "retroEditCard", v: 1, cardId, text }),
    retroGroupCard: (cardId, ontoCardId) => send({ t: "retroGroupCard", v: 1, cardId, ontoCardId }),
    retroSetAction: (cardId, on, owner) => send({ t: "retroSetAction", v: 1, cardId, on, owner }),
    retroSetPhase: (phase) => send({ t: "retroSetPhase", v: 1, phase }),
    pulseVote: (dim, value) => send({ t: "pulseVote", v: 1, dim, value }),
    pulseReveal: () => send({ t: "pulseReveal", v: 1 }),
    pulseReset: () => send({ t: "pulseReset", v: 1 }),
    pollSetMode: (mode) => send({ t: "pollSetMode", v: 1, mode }),
    pollSetMulti: (on) => send({ t: "pollSetMulti", v: 1, on }),
    pollSetPrompt: (prompt) => send({ t: "pollSetPrompt", v: 1, prompt }),
    pollSubmit: (text) => send({ t: "pollSubmit", v: 1, text }),
    pollVote: (id) => send({ t: "pollVote", v: 1, id }),
    pollRemove: (id) => send({ t: "pollRemove", v: 1, id }),
    pollClear: () => send({ t: "pollClear", v: 1 }),
    retroSetAnonymous: (on) => send({ t: "retroSetAnonymous", v: 1, on }),
    retroSetBlind: (on) => send({ t: "retroSetBlind", v: 1, on }),
    retroSpotlight: (cardId) => send({ t: "retroSpotlight", v: 1, cardId }),
    retroPickRandom: () => send({ t: "retroPickRandom", v: 1 }),
    retroResetDiscussed: () => send({ t: "retroResetDiscussed", v: 1 }),
    pickSetMode: (mode) => send({ t: "pickSetMode", v: 1, mode }),
    pickAddItem: (text) => send({ t: "pickAddItem", v: 1, text }),
    pickRemoveItem: (index) => send({ t: "pickRemoveItem", v: 1, index }),
    pickSpin: () => send({ t: "pickSpin", v: 1 }),
    pickClear: () => send({ t: "pickClear", v: 1 }),
    close: () => ws.close(),
  };
}
