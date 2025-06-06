// Single source of truth for the Ephem wire protocol.
// Imported by both the Worker (worker/) and the web client (src/).
// Versioned from commit #1 so old clients/exports never silently rot.

export const PROTOCOL_VERSION = 1 as const;

export type Member = {
  id: string;
  name: string;
};

/** A room runs one activity at a time; the facilitator switches between them. */
export type Activity = "estimate" | "retro" | "pick";

// ---- Estimation ----

export type Phase = "voting" | "revealed";

/** Built-in decks. Card values are display strings; "?" and "☕" are non-numeric. */
export const DECKS: Record<string, string[]> = {
  fib: ["0", "1", "2", "3", "5", "8", "13", "21", "?", "☕"],
  short: ["0", "½", "1", "2", "3", "5", "8", "13", "20", "?", "☕"],
  tshirt: ["XS", "S", "M", "L", "XL", "?", "☕"],
  modfib: ["0", "½", "1", "2", "3", "5", "8", "13", "20", "40", "100", "?", "☕"],
  powers: ["1", "2", "4", "8", "16", "32", "64", "?", "☕"],
  tfb: ["XS", "S", "M", "L", "XL", "XXL", "?", "☕"],
};

export const DECK_LABELS: Record<string, string> = {
  fib: "Fibonacci",
  short: "Short Fib",
  tshirt: "T-shirt",
  modfib: "Mod. Fibonacci",
  powers: "Powers of 2",
  tfb: "T-shirt+",
};

/** What a client sees of the estimation activity (redacted server-side). */
export type EstimateView = {
  story: string;
  deck: string; // key into DECKS
  phase: Phase;
  voted: string[]; // member ids who have voted (no values before reveal)
  yourVote: string | null; // your own vote (so your card shows selected)
  votes: Record<string, string> | null; // member id -> card, only once revealed
};

// ---- Retro ----

export type RetroColumn = { id: string; title: string; emoji: string };

export const RETRO_TEMPLATES: Record<string, { label: string; columns: RetroColumn[] }> = {
  ssc: {
    label: "Start / Stop / Continue",
    columns: [
      { id: "start", title: "Start", emoji: "🟢" },
      { id: "stop", title: "Stop", emoji: "🔴" },
      { id: "continue", title: "Continue", emoji: "🔵" },
    ],
  },
  msg: {
    label: "Mad / Sad / Glad",
    columns: [
      { id: "mad", title: "Mad", emoji: "😠" },
      { id: "sad", title: "Sad", emoji: "😕" },
      { id: "glad", title: "Glad", emoji: "😄" },
    ],
  },
  wlww: {
    label: "Well / Didn't / Actions",
    columns: [
      { id: "well", title: "Went Well", emoji: "✅" },
      { id: "didnt", title: "Didn’t Go Well", emoji: "⚠️" },
      { id: "actions", title: "Action Items", emoji: "🎯" },
    ],
  },
  fourls: {
    label: "4Ls",
    columns: [
      { id: "liked", title: "Liked", emoji: "👍" },
      { id: "learned", title: "Learned", emoji: "💡" },
      { id: "lacked", title: "Lacked", emoji: "🧩" },
      { id: "longed", title: "Longed For", emoji: "🌱" },
    ],
  },
  daki: {
    label: "Drop / Add / Keep / Improve",
    columns: [
      { id: "drop", title: "Drop", emoji: "🗑️" },
      { id: "add", title: "Add", emoji: "➕" },
      { id: "keep", title: "Keep", emoji: "📌" },
      { id: "improve", title: "Improve", emoji: "🔧" },
    ],
  },
  sailboat: {
    label: "Sailboat",
    columns: [
      { id: "wind", title: "Wind (helps)", emoji: "💨" },
      { id: "anchor", title: "Anchor (holds back)", emoji: "⚓" },
      { id: "rocks", title: "Rocks (risks)", emoji: "🪨" },
      { id: "island", title: "Island (goal)", emoji: "🏝️" },
    ],
  },
  starfish: {
    label: "Starfish",
    columns: [
      { id: "keep", title: "Keep Doing", emoji: "📌" },
      { id: "more", title: "More Of", emoji: "⬆️" },
      { id: "less", title: "Less Of", emoji: "⬇️" },
      { id: "start", title: "Start", emoji: "🟢" },
      { id: "stop", title: "Stop", emoji: "🔴" },
    ],
  },
  plusdelta: {
    label: "Plus / Delta",
    columns: [
      { id: "plus", title: "Plus", emoji: "➕" },
      { id: "delta", title: "Delta", emoji: "🔺" },
    ],
  },
  kalm: {
    label: "KALM",
    columns: [
      { id: "keep", title: "Keep", emoji: "🤝" },
      { id: "add", title: "Add", emoji: "➕" },
      { id: "less", title: "Less", emoji: "🔉" },
      { id: "more", title: "More", emoji: "🔊" },
    ],
  },
  pigs: {
    label: "Three Little Pigs",
    columns: [
      { id: "straw", title: "House of Straw", emoji: "🌾" },
      { id: "sticks", title: "House of Sticks", emoji: "🪵" },
      { id: "bricks", title: "House of Bricks", emoji: "🧱" },
    ],
  },
};

export const RETRO_VOTE_BUDGET = 5;

/** A retro card as a client sees it — author is NEVER sent (anonymity by default). */
export type RetroCardView = {
  id: string;
  column: string;
  text: string;
  mine: boolean; // is this my card (so I can delete it)
  votes: number; // total dot-votes
  youVoted: boolean;
};

export type RetroView = {
  template: string;
  columns: RetroColumn[];
  cards: RetroCardView[];
  votesLeft: number; // dot-votes you have left
};

// ---- Picker (the facilitator's "wheel of names") ----

export type PickMode = "person" | "order" | "list";

export type PickView = {
  mode: PickMode;
  items: string[]; // candidates for "list" mode
  result: string[]; // [] = nothing yet; 1 for person/list; N (ordered) for order
  nonce: number; // bumps on each spin so the client re-runs its reveal animation
};

// ---- Messages ----

/** client -> server */
export type ClientMsg =
  | { t: "hello"; v: 1; name: string; clientId: string }
  // estimation
  | { t: "vote"; v: 1; card: string }
  | { t: "reveal"; v: 1 }
  | { t: "restart"; v: 1 }
  | { t: "setStory"; v: 1; story: string }
  | { t: "setDeck"; v: 1; deck: string }
  // activity + retro
  | { t: "switchActivity"; v: 1; activity: Activity }
  | { t: "retroSetTemplate"; v: 1; template: string }
  | { t: "retroAddCard"; v: 1; column: string; text: string }
  | { t: "retroVote"; v: 1; cardId: string }
  | { t: "retroDeleteCard"; v: 1; cardId: string }
  // picker
  | { t: "pickSetMode"; v: 1; mode: PickMode }
  | { t: "pickAddItem"; v: 1; text: string }
  | { t: "pickRemoveItem"; v: 1; index: number }
  | { t: "pickSpin"; v: 1 }
  | { t: "pickClear"; v: 1 };

/** server -> client. One full snapshot per change (Phase 1; patches come later). */
export type ServerMsg = {
  t: "snapshot";
  v: 1;
  you: string;
  facilitator: string | null;
  members: Member[];
  activity: Activity;
  estimate: EstimateView;
  retro: RetroView;
  pick: PickView;
};
