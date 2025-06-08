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
  // Reveal-to-Resolution: the outliers' one-line "what are you pricing?", shown only after reveal.
  rationales: Record<string, string> | null;
  // Convergence trail: one entry per reveal of this story, oldest→newest. The spread shrinking.
  history: { lo: number; hi: number; n: number }[];
  // Live presence: member ids currently typing a rationale.
  typing: string[];
  // The locked outcome: the agreed estimate + the one-line reason. The artifact teams keep.
  decision: { value: string; note: string } | null;
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

/** Emoji a card can be reacted with (server-validated). */
export const RETRO_REACTIONS = ["👍", "❤️", "🎯", "🔥", "😂", "👀"] as const;

/** A retro card as a client sees it. Author is sent only when the room is non-anonymous. */
export type RetroCardView = {
  id: string;
  column: string;
  text: string;
  mine: boolean; // is this my card (so I can delete it)
  author: string | null; // author name when the room shows names; null when anonymous
  votes: number; // total dot-votes
  youVoted: boolean;
  reactions: { emoji: string; count: number; mine: boolean }[]; // only non-zero, in RETRO_REACTIONS order
  discussed: boolean; // already picked by the random picker → marked done, won't be re-picked
  order: number; // position within its column (drag-to-rearrange)
  groupId: string | null; // cards sharing a groupId are stacked into a cluster
};

export type RetroView = {
  template: string;
  columns: RetroColumn[];
  cards: RetroCardView[];
  votesLeft: number; // dot-votes you have left
  anonymous: boolean; // room setting: hide card authors (default true)
  spotlightId: string | null; // facilitator is focusing the room on one card
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
  | { t: "sync"; v: 1 }
  // estimation
  | { t: "vote"; v: 1; card: string }
  | { t: "reveal"; v: 1 }
  | { t: "restart"; v: 1 } // wipe the round (votes + rationales) and start fresh
  | { t: "reestimate"; v: 1 } // reopen voting but KEEP the story + rationales, so the room converges in place
  | { t: "setStory"; v: 1; story: string }
  | { t: "setDeck"; v: 1; deck: string }
  | { t: "setRationale"; v: 1; text: string } // an outlier explains their estimate
  | { t: "typing"; v: 1; on: boolean } // live presence while composing a rationale
  | { t: "lockDecision"; v: 1; value: string; note: string } // facilitator locks the outcome ("" value = unlock)
  // facilitation
  | { t: "claimFacilitator"; v: 1 }
  | { t: "endRoom"; v: 1 } // facilitator kills the room now
  | { t: "reportRoom"; v: 1 } // anyone; 2 distinct reports in 60s ends an abusive room
  // activity + retro
  // timer (a shared, facilitator-run countdown, available during any activity)
  | { t: "timerStart"; v: 1; seconds: number }
  | { t: "timerStop"; v: 1 }
  | { t: "switchActivity"; v: 1; activity: Activity }
  | { t: "retroSetTemplate"; v: 1; template: string }
  | { t: "retroAddCard"; v: 1; column: string; text: string }
  | { t: "retroVote"; v: 1; cardId: string }
  | { t: "retroDeleteCard"; v: 1; cardId: string }
  | { t: "retroReact"; v: 1; cardId: string; emoji: string } // toggle an emoji reaction
  | { t: "retroMoveCard"; v: 1; cardId: string; toColumn: string; toIndex: number } // drag to rearrange
  | { t: "retroEditCard"; v: 1; cardId: string; text: string } // edit a sticky's text in place
  | { t: "retroGroupCard"; v: 1; cardId: string; ontoCardId: string } // stack cardId onto onto's group
  | { t: "retroSetAnonymous"; v: 1; on: boolean } // facilitator: show/hide authors
  | { t: "retroSpotlight"; v: 1; cardId: string | null } // facilitator: focus everyone on a card
  | { t: "retroPickRandom"; v: 1 } // facilitator: spotlight a random not-yet-discussed card
  | { t: "retroResetDiscussed"; v: 1 } // facilitator: clear the discussed marks, start a fresh pass
  // picker
  | { t: "pickSetMode"; v: 1; mode: PickMode }
  | { t: "pickAddItem"; v: 1; text: string }
  | { t: "pickRemoveItem"; v: 1; index: number }
  | { t: "pickSpin"; v: 1 }
  | { t: "pickClear"; v: 1 };

/** server -> client. One full snapshot per change (Phase 1; patches come later). */
export type Snapshot = {
  t: "snapshot";
  v: 1;
  you: string;
  facilitator: string | null;
  members: Member[];
  activity: Activity;
  estimate: EstimateView;
  retro: RetroView;
  pick: PickView;
  /** shared countdown: epoch-ms when it ends, or null. Clients render the remaining time. */
  timerEndsAt: number | null;
  /** total length of the running timer in ms (for the progress bar); null when no timer */
  timerDurationMs: number | null;
};

/** server -> client: the room has expired and been deleted. */
export type EndedMsg = { t: "ended"; v: 1 };

export type ServerMsg = Snapshot | EndedMsg;
