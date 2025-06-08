// Each retro format is its own little world — not the same wall with a new heading.
// A theme gives the board its atmosphere (gradient + motif + a one-line scene-setter)
// so Sailboat feels like the sea and Three Little Pigs feels like the houses.

export type RetroTheme = {
  panel: string; // gradient + tone for the board surface
  motif: string; // big faint emoji watermark
  blurb: string; // scene-setting line under the title
};

const FALLBACK: RetroTheme = {
  panel: "from-slate-100 to-slate-50",
  motif: "🗒️",
  blurb: "Drop a sticky in the column it belongs to.",
};

export const RETRO_THEMES: Record<string, RetroTheme> = {
  ssc: {
    panel: "from-emerald-50 via-slate-50 to-rose-50",
    motif: "🚦",
    blurb: "Green to start, red to stop, blue to keep — like a traffic light for the team.",
  },
  msg: {
    panel: "from-rose-100 via-amber-50 to-emerald-100",
    motif: "🎭",
    blurb: "How did the sprint feel? Mad on the left, glad on the right.",
  },
  wlww: {
    panel: "from-emerald-50 via-slate-50 to-violet-50",
    motif: "📋",
    blurb: "What went well, what didn’t, and what we’ll actually do about it.",
  },
  fourls: {
    panel: "from-sky-50 via-slate-50 to-violet-50",
    motif: "💡",
    blurb: "Liked, Learned, Lacked, Longed for — the four Ls of the sprint.",
  },
  daki: {
    panel: "from-rose-50 via-slate-50 to-sky-50",
    motif: "⚙️",
    blurb: "Tune the machine: Drop, Add, Keep, Improve.",
  },
  sailboat: {
    panel: "from-sky-200 via-sky-50 to-amber-100",
    motif: "⛵",
    blurb: "Wind pushes us forward · anchors hold us back · rocks are the risks ahead · the island is the goal.",
  },
  starfish: {
    panel: "from-amber-50 via-orange-50 to-sky-100",
    motif: "🌟",
    blurb: "Keep, more, less, start, stop — five arms of the starfish.",
  },
  plusdelta: {
    panel: "from-emerald-50 via-slate-50 to-violet-50",
    motif: "➕",
    blurb: "What was a plus, and what would we change next time?",
  },
  kalm: {
    panel: "from-iris-50 via-slate-50 to-sky-50",
    motif: "🔊",
    blurb: "Keep, Add, do Less, do More — turn the dials.",
  },
  pigs: {
    panel: "from-amber-100 via-orange-50 to-rose-100",
    motif: "🐷",
    blurb: "Straw, sticks, or bricks — how solid is what we built?",
  },
};

export function retroTheme(template: string): RetroTheme {
  return RETRO_THEMES[template] ?? FALLBACK;
}
