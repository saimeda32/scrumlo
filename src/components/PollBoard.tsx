import { useState } from "react";
import type { PollView } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";

const CLOUD_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316"];

/**
 * Ask the room a question (Slido-lite). Two modes: Q&A (submit answers, upvote, sort
 * by votes) and a one-word live word cloud. Ephemeral — nothing kept after the room.
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
              {poll.prompt || "…"}
            </h2>
          )}
          {isFacil && (
            <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10">
              {(["open", "cloud"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => poll.mode !== m && client.pollSetMode(m)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                    poll.mode === m ? "bg-iris-600 text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                  }`}
                >
                  {m === "open" ? "Q&A" : "Word cloud"}
                </button>
              ))}
            </div>
          )}
        </div>

        {canAct && (
          <div className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              maxLength={poll.mode === "cloud" ? 24 : 160}
              placeholder={poll.mode === "cloud" ? "One word…" : "Your answer…"}
              aria-label="Your submission"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-iris-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
            <button
              onClick={submit}
              className="shrink-0 rounded-lg bg-iris-600 px-4 py-2 text-sm font-semibold text-white hover:bg-iris-500"
            >
              {poll.mode === "cloud" ? "Add" : "Submit"}
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
      ) : (
        <div className="space-y-2">
          {poll.answers.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-soft dark:border-white/10 dark:bg-[#14141b] dark:text-slate-500">
              No answers yet — be the first.
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
