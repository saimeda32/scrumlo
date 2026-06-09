import { RETRO_PHASES, type RetroPhase } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";

/**
 * The facilitated-retro rail: brainstorm → group → vote → discuss. Everyone sees
 * where the room is and what to do; the facilitator clicks a step (or Next) to move
 * the room. During brainstorm, others' notes are hidden — this is what turns a
 * sticky wall into a real, paced retro.
 */
export function PhaseStepper({
  phase,
  isFacil,
  client,
}: {
  phase: RetroPhase;
  isFacil: boolean;
  client: RoomClient;
}) {
  const idx = RETRO_PHASES.findIndex((p) => p.id === phase);
  const current = RETRO_PHASES[idx] ?? RETRO_PHASES[0];
  const next = RETRO_PHASES[idx + 1] ?? null;

  return (
    <div className="mb-4 rounded-2xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-1.5">
        {RETRO_PHASES.map((p, i) => {
          const done = i < idx;
          const active = i === idx;
          const Tag = isFacil ? "button" : "div";
          return (
            <Tag
              key={p.id}
              {...(isFacil ? { onClick: () => client.retroSetPhase(p.id), type: "button" as const } : {})}
              aria-current={active ? "step" : undefined}
              className={`group flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left transition ${
                active
                  ? "bg-iris-600 text-white shadow-sm shadow-iris-600/25"
                  : done
                    ? "bg-iris-50 text-iris-700 dark:bg-iris-500/15 dark:text-iris-300"
                    : "text-slate-400 dark:text-slate-500"
              } ${isFacil ? "hover:bg-iris-500 hover:text-white" : "cursor-default"}`}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                  active ? "bg-white/25" : done ? "bg-iris-200/70 dark:bg-iris-500/30" : "bg-slate-100 dark:bg-white/10"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className="truncate text-xs font-bold tracking-tight sm:text-sm">{p.label}</span>
            </Tag>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-3 px-1">
        <p className="min-w-0 flex-1 truncate text-xs text-slate-500 dark:text-slate-400">{current.hint}</p>
        {isFacil && next && (
          <button
            onClick={() => client.retroSetPhase(next.id)}
            className="shrink-0 rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {phase === "brainstorm" ? "Reveal & group →" : `Next: ${next.label} →`}
          </button>
        )}
      </div>
    </div>
  );
}
