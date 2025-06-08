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
  // pop-culture
  throne: "amber", wall: "sky", walkers: "slate", dragons: "rose",
  assemble: "sky", stones: "violet", thanos: "rose", ultron: "slate",
  force: "sky", rebels: "amber", darkside: "slate", empire: "rose",
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
  const [adding, setAdding] = useState(false);
  const [dropEnd, setDropEnd] = useState(false);
  const color = SEMANTIC[column.id] ?? PALETTE[index % PALETTE.length];
  const c = C[color] ?? C.slate;
  const sorted = [...cards].sort((a, b) => a.order - b.order);

  function add() {
    const t = text.trim();
    if (!t) return;
    client.retroAddCard(column.id, t);
    setText("");
  }

  // Drop in the column's open area → append to the end (and pull out of any group).
  function onColumnDrop(e: React.DragEvent) {
    if (!canAct) return;
    e.preventDefault();
    setDropEnd(false);
    const cardId = e.dataTransfer.getData("text/cardId");
    if (cardId) client.retroMoveCard(cardId, column.id, sorted.length);
  }

  // Cluster consecutive same-group cards; a group shows once, at its first member's position.
  type Item =
    | { type: "card"; card: RetroCardView }
    | { type: "group"; gid: string; members: RetroCardView[] };
  const items: Item[] = [];
  const seenGroups = new Set<string>();
  for (const card of sorted) {
    if (card.groupId) {
      if (seenGroups.has(card.groupId)) continue;
      seenGroups.add(card.groupId);
      items.push({ type: "group", gid: card.groupId, members: sorted.filter((c) => c.groupId === card.groupId) });
    } else {
      items.push({ type: "card", card });
    }
  }

  return (
    <section
      className={`flex min-h-[260px] flex-col rounded-2xl p-1 transition ${
        dropEnd ? "bg-iris-500/10 ring-2 ring-iris-400/60" : ""
      }`}
      onDragOver={(e) => {
        if (!canAct) return;
        e.preventDefault();
        setDropEnd(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropEnd(false);
      }}
      onDrop={onColumnDrop}
    >
      <h3 className="mb-3 flex items-center gap-2 px-1">
        <span className={`h-3 w-3 rounded-full ${c.dot} shadow-sm ring-2 ring-white/70 dark:ring-white/10`} aria-hidden />
        <span className={`text-lg font-extrabold tracking-tight ${c.text} dark:text-slate-100`}>
          {column.title}
        </span>
        <span className="ml-auto grid h-5 min-w-[20px] place-items-center rounded-full bg-black/5 px-1.5 text-xs font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">
          {cards.length}
        </span>
      </h3>

      <ul className="flex flex-col gap-3">
        {items.map((item) =>
          item.type === "group" ? (
            <RetroGroup
              key={item.gid}
              members={item.members}
              canAct={canAct}
              isFacil={isFacil}
              spotlightId={spotlightId}
              c={c}
              client={client}
            />
          ) : (
            <RetroCard
              key={item.card.id}
              card={item.card}
              canAct={canAct}
              isFacil={isFacil}
              spotlit={spotlightId === item.card.id}
              c={c}
              client={client}
              onGroup={(draggedId) => {
                setDropEnd(false);
                client.retroGroupCard(draggedId, item.card.id);
              }}
            />
          ),
        )}
      </ul>

      {canAct &&
        (adding ? (
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                add(); // adds it and stays open, so the next sticky is one keystroke away
              } else if (e.key === "Escape") {
                setText("");
                setAdding(false);
              }
            }}
            onBlur={() => {
              if (!text.trim()) setAdding(false);
            }}
            placeholder="Type it, Enter to add. Esc when done."
            aria-label={`Add a card to ${column.title}`}
            rows={2}
            className={`mt-3 w-full resize-none rounded-[10px] px-3.5 py-3 text-[15px] font-medium text-slate-800 shadow-[0_6px_14px_-8px_rgba(15,23,42,0.4)] outline-none ${c.note}`}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            aria-label={`Add a sticky to ${column.title}`}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[10px] border-2 border-dashed border-slate-300 py-2.5 text-sm font-semibold text-slate-400 transition hover:border-iris-400 hover:bg-iris-50/40 hover:text-iris-600 dark:border-white/15 dark:text-slate-500 dark:hover:border-iris-400/60 dark:hover:bg-iris-500/5 dark:hover:text-iris-300"
          >
            <span className="text-lg leading-none">+</span> Add a sticky
          </button>
        ))}
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
  onGroup,
}: {
  card: RetroCardView;
  canAct: boolean;
  isFacil: boolean;
  spotlit: boolean;
  c: { note: string; edge: string; dot: string; text: string };
  client: RoomClient;
  onGroup: (draggedId: string) => void;
}) {
  const [pickReaction, setPickReaction] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(card.text);
  const tilt = tiltOf(card.id);

  function saveEdit() {
    const t = draft.trim();
    if (t && t !== card.text) client.retroEditCard(card.id, t);
    setEditing(false);
  }

  return (
    <li
      draggable={canAct && !editing}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/cardId", card.id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onDragOver={(e) => {
        if (canAct) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        if (!canAct) return;
        e.preventDefault();
        e.stopPropagation();
        const id = e.dataTransfer.getData("text/cardId");
        if (id && id !== card.id) onGroup(id);
      }}
      style={{ rotate: spotlit || dragging ? "0deg" : `${tilt}deg` }}
      className={`group relative rounded-[10px] px-3.5 pb-2.5 pt-3 text-[15px] leading-snug text-slate-800 shadow-[0_6px_14px_-6px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:rotate-0 hover:shadow-[0_12px_22px_-8px_rgba(15,23,42,0.45)] ${c.note} ${
        canAct ? "cursor-grab active:cursor-grabbing" : ""
      } ${spotlit ? "z-10 scale-[1.03] shadow-[0_16px_30px_-10px_rgba(79,70,229,0.55)] ring-2 ring-iris-400 ring-offset-2" : ""} ${
        over ? "scale-[1.02] ring-2 ring-emerald-400" : ""
      } ${dragging ? "opacity-40" : ""} ${card.discussed && !spotlit ? "opacity-65 saturate-50" : ""}`}
    >
      {over && (
        <span className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[10px] bg-emerald-400/10 text-xs font-bold text-emerald-700">
          + group
        </span>
      )}
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

      {editing ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              saveEdit();
            } else if (e.key === "Escape") {
              setEditing(false);
            }
          }}
          onBlur={saveEdit}
          rows={2}
          className="w-full resize-none rounded-md border border-black/10 bg-white/70 px-2 py-1 text-[15px] font-medium text-slate-800 outline-none focus:bg-white"
        />
      ) : (
        <div
          className="whitespace-pre-wrap break-words font-medium"
          onDoubleClick={() => {
            if (canAct && card.mine) {
              setDraft(card.text);
              setEditing(true);
            }
          }}
          title={canAct && card.mine ? "Double-click to edit" : undefined}
        >
          {card.text}
        </div>
      )}

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
              title={spotlit ? "Stop spotlight" : "Spotlight · focus the room here"}
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

