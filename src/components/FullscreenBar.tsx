import { useEffect, useState } from "react";
import { RETRO_PHASES, type RetroView } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";

/**
 * A floating toolbar shown only in the retro/board fullscreen view · it surfaces the
 * controls that otherwise live outside the canvas (phase rail, shared timer, vote
 * budget, room toggles, spin-to-discuss and the spotlight banner) so neither the
 * facilitator nor participants have to leave fullscreen to run the session.
 */
export function FullscreenBar({
  retro,
  isBoard,
  isFacil,
  client,
  timerEndsAt,
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

  const spotlit = retro.cards.find((c) => c.id === retro.spotlightId) ?? null;
  const total = retro.cards.length;
  const discussedCount = retro.cards.filter((c) => c.discussed).length;
  const anyLeft = discussedCount < total;

  const chip =
    "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition";
  const chipOff =
    "border-slate-200 text-slate-500 hover:border-iris-300 hover:text-iris-600 dark:border-white/10 dark:text-slate-400 dark:hover:text-iris-300";
  const chipOn =
    "border-iris-300 bg-iris-50 text-iris-700 dark:border-iris-500/40 dark:bg-iris-500/10 dark:text-iris-300";

  return (
    <>
      <div
        data-testid="fullscreen-bar"
        className="absolute left-3 top-3 z-30 flex max-w-[calc(100vw-220px)] flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-2.5 py-1.5 shadow-soft backdrop-blur dark:border-white/10 dark:bg-[#14141b]/90"
      >
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

        {/* vote budget · everyone keeps an eye on their dots (retro only) */}
        {!isBoard && (
          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-300">
            {retro.votesLeft} {retro.votesLeft === 1 ? "vote" : "votes"} left
          </span>
        )}

        {/* room toggles (facilitator) */}
        {isFacil && (
          <>
            {!isBoard && (
              <button
                onClick={() => client.retroSetBlind(!retro.blind)}
                className={`${chip} ${retro.blind ? chipOn : chipOff}`}
                title={
                  retro.blind
                    ? "Cards are hidden from others · click to reveal everyone's content"
                    : "Everyone sees all cards · click to blind the content while people write"
                }
              >
                {retro.blind ? "🔒 Cards hidden" : "👁 Cards shown"}
              </button>
            )}
            <button
              onClick={() => client.retroSetAnonymous(!retro.anonymous)}
              className={`${chip} ${chipOff}`}
              title={retro.anonymous ? "Currently anonymous · click to show names" : "Currently showing names · click to hide"}
            >
              {retro.anonymous ? "🕶 Anonymous" : "🙂 Names shown"}
            </button>
          </>
        )}

        {/* spin for the next card to discuss (facilitator, discuss phase) */}
        {isFacil && !isBoard && retro.phase === "discuss" && total > 0 && (
          <div className="flex items-center gap-1.5">
            {anyLeft ? (
              <>
                <button
                  onClick={() => client.retroPickRandom()}
                  className="rounded-lg bg-iris-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm shadow-iris-600/20 hover:bg-iris-500"
                >
                  🎲 Spin
                </button>
                <span className="text-[11px] font-medium text-slate-400">
                  {discussedCount}/{total} discussed
                </span>
              </>
            ) : (
              <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                All discussed ✓
              </span>
            )}
          </div>
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

      {/* spotlight banner · without this, fullscreen viewers miss where the room is looking */}
      {spotlit && (
        <div
          data-testid="fullscreen-spotlight"
          className="absolute left-1/2 top-16 z-30 flex w-[min(40rem,calc(100vw-32px))] -translate-x-1/2 items-start gap-3 rounded-2xl border border-iris-200 bg-iris-50/95 px-5 py-3 shadow-soft backdrop-blur dark:border-iris-500/25 dark:bg-[#1b1838]/95"
        >
          <span className="mt-0.5 text-iris-500 dark:text-iris-300">◎</span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-iris-400">
              Spotlight · everyone’s looking here
            </div>
            <div className="mt-0.5 whitespace-pre-wrap break-words text-sm font-medium text-slate-800 dark:text-slate-100">
              {spotlit.text}
            </div>
          </div>
          {isFacil && (
            <button
              onClick={() => client.retroSpotlight(null)}
              className="shrink-0 rounded-lg border border-iris-200 px-2.5 py-1 text-xs font-semibold text-iris-600 hover:bg-white dark:border-iris-500/30 dark:text-iris-300 dark:hover:bg-white/5"
            >
              Done
            </button>
          )}
        </div>
      )}
    </>
  );
}
