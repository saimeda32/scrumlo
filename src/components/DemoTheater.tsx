import { useEffect, useState } from "react";

// A self-playing hero: loops through a tiny live session — Estimate reveals,
// Retro stickies + a gliding cursor, then a Pick wheel with confetti. Pure
// CSS/SVG, no backend, remounts each act so the entrance animations replay.

const ACTS = ["Estimate", "Retro", "Pick"] as const;
const ACT_MS = 4600;

const SEATS = [
  { n: "Priya", v: "3", tone: "text-sky-600", bg: "bg-sky-50 dark:bg-sky-500/15" },
  { n: "Sai", v: "5", tone: "text-slate-600 dark:text-slate-300", bg: "bg-slate-50 dark:bg-white/10" },
  { n: "Dana", v: "8", tone: "text-slate-600 dark:text-slate-300", bg: "bg-slate-50 dark:bg-white/10" },
  { n: "Jo", v: "13", tone: "text-rose-600", bg: "bg-rose-50 dark:bg-rose-500/15" },
];

const STICKIES = [
  { t: "Shipped the new estimate flow 🎉", c: "bg-emerald-200/90 text-emerald-900", x: 6, y: 8, r: -3 },
  { t: "Standup ran long again", c: "bg-amber-200/90 text-amber-900", x: 120, y: 30, r: 2 },
  { t: "Pair more on the worker", c: "bg-sky-200/90 text-sky-900", x: 54, y: 96, r: -1.5 },
];

