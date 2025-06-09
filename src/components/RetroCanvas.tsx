import { useEffect, useRef, useState } from "react";
import type { RetroView, RetroCardView } from "../../shared/protocol";
import { RETRO_ZONE_W as ZONE_W, RETRO_CANVAS_H as CANVAS_H, RETRO_REACTIONS } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";
import { avatarColor, initials } from "../lib/colors";
import { columnColor, type ColC } from "../lib/retroColors";

const CARD_W = 220;

/**
 * A free, zoomable canvas (Miro/FigJam-style): zones are labeled vertical bands,
 * stickies are placed by (x,y) and dragged anywhere, the board pans via native
 * scroll and zooms with the controls — so 20 people and a wall of stickies still work.
 */
export function RetroCanvas({
  retro,
  canAct,
  isFacil,
  client,
  cursors,
  you,
}: {
  retro: RetroView;
  canAct: boolean;
  isFacil: boolean;
  client: RoomClient;
  cursors: { id: string; name: string; x: number; y: number }[];
  you: string;
}) {
  const [zoom, setZoom] = useState(0.8);
  const [addingZone, setAddingZone] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const viewportRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const lastCursor = useRef(0);

  // Broadcast my cursor (board coords), lightly throttled.
  function onBoardMove(e: React.PointerEvent) {
    if (!canAct || !boardRef.current) return;
    const now = e.timeStamp;
    if (now - lastCursor.current < 50) return;
    lastCursor.current = now;
    const r = boardRef.current.getBoundingClientRect();
    client.cursor((e.clientX - r.left) / zoom, (e.clientY - r.top) / zoom);
  }
  const cols = retro.columns;
  const W = cols.length * ZONE_W;
  // Board height fits the content (no giant empty scroll), capped at the canvas max.
  const boardH = Math.min(CANVAS_H, Math.max(720, ...retro.cards.map((c) => c.y + 200)));

  // Fit-to-width on first mount.
  useEffect(() => {
    const vw = viewportRef.current?.clientWidth ?? 900;
    setZoom(Math.max(0.4, Math.min(1, (vw - 24) / W)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fit() {
    const vw = viewportRef.current?.clientWidth ?? 900;
    setZoom(Math.max(0.4, Math.min(1.2, (vw - 24) / W)));
    if (viewportRef.current) viewportRef.current.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }

  function addInZone(colId: string) {
    const t = draft.trim();
    if (t) client.retroAddCard(colId, t);
    setDraft("");
    setAddingZone(null);
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 shadow-inner dark:border-white/10">
      {/* zoom controls */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/90 p-1 shadow-soft backdrop-blur dark:border-white/10 dark:bg-[#14141b]/90">
        <button onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} className="grid h-7 w-7 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Zoom out">−</button>
        <span className="w-10 text-center text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(2)))} className="grid h-7 w-7 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Zoom in">+</button>
        <button onClick={fit} className="ml-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">Fit</button>
      </div>

      {/* pannable viewport (native scroll) */}
      <div ref={viewportRef} className="dot-grid h-[600px] overflow-auto">
        <div style={{ width: W * zoom, height: boardH * zoom }}>
          <div ref={boardRef} onPointerMove={onBoardMove} id="scrumlo-canvas" className="relative origin-top-left dot-grid" style={{ width: W, height: boardH, transform: `scale(${zoom})` }}>
            {/* zone bands */}
            {cols.map((col, i) => {
              const c = columnColor(col.id, i);
              const count = retro.cards.filter((cd) => cd.column === col.id).length;
              return (
                <div
                  key={col.id}
                  className="absolute top-0 border-r border-dashed border-slate-300/50 dark:border-white/10"
                  style={{ left: i * ZONE_W, width: ZONE_W, height: CANVAS_H }}
                >
                  <div className="sticky top-0 flex items-center gap-2 px-4 pt-3">
                    <span className={`h-3 w-3 rounded-full ${c.dot} ring-2 ring-white/70 dark:ring-white/10`} aria-hidden />
                    <span className={`text-base font-extrabold tracking-tight ${c.text} dark:text-slate-100`}>{col.title}</span>
                    <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-black/5 px-1.5 text-xs font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">{count}</span>
                  </div>
                  {canAct && (
                    <div className="px-4 pt-2">
                      {addingZone === col.id ? (
                        <textarea
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              addInZone(col.id);
                            } else if (e.key === "Escape") {
                              setDraft("");
                              setAddingZone(null);
                            }
                          }}
                          onBlur={() => !draft.trim() && setAddingZone(null)}
                          placeholder="Type it, Enter to add."
                          rows={2}
                          className={`w-full resize-none rounded-[10px] px-3 py-2 text-sm font-medium text-slate-800 shadow ${c.note}`}
                        />
                      ) : (
                        <button
                          onClick={() => {
                            setDraft("");
                            setAddingZone(col.id);
                          }}
                          className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border-2 border-dashed border-slate-300 py-2 text-sm font-semibold text-slate-400 transition hover:border-iris-400 hover:text-iris-600 dark:border-white/15 dark:text-slate-500 dark:hover:text-iris-300"
                        >
                          <span className="text-base leading-none">+</span> Add a sticky
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* stickies */}
            {retro.cards.map((card, i) => (
              <CanvasCard
                key={card.id}
                card={card}
                c={columnColor(card.column, cols.findIndex((z) => z.id === card.column))}
                zoom={zoom}
                canAct={canAct}
                isFacil={isFacil}
                spotlit={retro.spotlightId === card.id}
                client={client}
                idx={i}
              />
            ))}

            {/* live cursors — everyone else's pointer, in board coords */}
            {cursors
              .filter((cu) => cu.id !== you && cu.x >= 0 && cu.x <= W && cu.y >= 0 && cu.y <= boardH)
              .map((cu) => (
                <div
                  key={cu.id}
                  className="pointer-events-none absolute z-40 transition-[left,top] duration-75 ease-linear"
                  style={{ left: cu.x, top: cu.y }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: avatarColor(cu.id) }}>
                    <path d="M2 2 L2 15 L6 11 L9 17 L11.5 16 L8.5 10 L14 10 Z" fill="currentColor" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
                  </svg>
                  <span
                    className="absolute left-4 top-3 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold text-white shadow"
                    style={{ background: avatarColor(cu.id) }}
                  >
                    {cu.name}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function tiltOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ((h % 5) - 2) * 0.8;
}

function CanvasCard({
  card,
  c,
  zoom,
  canAct,
  isFacil,
  spotlit,
  client,
}: {
  card: RetroCardView;
  c: ColC;
  zoom: number;
  canAct: boolean;
  isFacil: boolean;
  spotlit: boolean;
  client: RoomClient;
  idx: number;
}) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(card.text);
  const [pick, setPick] = useState(false);
  const start = useRef({ px: 0, py: 0, cx: 0, cy: 0 });
  const moved = useRef(false);

  const x = drag?.x ?? card.x;
  const y = drag?.y ?? card.y;

  function onDown(e: React.PointerEvent) {
    if (!canAct || editing) return;
    if ((e.target as HTMLElement).closest("button,textarea,input")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { px: e.clientX, py: e.clientY, cx: card.x, cy: card.y };
    moved.current = false;
    setDrag({ x: card.x, y: card.y });
    e.stopPropagation();
  }
  function onMove(e: React.PointerEvent) {
    if (!drag) return;
    const s = start.current;
    moved.current = true;
    setDrag({ x: s.cx + (e.clientX - s.px) / zoom, y: s.cy + (e.clientY - s.py) / zoom });
  }
  function onUp(e: React.PointerEvent) {
    if (!drag) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    if (moved.current) client.retroMoveXY(card.id, Math.round(drag.x), Math.round(drag.y));
    setDrag(null);
  }
  function saveEdit() {
    const t = text.trim();
    if (t && t !== card.text) client.retroEditCard(card.id, t);
    setEditing(false);
  }

  return (
    <div
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      style={{ left: x, top: y, width: CARD_W, rotate: spotlit || drag ? "0deg" : `${tiltOf(card.id)}deg` }}
      className={`group absolute select-none rounded-[10px] px-3.5 pb-2.5 pt-3 text-[15px] leading-snug text-slate-800 shadow-[0_6px_16px_-8px_rgba(15,23,42,0.45)] ${c.note} ${
        canAct ? "cursor-grab active:cursor-grabbing" : ""
      } ${drag ? "z-30 scale-[1.03] shadow-[0_18px_30px_-10px_rgba(15,23,42,0.5)]" : "z-10 hover:z-20"} ${
        spotlit ? "ring-2 ring-iris-500 ring-offset-2" : ""
      } ${card.discussed && !spotlit ? "opacity-65 saturate-50" : ""}`}
    >
      {card.discussed && !spotlit && (
        <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow">✓</span>
      )}
      {card.author && (
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="grid h-4 w-4 place-items-center rounded-full text-[8px] font-bold text-white" style={{ background: avatarColor(card.author) }}>
            {initials(card.author)}
          </span>
          <span className="text-[11px] font-medium text-slate-600/80">{card.author}</span>
        </div>
      )}
      {editing ? (
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              saveEdit();
            } else if (e.key === "Escape") setEditing(false);
          }}
          onBlur={saveEdit}
          rows={2}
          className="w-full resize-none rounded-md border border-black/10 bg-white/70 px-2 py-1 text-[15px] font-medium text-slate-800 outline-none"
        />
      ) : (
        <div
          className="whitespace-pre-wrap break-words font-medium"
          onDoubleClick={() => canAct && card.mine && (setText(card.text), setEditing(true))}
        >
          {card.text}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => client.retroVote(card.id)}
          disabled={!canAct}
          aria-pressed={card.youVoted}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition disabled:cursor-default ${
            card.youVoted ? "bg-slate-900 text-white" : "bg-white/70 text-slate-600 enabled:hover:bg-white"
          }`}
        >
          ▲ {card.votes}
        </button>
        {card.reactions.map((r) => (
          <button
            key={r.emoji}
            onClick={() => canAct && client.retroReact(card.id, r.emoji)}
            className="inline-flex items-center gap-0.5 rounded-full bg-white/60 px-1.5 py-0.5 text-xs hover:bg-white/90"
          >
            {r.emoji}
            <span className="font-semibold text-slate-600">{r.count}</span>
          </button>
        ))}
        {canAct && (
          <div className="relative">
            <button onClick={() => setPick((v) => !v)} className="rounded-full bg-white/55 px-2 py-0.5 text-xs text-slate-500 hover:bg-white/90" aria-label="Add reaction">☺﹢</button>
            {pick && (
              <div className="absolute left-0 top-7 z-40 flex gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-lg">
                {RETRO_REACTIONS.map((e) => (
                  <button key={e} onClick={() => { client.retroReact(card.id, e); setPick(false); }} className="rounded-full px-1 text-base hover:scale-125">{e}</button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          {isFacil && (
            <button
              onClick={() => client.retroSpotlight(spotlit ? null : card.id)}
              title={spotlit ? "Stop spotlight" : "Spotlight — focus the room here"}
              aria-label="Spotlight this sticky"
              className={`grid h-7 w-7 place-items-center rounded-full text-sm transition ${
                spotlit ? "bg-iris-500 text-white shadow" : "bg-white/70 text-slate-500 hover:bg-white hover:text-iris-600"
              }`}
            >
              ◎
            </button>
          )}
          {card.mine && (
            <button
              onClick={() => client.retroDeleteCard(card.id)}
              aria-label="Delete sticky"
              title="Delete"
              className="grid h-7 w-7 place-items-center rounded-full bg-white/70 text-sm text-slate-400 transition hover:bg-white hover:text-rose-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
