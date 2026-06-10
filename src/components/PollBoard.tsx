import { useState } from "react";
import type { PollView, PollMode } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";

const CLOUD_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316"];
const MODES: { id: PollMode; label: string }[] = [
  { id: "open", label: "Q&A" },
  { id: "choice", label: "Poll" },
  { id: "cloud", label: "Word cloud" },
];

/**
 * Ask the room a question (Slido-lite). Three formats: open Q&A (submit answers and
 * upvote), a facilitator-defined Poll (single- or multi-select with bar results), and
 * a one-word word cloud. Ephemeral · nothing kept after the room.
 */
export function PollBoard({
  poll,
  isFacil,
  canAct,
  client,
}: {
  poll: PollView;
  isFacil: boolean;
  canAct: boolean;
  client: RoomClient;
}) {
  const [draft, setDraft] = useState("");
  const [prompt, setPrompt] = useState(poll.prompt);

  function submit() {
    const t = draft.trim();
    if (t) client.pollSubmit(t);
    setDraft("");
  }

  const maxCount = poll.cloud.length ? Math.max(...poll.cloud.map((c) => c.count)) : 1;
  const choice = poll.mode === "choice";
  const totalVotes = poll.answers.reduce((s, a) => s + a.votes, 0);
  const maxVotes = poll.answers.length ? Math.max(...poll.answers.map((a) => a.votes), 1) : 1;
  // In choice mode only the facilitator adds options; in open/cloud anyone submits.
  const canInput = choice ? isFacil : canAct;
  const inputLabel = choice ? "Add an option" : poll.mode === "cloud" ? "Add" : "Submit";

  return (
    <div className="space-y-4">
      {/* prompt + mode */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-[#14141b]">
        <div className="flex flex-wrap items-center gap-3">
          {isFacil ? (
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onBlur={() => prompt !== poll.prompt && client.pollSetPrompt(prompt)}
              onKeyDown={(e) => e.key === "Enter" && client.pollSetPrompt(prompt)}
              placeholder="Ask the room a question…"
              aria-label="Poll question"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-lg font-bold text-slate-800 outline-none focus:border-iris-500 dark:border-white/10 dark:text-slate-100"
            />
          ) : (
            <h2 className="min-w-0 flex-1 text-lg font-bold text-slate-800 dark:text-slate-100">
              {poll.prompt || (
                <span className="font-medium text-slate-400 dark:text-slate-500">
                  Waiting for the facilitator to ask something…
                </span>
              )}
            </h2>
          )}
          {isFacil && (
            <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => poll.mode !== m.id && client.pollSetMode(m.id)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    poll.mode === m.id ? "bg-iris-600 text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* single/multi toggle, choice mode only, facilitator only */}
        {choice && isFacil && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Picks per person:</span>
            <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10">
              {([false, true] as const).map((m) => (
                <button
                  key={String(m)}
                  onClick={() => poll.multi !== m && client.pollSetMulti(m)}
                  className={`rounded-md px-3 py-0.5 text-xs font-semibold transition ${
                    poll.multi === m ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900" : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {m ? "Multi-select" : "Single-select"}
                </button>
              ))}
            </div>
          </div>
        )}

        {canInput && (
          <div className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              maxLength={poll.mode === "cloud" ? 24 : choice ? 80 : 160}
              placeholder={choice ? "Add an option…" : poll.mode === "cloud" ? "One word…" : "Your answer…"}
              aria-label="Your submission"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-iris-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
            <button
              onClick={submit}
              className="shrink-0 rounded-lg bg-iris-600 px-4 py-2 text-sm font-semibold text-white hover:bg-iris-500"
            >
              {inputLabel}
            </button>
          </div>
        )}
        {isFacil && poll.total > 0 && (
          <button onClick={() => client.pollClear()} className="mt-2 text-xs font-medium text-slate-400 hover:text-rose-500">
            Clear all ({poll.total})
          </button>
        )}
      </div>

      {/* results */}
      {poll.mode === "cloud" ? (
        <div className="min-h-[200px] rounded-2xl border border-slate-200 bg-white p-8 shadow-soft dark:border-white/10 dark:bg-[#14141b]">
          {poll.cloud.length === 0 ? (
            <p className="text-center text-sm text-slate-400 dark:text-slate-500">Drop a word to start the cloud.</p>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              {poll.cloud.map((c, i) => (
                <span
                  key={c.word}
                  className="font-extrabold leading-tight"
                  style={{
                    fontSize: `${14 + Math.sqrt(c.count / maxCount) * 34}px`,
                    color: CLOUD_COLORS[i % CLOUD_COLORS.length],
                    opacity: 0.55 + 0.45 * (c.count / maxCount),
                  }}
                  title={`${c.count}×`}
                >
                  {c.word}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : choice ? (
        // Poll: facilitator-defined options, single- or multi-select, bar results.
        <div className="space-y-2">
          {poll.answers.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-soft dark:border-white/10 dark:bg-[#14141b] dark:text-slate-500">
              {isFacil ? "Add a few options for the room to pick from." : "Waiting for the facilitator to add options…"}
            </p>
          ) : (
            poll.answers.map((a) => {
              const pct = totalVotes ? Math.round((a.votes / totalVotes) * 100) : 0;
              return (
                <div key={a.id} className="flex items-center gap-2">
                  <button
                    onClick={() => canAct && client.pollVote(a.id)}
                    disabled={!canAct}
                    role={poll.multi ? "checkbox" : "radio"}
                    aria-checked={a.youVoted}
                    className={`relative min-w-0 flex-1 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-default ${
                      a.youVoted
                        ? "border-iris-300 bg-iris-50 dark:border-iris-500/40 dark:bg-iris-500/10"
                        : "border-slate-200 bg-white enabled:hover:border-iris-300 dark:border-white/10 dark:bg-[#14141b]"
                    }`}
                  >
                    {/* result bar */}
                    <span
                      className="absolute inset-y-0 left-0 -z-0 bg-iris-100/70 dark:bg-iris-500/15"
                      style={{ width: `${(a.votes / maxVotes) * 100}%` }}
                      aria-hidden
                    />
                    <span className="relative flex items-center gap-2.5">
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center border-2 text-[11px] font-bold ${
                          poll.multi ? "rounded" : "rounded-full"
                        } ${a.youVoted ? "border-iris-600 bg-iris-600 text-white" : "border-slate-300 text-transparent dark:border-white/20"}`}
                      >
                        ✓
                      </span>
                      <span className="min-w-0 flex-1 break-words text-sm font-medium text-slate-700 dark:text-slate-200">{a.text}</span>
                      <span className="shrink-0 text-xs font-bold tabular-nums text-slate-500 dark:text-slate-400">
                        {a.votes} · {pct}%
                      </span>
                    </span>
                  </button>
                  {isFacil && (
                    <button
                      onClick={() => client.pollRemove(a.id)}
                      aria-label="Remove option"
                      className="shrink-0 rounded px-1.5 text-slate-300 hover:text-rose-500"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        // Open Q&A: submitted answers, upvoted, sorted by votes.
        <div className="space-y-2">
          {poll.answers.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-soft dark:border-white/10 dark:bg-[#14141b] dark:text-slate-500">
              No answers yet · be the first.
            </p>
          ) : (
            poll.answers.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-soft dark:border-white/10 dark:bg-[#14141b]"
              >
                <button
                  onClick={() => canAct && client.pollVote(a.id)}
                  disabled={!canAct}
                  aria-pressed={a.youVoted}
                  aria-label={`Upvote · ${a.votes}`}
                  className={`flex shrink-0 flex-col items-center rounded-lg px-2.5 py-1 text-xs font-bold transition disabled:cursor-default ${
                    a.youVoted ? "bg-iris-600 text-white" : "bg-slate-100 text-slate-500 enabled:hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"
                  }`}
                >
                  ▲<span className="tabular-nums">{a.votes}</span>
                </button>
                <span className="min-w-0 flex-1 break-words text-sm text-slate-700 dark:text-slate-200">{a.text}</span>
                {(isFacil || a.mine) && (
                  <button
                    onClick={() => client.pollRemove(a.id)}
                    aria-label="Remove"
                    className="shrink-0 rounded px-1.5 text-slate-300 hover:text-rose-500"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
