// Single source of truth for the Scrumlo wire protocol.
// Imported by both the Worker (worker/) and the web client (src/).
// Versioned from commit #1 so old clients/exports never silently rot.

export const PROTOCOL_VERSION = 1 as const;

export type Member = {
  id: string;
  name: string;
};

/** A room runs one activity at a time; the facilitator switches between them. */
export type Activity = "estimate" | "retro" | "pick" | "board" | "pulse" | "poll";

// ---- Poll / Q&A (Slido-lite): ask the room a question ----
// open   = Q&A: anyone submits a text answer, everyone upvotes, sorted by votes
// choice = facilitator defines options; people pick (single- or multi-select), bar results
// cloud  = one-word live word cloud
export type PollMode = "open" | "choice" | "cloud";
// A finished question, archived when the facilitator moves to the next one.
// Results are one unified shape across modes: cloud words, options, or answers,
// each with its count — ready for the UI and the markdown export as-is.
export type PollLogItem = { prompt: string; mode: PollMode; results: { text: string; count: number }[] };
export type PollView = {
  mode: PollMode;
  prompt: string;
  multi: boolean; // choice mode: allow picking more than one option
  // Blind mode: results stay server-side until the facilitator reveals, so early
  // answers can't anchor the room. While answering, non-facilitators get only
  // their OWN entries (so they can edit/remove) — never counts or the cloud.
  blind: boolean;
  phase: "answering" | "revealed"; // only meaningful while blind
  answered: number; // distinct people who have answered
  eligible: number; // present non-spectator members
  youAnswered: boolean;
  // open + choice: answers/options, with votes (sorted by votes desc)
  answers: { id: string; text: string; votes: number; youVoted: boolean; mine: boolean }[];
  // cloud mode: aggregated word frequencies
  cloud: { word: string; count: number }[];
  total: number; // how many submissions in total
  // Question queue: upcoming prompts are the facilitator's secret (others get only
  // the count, so questions can't be answered ahead); the log is for everyone.
  queue: string[];
  queueLen: number;
  log: PollLogItem[];
};

// ---- Pulse (team health check) ----
export const PULSE_DIMENSIONS = ["Morale", "Clarity", "Delivery", "Collaboration", "Fun"] as const;

/** Selectable health-check themes · each is a different five-question lens on the team. */
export const PULSE_THEMES: Record<string, { label: string; dims: string[] }> = {
  classic: { label: "Team health", dims: [...PULSE_DIMENSIONS] },
  sprint: { label: "Sprint health", dims: ["Pace", "Scope sanity", "Quality", "Focus", "Unblocked"] },
  vibes: { label: "Team vibes", dims: ["Energy", "Safety", "Trust", "Laughs", "Growth"] },
  remote: { label: "Remote check", dims: ["Connection", "Meetings", "Deep work", "Tooling", "Balance"] },
};
// Minimum fully-submitted people before a health check can be revealed, so a single
// person's scores can't be read straight off the aggregate.
export const PULSE_MIN_REVEAL = 2;

export type PulseView = {
  theme: string; // key into PULSE_THEMES
  dimensions: string[];
  phase: "voting" | "revealed";
  voted: string[]; // member ids who've rated every dimension
  yourVotes: Record<string, number> | null; // your dim -> 1..5 (null for spectators)
  // per-dimension aggregate, only once revealed
  results: { dim: string; avg: number; count: number; spread: number[] }[] | null;
};

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
  custom: "Custom deck",
};

/** What a client sees of the estimation activity (redacted server-side). */
export type EstimateView = {
  story: string;
  deck: string; // key into DECKS, or "custom"
  customDeck: string[]; // the card values when deck === "custom" (else [])
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
  // Backlog: stories queued next, and a log of ones already decided this session.
  queue: string[];
  log: { story: string; value: string; note: string }[];
};

// ---- Retro ----

export type RetroColumn = { id: string; title: string; emoji: string };

export const RETRO_TEMPLATES: Record<
  string,
  {
    label: string;
    columns: RetroColumn[];
    /** "free" = one open canvas (no column semantics) spanning `span` zone-widths. */
    kind?: "columns" | "free";
    span?: number;
    /** Starter cards dropped when the facilitator picks this format. */
    seeds?: { text: string; x: number; y: number }[];
  }
