import type { EstimateView } from "../../shared/protocol";
import { numericValue } from "../lib/colors";

export function Consensus({ estimate }: { estimate: EstimateView }) {
  if (estimate.phase !== "revealed" || !estimate.votes) return null;

  const nums = Object.values(estimate.votes)
    .map(numericValue)
    .filter((n): n is number => n !== null);

  if (nums.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
        No numeric votes to compare.
      </div>
    );
  }

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const inSync = min === max;

  return (
    <div
      data-testid="consensus"
      className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
    >
      <span
        className={`rounded-lg px-3 py-1.5 text-sm font-bold ${
          inSync ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"
        }`}
      >
        {inSync ? `✓ consensus · ${min}` : `↔ spread ${min}–${max}`}
      </span>
      <span className="text-sm text-slate-500">
        avg <b className="text-slate-800">{avg.toFixed(1)}</b>
        {!inSync && ` · not in sync — talk to the ${min} and the ${max}`}
      </span>
    </div>
  );
}
