import { useState } from "react";
import type { EstimateView, Member } from "../../shared/protocol";
import { DECKS } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";
import { numericValue } from "../lib/colors";

/**
 * Reveal-to-Resolution. The protagonist of the reveal: a single axis showing the
 * whole distribution — every camp, not just the two extremes. On agreement it's
 * calm; on a spread it pulls taut between the low and high camps, asks each outlier
 * one line ("what are you pricing?"), and offers a one-tap re-vote so the round
 * converges in place instead of going silent.
 */
type Cluster = {
  value: number;
  card: string;
  ids: string[];
  pos: number; // 0..1 along the axis
  kind: "low" | "high" | "mid";
};

export function TensionLine({
  estimate,
  members,
  you,
  isFacil,
  client,
}: {
  estimate: EstimateView;
  members: Member[];
  you: string;
  isFacil: boolean;
  client: RoomClient;
}) {
  const [draft, setDraft] = useState("");
  const votes = estimate.votes ?? {};
  const rationales = estimate.rationales ?? {};
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "someone";

  // Equal-spaced positions by deck index (so 3→5 and 13→21 read as one step each).
  const scale = (DECKS[estimate.deck] ?? DECKS.fib).filter((c) => numericValue(c) !== null);
  const posOf = (card: string) =>
    scale.length <= 1 ? 0.5 : Math.max(0, scale.indexOf(card)) / (scale.length - 1);

  const numeric = Object.entries(votes).filter(([, c]) => numericValue(c) !== null);
  const nonNumeric = Object.entries(votes).filter(([, c]) => numericValue(c) === null);

  if (numeric.length < 2) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Not enough numeric votes to compare.
        {isFacil && <ReestimateBar client={client} className="mt-4 justify-center" />}
      </div>
    );
  }

  const values = numeric.map(([, c]) => numericValue(c)!);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const tension = min !== max;

  // The whole distribution as camps, not just the extremes.
  const byValue = new Map<number, string[]>();
  for (const [id, c] of numeric) {
    const v = numericValue(c)!;
    (byValue.get(v) ?? byValue.set(v, []).get(v)!).push(id);
  }
  const clusters: Cluster[] = [...byValue.entries()]
    .map(([value, ids]) => {
      const card = scale.find((c) => numericValue(c) === value)!;
      return {
        value,
        card,
        ids,
        pos: posOf(card),
        kind: (value === min ? "low" : value === max ? "high" : "mid") as Cluster["kind"],
      };
    })
    .sort((a, b) => a.value - b.value);

  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor((sorted.length - 1) / 2)];

  // Text alternative — the distribution in words (color is not the only signal).
  const distText =
    `Vote distribution: ${numeric.length} votes from ${min} to ${max}, median ${median}. ` +
    clusters.map((c) => `${c.card} (${c.ids.map(nameOf).join(", ")})`).join("; ") + ".";

  if (!tension) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 text-center">
        <div className="text-2xl font-extrabold text-emerald-700">Everyone said {clusters[0].card}</div>
        <div className="mt-1 text-sm text-slate-500">No tension — that's a clean estimate. Lock it in.</div>
        {isFacil && <ReestimateBar client={client} className="mt-5 justify-center" fresh />}
      </div>
    );
  }

  const minPos = clusters[0].pos * 100;
  const maxPos = clusters[clusters.length - 1].pos * 100;
  const youVal = estimate.yourVote ? numericValue(estimate.yourVote) : null;
  const youOutlier = youVal === min || youVal === max;
  const youHasRationale = !!rationales[you]?.trim();

  const endRationale = (val: number) => {
    const e = numeric.find(([id, c]) => numericValue(c) === val && rationales[id]?.trim());
    return e ? { name: nameOf(e[0]), text: rationales[e[0]] } : null;
  };
  const lowR = endRationale(min);
  const highR = endRationale(max);
  const waitingLow = !lowR;
  const waitingHigh = !highR;

  function share() {
    if (draft.trim()) {
      client.setRationale(draft.trim());
      setDraft("");
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <p className="sr-only">{distText}</p>

      {/* the taut line with every camp */}
      <div className="relative mx-auto h-24 max-w-2xl">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-100" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-sky-400 to-rose-400"
          style={{ left: `${minPos}%`, width: `${Math.max(0, maxPos - minPos)}%` }}
        />
        {clusters.map((c) => {
          const size = Math.min(14 + (c.ids.length - 1) * 6, 30);
          const color =
            c.kind === "low" ? "bg-sky-500" : c.kind === "high" ? "bg-rose-500" : "bg-slate-300";
          const labelColor =
            c.kind === "low" ? "text-sky-600" : c.kind === "high" ? "text-rose-600" : "text-slate-400";
          return (
            <div
              key={c.value}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${c.pos * 100}%` }}
            >
              <div
                className={`flex items-center justify-center rounded-full border-2 border-white shadow-sm ${color}`}
                style={{ height: size, width: size }}
                title={c.ids.map(nameOf).join(", ")}
              >
                {c.ids.length > 1 && (
                  <span className="text-[10px] font-bold text-white">{c.ids.length}</span>
                )}
              </div>
              <span
                className={`absolute left-1/2 top-full mt-2 -translate-x-1/2 text-lg font-extrabold ${labelColor}`}
              >
                {c.card}
              </span>
            </div>
          );
        })}
      </div>

      {/* the camps, in words */}
      <div className="mt-6 text-center text-sm text-slate-600">
        {clusters.map((c, i) => (
          <span key={c.value}>
            {i > 0 && <span className="text-slate-300"> · </span>}
            <b className={c.kind === "low" ? "text-sky-600" : c.kind === "high" ? "text-rose-600" : "text-slate-500"}>
              {c.card}
            </b>{" "}
            {c.ids.map(nameOf).join(", ")}
          </span>
        ))}
        <span className="text-slate-400"> — median {median}</span>
      </div>

      {/* the captured "why" */}
      {(lowR || highR) && (
        <p className="mt-4 text-center text-sm text-slate-700">
          {lowR && (
            <>
              <span className="font-semibold text-sky-600">{lowR.name}</span> is pricing “{lowR.text}”
            </>
          )}
          {lowR && highR && <span className="text-slate-400"> · </span>}
          {highR && (
            <>
              <span className="font-semibold text-rose-600">{highR.name}</span> is pricing “{highR.text}”
            </>
          )}
        </p>
      )}
      {(waitingLow || waitingHigh) && (
        <p className="mt-4 text-center text-xs text-slate-400">
          {waitingLow && waitingHigh
            ? `Waiting on the ${min} and the ${max} to say what they're pricing…`
            : `Waiting on the ${waitingLow ? min : max} to say what they're pricing…`}
        </p>
      )}

      {/* outlier prompt */}
      {youOutlier && !youHasRationale && (
        <div className="mx-auto mt-6 max-w-md">
          <label className="text-xs font-semibold text-slate-500">
            In a few words — what are you pricing at {estimate.yourVote}?
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && share()}
              placeholder="e.g. the data migration"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
            <button
              onClick={share}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Share
            </button>
          </div>
        </div>
      )}

      {nonNumeric.length > 0 && (
        <p className="mt-5 text-center text-xs text-slate-400">
          {nonNumeric.map(([id, c]) => `${nameOf(id)}: ${c}`).join(" · ")}
        </p>
      )}

      {/* close the loop */}
      {isFacil && <ReestimateBar client={client} className="mt-7 justify-center" />}
    </div>
  );
}

/** The action that turns "interesting chart" into "the round resolves" — re-vote in place. */
function ReestimateBar({
  client,
  className = "",
  fresh = false,
}: {
  client: RoomClient;
  className?: string;
  fresh?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {!fresh && (
        <button
          onClick={() => client.reestimate()}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 hover:bg-indigo-500"
        >
          ↻ Re-estimate — keep the conversation
        </button>
      )}
      <button
        onClick={() => client.restart()}
        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
      >
        New story
      </button>
    </div>
  );
}
