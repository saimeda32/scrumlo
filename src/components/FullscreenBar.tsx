import { useEffect, useState } from "react";
import { RETRO_PHASES, type RetroView } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";

/**
 * A floating toolbar shown only in the retro/board fullscreen view · it surfaces the
 * controls that otherwise live outside the canvas (the phase rail and the shared
 * timer) so a facilitator never has to leave fullscreen to run the session.
 */
export function FullscreenBar({
  retro,
  isBoard,
  isFacil,
  client,
  timerEndsAt,
  timerDurationMs,
  onExit,
}: {
  retro: RetroView;
  isBoard: boolean;
  isFacil: boolean;
  client: RoomClient;
  timerEndsAt: number | null;
  timerDurationMs: number | null;
  onExit: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (timerEndsAt === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [timerEndsAt]);

  const idx = RETRO_PHASES.findIndex((p) => p.id === retro.phase);
  const next = RETRO_PHASES[idx + 1] ?? null;
  const remaining = timerEndsAt !== null ? Math.max(0, timerEndsAt - now) : null;
  const mm = remaining !== null ? Math.floor(remaining / 60000) : 0;
  const ss = remaining !== null ? Math.floor((remaining % 60000) / 1000) : 0;
  const urgent = remaining !== null && remaining <= 10_000;

  return (
    <div className="absolute left-3 top-3 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-2.5 py-1.5 shadow-soft backdrop-blur dark:border-white/10 dark:bg-[#14141b]/90">
      {/* phase (retro only) */}
      {!isBoard && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold tracking-tight text-iris-600 dark:text-iris-300">
            {RETRO_PHASES[idx]?.label ?? "Retro"}
          </span>
          {isFacil && next && (
            <button
              onClick={() => client.retroSetPhase(next.id)}
              className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
            >
              {retro.phase === "brainstorm" ? "Reveal →" : `${next.label} →`}
            </button>
          )}
          <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-white/10" />
        </div>
      )}

      {/* timer */}
      {remaining !== null ? (
        <div className="flex items-center gap-1.5">
          <span
            className={`tabular-nums text-sm font-bold ${
              urgent ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-200"
            }`}
          >
            ⏱ {mm}:{String(ss).padStart(2, "0")}
          </span>
          {isFacil && (
            <button
              onClick={() => client.timerStop()}
              className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-slate-400 hover:text-rose-500"
            >
              clear
            </button>
          )}
        </div>
      ) : (
        isFacil && (
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-medium text-slate-400">Timer</span>
            {[
              { label: "1m", s: 60 },
              { label: "3m", s: 180 },
              { label: "5m", s: 300 },
            ].map((t) => (
              <button
                key={t.s}
                onClick={() => client.timerStart(t.s)}
                className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:border-iris-300 hover:text-iris-600 dark:border-white/10 dark:text-slate-300"
              >
                {t.label}
              </button>
            ))}
          </div>
        )
      )}

      <span className="mx-0.5 h-5 w-px bg-slate-200 dark:bg-white/10" />
      <button
        onClick={onExit}
        className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
        title="Exit fullscreen (Esc)"
      >
        ⤡ Exit
      </button>
    </div>
  );
}
