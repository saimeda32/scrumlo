import { useState } from "react";
import type { EstimateView, Member } from "../../shared/protocol";
import { DECKS } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";
import { numericValue } from "../lib/colors";

/**
 * Reveal-to-Resolution. The protagonist of the reveal: a single axis showing the
 * whole distribution · every camp, not just the two extremes. On agreement it's
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
  // Custom decks aren't in DECKS, so resolve them the same way EstimateBoard/Deck do.
  const deckCards =
    estimate.deck === "custom" && estimate.customDeck?.length
      ? estimate.customDeck
      : (DECKS[estimate.deck] ?? DECKS.fib);
  // One value scale for any deck. Numeric decks rank by number; word decks (t-shirts)
  // rank by deck position. "?" and "☕" are never rankable either way.
  const numericMode = deckCards.filter((c) => numericValue(c) !== null).length >= 2;
  const scale = numericMode
    ? deckCards.filter((c) => numericValue(c) !== null)
    : deckCards.filter((c) => c !== "?" && c !== "☕");
  const valueOf = (card: string): number | null =>
    numericMode ? numericValue(card) : scale.indexOf(card) >= 0 ? scale.indexOf(card) : null;
  const cardOf = (value: number): string =>
    numericMode ? (scale.find((c) => numericValue(c) === value) ?? String(value)) : (scale[value] ?? "?");
  const posOf = (card: string) =>
    scale.length <= 1 ? 0.5 : Math.max(0, scale.indexOf(card)) / (scale.length - 1);

  const numeric = Object.entries(votes).filter(([, c]) => valueOf(c) !== null);
  const nonNumeric = Object.entries(votes).filter(([, c]) => valueOf(c) === null);

  if (numeric.length < 2) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-white/10 dark:bg-[#14141b] dark:text-slate-400">
        Not enough comparable votes yet.
        {isFacil && <ReestimateBar client={client} className="mt-4 justify-center" />}
      </div>
    );
  }

  const values = numeric.map(([, c]) => valueOf(c)!);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const tension = min !== max;

  // The whole distribution as camps, not just the extremes.
  const byValue = new Map<number, string[]>();
  for (const [id, c] of numeric) {
    const v = valueOf(c)!;
    (byValue.get(v) ?? byValue.set(v, []).get(v)!).push(id);
  }
  const clusters: Cluster[] = [...byValue.entries()]
    .map(([value, ids]) => {
      const card = cardOf(value);
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
  const medianCard = cardOf(median);

  // Text alternative · the distribution in words (color is not the only signal).
  const distText =
    `Vote distribution: ${numeric.length} votes from ${cardOf(min)} to ${cardOf(max)}, median ${medianCard}. ` +
    clusters.map((c) => `${c.card} (${c.ids.map(nameOf).join(", ")})`).join("; ") + ".";

  if (!tension) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-8 text-center shadow-soft dark:border-emerald-500/25 dark:bg-emerald-500/10">
        <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300">Everyone said {clusters[0].card}</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">No tension · that's a clean estimate. Lock it in.</div>
        <div className="mx-auto mt-5 max-w-md text-left">
          <DecisionBar
            decision={estimate.decision}
            isFacil={isFacil}
            defaultValue={clusters[0].card}
            defaultNote=""
            client={client}
          />
        </div>
        {isFacil && <ReestimateBar client={client} className="justify-center" fresh />}
      </div>
    );
  }

  const minPos = clusters[0].pos * 100;
  const maxPos = clusters[clusters.length - 1].pos * 100;
  const youVal = estimate.yourVote ? valueOf(estimate.yourVote) : null;
  const youOutlier = youVal === min || youVal === max;
  const youHasRationale = !!rationales[you]?.trim();

  const endRationale = (val: number) => {
    const e = numeric.find(([id, c]) => valueOf(c) === val && rationales[id]?.trim());
    return e ? { name: nameOf(e[0]), text: rationales[e[0]] } : null;
  };
  const lowR = endRationale(min);
  const highR = endRationale(max);
  const waitingLow = !lowR;
  const waitingHigh = !highR;
  const typingNames = (estimate.typing ?? []).filter((id) => id !== you).map(nameOf);

  function share() {
    if (draft.trim()) {
      client.setRationale(draft.trim());
      setDraft("");
      client.typing(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8 dark:border-white/10 dark:bg-[#14141b]">
      <p className="sr-only">{distText}</p>

      <DecisionBar
        decision={estimate.decision}
        isFacil={isFacil}
        defaultValue={medianCard}
        defaultNote={highR?.text ?? ""}
        client={client}
      />

      {/* convergence trail · the spread shrinking, round over round */}
      {estimate.history.length >= 2 && <ConvergenceTrail history={estimate.history} />}

      {/* the taut line with every camp */}
      <div className="relative mx-auto h-24 max-w-2xl">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-slate-100 dark:bg-white/10" style={{ top: "calc(50% - 3px)" }} />
        <div
          className="animate-draw absolute h-1.5 rounded-full bg-gradient-to-r from-sky-400 to-rose-400"
          style={{ top: "calc(50% - 3px)", left: `${minPos}%`, width: `${Math.max(0, maxPos - minPos)}%` }}
        />
        {clusters.map((c, i) => {
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
                className={`animate-pop flex items-center justify-center rounded-full border-2 border-white shadow-soft dark:border-[#14141b] ${color}`}
                style={{ height: size, width: size, animationDelay: `${0.15 + i * 0.08}s` }}
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
      <div className="animate-rise mt-6 text-center text-sm text-slate-600 dark:text-slate-300" style={{ animationDelay: "0.35s" }}>
        {clusters.map((c, i) => (
          <span key={c.value}>
            {i > 0 && <span className="text-slate-300 dark:text-slate-600"> · </span>}
            <b className={c.kind === "low" ? "text-sky-600 dark:text-sky-400" : c.kind === "high" ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-300"}>
              {c.card}
            </b>{" "}
            {c.ids.map(nameOf).join(", ")}
          </span>
        ))}
      </div>

      {/* the headline number · the answer the room came for, in our colour and unmissable */}
      <div className="animate-rise mt-4 flex items-center justify-center gap-2.5" style={{ animationDelay: "0.4s" }}>
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-iris-400 dark:text-iris-400/80">
          Median
        </span>
        <span className="rounded-xl bg-iris-100 px-3 py-1 text-2xl font-extrabold tracking-tight text-iris-700 dark:bg-iris-500/15 dark:text-iris-300">
          {medianCard}
        </span>
      </div>

      {/* the captured "why" */}
      {(lowR || highR) && (
        <p className="animate-rise mt-4 text-center text-sm text-slate-700 dark:text-slate-200">
          {lowR && (
            <>
              <span className="font-semibold text-sky-600 dark:text-sky-400">{lowR.name}</span> is pricing “{lowR.text}”
            </>
          )}
          {lowR && highR && <span className="text-slate-400 dark:text-slate-600"> · </span>}
          {highR && (
            <>
              <span className="font-semibold text-rose-600 dark:text-rose-400">{highR.name}</span> is pricing “{highR.text}”
            </>
          )}
        </p>
      )}
      {typingNames.length > 0 ? (
        <p className="animate-pulse-soft mt-4 text-center text-xs font-medium text-iris-500">
          {typingNames.join(" & ")} {typingNames.length > 1 ? "are" : "is"} explaining…
        </p>
      ) : (
        (waitingLow || waitingHigh) && (
          <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
            {waitingLow && waitingHigh
              ? `Waiting on the ${cardOf(min)} and the ${cardOf(max)} to say what they're pricing…`
              : `Waiting on the ${cardOf(waitingLow ? min : max)} to say what they're pricing…`}
          </p>
        )
      )}

      {/* outlier prompt */}
      {youOutlier && !youHasRationale && (
        <div className="mx-auto mt-6 max-w-md">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            In a few words · what are you pricing at {estimate.yourVote}?
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && share()}
              onFocus={() => client.typing(true)}
              onBlur={() => client.typing(false)}
              placeholder="e.g. the data migration"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-iris-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-600"
            />
            <button
              onClick={share}
              className="rounded-lg bg-iris-600 px-4 py-2 text-sm font-semibold text-white hover:bg-iris-500"
            >
              Share
            </button>
          </div>
        </div>
      )}

      {nonNumeric.length > 0 && (
        <p className="mt-5 text-center text-xs text-slate-400 dark:text-slate-500">
          {nonNumeric.map(([id, c]) => `${nameOf(id)}: ${c}`).join(" · ")}
        </p>
      )}

      {/* close the loop */}
      {isFacil && <ReestimateBar client={client} className="mt-7 justify-center" />}
    </div>
  );
}

/** Lock the outcome · the agreed number + the reason. The artifact the team keeps. */
function DecisionBar({
  decision,
  isFacil,
  defaultValue,
  defaultNote,
  client,
}: {
  decision: { value: string; note: string } | null;
  isFacil: boolean;
  defaultValue: string;
  defaultNote: string;
  client: RoomClient;
}) {
  const [value, setValue] = useState(defaultValue);
  const [note, setNote] = useState(defaultNote);

  if (decision) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 dark:border-emerald-500/25 dark:bg-emerald-500/10">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-extrabold text-white">
          {decision.value}
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <span className="font-semibold text-emerald-700 dark:text-emerald-300">Locked</span>
          {decision.note && <span className="text-slate-600 dark:text-slate-300"> · {decision.note}</span>}
        </div>
        {isFacil && (
          <button
            onClick={() => client.lockDecision("", "")}
            className="shrink-0 text-xs font-semibold text-emerald-600 hover:underline"
          >
            Unlock
          </button>
        )}
      </div>
    );
  }
  if (!isFacil) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-white/5">
      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Lock it at</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Agreed estimate"
        className="w-12 rounded-lg border border-slate-300 px-2 py-1 text-center text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-white"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && value.trim() && client.lockDecision(value.trim(), note.trim())}
        placeholder="because… (optional)"
        aria-label="Reason"
        className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-600"
      />
      <button
        onClick={() => value.trim() && client.lockDecision(value.trim(), note.trim())}
        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500"
      >
        ✓ Lock
      </button>
    </div>
  );
}

/** The spread shrinking, round over round · the room visibly converging. */
function ConvergenceTrail({ history }: { history: { lo: number; hi: number; n: number }[] }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-center gap-2 text-xs">
      <span className="font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Converging</span>
      {history.map((r, i) => {
        const consensus = r.lo === r.hi;
        const last = i === history.length - 1;
        return (
          <span key={i} className="inline-flex items-center gap-2">
            {i > 0 && <span className="text-slate-300 dark:text-slate-600">→</span>}
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                last
                  ? consensus
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                    : "bg-iris-100 text-iris-700 dark:bg-iris-500/20 dark:text-iris-300"
                  : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
              }`}
            >
              {consensus ? `✓ ${r.lo}` : `${r.lo}–${r.hi}`}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** The action that turns "interesting chart" into "the round resolves" · re-vote in place. */
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
          className="rounded-xl bg-iris-600 px-5 py-2.5 text-sm font-semibold text-white  shadow-soft shadow-iris-600/20 hover:bg-iris-500"
        >
          ↻ Re-estimate · keep the conversation
        </button>
      )}
      <button
        onClick={() => client.restart()}
        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
      >
        New story
      </button>
    </div>
  );
}
