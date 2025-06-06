import { useState } from "react";
import type { EstimateView, Member } from "../../shared/protocol";
import { DECKS } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";
import { numericValue } from "../lib/colors";

/**
 * Reveal-to-Resolution. The protagonist of the reveal: a single horizontal axis
 * with each vote as a quiet dot. On agreement it's calm grey; on disagreement the
 * line pulls taut between the two outliers, who are asked one line — "what are you
 * pricing?" — turning the wasted post-reveal silence into surfaced scope/risk.
 */
export function TensionLine({
  estimate,
  members,
  you,
  client,
}: {
  estimate: EstimateView;
  members: Member[];
  you: string;
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
      </div>
    );
  }

  const values = numeric.map(([, c]) => numericValue(c)!);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const minCard = scale.find((c) => numericValue(c) === min)!;
  const maxCard = scale.find((c) => numericValue(c) === max)!;
  const tension = min !== max;

  if (!tension) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 text-center">
        <div className="text-2xl font-extrabold text-emerald-700">Everyone said {minCard}</div>
        <div className="mt-1 text-sm text-slate-500">No tension — that's a clean estimate. Lock it in.</div>
      </div>
    );
  }

  const minPos = posOf(minCard) * 100;
  const maxPos = posOf(maxCard) * 100;
  const youVal = estimate.yourVote ? numericValue(estimate.yourVote) : null;
  const youOutlier = youVal === min || youVal === max;
  const youHasRationale = !!rationales[you]?.trim();

  const endRationale = (val: number) => {
    const e = numeric.find(([id, c]) => numericValue(c) === val && rationales[id]?.trim());
    return e ? { name: nameOf(e[0]), text: rationales[e[0]] } : null;
  };
  const lowR = endRationale(min);
  const highR = endRationale(max);

  function share() {
    if (draft.trim()) {
      client.setRationale(draft.trim());
      setDraft("");
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      {/* the taut line */}
      <div className="relative mx-auto my-10 h-1.5 max-w-2xl rounded-full bg-slate-100">
        <div
          className="absolute top-0 h-1.5 rounded-full bg-gradient-to-r from-sky-400 to-rose-400"
          style={{ left: `${minPos}%`, width: `${Math.max(0, maxPos - minPos)}%` }}
        />
        {numeric.map(([id, c]) => {
          const v = numericValue(c)!;
          const isMin = v === min;
          const isMax = v === max;
          const outlier = isMin || isMax;
          return (
            <div
              key={id}
              className="absolute -top-[5px] -translate-x-1/2"
              style={{ left: `${posOf(c) * 100}%` }}
            >
              <div
                className={`h-4 w-4 rounded-full border-2 border-white shadow-sm transition ${
                  outlier ? (isMin ? "scale-125 bg-sky-500" : "scale-125 bg-rose-500") : "bg-slate-300"
                }`}
                title={nameOf(id)}
              />
            </div>
          );
        })}
        <div className="absolute -bottom-9 -translate-x-1/2" style={{ left: `${minPos}%` }}>
          <span className="text-xl font-extrabold text-sky-600">{minCard}</span>
        </div>
        <div className="absolute -bottom-9 -translate-x-1/2" style={{ left: `${maxPos}%` }}>
          <span className="text-xl font-extrabold text-rose-600">{maxCard}</span>
        </div>
      </div>

      {/* the named axis (deterministic for now; AI names it in the next pass) */}
      <div className="mt-12 text-center">
        {lowR || highR ? (
          <p className="text-sm text-slate-700">
            {lowR && (
              <>
                <span className="font-semibold text-sky-600">{lowR.name}</span> is pricing “
                {lowR.text}”
              </>
            )}
            {lowR && highR && <span className="text-slate-400"> · </span>}
            {highR && (
              <>
                <span className="font-semibold text-rose-600">{highR.name}</span> is pricing “
                {highR.text}”
              </>
            )}
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            The <b className="text-sky-600">{minCard}</b> and the <b className="text-rose-600">{maxCard}</b>{" "}
            are seeing this differently — what's the difference?
          </p>
        )}
      </div>

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
    </div>
  );
}
