import { useEffect, useState } from "react";
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
  onExport,
}: {
  estimate: EstimateView;
  members: Member[];
  you: string;
  isFacil: boolean;
  canAct: boolean;
  client: RoomClient;
  onExport: () => void;
}) {
  const revealed = estimate.phase === "revealed";
  const [showAdd, setShowAdd] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [draft, setDraft] = useState("");

  // Keyboard voting: press a card's value to vote it; R reveals (facilitator).
  useEffect(() => {
    if (!canAct) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (isFacil && (e.key === "r" || e.key === "R") && !revealed) {
        client.reveal();
        return;
      }
      if (revealed) return;
      const deck =
        estimate.deck === "custom" && estimate.customDeck?.length
          ? estimate.customDeck
          : (DECKS[estimate.deck] ?? DECKS.fib);
      if (deck.includes(e.key)) client.vote(e.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canAct, isFacil, revealed, estimate.deck, estimate.customDeck, client]);

  // Accept plain lines OR pasted CSV / Jira exports: one story per line, and within
  // a comma row, keep an ID-looking first cell as a prefix and use the longest cell
  // as the title (so "PROJ-12,Add CSV export,5" → "PROJ-12 — Add CSV export").
  function parseStory(line: string): string {
    const t = line.trim().replace(/^["']|["']$/g, "");
    if (!t.includes(",")) return t;
    const cells = t.split(",").map((c) => c.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    if (!cells.length) return t;
    const idLike = /^[A-Za-z]{1,8}-?\d+$/;
    const id = idLike.test(cells[0]) ? cells[0] : null;
    const rest = id ? cells.slice(1) : cells;
    const title = rest.slice().sort((a, b) => b.length - a.length)[0] || cells[0];
    return id ? `${id} — ${title}` : title;
  }

  function addStories() {
    const stories = draft.split("\n").map(parseStory).filter(Boolean);
    if (stories.length) client.estimateQueueAdd(stories);
    setDraft("");
    setShowAdd(false);
  }

  return (
    <>
      {/* backlog bar */}
      {(estimate.queue.length > 0 || estimate.log.length > 0 || isFacil) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/60 px-4 py-2.5 text-xs dark:border-white/10 dark:bg-white/5">
          {estimate.log.length > 0 && (
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              ✓ {estimate.log.length} estimated
            </span>
          )}
          {estimate.queue.length > 0 ? (
            <button
              onClick={() => setShowQueue((v) => !v)}
              className="min-w-0 truncate text-left text-slate-500 hover:text-iris-600 dark:text-slate-400 dark:hover:text-iris-300"
              title="Show the full backlog"
            >
              Up next: <span className="font-medium text-slate-700 dark:text-slate-200">{estimate.queue[0]}</span>
              {estimate.queue.length > 1 && ` (+${estimate.queue.length - 1} more)`}
              <span className="ml-1 text-slate-400">{showQueue ? "▾" : "▸"}</span>
            </button>
          ) : estimate.log.length > 0 ? (
            <span className="font-medium text-slate-600 dark:text-slate-300">All estimated 🎉</span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">Backlog empty</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {/* Once the backlog's done, surface a one-click export of the results. */}
            {estimate.log.length > 0 && estimate.queue.length === 0 && (
              <button
                onClick={onExport}
                className="rounded-lg bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-500"
              >
                ↓ Export results
              </button>
            )}
            {isFacil && (
              <>
                <button
                  onClick={() => setShowAdd((v) => !v)}
                  className="rounded-lg border border-slate-200 px-2.5 py-1 font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                >
                  + Add stories
                </button>
                {(estimate.queue.length > 0 || estimate.decision) && (
                  <button
                    onClick={() => client.estimateNextStory()}
                    className="rounded-lg bg-iris-600 px-2.5 py-1 font-semibold text-white hover:bg-iris-500"
                  >
                    Next story →
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
      {showQueue && estimate.queue.length > 0 && (
        <ol className="mb-3 space-y-1 rounded-xl border border-slate-200 bg-white/60 p-2 dark:border-white/10 dark:bg-white/5">
          {estimate.queue.map((story, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-slate-50 dark:hover:bg-white/5">
              <span className="w-5 shrink-0 text-center text-xs font-semibold text-slate-400">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">{story}</span>
              {isFacil && (
                <div className="flex shrink-0 items-center">
                  <button
                    onClick={() => client.estimateQueueReorder(i, i - 1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className="rounded px-1 text-slate-400 enabled:hover:text-iris-600 disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => client.estimateQueueReorder(i, i + 1)}
                    disabled={i === estimate.queue.length - 1}
                    aria-label="Move down"
                    className="rounded px-1 text-slate-400 enabled:hover:text-iris-600 disabled:opacity-30"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => client.estimateQueueRemove(i)}
                    aria-label={`Remove "${story}" from the backlog`}
                    className="rounded px-1.5 text-slate-400 hover:text-rose-500"
                  >
                    ✕
                  </button>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {showAdd && isFacil && (
        <div className="mb-3 rounded-xl border border-iris-200 bg-iris-50/50 p-3 dark:border-iris-500/25 dark:bg-iris-500/5">
          <textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste your backlog, one story per line…"
            rows={4}
            className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-iris-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-sm text-slate-500">
              Cancel
            </button>
            <button
              onClick={addStories}
              className="rounded-lg bg-iris-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-iris-500"
            >
              Queue them
            </button>
          </div>
        </div>
      )}

      {/* story bar */}
      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-white/10 dark:bg-[#14141b]">
        <div className="h-1 bg-gradient-to-r from-iris-500 via-violet-500 to-iris-500" />
        <div className="flex items-center gap-4 px-6 py-5">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-iris-500 dark:text-iris-400">
              Now estimating
            </div>
            {isFacil ? (
              <input
                value={estimate.story}
                onChange={(e) => client.setStory(e.target.value)}
                placeholder="What are we sizing?"
                aria-label="Story"
                className="mt-0.5 w-full border-0 bg-transparent p-0 text-2xl font-extrabold tracking-tight text-slate-900 outline-none placeholder:text-slate-300 dark:text-white dark:placeholder:text-slate-700"
              />
            ) : (
              <div className="mt-0.5 truncate text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {estimate.story || <span className="text-slate-300 dark:text-slate-700">Waiting for a story…</span>}
              </div>
            )}
          </div>
          {isFacil && !revealed && (
            <button
              onClick={() => client.reveal()}
              className="shrink-0 rounded-xl bg-iris-600 px-5 py-2.5 text-base font-semibold text-white shadow-soft transition hover:bg-iris-500"
            >
              Reveal cards
            </button>
          )}
        </div>
      </div>

      {/* re-vote context: last round's captured takes, so the room converges knowing why */}
      {!revealed && estimate.rationales && Object.keys(estimate.rationales).length > 0 && (
        <div className="mb-4 rounded-xl border border-iris-100 bg-iris-50/50 px-4 py-3 dark:border-iris-500/20 dark:bg-iris-500/5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-iris-400">
            Re-voting · last round
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

      {/* the card table */}
      <div className="relative mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white px-4 pb-2 pt-4 shadow-soft sm:px-6 dark:border-white/10 dark:bg-[#14141b]">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{ background: "radial-gradient(70% 90% at 50% 130%, rgba(99,102,241,0.12), transparent 62%)" }}
        />
        <div className="relative mb-1 flex items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
            Your hand · {DECK_LABELS[estimate.deck] ?? estimate.deck}
          </span>
          {!revealed && (
            <StatusTicker
              phrases={FLAVOR.waiting}
              className="ml-auto hidden max-w-[45%] truncate text-[11px] italic text-slate-300 sm:block dark:text-slate-600"
            />
          )}
        </div>
        <Deck
          deck={estimate.deck}
          customDeck={estimate.customDeck}
          yourVote={estimate.yourVote}
          disabled={revealed || !canAct}
          onVote={(c) => client.vote(c)}
        />
      </div>

      <p className="mt-8 text-xs text-slate-400">
        {isFacil
          ? "You’re the facilitator · you control reveal, restart, story and deck."
          : "Blind reveal · nobody sees a number until the facilitator reveals."}
      </p>
    </>
  );
}
