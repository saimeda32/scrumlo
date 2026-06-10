import { useEffect, useRef, useState } from "react";
import type { PollView, PollMode } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";

const CLOUD_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316"];
const MODES: { id: PollMode; label: string }[] = [
  { id: "open", label: "Q&A" },
  { id: "choice", label: "Poll" },
  { id: "cloud", label: "Word cloud" },
];

// Rotating quips for the blind waiting room. Pure flavor — never identifies anyone.
const QUIPS = [
  "brains warming up… 🧠",
  "no peeking 👀",
  "answers marinating…",
  "someone's crafting a masterpiece ✍️",
  "the suspense is building… 🍿",
  "good answers take a second…",
  "🤫 sealed until the reveal",
  "plot twist loading…",
  "thoughts brewing ☕",
  "honesty mode: engaged 🔒",
];

/**
 * Ask the room a question (Slido-lite). Three formats: open Q&A (submit answers and
 * upvote), a facilitator-defined Poll (single- or multi-select with bar results), and
 * a one-word word cloud. With "Hide until reveal" on (the default), results stay
 * server-side until the facilitator reveals, so early answers can't anchor the room.
 * Ephemeral · nothing kept after the room.
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

  // Blind + still answering → results are hidden for everyone (server enforces it).
  const hidden = poll.blind && poll.phase === "answering";
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

        {/* facilitator knobs: results visibility, and picks-per-person in choice mode */}
        {isFacil && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Results:</span>
              <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10">
                {([true, false] as const).map((m) => (
                  <button
                    key={String(m)}
                    onClick={() => poll.blind !== m && client.pollSetBlind(m)}
                    className={`rounded-md px-3 py-0.5 text-xs font-semibold transition ${
                      poll.blind === m ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900" : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {m ? "Hidden until reveal" : "Live"}
                  </button>
                ))}
              </div>
            </div>
            {choice && (
              <div className="flex items-center gap-2">
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

      {/* blind progress: who's in, and (for the facilitator) the reveal button */}
      {hidden && (
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-soft dark:border-white/10 dark:bg-[#14141b]">
          <ProgressRing answered={poll.answered} eligible={poll.eligible} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {poll.answered} of {poll.eligible} answered
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500">
              Results stay hidden until the facilitator reveals — answer honestly, nobody's watching. 🔒
            </div>
          </div>
          {isFacil && (
            <button
              onClick={() => client.pollReveal()}
              disabled={poll.answered === 0}
              className="shrink-0 rounded-xl bg-iris-600 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-iris-500 disabled:cursor-default disabled:opacity-40"
            >
              Reveal ✨
            </button>
          )}
        </div>
      )}

      {/* results */}
      {poll.mode === "cloud" ? (
        hidden ? (
          poll.youAnswered ? (
            <WaitingPanel answered={poll.answered} />
          ) : (
            <HiddenPlaceholder text="Drop a word — the cloud appears when the facilitator reveals." />
          )
        ) : (
          <div className="min-h-[240px] rounded-2xl border border-slate-200 bg-white p-8 shadow-soft dark:border-white/10 dark:bg-[#14141b]">
            {poll.cloud.length === 0 ? (
              <p className="text-center text-sm text-slate-400 dark:text-slate-500">Drop a word to start the cloud.</p>
            ) : (
              <WordCloud cloud={poll.cloud} epoch={poll.phase} />
            )}
          </div>
        )
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
                    {/* result bar · masked while blind so counts can't anchor picks */}
                    {!hidden && (
                      <span
                        className="absolute inset-y-0 left-0 -z-0 bg-iris-100/70 dark:bg-iris-500/15"
                        style={{ width: `${(a.votes / maxVotes) * 100}%` }}
                        aria-hidden
                      />
                    )}
                    <span className="relative flex items-center gap-2.5">
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center border-2 text-[11px] font-bold ${
                          poll.multi ? "rounded" : "rounded-full"
                        } ${a.youVoted ? "border-iris-600 bg-iris-600 text-white" : "border-slate-300 text-transparent dark:border-white/20"}`}
                      >
                        ✓
                      </span>
                      <span className="min-w-0 flex-1 break-words text-sm font-medium text-slate-700 dark:text-slate-200">{a.text}</span>
                      {!hidden && (
                        <span className="shrink-0 text-xs font-bold tabular-nums text-slate-500 dark:text-slate-400">
                          {a.votes} · {pct}%
                        </span>
                      )}
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
          {hidden && poll.youAnswered && <WaitingPanel answered={poll.answered} compact />}
        </div>
      ) : (
        // Open Q&A: submitted answers, upvoted, sorted by votes.
        // While blind you only get YOUR answers back from the server; upvoting opens at reveal.
        <div className="space-y-2">
          {hidden && poll.answers.length > 0 && (
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
              Your answers — only you can see these until the reveal:
            </p>
          )}
          {poll.answers.length === 0 ? (
            hidden && poll.youAnswered ? null : (
              <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-soft dark:border-white/10 dark:bg-[#14141b] dark:text-slate-500">
                No answers yet · be the first.
              </p>
            )
          ) : (
            poll.answers.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-soft dark:border-white/10 dark:bg-[#14141b]"
              >
                {!hidden && (
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
                )}
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
          {hidden && poll.youAnswered && <WaitingPanel answered={poll.answered} compact />}
        </div>
      )}
    </div>
  );
}

/** The word cloud: merged words sized by how many distinct people said them, with
 *  dramatic scaling so popular words visibly dominate, plus a staggered pop-in.
 *  `epoch` keys the spans so the whole cloud re-animates on reveal. */
function WordCloud({ cloud, epoch }: { cloud: { word: string; count: number }[]; epoch: string }) {
  const maxCount = Math.max(...cloud.map((c) => c.count));
  return (
    <div className="flex min-h-[200px] flex-wrap content-center items-center justify-center gap-x-5 gap-y-2">
      {cloud.map((c, i) => {
        const ratio = c.count / maxCount;
        // Everything tied (max 1×) renders mid-size; otherwise winners tower over one-offs.
        const size = maxCount === 1 ? 26 : Math.round(17 + Math.pow(ratio, 1.35) * 58);
        // Slight jitter on the small words keeps it organic; the leaders stay level.
        const rot = c.count === maxCount ? 0 : ((i % 5) - 2) * 2;
        return (
          <span key={`${epoch}-${c.word}`} className="inline-block" style={{ transform: `rotate(${rot}deg)` }}>
            <span
              className="animate-pop inline-block font-extrabold leading-tight"
              style={{
                fontSize: `${size}px`,
                color: CLOUD_COLORS[i % CLOUD_COLORS.length],
                opacity: 0.6 + 0.4 * ratio,
                animationDelay: `${Math.min(i * 70, 1400)}ms`,
              }}
              title={`${c.count}×`}
            >
              {c.word}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** Donut progress for the blind phase: answered / eligible. */
function ProgressRing({ answered, eligible }: { answered: number; eligible: number }) {
  const pct = eligible > 0 ? Math.min(answered / eligible, 1) : 0;
  const r = 15.9155; // circumference ≈ 100, so dasharray maps 1:1 to percent
  return (
    <svg viewBox="0 0 36 36" className="h-12 w-12 shrink-0 -rotate-90">
      <circle cx="18" cy="18" r={r} fill="none" strokeWidth="4" className="stroke-slate-200 dark:stroke-white/10" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${pct * 100} 100`}
        className="stroke-iris-500 transition-[stroke-dasharray] duration-500"
      />
    </svg>
  );
}

function HiddenPlaceholder({ text }: { text: string }) {
  return (
    <div className="grid min-h-[200px] place-items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8 dark:border-white/15 dark:bg-white/[0.02]">
      <div className="text-center">
        <div className="mb-2 text-3xl">🤫</div>
        <p className="text-sm font-medium text-slate-400 dark:text-slate-500">{text}</p>
      </div>
    </div>
  );
}

/** The blind waiting room: an anonymized tick when someone answers, interleaved with
 *  rotating quips. Pure client-side flavor — nothing here identifies anyone. */
function WaitingPanel({ answered, compact }: { answered: number; compact?: boolean }) {
  const [feed, setFeed] = useState<{ id: number; text: string }[]>([]);
  const idRef = useRef(0);
  const prevAnswered = useRef(answered);
  const quipRef = useRef(Math.floor(Math.random() * QUIPS.length));

  function push(text: string) {
    idRef.current += 1;
    const id = idRef.current;
    setFeed((f) => [{ id, text }, ...f].slice(0, 4));
  }

  useEffect(() => {
    if (answered > prevAnswered.current) push("someone just answered ✍️");
    prevAnswered.current = answered;
  }, [answered]);

  useEffect(() => {
    push(QUIPS[quipRef.current % QUIPS.length]);
    const t = setInterval(() => {
      quipRef.current += 1;
      push(QUIPS[quipRef.current % QUIPS.length]);
    }, 4500);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-white/10 dark:bg-[#14141b] ${
        compact ? "p-4" : "min-h-[200px] p-6"
      }`}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
        <span className="animate-pulse-soft">●</span> You're in! Waiting for the reveal…
      </div>
      <div className="space-y-1.5" aria-live="polite">
        {feed.map((l, i) => (
          <p
            key={l.id}
            className="animate-rise text-sm font-medium text-slate-500 dark:text-slate-400"
            style={{ opacity: 1 - i * 0.22 }}
          >
            {l.text}
          </p>
        ))}
      </div>
    </div>
  );
}
