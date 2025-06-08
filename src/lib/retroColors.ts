// Per-column color identity, shared by the canvas + zone bands. Semantic where the
// meaning is known (start=green, stop=pink), else a palette spread by position.
const SEMANTIC: Record<string, string> = {
  start: "emerald", continue: "sky", stop: "rose",
  glad: "emerald", sad: "amber", mad: "rose",
  well: "emerald", didnt: "rose", actions: "violet",
  liked: "emerald", learned: "sky", lacked: "amber", longed: "violet",
  drop: "rose", add: "emerald", keep: "sky", improve: "violet",
  wind: "sky", anchor: "slate", rocks: "amber", island: "emerald",
  more: "emerald", less: "amber", plus: "emerald", delta: "violet",
  straw: "amber", sticks: "orange", bricks: "rose",
  throne: "amber", wall: "sky", walkers: "slate", dragons: "rose",
  assemble: "sky", stones: "violet", thanos: "rose", ultron: "slate",
  force: "sky", rebels: "amber", darkside: "slate", empire: "rose",
};
const PALETTE = ["amber", "sky", "emerald", "rose", "violet", "teal"];

export type ColC = { note: string; edge: string; dot: string; text: string };

const C: Record<string, ColC> = {
  amber: { note: "bg-amber-200", edge: "bg-amber-300", dot: "bg-amber-400", text: "text-amber-800" },
  emerald: { note: "bg-emerald-200", edge: "bg-emerald-300", dot: "bg-emerald-400", text: "text-emerald-800" },
  sky: { note: "bg-sky-200", edge: "bg-sky-300", dot: "bg-sky-400", text: "text-sky-800" },
  rose: { note: "bg-rose-200", edge: "bg-rose-300", dot: "bg-rose-400", text: "text-rose-800" },
  violet: { note: "bg-violet-200", edge: "bg-violet-300", dot: "bg-violet-400", text: "text-violet-800" },
  teal: { note: "bg-teal-200", edge: "bg-teal-300", dot: "bg-teal-400", text: "text-teal-800" },
  orange: { note: "bg-orange-200", edge: "bg-orange-300", dot: "bg-orange-400", text: "text-orange-800" },
  slate: { note: "bg-slate-200", edge: "bg-slate-300", dot: "bg-slate-400", text: "text-slate-700" },
};

export function columnColor(columnId: string, index: number): ColC {
  return C[SEMANTIC[columnId] ?? PALETTE[index % PALETTE.length]] ?? C.slate;
}
