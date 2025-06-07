import { useState } from "react";
import type { RetroColumn as Col, RetroCardView } from "../../shared/protocol";
import { RETRO_REACTIONS } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";
import { avatarColor, initials } from "../lib/colors";

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

const C: Record<string, { dot: string; from: string; text: string; ring: string }> = {
  emerald: { dot: "bg-emerald-400", from: "from-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  sky: { dot: "bg-sky-400", from: "from-sky-50", text: "text-sky-700", ring: "ring-sky-200" },
  amber: { dot: "bg-amber-400", from: "from-amber-50", text: "text-amber-700", ring: "ring-amber-200" },
  violet: { dot: "bg-violet-400", from: "from-violet-50", text: "text-violet-700", ring: "ring-violet-200" },
  rose: { dot: "bg-rose-400", from: "from-rose-50", text: "text-rose-700", ring: "ring-rose-200" },
  teal: { dot: "bg-teal-400", from: "from-teal-50", text: "text-teal-700", ring: "ring-teal-200" },
  orange: { dot: "bg-orange-400", from: "from-orange-50", text: "text-orange-700", ring: "ring-orange-200" },
  slate: { dot: "bg-slate-400", from: "from-slate-100", text: "text-slate-700", ring: "ring-slate-200" },
};

export function RetroColumn({
  column,
  index,
  cards,
  canAct,
  isFacil,
  spotlightId,
  client,
}: {
  column: Col;
  index: number;
  cards: RetroCardView[];
  canAct: boolean;
  isFacil: boolean;
  spotlightId: string | null;
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
          <RetroCard
            key={card.id}
            card={card}
            canAct={canAct}
            isFacil={isFacil}
            spotlit={spotlightId === card.id}
            ring={c.ring}
            client={client}
          />
        ))}
      </ul>

      {canAct && (
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
      )}
    </section>
  );
}

function RetroCard({
  card,
  canAct,
  isFacil,
  spotlit,
  ring,
  client,
}: {
  card: RetroCardView;
  canAct: boolean;
  isFacil: boolean;
  spotlit: boolean;
  ring: string;
  client: RoomClient;
}) {
  const [pickReaction, setPickReaction] = useState(false);

  return (
    <li
      className={`group rounded-xl border bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition ${
        spotlit ? `border-transparent ring-2 ring-indigo-400 ${ring}` : "border-slate-200"
      }`}
    >
      {card.author && (
        <div className="mb-1.5 flex items-center gap-1.5">
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white"
            style={{ background: avatarColor(card.author) }}
          >
            {initials(card.author)}
          </span>
          <span className="text-[11px] font-medium text-slate-400">{card.author}</span>
        </div>
      )}

      <div className="whitespace-pre-wrap break-words">{card.text}</div>

      {card.reactions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.reactions.map((r) => (
            <button
              key={r.emoji}
              onClick={() => canAct && client.retroReact(card.id, r.emoji)}
              disabled={!canAct}
              className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs transition disabled:cursor-default ${
                r.mine ? "border-indigo-300 bg-indigo-50" : "border-slate-200 hover:border-indigo-300"
              }`}
            >
              <span>{r.emoji}</span>
              <span className="font-semibold text-slate-500">{r.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => client.retroVote(card.id)}
          disabled={!canAct}
          aria-pressed={card.youVoted}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition disabled:cursor-default disabled:opacity-60 ${
            card.youVoted
              ? "border-indigo-300 bg-indigo-50 text-indigo-700"
              : "border-slate-200 text-slate-500 enabled:hover:border-indigo-300"
          }`}
        >
          ▲ {card.votes}
        </button>

        {canAct && (
          <div className="relative">
            <button
              onClick={() => setPickReaction((v) => !v)}
              aria-label="Add reaction"
              className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-400 transition hover:border-indigo-300 hover:text-indigo-500"
            >
              ☺﹢
            </button>
            {pickReaction && (
              <div className="absolute left-0 top-7 z-10 flex gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-lg">
                {RETRO_REACTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      client.retroReact(card.id, e);
                      setPickReaction(false);
                    }}
                    className="rounded-full px-1 text-base transition hover:scale-125"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isFacil && (
            <button
              onClick={() => client.retroSpotlight(spotlit ? null : card.id)}
              aria-label={spotlit ? "Stop spotlight" : "Spotlight this card"}
              title={spotlit ? "Stop spotlight" : "Spotlight — focus the room here"}
              className={`text-xs transition ${
                spotlit
                  ? "text-indigo-500"
                  : "text-slate-300 opacity-0 hover:text-indigo-500 group-focus-within:opacity-100 group-hover:opacity-100"
              }`}
            >
              ◎
            </button>
          )}
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
      </div>
    </li>
  );
}
