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
      <div className="mb-4 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Now estimating
          </div>
          {isFacil ? (
            <input
              value={estimate.story}
              onChange={(e) => client.setStory(e.target.value)}
              placeholder="What are we estimating?"
              aria-label="Story"
              className="w-full border-0 bg-transparent p-0 text-lg font-semibold text-slate-900 outline-none placeholder:text-slate-300"
            />
          ) : (
            <div className="truncate text-lg font-semibold text-slate-900">
              {estimate.story || <span className="text-slate-300">Waiting for a story…</span>}
            </div>
          )}
        </div>
        {isFacil &&
          (revealed ? (
            <button
              onClick={() => client.restart()}
              className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ↻ New round
            </button>
          ) : (
            <button
              onClick={() => client.reveal()}
              className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            >
              Reveal cards
            </button>
          ))}
      </div>

      {revealed ? (
        <TensionLine estimate={estimate} members={members} you={you} client={client} />
      ) : (
        <Seats members={members} estimate={estimate} />
      )}

      {/* deck */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
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
                      ? "bg-indigo-100 text-indigo-700"
                      : "text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  {DECK_LABELS[d] ?? d}
                </button>
              ))}
            </div>
          ) : (
            <span className="text-xs text-slate-400">{DECK_LABELS[estimate.deck] ?? estimate.deck}</span>
          )}
          {!revealed && (
            <StatusTicker phrases={FLAVOR.waiting} className="ml-auto text-xs text-slate-300" />
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