export function DemoTheater() {
  const [act, setAct] = useState(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setAct((a) => {
        const next = (a + 1) % ACTS.length;
        if (next === 0) setCycle((c) => c + 1);
        return next;
      });
    }, ACT_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative">
      <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-tr from-iris-200/40 to-violet-200/30 blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-iris-900/10 dark:border-white/10 dark:bg-[#14141b] dark:shadow-black/40">
        {/* chrome + act tabs */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 dark:border-white/10">
          <span className="flex gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          </span>
          <span className="ml-1 flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-emerald-500" /> live
          </span>
          <div className="ml-auto flex items-center gap-1">
            {ACTS.map((label, i) => (
              <span
                key={label}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold transition ${
                  i === act
                    ? "bg-iris-600 text-white"
                    : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* progress bar for the current act */}
        <div className="h-0.5 bg-slate-100 dark:bg-white/10">
          <div
            key={`${act}-${cycle}`}
            className="h-full bg-iris-500"
            style={{ animation: `scrumlo-draw ${ACT_MS}ms linear both`, transformOrigin: "left center" }}
          />
        </div>

        {/* stage — fixed height so the layout never jumps */}
        <div key={`${act}-${cycle}`} className="relative h-[260px] p-4">
          {act === 0 && <EstimateAct />}
          {act === 1 && <RetroAct />}
          {act === 2 && <PickAct />}
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
        A real session, on a loop · estimate, retro, pick — then poof.
      </p>
    </div>
  );
}

function EstimateAct() {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Add CSV export to billing</span>
        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">↔ spread 3–13</span>
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {SEATS.map((s, i) => (
          <div
            key={s.n}
            className="animate-flip rounded-xl border border-slate-200 bg-white p-2 text-center shadow-sm dark:border-white/10 dark:bg-white/5"
            style={{ animationDelay: `${i * 220}ms` }}
          >
            <div className={`grid place-items-center rounded-lg py-2 text-2xl font-extrabold ${s.bg} ${s.tone}`}>
              {s.v}
            </div>
            <div className="mt-1.5 truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">{s.n}</div>
          </div>
        ))}
      </div>
      <div
        className="animate-rise mt-auto flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500 dark:bg-white/5 dark:text-slate-400"
        style={{ animationDelay: "1.1s" }}
      >
        <span>
          avg <b className="text-slate-700 dark:text-slate-200">7.25</b> · two camps forming
        </span>
        <span className="rounded-md bg-iris-600 px-2 py-1 text-[10px] font-semibold text-white">↻ Re-estimate</span>
      </div>
    </div>
  );
}

function RetroAct() {
  return (
    <div className="dot-grid relative h-full overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
      {STICKIES.map((s, i) => (
        <div
          key={i}
          className="animate-pop absolute w-[120px] rounded-md px-2.5 py-2 text-[11px] font-semibold leading-snug shadow-md"
          style={{ left: s.x, top: s.y, rotate: `${s.r}deg`, animationDelay: `${i * 280}ms` }}
        >
          <div className={`absolute inset-0 -z-10 rounded-md ${s.c}`} />
          <span className={s.c.split(" ").slice(1).join(" ")}>{s.t}</span>
          <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/70 px-1.5 text-[9px] font-bold text-slate-700">
            ▲ {3 + i}
          </div>
        </div>
      ))}
      {/* a teammate's live cursor gliding across the board */}
      <div className="animate-glide absolute left-0 top-0">
        <svg width="18" height="18" viewBox="0 0 20 20" className="text-violet-500" style={{ color: "#8b5cf6" }}>
          <path d="M2 2 L2 15 L6 11 L9 17 L11.5 16 L8.5 10 L14 10 Z" fill="currentColor" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
        <span className="absolute left-4 top-3 whitespace-nowrap rounded-full bg-violet-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow">Dana</span>
      </div>
      <span className="absolute bottom-2 right-2 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-500 shadow-sm dark:bg-black/40 dark:text-slate-300">
        Start · Stop · Continue
      </span>
    </div>
  );
}

const WHEEL = [
  { n: "Priya", c: "#38bdf8" },
  { n: "Sai", c: "#a78bfa" },
  { n: "Dana", c: "#f472b6" },
  { n: "Jo", c: "#34d399" },
  { n: "Max", c: "#fbbf24" },
  { n: "Lin", c: "#fb7185" },
];

function PickAct() {
  // 6 slices · land the pointer (top) on "Jo" (index 3). Each slice = 60°.
  // center of slice i sits at i*60+30 from the top; spin a few turns then offset.
  const landTo = 360 * 3 - (3 * 60 + 30);
  const conf = Array.from({ length: 12 }, (_, i) => ({
    cx: `${Math.cos((i / 12) * Math.PI * 2) * 70}px`,
    cy: `${Math.sin((i / 12) * Math.PI * 2) * 70 - 20}px`,
    c: WHEEL[i % WHEEL.length].c,
    d: 1.8 + (i % 5) * 0.08,
  }));
  return (
    <div className="flex h-full items-center justify-center gap-5">
      <div className="relative h-[180px] w-[180px]">
        {/* pointer */}
        <div className="absolute left-1/2 top-[-2px] z-10 -translate-x-1/2 text-iris-600">▼</div>
        <div className="animate-spin-wheel h-full w-full" style={{ ["--spin-to" as string]: `${landTo}deg` }}>
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            {WHEEL.map((s, i) => {
              const a0 = (i / WHEEL.length) * Math.PI * 2;
              const a1 = ((i + 1) / WHEEL.length) * Math.PI * 2;
              const x0 = 50 + 50 * Math.cos(a0), y0 = 50 + 50 * Math.sin(a0);
              const x1 = 50 + 50 * Math.cos(a1), y1 = 50 + 50 * Math.sin(a1);
              const mid = (a0 + a1) / 2;
              const tx = 50 + 32 * Math.cos(mid), ty = 50 + 32 * Math.sin(mid);
              return (
                <g key={s.n}>
                  <path d={`M50 50 L${x0} ${y0} A50 50 0 0 1 ${x1} ${y1} Z`} fill={s.c} opacity="0.92" />
                  <text x={tx} y={ty} fontSize="7" fontWeight="700" fill="white" textAnchor="middle" dominantBaseline="middle" transform={`rotate(90 ${tx} ${ty})`}>
                    {s.n}
                  </text>
                </g>
              );
            })}
            <circle cx="50" cy="50" r="9" fill="white" />
          </svg>
        </div>
        {/* confetti burst on landing */}
        <div className="absolute left-1/2 top-1/2">
          {conf.map((p, i) => (
            <span
              key={i}
              className="animate-conf absolute h-1.5 w-1.5 rounded-[1px]"
              style={{ background: p.c, ["--cx" as string]: p.cx, ["--cy" as string]: p.cy, animationDelay: `${p.d}s` }}
            />
          ))}
        </div>
      </div>
      <div className="animate-rise" style={{ animationDelay: "2.4s" }}>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Goes first</div>
        <div className="text-2xl font-extrabold text-slate-900 dark:text-white">Jo 🎉</div>
        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">no repeats · spin again anytime</div>
      </div>
    </div>
  );
}
