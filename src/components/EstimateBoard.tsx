import type { EstimateView, Member } from "../../shared/protocol";
import { DECKS, DECK_LABELS } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";
import { Seats } from "./Seats";
import { Deck } from "./Deck";
import { TensionLine } from "./TensionLine";
import { StatusTicker } from "./StatusTicker";
import { FLAVOR } from "../lib/flavor";

export function EstimateBoard({
  estimate,
  members,
  you,
  isFacil,
  canAct,
  client,
}: {
  estimate: EstimateView;
  members: Member[];
  you: string;
  isFacil: boolean;
  canAct: boolean;
  client: RoomClient;
}) {
  const revealed = estimate.phase === "revealed";

  return (
    <>
      {/* story bar */}
      <div className="mb-4 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-soft dark:border-white/10 dark:bg-[#14141b]">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Now estimating
          </div>
          {isFacil ? (
            <input
              value={estimate.story}
              onChange={(e) => client.setStory(e.target.value)}
              placeholder="What are we estimating?"
              aria-label="Story"
              className="w-full border-0 bg-transparent p-0 text-lg font-semibold text-slate-900 outline-none placeholder:text-slate-300 dark:text-white dark:placeholder:text-slate-600"
            />
          ) : (
            <div className="truncate text-lg font-semibold text-slate-900 dark:text-white">
              {estimate.story || <span className="text-slate-300 dark:text-slate-600">Waiting for a story…</span>}
            </div>
          )}
        </div>
        {isFacil && !revealed && (
          <button
            onClick={() => client.reveal()}
            className="shrink-0 rounded-xl bg-iris-600 px-4 py-2 text-sm font-semibold text-white hover:bg-iris-500"
          >
            Reveal cards
          </button>
        )}
      </div>

      {/* re-vote context: last round's captured takes, so the room converges knowing why */}
      {!revealed && estimate.rationales && Object.keys(estimate.rationales).length > 0 && (
        <div className="mb-4 rounded-xl border border-iris-100 bg-iris-50/50 px-4 py-3 dark:border-iris-500/20 dark:bg-iris-500/5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-iris-400">
            Re-voting — last round
          </div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {Object.entries(estimate.rationales).map(([id, text], i) => {
              const name = members.find((m) => m.id === id)?.name ?? "someone";
              return (
                <span key={id}>
                  {i > 0 && <span className="text-slate-300 dark:text-slate-600"> · </span>}
                  <b className="text-slate-700 dark:text-slate-200">{name}</b>: “{text}”
                </span>
              );
            })}
          </div>
        </div>
      )}

      {revealed ? (
        <TensionLine estimate={estimate} members={members} you={you} isFacil={isFacil} client={client} />
      ) : (
        <Seats members={members} estimate={estimate} />
      )}

      {/* deck */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-[#14141b]">
        <div className="mb-3 flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Your card
          </span>
          {isFacil ? (
            <div className="flex flex-wrap gap-1">
              {Object.keys(DECKS).map((d) => (
                <button
                  key={d}
                  onClick={() => client.setDeck(d)}
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${
                    estimate.deck === d
                      ? "bg-iris-100 text-iris-700 dark:bg-iris-500/20 dark:text-iris-300"
                      : "text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-white/5"
                  }`}
                >
                  {DECK_LABELS[d] ?? d}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs text-slate-400 dark:text-slate-500">{DECK_LABELS[estimate.deck] ?? estimate.deck}</span>
          )}
          {!revealed && (
            <StatusTicker
              phrases={FLAVOR.waiting}
              className="ml-auto hidden max-w-[45%] truncate text-[11px] italic text-slate-300 sm:block dark:text-slate-600"
            />
          )}
        </div>
        <Deck
          deck={estimate.deck}
          yourVote={estimate.yourVote}
          disabled={revealed || !canAct}
          onVote={(c) => client.vote(c)}
        />
      </div>

      <p className="mt-8 text-xs text-slate-400">
        {isFacil
          ? "You’re the facilitator — you control reveal, restart, story and deck."
          : "Blind reveal — nobody sees a number until the facilitator reveals."}
      </p>
    </>
  );
}
