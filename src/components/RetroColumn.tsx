import { useState } from "react";
import type { RetroColumn as Col, RetroCardView } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";

const COLUMN_TINT: Record<string, string> = {
  start: "from-emerald-50",
  continue: "from-sky-50",
  stop: "from-rose-50",
  glad: "from-emerald-50",
  sad: "from-amber-50",
  mad: "from-rose-50",
};

export function RetroColumn({
  column,
  cards,
  client,
}: {
  column: Col;
  cards: RetroCardView[];
  client: RoomClient;
}) {
  const [text, setText] = useState("");
  const tint = COLUMN_TINT[column.id] ?? "from-slate-50";
  // highest-voted first
  const sorted = [...cards].sort((a, b) => b.votes - a.votes);

  function add() {
    const t = text.trim();
    if (!t) return;
    client.retroAddCard(column.id, t);
    setText("");
  }

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-gradient-to-b ${tint} to-white p-3 shadow-sm`}
    >
      <h3 className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold text-slate-700">
        <span aria-hidden>{column.emoji}</span>
        {column.title}
        <span className="ml-auto text-xs font-normal text-slate-400">{cards.length}</span>
      </h3>

      <ul className="space-y-2">
        {sorted.map((c) => (
          <li
            key={c.id}
            className="group rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm"
          >
            <div className="whitespace-pre-wrap break-words">{c.text}</div>
            <div className="mt-2 flex items-center justify-between">
              <button
                onClick={() => client.retroVote(c.id)}
                aria-pressed={c.youVoted}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition ${
                  c.youVoted
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-500 hover:border-indigo-300"
                }`}
              >
                ▲ {c.votes}
              </button>
              {c.mine && (
                <button
                  onClick={() => client.retroDeleteCard(c.id)}
                  aria-label="Delete card"
                  className="text-xs text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-500"
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