> = {
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
  // ---- pop-culture formats (same retro mechanics, more fun) ----
  got: {
    label: "Game of Thrones",
    columns: [
      { id: "throne", title: "Iron Throne", emoji: "👑" }, // wins we're proud of
      { id: "wall", title: "The Wall", emoji: "🧊" }, // what holds the line · keep
      { id: "walkers", title: "White Walkers", emoji: "🧟" }, // threats marching toward us
      { id: "dragons", title: "Dragons", emoji: "🐉" }, // our firepower · do more of
    ],
  },
  avengers: {
    label: "Avengers",
    columns: [
      { id: "assemble", title: "Assemble", emoji: "🦸" }, // what brought us together · wins
      { id: "stones", title: "Infinity Stones", emoji: "💎" }, // what powered us · keep
      { id: "thanos", title: "Thanos", emoji: "🫰" }, // the big blocker that snapped us
      { id: "ultron", title: "Ultron", emoji: "🤖" }, // what we built that backfired · stop
    ],
  },
  starwars: {
    label: "Star Wars",
    columns: [
      { id: "force", title: "The Force", emoji: "✨" }, // strengths with us
      { id: "rebels", title: "Rebellion", emoji: "🚀" }, // bold moves to start
      { id: "darkside", title: "Dark Side", emoji: "🌑" }, // temptations / bad habits · stop
      { id: "empire", title: "The Empire", emoji: "🪐" }, // blockers and risks
    ],
  },
  // Not a retro · a lightweight planning board. Same canvas: drop stickies, drag to
  // group, dot-vote priorities, export. Ephemeral roadmapping without a database.
  roadmap: {
    label: "Roadmap board",
    columns: [
      { id: "now", title: "Now", emoji: "🔥" },
      { id: "next", title: "Next", emoji: "➡️" },
      { id: "later", title: "Later", emoji: "🗓️" },
      { id: "someday", title: "Someday", emoji: "💭" },
    ],
  },
  // Free-canvas formats · one open band, stickies + connectors do the talking.
  mindmap: {
    label: "Mind map",
    kind: "free",
    span: 3,
    columns: [{ id: "canvas", title: "Mind map", emoji: "🧠" }],
    seeds: [{ text: "Central topic", x: 640, y: 360 }],
  },
  flow: {
    label: "Flowchart (lite)",
    kind: "free",
    span: 3,
    columns: [{ id: "canvas", title: "Flow", emoji: "🔀" }],
    seeds: [{ text: "Start", x: 110, y: 110 }],
  },
};

/** Board width of a template, in zone-widths (free formats span wider than their one column). */
export function retroSpanOf(tpl: { columns: RetroColumn[]; span?: number }): number {
  return tpl.span ?? tpl.columns.length;
}

export const RETRO_VOTE_BUDGET = 5;

/** Emoji a card can be reacted with (server-validated). */
export const RETRO_REACTIONS = ["👍", "❤️", "🎯", "🔥", "😂", "👀", "🎉", "💡", "🚀", "🤔", "😮", "💯"] as const;

/** Structured tags a card can carry (server-validated, max 3 per card). */
export const RETRO_TAGS = ["Priority", "Quick win", "Blocked", "Idea"] as const;
export const RETRO_MAX_TAGS = 3;

/** A retro card as a client sees it. Author is sent only when the room is non-anonymous. */
export type RetroCardView = {
  id: string;
  column: string;
  text: string;
  mine: boolean; // is this my card (so I can delete it)
  author: string | null; // author name when the room shows names; null when anonymous
  votes: number; // total dot-votes
  youVoted: boolean;
  reactions: { emoji: string; count: number; mine: boolean; who: string[] }[]; // who = reactor names ([] while anonymous/masked)
  tags: string[]; // structured labels from RETRO_TAGS (empty while masked)
  discussed: boolean; // already picked by the random picker → marked done, won't be re-picked
  order: number; // legacy column ordering
  groupId: string | null; // cards sharing a groupId are stacked into a cluster
  groupTitle: string | null; // cluster name (set for every member; rendered on the head card)
  groupVotes: number; // dot-votes summed across the whole cluster (== votes when ungrouped)
  groupSize: number; // number of cards in this cluster (1 when ungrouped)
  action: boolean; // promoted to an action item (a committed takeaway)
  owner: string | null; // who owns the action item, if assigned
  masked: boolean; // hidden during blind brainstorm (someone else's note, text withheld)
  x: number; // free position on the canvas (board coords)
  y: number;
};

