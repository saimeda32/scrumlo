import { useEffect, useRef, useState } from "react";
import { IconClock } from "./icons";
import { useFocusTrap } from "../lib/useFocusTrap";
import { useNow } from "../lib/useNow";

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
  pausedMs = null,
  isFacil,
  onStop,
  onExtend,
  onPause,
  onResume,
}: {
  endsAt: number | null;
  durationMs: number | null;
  pausedMs?: number | null;
  isFacil: boolean;
  onStop: () => void;
  onExtend?: (seconds: number) => void;
  onPause?: () => void;
  onResume?: () => void;
}) {
  // Time is an external store; the parent keys this component by endsAt/pausedMs,
  // so dismissed/buzzed reset by remount instead of effects mirroring props.
  const now = useNow(endsAt !== null, 200);
  const [dismissed, setDismissed] = useState(false);
  const buzzed = useRef(false);

  // one gentle buzz on mobile when it lands on zero (side effect, not in render)
  useEffect(() => {
    if (endsAt === null || now < endsAt || buzzed.current) return;
    buzzed.current = true;
    try {
      navigator.vibrate?.([120, 60, 120]);
    } catch {
      /* unsupported */
    }
  }, [now, endsAt]);

  const paused = pausedMs !== null;
  if (endsAt === null && !paused) return null;

  const remaining = paused ? pausedMs : endsAt! - now;
  const done = !paused && remaining <= 0;
  const total = durationMs ?? Math.max(remaining, 1);
  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const urgent = !done && remaining <= 10_000;
  const warning = !done && remaining <= 30_000 && !urgent;

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
          <div data-testid="timer-remaining" className="text-2xl font-extrabold tabular-nums tracking-tight">
            {done ? "Time’s up" : fmt(remaining)}
          </div>
          <div className="text-xs font-medium opacity-70">
            {done ? "" : paused ? "paused" : warning || urgent ? "wrap it up" : "timer running"}
          </div>
          {isFacil && (
            <div className="ml-auto flex items-center gap-1.5">
              {!done && !paused && onExtend && (
                <>
                  <button onClick={() => onExtend(30)} className="rounded-lg border border-current/20 px-2 py-1 text-xs font-semibold opacity-80 hover:opacity-100">
                    +30s
                  </button>
                  <button onClick={() => onExtend(60)} className="rounded-lg border border-current/20 px-2 py-1 text-xs font-semibold opacity-80 hover:opacity-100">
                    +1m
                  </button>
                </>
              )}
              {!done && !paused && onPause && (
                <button onClick={onPause} aria-label="Pause timer" title="Pause" className="rounded-lg border border-current/20 px-2 py-1 text-xs font-semibold opacity-80 hover:opacity-100">
                  ⏸
                </button>
              )}
              {paused && onResume && (
                <button onClick={onResume} aria-label="Resume timer" title="Resume" className="rounded-lg border border-current/20 px-2 py-1 text-xs font-semibold opacity-80 hover:opacity-100">
                  ▶ Resume
                </button>
              )}
              <button
                onClick={onStop}
                className="rounded-lg border border-current/20 px-2.5 py-1 text-xs font-semibold opacity-80 hover:opacity-100"
              >
                {done ? "Clear" : "Stop"}
              </button>
            </div>
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
        <TimeUpDialog
          total={total}
          isFacil={isFacil}
          onGotIt={() => setDismissed(true)}
          onClear={() => {
            onStop();
            setDismissed(true);
          }}
        />
      )}
    </>
  );
}

/** The full-screen "Time's up" alert · its own component so the focus trap mounts with it. */
function TimeUpDialog({
  total,
  isFacil,
  onGotIt,
  onClear,
}: {
  total: number;
  isFacil: boolean;
  onGotIt: () => void;
  onClear: () => void;
}) {
  const trapRef = useFocusTrap<HTMLDivElement>();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onGotIt();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onGotIt]);
  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-[60] grid place-items-center bg-slate-900/70 p-6 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-label="Time's up"
      onClick={onGotIt}
    >
      <div
        className="animate-pop max-w-sm rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-2xl dark:border-white/10 dark:bg-[#14141b]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="animate-pulse-soft text-6xl">⏰</div>
        <div className="mt-4 text-3xl font-extrabold text-slate-900 dark:text-white">Time’s up</div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{fmt(total)} is done. Wrap up and move on.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={onGotIt}
            className="rounded-xl bg-iris-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-iris-500"
          >
            Got it
          </button>
          {isFacil && (
            <button
              onClick={onClear}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
            >
              Clear timer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
