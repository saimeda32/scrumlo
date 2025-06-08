import { useState } from "react";
import type { RetroColumn as Col, RetroCardView } from "../../shared/protocol";
import { RETRO_REACTIONS } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";
import { avatarColor, initials } from "../lib/colors";

// Each column is a zone on the wall; its cards are sticky notes in the zone's color.
// Semantic where the meaning is known (start=green, stop=pink), else a palette by position.
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
const PALETTE = ["amber", "sky", "emerald", "rose", "violet", "teal"];

// Sticky-note color = solid warm paper. dot/text for the zone header.
const C: Record<string, { note: string; edge: string; dot: string; text: string }> = {
  amber: { note: "bg-amber-200", edge: "bg-amber-300", dot: "bg-amber-400", text: "text-amber-800" },
  emerald: { note: "bg-emerald-200", edge: "bg-emerald-300", dot: "bg-emerald-400", text: "text-emerald-800" },
  sky: { note: "bg-sky-200", edge: "bg-sky-300", dot: "bg-sky-400", text: "text-sky-800" },
  rose: { note: "bg-rose-200", edge: "bg-rose-300", dot: "bg-rose-400", text: "text-rose-800" },
  violet: { note: "bg-violet-200", edge: "bg-violet-300", dot: "bg-violet-400", text: "text-violet-800" },
  teal: { note: "bg-teal-200", edge: "bg-teal-300", dot: "bg-teal-400", text: "text-teal-800" },
  orange: { note: "bg-orange-200", edge: "bg-orange-300", dot: "bg-orange-400", text: "text-orange-800" },
  slate: { note: "bg-slate-200", edge: "bg-slate-300", dot: "bg-slate-400", text: "text-slate-700" },
};

// Small deterministic tilt per note so the wall feels hand-placed, not snapped to a grid.
function tiltOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ((h % 5) - 2) * 0.9; // -1.8°..+1.8°
}

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
  const color = SEMANTIC[column.id] ?? PALETTE[index % PALETTE.length];
  const c = C[color] ?? C.slate;
  const sorted = [...cards].sort((a, b) => b.votes - a.votes);

  function add() {
    const t = text.trim();
    if (!t) return;
    client.retroAddCard(column.id, t);
    setText("");
  }

  return (
    <section className="flex min-h-[260px] flex-col">
      <h3 className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold">
        <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} aria-hidden />
        <span className={c.text}>{column.title}</span>
        <span className="ml-auto text-xs font-normal text-slate-400">{cards.length}</span>
      </h3>

      <ul className="flex flex-col gap-3">
        {sorted.map((card) => (
          <RetroCard
            key={card.id}
            card={card}
            canAct={canAct}
            isFacil={isFacil}
            spotlit={spotlightId === card.id}
            c={c}
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
          placeholder="+ jot a sticky…"
          aria-label={`Add a card to ${column.title}`}
          rows={1}
          className="mt-3 w-full resize-none rounded-lg border border-dashed border-slate-300 bg-white/50 px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
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
  c,
  client,
}: {
  card: RetroCardView;
  canAct: boolean;
  isFacil: boolean;
  spotlit: boolean;
  c: { note: string; edge: string; dot: string; text: string };
  client: RoomClient;
}) {
  const [pickReaction, setPickReaction] = useState(false);
  const tilt = tiltOf(card.id);

  return (
    <li
      style={{ rotate: spotlit ? "0deg" : `${tilt}deg` }}
      className={`group relative rounded-[10px] px-3.5 pb-2.5 pt-3 text-[15px] leading-snug text-slate-800 shadow-[0_6px_14px_-6px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:rotate-0 hover:shadow-[0_12px_22px_-8px_rgba(15,23,42,0.45)] ${c.note} ${
        spotlit ? "z-10 scale-[1.03] shadow-[0_16px_30px_-10px_rgba(79,70,229,0.55)] ring-2 ring-iris-400 ring-offset-2" : ""
      } ${card.discussed && !spotlit ? "opacity-65 saturate-50" : ""}`}
    >
      {/* peeled corner */}
      <span
        className={`pointer-events-none absolute bottom-0 right-0 h-4 w-4 rounded-br-[10px] ${c.edge}`}
        style={{ clipPath: "polygon(100% 0, 0 100%, 100% 100%)" }}
        aria-hidden
      />

      {card.discussed && !spotlit && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow" title="Discussed">
          ✓
        </span>
      )}

      {card.author && (
        <div className="mb-1.5 flex items-center gap-1.5">
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white"
            style={{ background: avatarColor(card.author) }}
          >
            {initials(card.author)}
          </span>
          <span className="text-[11px] font-medium text-slate-600/80">{card.author}</span>
        </div>
      )}

      <div className="whitespace-pre-wrap break-words font-medium">{card.text}</div>

      {card.reactions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.reactions.map((r) => (
            <button
              key={r.emoji}
              onClick={() => canAct && client.retroReact(card.id, r.emoji)}
              disabled={!canAct}
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs transition disabled:cursor-default ${
                r.mine ? "bg-white/90 ring-1 ring-slate-300" : "bg-white/55 hover:bg-white/90"
              }`}
            >
              <span>{r.emoji}</span>
              <span className="font-semibold text-slate-600">{r.count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => client.retroVote(card.id)}
          disabled={!canAct}
          aria-pressed={card.youVoted}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition disabled:cursor-default disabled:opacity-70 ${
            card.youVoted ? "bg-slate-900 text-white" : "bg-white/70 text-slate-600 enabled:hover:bg-white"
          }`}
        >
          ▲ {card.votes}
        </button>

        {canAct && (
          <div className="relative">
            <button
              onClick={() => setPickReaction((v) => !v)}
              aria-label="Add reaction"
              className="rounded-full bg-white/55 px-2 py-0.5 text-xs text-slate-500 transition hover:bg-white/90"
            >
              ☺﹢
            </button>
            {pickReaction && (
              <div className="absolute left-0 top-7 z-20 flex gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-lg">
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
                  ? "text-iris-600"
                  : "text-slate-500/60 opacity-0 hover:text-iris-600 group-focus-within:opacity-100 group-hover:opacity-100"
              }`}
            >
              ◎
            </button>
          )}
          {card.mine && (
            <button
              onClick={() => client.retroDeleteCard(card.id)}
              aria-label="Delete card"
              className="text-xs text-slate-500/50 opacity-0 transition focus:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-rose-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