/** Facilitated retro phases, stepped through in order. */
export type RetroPhase = "brainstorm" | "group" | "vote" | "discuss";
export const RETRO_PHASES: { id: RetroPhase; label: string; hint: string }[] = [
  { id: "brainstorm", label: "Brainstorm", hint: "Get the notes up. Toggle 🔒 Cards hidden for a blind round first if you want." },
  { id: "group", label: "Group", hint: "Drag similar notes together into clusters." },
  { id: "vote", label: "Vote", hint: "Spend your dots on the themes that matter most." },
  { id: "discuss", label: "Discuss", hint: "Work the top themes. Spotlight a card and capture action items." },
];

/** Canvas layout shared by client + server: zones are vertical bands of this width.
 *  Wide enough for two 220px stickies side by side (see CARD_W in RetroCanvas). */
export const RETRO_ZONE_W = 500;
export const RETRO_CANVAS_H = 1600;

/** A connector between two stickies (e.g. roadmap dependencies, mind-map branches). */
export type RetroEdge = { id: string; from: string; to: string };

export type RetroView = {
  template: string;
  columns: RetroColumn[];
  cards: RetroCardView[];
  edges: RetroEdge[]; // connectors; edges touching masked cards are withheld
  votesLeft: number; // dot-votes you have left
  anonymous: boolean; // room setting: hide card authors (default true)
  blind: boolean; // room setting: hide OTHERS' card bodies (default false; facilitator still sees all)
  spotlightId: string | null; // facilitator is focusing the room on one card
  phase: RetroPhase; // facilitated phase the room is in
};

// ---- Picker (the facilitator's "wheel of names") ----

export type PickMode = "person" | "order" | "list";

export type PickView = {
  mode: PickMode;
  items: string[]; // candidates for "list" mode
  result: string[]; // [] = nothing yet; 1 for person/list; N (ordered) for order
  nonce: number; // bumps on each spin so the client re-runs its reveal animation
  recent: string[]; // already picked this round (no-repeat), in pick order
};

// ---- Live floating reactions (Zoom-style) · ephemeral, work in any activity ----
export const EMOTES = ["👍", "❤️", "🎉", "😂", "🔥", "👏", "🤯", "🙌"] as const;

// ---- Messages ----

