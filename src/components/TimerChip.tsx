import { useState } from "react";
import { IconClock } from "./icons";

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
}: {
  endsAt: number | null;
  isFacil: boolean;
  onStart: (seconds: number) => void;
  onStop?: () => void; // running timer is shown by TimerBanner; kept for caller compatibility
}) {
  const [menu, setMenu] = useState(false);

  // A running timer is shown by the prominent TimerBanner · and only the
  // facilitator gets the start control here.
  if (endsAt !== null || !isFacil) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setMenu((m) => !m)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-iris-500 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
      >
        <IconClock className="h-3.5 w-3.5" />
        Timer
      </button>
      {menu && (
        <div className="absolute right-0 z-10 mt-1 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#1a1a22]">
          {PRESETS.map((p) => (
            <button
              key={p.s}
              onClick={() => {
                onStart(p.s);
                setMenu(false);
              }}
              className="rounded px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-iris-50 hover:text-iris-700 dark:text-slate-300 dark:hover:bg-iris-500/15 dark:hover:text-iris-300"
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
