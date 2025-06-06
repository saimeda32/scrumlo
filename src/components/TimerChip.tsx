import { useEffect, useState } from "react";
import { IconClock } from "./icons";

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const PRESETS = [
  { label: "1m", s: 60 },
  { label: "3m", s: 180 },
  { label: "5m", s: 300 },
  { label: "10m", s: 600 },
];

export function TimerChip({
  endsAt,
  isFacil,
  onStart,
  onStop,
}: {
  endsAt: number | null;
  isFacil: boolean;
  onStart: (seconds: number) => void;
  onStop: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [endsAt]);

  if (endsAt !== null) {
    const remaining = endsAt - now;
    const done = remaining <= 0;
    const urgent = !done && remaining <= 10_000;
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold tabular-nums ${
          done
            ? "bg-rose-100 text-rose-700"
            : urgent
              ? "animate-pulse bg-rose-50 text-rose-600"
              : "bg-slate-100 text-slate-700"
        }`}
      >
        <IconClock className="h-3.5 w-3.5" />
        {done ? "time’s up" : fmt(remaining)}
        {isFacil && (
          <button
            onClick={onStop}
            aria-label="Stop timer"
            className="ml-0.5 text-slate-400 hover:text-rose-500"
          >
            ✕
          </button>
        )}
      </span>
    );
  }

  if (!isFacil) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setMenu((m) => !m)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <IconClock className="h-3.5 w-3.5" />
        Timer
      </button>
      {menu && (
        <div className="absolute right-0 z-10 mt-1 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {PRESETS.map((p) => (
            <button
              key={p.s}
              onClick={() => {
                onStart(p.s);
                setMenu(false);
              }}
              className="rounded px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