/** A cluster of stacked stickies. Shows the summed votes; drag a card out to ungroup. */
function RetroGroup({
  members,
  canAct,
  isFacil,
  spotlightId,
  c,
  client,
}: {
  members: RetroCardView[];
  canAct: boolean;
  isFacil: boolean;
  spotlightId: string | null;
  c: { note: string; edge: string; dot: string; text: string };
  client: RoomClient;
}) {
  const [over, setOver] = useState(false);
  const sumVotes = members.reduce((s, m) => s + m.votes, 0);

  return (
    <li
      onDragOver={(e) => {
        if (canAct) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false);
      }}
      onDrop={(e) => {
        setOver(false);
        if (!canAct) return;
        e.preventDefault();
        e.stopPropagation();
        const id = e.dataTransfer.getData("text/cardId");
        if (id && !members.some((m) => m.id === id)) client.retroGroupCard(id, members[0].id);
      }}
      className={`rounded-2xl border-2 border-dashed p-2 transition ${
        over ? "border-emerald-400 bg-emerald-400/5" : "border-slate-300/70 dark:border-white/15"
      }`}
    >
      <div className="mb-1.5 flex items-center gap-2 px-1 text-xs font-semibold">
        <span className="rounded-full bg-slate-900 px-2 py-0.5 text-white dark:bg-white/15">▲ {sumVotes}</span>
        <span className="text-slate-400 dark:text-slate-500">· {members.length} grouped · drag one out to split</span>
      </div>
      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <RetroCard
            key={m.id}
            card={m}
            canAct={canAct}
            isFacil={isFacil}
            spotlit={spotlightId === m.id}
            c={c}
            client={client}
            onGroup={(draggedId) => client.retroGroupCard(draggedId, m.id)}
          />
        ))}
      </ul>
    </li>
  );
}