/** client -> server */
export type ClientMsg =
  | { t: "hello"; v: 1; name: string; clientId: string }
  | { t: "sync"; v: 1 }
  | { t: "emote"; v: 1; emoji: string } // live floating reaction, broadcast to everyone
  | { t: "spotlightPick"; v: 1 } // spin to pick a present person, on any screen (no tab switch)
  // estimation
  | { t: "vote"; v: 1; card: string }
  | { t: "reveal"; v: 1 }
  | { t: "restart"; v: 1 } // wipe the round (votes + rationales) and start fresh
  | { t: "reestimate"; v: 1 } // reopen voting but KEEP the story + rationales, so the room converges in place
  | { t: "setStory"; v: 1; story: string }
  | { t: "setDeck"; v: 1; deck: string }
  | { t: "setCustomDeck"; v: 1; cards: string[] } // facilitator defines a custom card sequence
  | { t: "setRationale"; v: 1; text: string } // an outlier explains their estimate
  | { t: "typing"; v: 1; on: boolean } // live presence while composing a rationale
  | { t: "lockDecision"; v: 1; value: string; note: string } // facilitator locks the outcome ("" value = unlock)
  | { t: "estimateQueueAdd"; v: 1; stories: string[] } // queue stories to estimate
  | { t: "estimateQueueRemove"; v: 1; index: number } // drop a queued story (typo/dupe)
  | { t: "estimateQueueReorder"; v: 1; from: number; to: number } // move a queued story up/down
  | { t: "estimateNextStory"; v: 1 } // log current decision, advance to the next story
  // live cursor position on the retro canvas; `drag` carries a sticky being moved
  // right now (live, pre-drop) so everyone sees it glide, not just jump on release.
  | { t: "cursor"; v: 1; x: number; y: number; drag?: { cardId: string; x: number; y: number } | null }
  // facilitation
  | { t: "claimFacilitator"; v: 1 }
  | { t: "handBaton"; v: 1; toId: string } // facilitator passes the role to a present member
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
  | { t: "retroTagCard"; v: 1; cardId: string; tag: string; on: boolean } // toggle a structured tag
  | { t: "retroRenameGroup"; v: 1; groupId: string; title: string } // rename a cluster
  | { t: "retroSort"; v: 1; by: "tag" | "votes" | "author" } // facilitator: gather cards into clusters by criterion
  | { t: "retroLinkCards"; v: 1; fromId: string; toId: string } // draw a connector between two stickies
  | { t: "retroUnlink"; v: 1; edgeId: string } // remove a connector
  | { t: "retroMoveCard"; v: 1; cardId: string; toColumn: string; toIndex: number } // legacy column move
  | { t: "retroMoveXY"; v: 1; cardId: string; x: number; y: number } // free-canvas placement
  | { t: "retroEditCard"; v: 1; cardId: string; text: string } // edit a sticky's text in place
  | { t: "retroGroupCard"; v: 1; cardId: string; ontoCardId: string } // stack cardId onto onto's group
  | { t: "retroSetAction"; v: 1; cardId: string; on: boolean; owner?: string | null } // promote a sticky to an action item
  | { t: "retroSetPhase"; v: 1; phase: RetroPhase } // facilitator steps the retro phase
  // pulse (health check)
  | { t: "pulseVote"; v: 1; dim: string; value: number }
  | { t: "pulseSetTheme"; v: 1; theme: string } // facilitator swaps the question set (resets votes)
  | { t: "pulseReveal"; v: 1 }
  | { t: "pulseReset"; v: 1 }
  // poll / Q&A
  | { t: "pollSetMode"; v: 1; mode: PollMode }
  | { t: "pollSetMulti"; v: 1; on: boolean } // choice mode: single- vs multi-select
  | { t: "pollSetPrompt"; v: 1; prompt: string }
  | { t: "pollSubmit"; v: 1; text: string }
  | { t: "pollVote"; v: 1; id: string }
  | { t: "pollRemove"; v: 1; id: string }
  | { t: "pollClear"; v: 1 }
  | { t: "pollSetBlind"; v: 1; on: boolean } // facilitator: hide results until reveal
  | { t: "pollReveal"; v: 1 } // facilitator: show the blind results to everyone
  | { t: "pollQueueAdd"; v: 1; prompt: string } // facilitator: queue an upcoming question
  | { t: "pollQueueRemove"; v: 1; index: number }
  | { t: "pollNext"; v: 1 } // facilitator: archive current results, load the next question
  | { t: "retroSetAnonymous"; v: 1; on: boolean } // facilitator: show/hide authors
  | { t: "retroSetBlind"; v: 1; on: boolean } // facilitator: hide/show other people's card bodies
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
  board: RetroView; // a separate planning board (roadmap) · same canvas, own cards
  pulse: PulseView; // team health check
  poll: PollView; // ask-the-room Q&A / word cloud
  pick: PickView;
  /** shared countdown: epoch-ms when it ends, or null. Clients render the remaining time. */
  timerEndsAt: number | null;
  /** total length of the running timer in ms (for the progress bar); null when no timer */
  timerDurationMs: number | null;
};

/** server -> client: the room has expired and been deleted. */
export type EndedMsg = { t: "ended"; v: 1 };

/** server -> client: lightweight live cursors (not a full snapshot, sent often). */
export type CursorsMsg = {
  t: "cursors";
  v: 1;
  cursors: {
    id: string;
    name: string;
    x: number;
    y: number;
    /** a sticky this person is dragging right now (board coords), if any */
    drag?: { cardId: string; x: number; y: number };
  }[];
};

/** server -> client: a live floating reaction someone sent (not a full snapshot). */
export type EmoteMsg = { t: "emote"; v: 1; emoji: string; from: string };
/** Broadcast when the facilitator passes the baton — clients play the coronation. */
export type BatonMsg = { t: "baton"; v: 1; fromName: string; toName: string };

/** server -> client: someone span the "pick a person" wheel. The server chose the
 *  winner fairly (server-authoritative), so every screen lands on the same name.
 *  `nonce` bumps per spin so a repeat winner still re-triggers the animation. */
export type SpotlightMsg = { t: "spotlight"; v: 1; name: string; by: string; nonce: number };

export type ServerMsg = Snapshot | EndedMsg | CursorsMsg | EmoteMsg | SpotlightMsg | BatonMsg;
