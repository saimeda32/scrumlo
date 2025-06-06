import { useState } from "react";
import type { RetroColumn as Col, RetroCardView } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";

// Engineering-grade color identity per column (no cartoon graphics). Semantic where
// the meaning is known (start=green, stop=red), else a palette spread by position —
// so every format looks distinct and designed, not an identical gray kanban.
const SEMANTIC: Record<string, string> = {
  start: "emerald", continue: "sky", stop: "rose",
  glad: "emerald", sad: "amber", mad: "rose",
  well: "emerald", didnt: "rose", actions: "violet",
  liked: "emerald", learned: "sky", lacked: "amber", longed: "violet",
  drop: "rose", add: "emerald", keep: "sky", improve: "violet",
  wind: "sky", anchor: "slate", rocks: "amber", island: "emerald",
  more: "emerald", less: "amber", plus: "emerald", delta: "violet",
  straw: "amber", sticks: "orange", bricks: "rose",
};
const PALETTE = ["emerald", "sky", "amber", "violet", "rose", "teal"];

const C: Record<string, { dot: string; from: string; text: string }> = {
  emerald: { dot: "bg-emerald-400", from: "from-emerald-50", text: "text-emerald-700" },
  sky: { dot: "bg-sky-400", from: "from-sky-50", text: "text-sky-700" },
  amber: { dot: "bg-amber-400", from: "from-amber-50", text: "text-amber-700" },
  violet: { dot: "bg-violet-400", from: "from-violet-50", text: "text-violet-700" },
  rose: { dot: "bg-rose-400", from: "from-rose-50", text: "text-rose-700" },
  teal: { dot: "bg-teal-400", from: "from-teal-50", text: "text-teal-700" },
  orange: { dot: "bg-orange-400", from: "from-orange-50", text: "text-orange-700" },
  slate: { dot: "bg-slate-400", from: "from-slate-100", text: "text-slate-700" },
};

export function RetroColumn({
  column,
  index,
  cards,
  client,
}: {
  column: Col;
  index: number;
  cards: RetroCardView[];
  client: RoomClient;
}) {
  const [text, setText] = useState("");
  const c = C[SEMANTIC[column.id] ?? PALETTE[index % PALETTE.length]] ?? C.slate;
  const sorted = [...cards].sort((a, b) => b.votes - a.votes);

  function add() {
    const t = text.trim();
    if (!t) return;
    client.retroAddCard(column.id, t);
    setText("");
  }

  return (
    <section
      className={`flex min-h-[220px] flex-col rounded-2xl border border-slate-200 bg-gradient-to-b ${c.from} to-white p-3 shadow-sm`}
    >
      <h3 className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold">
        <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} aria-hidden />
        <span className={c.text}>{column.title}</span>
        <span className="ml-auto text-xs font-normal text-slate-400">{cards.length}</span>
      </h3>

      <ul className="space-y-2">
        {sorted.map((card) => (
          <li
            key={card.id}
            className="group rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm"
          >
            <div className="whitespace-pre-wrap break-words">{card.text}</div>
            <div className="mt-2 flex items-center justify-between">
              <button
                onClick={() => client.retroVote(card.id)}
                aria-pressed={card.youVoted}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${
                  card.youVoted
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-500 hover:border-indigo-300"
                }`}
              >
                ▲ {card.votes}
              </button>
              {card.mine && (
                <button
                  onClick={() => client.retroDeleteCard(card.id)}
                  aria-label="Delete card"
                  className="text-xs text-slate-300 opacity-0 transition focus:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-rose-500"
                >
                  ✕
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            add();
          }
        }}
        placeholder="+ add a card…"
        aria-label={`Add a card to ${column.title}`}
        rows={1}
        className="mt-2 w-full resize-none rounded-xl border border-dashed border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-400"
      />
    </section>
  );
}
