import { useEffect, useRef, useState } from "react";
import { IconClock } from "./icons";

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * A prominent, shared countdown everyone sees, with a warning state as it runs low
 * and a full-screen nudge the moment it hits zero. Driven by the shared timerEndsAt,
 * so every client lights up together.
 */
export function TimerBanner({
  endsAt,
  durationMs,
  isFacil,
  onStop,
}: {
  endsAt: number | null;
  durationMs: number | null;
  isFacil: boolean;
  onStop: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(false);
  const buzzed = useRef(false);

  useEffect(() => {
    setDismissed(false);
    buzzed.current = false;
    if (endsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [endsAt]);

  if (endsAt === null) return null;

  const remaining = endsAt - now;
  const done = remaining <= 0;
  const total = durationMs ?? Math.max(remaining, 1);
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const urgent = !done && remaining <= 10_000;
  const warning = !done && remaining <= 30_000 && !urgent;

  // one gentle buzz on mobile when it lands on zero
  if (done && !buzzed.current) {
    buzzed.current = true;
    try {
      navigator.vibrate?.([120, 60, 120]);
    } catch {
      /* unsupported */
    }
  }

  const tone = done
    ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200"
    : urgent
      ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-200"
      : warning
        ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200"
        : "border-iris-200 bg-white text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-100";
  const fill = done || urgent ? "bg-rose-500" : warning ? "bg-amber-500" : "bg-iris-500";

  return (
    <>
      <div className={`mb-4 rounded-2xl border px-4 py-3 shadow-soft ${tone}`}>
        <div className="flex items-center gap-3">
          <IconClock className={`h-5 w-5 ${urgent && !done ? "animate-pulse-soft" : ""}`} />
          <div className="text-2xl font-extrabold tabular-nums tracking-tight">
            {done ? "Time’s up" : fmt(remaining)}
          </div>
          <div className="text-xs font-medium opacity-70">
            {done ? "" : warning || urgent ? "wrap it up" : "timer running"}
          </div>
          {isFacil && (
            <button
              onClick={onStop}
              className="ml-auto rounded-lg border border-current/20 px-2.5 py-1 text-xs font-semibold opacity-80 hover:opacity-100"
            >
              {done ? "Clear" : "Stop"}
            </button>
          )}
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
          <div
            className={`h-full rounded-full transition-[width] duration-200 ease-linear ${fill}`}
            style={{ width: `${done ? 100 : pct}%` }}
          />
        </div>
      </div>

      {done && !dismissed && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/70 p-6 backdrop-blur-sm"
          role="alertdialog"
          aria-label="Time's up"
          onClick={() => setDismissed(true)}
        >
          <div
            className="animate-pop max-w-sm rounded-3xl border border-white/10 bg-[#14141b] p-10 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="animate-pulse-soft text-6xl">⏰</div>
            <div className="mt-4 text-3xl font-extrabold text-white">Time’s up</div>
            <p className="mt-2 text-sm text-slate-400">
              {fmt(total)} is done. Wrap up and move on.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <button
                onClick={() => setDismissed(true)}
                className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Got it
              </button>
              {isFacil && (
                <button
                  onClick={() => {
                    onStop();
                    setDismissed(true);
                  }}
                  className="rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5"
                >
                  Clear timer
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
