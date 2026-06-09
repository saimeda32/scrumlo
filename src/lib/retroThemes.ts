// Each retro format is its own world. A theme gives the board its mood (an accent
// glow), and a one-line scene-setter. The visual mark is drawn in RetroGlyph (custom,
// not emoji). `motif` stays for small contextual chips (e.g. the format picker).

export type RetroTheme = {
  glow: string; // accent hex for the board's color wash + glyph tint
  motif: string; // small emoji used only in compact chips
  blurb: string; // scene-setting line under the title
};

const FALLBACK: RetroTheme = {
  glow: "#94a3b8",
  motif: "🗒️",
  blurb: "Drop a sticky in the column it belongs to.",
};

export const RETRO_THEMES: Record<string, RetroTheme> = {
  ssc: { glow: "#34d399", motif: "🚦", blurb: "Green to go, red to halt, blue to hold the line." },
  msg: { glow: "#fbbf24", motif: "🎭", blurb: "How did the sprint feel? Mad on the left, glad on the right." },
  wlww: { glow: "#34d399", motif: "📋", blurb: "What worked, what didn’t, and what we’ll actually do next." },
  fourls: { glow: "#38bdf8", motif: "💡", blurb: "Liked, Learned, Lacked, Longed for. The four Ls." },
  daki: { glow: "#38bdf8", motif: "⚙️", blurb: "Tune the machine: Drop, Add, Keep, Improve." },
  sailboat: {
    glow: "#38bdf8",
    motif: "⛵",
    blurb: "Wind moves us, anchors hold us, rocks are the risk, the island is the goal.",
  },
  starfish: { glow: "#fbbf24", motif: "🌟", blurb: "Keep, more, less, start, stop. Five arms, one team." },
  plusdelta: { glow: "#34d399", motif: "➕", blurb: "What was a plus, and what would you change?" },
  kalm: { glow: "#818cf8", motif: "🔊", blurb: "Keep, Add, Less, More. Turn the dials." },
  pigs: { glow: "#fb923c", motif: "🐷", blurb: "Straw, sticks, or bricks. How solid is what we built?" },
  got: {
    glow: "#60a5fa",
    motif: "🐉",
    blurb: "Winter is coming. Hold the wall, name the walkers, count your dragons.",
  },
  avengers: {
    glow: "#f87171",
    motif: "🦸",
    blurb: "Earth’s mightiest sprint. What we assembled, what powered us, our Thanos.",
  },
  starwars: {
    glow: "#818cf8",
    motif: "✨",
    blurb: "The Force with us, the rebellion to start, the Dark Side to drop.",
  },
  roadmap: {
    glow: "#6366f1",
    motif: "🗺️",
    blurb: "Plan it out: Now, Next, Later, Someday. Drag to group, dot-vote priorities, export.",
  },
};

export function retroTheme(template: string): RetroTheme {
  return RETRO_THEMES[template] ?? FALLBACK;
}
