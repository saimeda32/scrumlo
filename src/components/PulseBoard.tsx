import type { PulseView, Member } from "../../shared/protocol";
import { PULSE_MIN_REVEAL, PULSE_THEMES } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";
import { pulseVerdict } from "../lib/pulseVerdict";

const VERDICT_COLORS = { good: "#10b981", ok: "#f59e0b", bad: "#ef4444" } as const;

/** Facilitator-only chips to swap the question set (resets the blind round). */
function ThemeChips({ pulse, isFacil, client }: { pulse: PulseView; isFacil: boolean; client: RoomClient }) {
  if (!isFacil) return null;
  return (
    <div className="mb-4 flex flex-wrap gap-1.5">
      {Object.entries(PULSE_THEMES).map(([id, t]) => (
        <button
          key={id}
          onClick={() => id !== pulse.theme && client.pulseSetTheme(id)}
          aria-pressed={id === pulse.theme}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
            id === pulse.theme
              ? "bg-iris-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Team health check: everyone rates a few dimensions 1–5, blind, then the facilitator
 * reveals an aggregate radar + per-dimension bars. Just votes-in-a-DO · ephemeral.
 */
function scoreColor(v: number): string {
  if (v >= 4) return "#10b981"; // green
  if (v >= 3) return "#84cc16"; // lime
  if (v >= 2) return "#f59e0b"; // amber
  return "#ef4444"; // rose
}

export function PulseBoard({
  pulse,
  members,
  isFacil,
  canAct,
  client,
}: {
  pulse: PulseView;
  members: Member[];
  you: string;
  isFacil: boolean;
  canAct: boolean;
  client: RoomClient;
}) {
  const revealed = pulse.phase === "revealed";
  const present = members.length;
  const youVoted = pulse.yourVotes && pulse.dimensions.every((d) => pulse.yourVotes![d] !== undefined);

  if (revealed && pulse.results) {
    const overall = pulse.results.length
      ? pulse.results.reduce((a, r) => a + r.avg, 0) / pulse.results.length
      : 0;
    const verdict = pulseVerdict(pulse.results);
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-white/10 dark:bg-[#14141b]">
        {verdict && (
          <div className="mb-5 text-center sm:text-left">
            <span
              data-testid="pulse-verdict"
              className="animate-pop text-4xl font-extrabold tracking-tight"
              style={{ color: VERDICT_COLORS[verdict.tone] }}
            >
              {verdict.word}
            </span>
            <span className="ml-3 align-middle text-sm text-slate-400 dark:text-slate-500">the room, in one word</span>
          </div>
        )}
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
          <Radar results={pulse.results} />
          <div className="min-w-0 flex-1">
            <div className="mb-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold" style={{ color: scoreColor(overall) }}>
                {overall.toFixed(1)}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400">overall · out of 5</span>
            </div>
            <div className="space-y-3">
              {pulse.results.map((r) => (
                <div key={r.dim}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">{r.dim}</span>
                    <span className="tabular-nums font-bold" style={{ color: scoreColor(r.avg) }}>
                      {r.avg.toFixed(1)}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                    <div
                      className="animate-draw h-full rounded-full"
                      style={{ width: `${(r.avg / 5) * 100}%`, background: scoreColor(r.avg), transformOrigin: "left center" }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {isFacil && (
              <button
                onClick={() => client.pulseReset()}
                className="mt-6 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
              >
                ↻ New check
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft dark:border-white/10 dark:bg-[#14141b]">
      <div className="mb-1 text-lg font-bold text-slate-800 dark:text-slate-100">
        {PULSE_THEMES[pulse.theme]?.label ?? "How's the team doing?"}
      </div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Rate each 1–5. It's blind · nobody sees the numbers until the facilitator reveals.
      </p>
      <ThemeChips pulse={pulse} isFacil={isFacil} client={client} />

      <div className="space-y-4">
        {pulse.dimensions.map((dim) => {
          const mine = pulse.yourVotes?.[dim];
          return (
            <div key={dim} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{dim}</span>
              <div className="flex shrink-0 gap-1.5">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() => canAct && client.pulseVote(dim, v)}
                    disabled={!canAct}
                    aria-pressed={mine === v}
                    aria-label={`${dim}: ${v} of 5`}
                    className={`grid h-9 w-9 place-items-center rounded-lg text-sm font-bold transition disabled:cursor-default ${
                      mine === v
                        ? "text-white shadow"
                        : "bg-slate-100 text-slate-500 enabled:hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"
                    }`}
                    style={mine === v ? { background: scoreColor(v) } : undefined}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-300">
          {pulse.voted.length} / {present} submitted
        </span>
        {youVoted && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">✓ your ratings are in</span>}
        {isFacil && (
          <div className="ml-auto flex items-center gap-2">
            {pulse.voted.length < PULSE_MIN_REVEAL && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Needs {PULSE_MIN_REVEAL}+ submitted to reveal anonymously
              </span>
            )}
            <button
              onClick={() => client.pulseReveal()}
              disabled={pulse.voted.length < PULSE_MIN_REVEAL}
              title={pulse.voted.length < PULSE_MIN_REVEAL ? `Need at least ${PULSE_MIN_REVEAL} submissions` : undefined}
              className="rounded-xl bg-iris-600 px-4 py-2 text-sm font-semibold text-white hover:bg-iris-500 disabled:opacity-50"
            >
              Reveal results →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** A pentagon radar of the per-dimension averages. */
function Radar({ results }: { results: { dim: string; avg: number }[] }) {
  const n = results.length;
  const size = 220;
  const c = size / 2;
  const r = size / 2 - 34;
  const pt = (i: number, frac: number) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [c + r * frac * Math.cos(a), c + r * frac * Math.sin(a)];
  };
  const ring = (frac: number) =>
    results.map((_, i) => pt(i, frac).map((v) => v.toFixed(1)).join(",")).join(" ");
  const shape = results.map((res, i) => pt(i, res.avg / 5).map((v) => v.toFixed(1)).join(",")).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      {[1, 0.75, 0.5, 0.25].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" className="stroke-slate-200 dark:stroke-white/10" strokeWidth="1" />
      ))}
      {results.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} className="stroke-slate-200 dark:stroke-white/10" strokeWidth="1" />;
      })}
      <polygon points={shape} fill="rgba(99,102,241,0.22)" className="stroke-iris-500" strokeWidth="2" />
      {results.map((res, i) => {
        const [x, y] = pt(i, res.avg / 5);
        return <circle key={i} cx={x} cy={y} r="3.5" style={{ fill: scoreColor(res.avg) }} />;
      })}
      {results.map((res, i) => {
        const [x, y] = pt(i, 1.16);
        return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-slate-500 dark:fill-slate-400" fontSize="9" fontWeight="700">
            {res.dim}
          </text>
        );
      })}
    </svg>
  );
}
