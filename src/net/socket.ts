import { WebSocket as ReconnectingWebSocket } from "partysocket";
import type { ClientMsg, ServerMsg, Snapshot, Activity, PickMode } from "../../shared/protocol";

export type RoomClient = {
  join: (name: string) => void;
  // estimation
  vote: (card: string) => void;
  reveal: () => void;
  restart: () => void;
  reestimate: () => void;
  setStory: (story: string) => void;
  setDeck: (deck: string) => void;
  setRationale: (text: string) => void;
  typing: (on: boolean) => void;
  cursor: (x: number, y: number, drag?: { cardId: string; x: number; y: number } | null) => void;
  lockDecision: (value: string, note: string) => void;
  estimateQueueAdd: (stories: string[]) => void;
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
  retroSetAnonymous: (on: boolean) => void;
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
// cleared when the tab closes — on-ethos with "no durable identity".
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

  const send = (m: ClientMsg) => {
    if (ws.readyState === ReconnectingWebSocket.OPEN) ws.send(JSON.stringify(m));
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
      const msg = JSON.parse(e.data as string) as ServerMsg;
      if (msg.t === "snapshot") onSnapshot(msg);
      else if (msg.t === "cursors") onCursors?.(msg.cursors);
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
        /* private mode — still works for this session in memory */
      }
      send({ t: "hello", v: 1, name, clientId });
    },
    vote: (card) => send({ t: "vote", v: 1, card }),
    reveal: () => send({ t: "reveal", v: 1 }),
    restart: () => send({ t: "restart", v: 1 }),
    reestimate: () => send({ t: "reestimate", v: 1 }),
    setStory: (story) => send({ t: "setStory", v: 1, story }),
    setDeck: (deck) => send({ t: "setDeck", v: 1, deck }),
    setRationale: (text) => send({ t: "setRationale", v: 1, text }),
    typing: (on) => send({ t: "typing", v: 1, on }),
    cursor: (x, y, drag) => send({ t: "cursor", v: 1, x, y, drag: drag ?? null }),
    lockDecision: (value, note) => send({ t: "lockDecision", v: 1, value, note }),
    estimateQueueAdd: (stories) => send({ t: "estimateQueueAdd", v: 1, stories }),
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
    retroSetAnonymous: (on) => send({ t: "retroSetAnonymous", v: 1, on }),
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
