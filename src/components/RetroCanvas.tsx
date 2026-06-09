import { useEffect, useRef, useState } from "react";
import type { RetroView, RetroCardView } from "../../shared/protocol";
import { RETRO_ZONE_W as ZONE_W, RETRO_CANVAS_H as CANVAS_H, RETRO_REACTIONS, RETRO_PHASES } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";
import { avatarColor, initials } from "../lib/colors";
import { columnColor, type ColC } from "../lib/retroColors";
import { retroTheme } from "../lib/retroThemes";
import { RetroGlyph } from "./RetroGlyph";
import { useCursors } from "../store/cursorStore";

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
  you,
}: {
  retro: RetroView;
  canAct: boolean;
  isFacil: boolean;
  client: RoomClient;
  you: string;
}) {
  // Read cursors straight from their own store so a cursor frame re-renders only
  // this canvas, never the whole Room tree.
  const cursors = useCursors((s) => s.cursors);
  const [zoom, setZoom] = useState(0.8);
  const [addingZone, setAddingZone] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [full, setFull] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Fullscreen makes the wall big enough for 4–5 columns. Escape exits.
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);
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

  // Cards other people are dragging right now (live, pre-drop) — render them at
  // the in-flight position so they glide for everyone, not just jump on release.
  const liveDrag = new Map<string, { x: number; y: number }>();
  for (const cu of cursors) if (cu.drag) liveDrag.set(cu.drag.cardId, { x: cu.drag.x, y: cu.drag.y });

  const theme = retroTheme(retro.template);

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
    <div
      className={
        full
          ? "fixed inset-0 z-50 overflow-hidden border-0 bg-slate-50 p-3 dark:bg-[#0a0a0f]"
          : "relative overflow-hidden rounded-3xl border border-slate-200/80 shadow-inner dark:border-white/10"
      }
    >
      {/* zoom + fullscreen controls */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/90 p-1 shadow-soft backdrop-blur dark:border-white/10 dark:bg-[#14141b]/90">
        <button onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} className="grid h-7 w-7 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Zoom out">−</button>
        <span className="w-10 text-center text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(2)))} className="grid h-7 w-7 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Zoom in">+</button>
        <button onClick={fit} className="ml-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">Fit</button>
        <button
          onClick={() => setFull((v) => !v)}
          className="ml-0.5 grid h-7 w-7 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
          aria-label={full ? "Exit fullscreen" : "Fullscreen"}
          title={full ? "Exit fullscreen (Esc)" : "Fullscreen — more room for the wall"}
        >
          {full ? "⤡" : "⤢"}
        </button>
      </div>

      {/* in fullscreen the phase rail is hidden — surface a compact phase control */}
      {full && (
        <div className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 shadow-soft backdrop-blur dark:border-white/10 dark:bg-[#14141b]/90">
          <span className="text-xs font-bold tracking-tight text-iris-600 dark:text-iris-300">
            {RETRO_PHASES.find((p) => p.id === retro.phase)?.label ?? "Retro"}
          </span>
          {isFacil &&
            (() => {
              const idx = RETRO_PHASES.findIndex((p) => p.id === retro.phase);
              const next = RETRO_PHASES[idx + 1];
              return next ? (
                <button
                  onClick={() => client.retroSetPhase(next.id)}
                  className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
                >
                  {retro.phase === "brainstorm" ? "Reveal →" : `${next.label} →`}
                </button>
              ) : null;
            })()}
        </div>
      )}

      {/* pannable viewport (native scroll) */}
      <div
        ref={viewportRef}
        className={`dot-grid overflow-auto ${full ? "h-[calc(100vh-24px)] rounded-2xl" : "h-[600px]"}`}
        style={{ touchAction: "pan-x pan-y" }}
      >
        <div style={{ width: W * zoom, height: boardH * zoom }}>
          <div ref={boardRef} onPointerMove={onBoardMove} id="scrumlo-canvas" className="relative origin-top-left dot-grid" style={{ width: W, height: boardH, transform: `scale(${zoom})` }}>
            <ThemedBackdrop template={retro.template} glow={theme.glow} w={W} h={boardH} />
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
                canVote={canAct && retro.phase === "vote"}
                isFacil={isFacil}
                spotlit={retro.spotlightId === card.id}
                client={client}
                live={liveDrag.get(card.id) ?? null}
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

/**
 * A playful, theme-aware backdrop: a soft color wash at the top plus a faint
 * scatter of the theme's own glyph (sailboats, shields, crowns, rockets…) so the
 * board feels like *that* retro, not a blank grid. Deterministic + decorative.
 */
function ThemedBackdrop({
  template,
  glow,
  w,
  h,
}: {
  template: string;
  glow: string;
  w: number;
  h: number;
}) {
  const cols = Math.max(2, Math.floor(w / 230));
  const rows = Math.max(2, Math.floor(h / 230));
  const motifs: { x: number; y: number; rot: number; size: number; op: number; i: number }[] = [];
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // brick-offset rows + per-cell jitter so it reads organic, not gridded
      const off = r % 2 ? 115 : 0;
      const jx = ((i * 53) % 64) - 32;
      const jy = ((i * 31) % 64) - 32;
      motifs.push({
        x: c * 230 + 70 + off + jx,
        y: r * 230 + 70 + jy,
        rot: ((i * 37) % 48) - 24,
        size: 64 + ((i * 17) % 66),
        op: 0.04 + ((i * 7) % 4) * 0.012,
        i,
      });
      i++;
    }
  }
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-x-0 top-0 h-72 opacity-[0.07]"
        style={{ background: `radial-gradient(70% 100% at 50% 0%, ${glow}, transparent 72%)` }}
      />
      {motifs.map((m) => (
        <RetroGlyph
          key={m.i}
          template={template}
          className="absolute"
          style={{
            left: m.x,
            top: m.y,
            width: m.size,
            height: m.size,
            color: glow,
            opacity: m.op,
            transform: `rotate(${m.rot}deg)`,
          }}
        />
      ))}
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
  canVote,
  isFacil,
  spotlit,
  client,
  live,
}: {
  card: RetroCardView;
  c: ColC;
  zoom: number;
  canAct: boolean;
  canVote: boolean;
  isFacil: boolean;
  spotlit: boolean;
  client: RoomClient;
  live: { x: number; y: number } | null;
  idx: number;
}) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(card.text);
  const [pick, setPick] = useState(false);
  const start = useRef({ px: 0, py: 0, cx: 0, cy: 0 });
  const moved = useRef(false);
  const lastLive = useRef(0);

  // Local drag wins; otherwise follow a teammate's live drag; else the resting spot.
  const x = drag?.x ?? live?.x ?? card.x;
  const y = drag?.y ?? live?.y ?? card.y;

  // Blind brainstorm: someone else's note, text withheld by the server. Show a
  // calm placeholder so you know it's there without it anchoring your thinking.
  if (card.masked) {
    return (
      <div
        style={{ left: card.x, top: card.y, width: CARD_W, rotate: `${tiltOf(card.id)}deg` }}
        className={`absolute z-10 select-none rounded-[10px] px-3.5 py-4 ${c.note} opacity-60`}
        aria-hidden
      >
        <div className="flex items-center gap-2 text-slate-500/70">
          <span className="text-base">🔒</span>
          <div className="h-2 flex-1 rounded-full bg-slate-500/20" />
        </div>
        <div className="mt-2 h-2 w-2/3 rounded-full bg-slate-500/15" />
      </div>
    );
  }

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
    // Don't let this bubble to the board's cursor handler — otherwise it sends a
    // no-drag cursor that races ours and makes the card flicker for everyone else.
    e.stopPropagation();
    const s = start.current;
    moved.current = true;
    const nx = s.cx + (e.clientX - s.px) / zoom;
    const ny = s.cy + (e.clientY - s.py) / zoom;
    setDrag({ x: nx, y: ny });
    // Broadcast the in-flight position so others see it glide (throttled ~20/s).
    if (e.timeStamp - lastLive.current >= 50) {
      lastLive.current = e.timeStamp;
      client.cursor(nx, ny, { cardId: card.id, x: Math.round(nx), y: Math.round(ny) });
    }
  }
  function onUp(e: React.PointerEvent) {
    if (!drag) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    if (moved.current) {
      // Dropped on top of another sticky? Cluster them. Otherwise free-place.
      const onto = document
        .elementsFromPoint(e.clientX, e.clientY)
        .map((el) => (el as HTMLElement).closest?.("[data-card-id]") as HTMLElement | null)
        .find((el) => el && el.dataset.cardId && el.dataset.cardId !== card.id);
      const ontoId = onto?.dataset.cardId;
      if (ontoId) client.retroGroupCard(card.id, ontoId);
      else client.retroMoveXY(card.id, Math.round(drag.x), Math.round(drag.y));
      client.cursor(drag.x, drag.y); // clear the live-drag flag for everyone
    }
    setDrag(null);
  }
  function saveEdit() {
    const t = text.trim();
    if (t && t !== card.text) client.retroEditCard(card.id, t);
    setEditing(false);
  }
  // Keyboard accessibility: nudge a focused sticky with the arrow keys (Shift = bigger
  // step), so the canvas isn't mouse-only.
  function onKey(e: React.KeyboardEvent) {
    if (!canAct || editing) return;
    const step = e.shiftKey ? 60 : 20;
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else if (e.key === "ArrowUp") dy = -step;
    else if (e.key === "ArrowDown") dy = step;
    else return;
    e.preventDefault();
    client.retroMoveXY(card.id, Math.round(card.x + dx), Math.round(card.y + dy));
  }

  return (
    <div
      data-card-id={card.id}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onKeyDown={onKey}
      tabIndex={canAct ? 0 : -1}
      role="group"
      aria-label={`Sticky: ${card.text}. Arrow keys to move.`}
      style={{ left: x, top: y, width: CARD_W, touchAction: "none", rotate: spotlit || drag || live ? "0deg" : `${tiltOf(card.id)}deg` }}
      className={`group absolute select-none rounded-[10px] px-3.5 pb-2.5 pt-3 text-[15px] leading-snug text-slate-800 shadow-[0_6px_16px_-8px_rgba(15,23,42,0.45)] ${c.note} ${
        canAct ? "cursor-grab active:cursor-grabbing" : ""
      } ${
        drag
          ? "z-30 scale-[1.03] shadow-[0_18px_30px_-10px_rgba(15,23,42,0.5)]"
          : live
            ? "z-20 scale-[1.02] ring-2 ring-violet-400/70 shadow-[0_14px_26px_-10px_rgba(15,23,42,0.45)] transition-[left,top] duration-75 ease-linear"
            : "z-10 hover:z-20"
      } ${
        spotlit ? "ring-2 ring-iris-500 ring-offset-2" : ""
      } ${card.groupId && !spotlit && !drag && !live ? "ring-1 ring-violet-300" : ""} ${
        card.discussed && !spotlit ? "opacity-65 saturate-50" : ""
      }`}
    >
      {card.discussed && !spotlit && (
        <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow">✓</span>
      )}
      {card.groupId && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (canAct) client.retroMoveXY(card.id, Math.round(card.x + 30), Math.round(card.y + 30));
          }}
          title={`Cluster of ${card.groupSize} · click to pull this one out`}
          aria-label={`Grouped, ${card.groupSize} cards. Click to ungroup this one.`}
          className="absolute -left-1.5 -top-2 inline-flex items-center gap-0.5 rounded-full bg-violet-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow hover:bg-violet-600"
        >
          ⧉ {card.groupSize}
        </button>
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
          disabled={!canVote && !card.youVoted}
          aria-pressed={card.youVoted}
          aria-label={
            card.groupId
              ? `Vote · cluster has ${card.groupVotes} ${card.groupVotes === 1 ? "vote" : "votes"}`
              : `Vote · ${card.votes} ${card.votes === 1 ? "vote" : "votes"}`
          }
          title={card.groupId ? `Cluster total: ${card.groupVotes} across ${card.groupSize} cards` : undefined}
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition disabled:cursor-default ${
            card.youVoted ? "bg-slate-900 text-white" : "bg-white/70 text-slate-600 enabled:hover:bg-white"
          }`}
        >
          ▲ {card.groupId ? card.groupVotes : card.votes}
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
          {canAct && (
            <button
              onClick={() => client.retroSetAction(card.id, !card.action, card.owner ?? null)}
              title={card.action ? "Unmark action item" : "Mark as an action item"}
              aria-label={card.action ? "Unmark action item" : "Mark as action item"}
              className={`grid h-7 w-7 place-items-center rounded-full text-sm transition ${
                card.action ? "bg-amber-400 text-white shadow" : "bg-white/70 text-slate-500 hover:bg-white hover:text-amber-600"
              }`}
            >
              ⚑
            </button>
          )}
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

      {card.action && (
        <div
          className="mt-1.5 flex items-center gap-1.5 rounded-md bg-amber-100/80 px-2 py-1 text-[11px] font-bold text-amber-800"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="shrink-0">⚑ Action</span>
          {canAct ? (
            <input
              defaultValue={card.owner ?? ""}
              key={card.owner ?? ""}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if ((v || null) !== (card.owner ?? null)) client.retroSetAction(card.id, true, v || null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              placeholder="owner?"
              aria-label="Action item owner"
              className="w-20 rounded bg-white/80 px-1.5 py-0.5 text-[11px] font-semibold text-amber-900 outline-none placeholder:font-medium placeholder:text-amber-500/70"
            />
          ) : (
            <span className="font-semibold">· {card.owner || "unassigned"}</span>
          )}
        </div>
      )}
    </div>
  );
}
