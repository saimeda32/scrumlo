import { useEffect, useRef, useState } from "react";
import type { RetroView, RetroCardView } from "../../shared/protocol";
import { RETRO_ZONE_W as ZONE_W, RETRO_CANVAS_H as CANVAS_H, RETRO_REACTIONS, RETRO_TAGS, RETRO_TEMPLATES, STICKY_COLORS, retroSpanOf } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";
import { avatarColor, initials } from "../lib/colors";
import { useLead } from "../store/leadStore";
import { columnColor, stickyTone, STICKY_SWATCH, type ColC } from "../lib/retroColors";
import { retroTheme } from "../lib/retroThemes";
import { RetroGlyph } from "./RetroGlyph";
import { useCursors } from "../store/cursorStore";
import { memo } from "react";
import { FullscreenBar } from "./FullscreenBar";
import { LogoMark } from "./Logo";

const CARD_W = 220;

/** Tag chip tones — one stable color per structured tag. */
const TAG_TONES: Record<string, string> = {
  Priority: "bg-rose-100 text-rose-700",
  "Quick win": "bg-emerald-100 text-emerald-700",
  Blocked: "bg-amber-100 text-amber-800",
  Idea: "bg-sky-100 text-sky-700",
};
const tagTone = (t: string) => TAG_TONES[t] ?? "bg-slate-100 text-slate-600";

/** Card element under the pointer, excluding the card being dragged. */
function cardUnderPointer(x: number, y: number, selfId: string): HTMLElement | null {
  return (
    document
      .elementsFromPoint(x, y)
      .map((el) => (el as HTMLElement).closest?.("[data-card-id]") as HTMLElement | null)
      .find((el): el is HTMLElement => !!el && !!el.dataset.cardId && el.dataset.cardId !== selfId) ?? null
  );
}

/** Curved connector between two anchors · control arms scale with the horizontal gap. */
function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const arm = Math.max(40, Math.min(Math.abs(x2 - x1) / 2, 160)) * (x2 >= x1 ? 1 : -1);
  return `M ${x1} ${y1} C ${x1 + arm} ${y1}, ${x2 - arm} ${y2}, ${x2} ${y2}`;
}

/** Leave from the side facing the target (right edge when heading right, etc). */
function edgeAnchors(f: { x: number; y: number }, t: { x: number; y: number }) {
  const ltr = t.x >= f.x;
  return { x1: f.x + (ltr ? CARD_W : 0), y1: f.y + 36, x2: t.x + (ltr ? 0 : CARD_W), y2: t.y + 36 };
}

// The card currently highlighted as a group target under an in-flight drag. Imperative
// DOM state on purpose: hover-during-drag changes at pointermove rate, and a store write
// would re-render the canvas every frame for a purely local affordance.
let dropTargetEl: HTMLElement | null = null;
function setDropTarget(el: HTMLElement | null) {
  if (dropTargetEl === el) return;
  if (dropTargetEl) delete dropTargetEl.dataset.dropTarget;
  dropTargetEl = el;
  if (el) el.dataset.dropTarget = "group";
}

/**
 * A free, zoomable canvas (Miro/FigJam-style): zones are labeled vertical bands,
 * stickies are placed by (x,y) and dragged anywhere, the board pans via native
 * scroll and zooms with the controls · so 20 people and a wall of stickies still work.
 */
export function RetroCanvas({
  retro,
  canAct,
  isFacil,
  client,
  you,
  isBoard = false,
  timerEndsAt = null,
  timerDurationMs = null,
}: {
  retro: RetroView;
  canAct: boolean;
  isFacil: boolean;
  client: RoomClient;
  you: string;
  isBoard?: boolean;
  timerEndsAt?: number | null;
  timerDurationMs?: number | null;
}) {
  // NOTE: RetroCanvas deliberately does NOT subscribe to the cursor store · that
  // would re-render the whole wall ~20×/sec. Cursor pointers live in <CursorLayer>
  // and each card subscribes to only its own live-drag, so a mouse move re-renders
  // just those tiny pieces, never the board/backdrop.
  const [zoom, setZoom] = useState(0.8);
  const [full, setFull] = useState(false);
  const [gatherOpen, setGatherOpen] = useState(false);
  const [linkDrag, setLinkDrag] = useState<{ from: string; x: number; y: number } | null>(null);
  const [leading, setLeading] = useState(false);
  const lead = useLead((s) => s.lead);
  const ignoring = useLead((s) => s.ignoring);
  const following = !!lead && lead.byId !== you && !ignoring;
  const lastLead = useRef(0);
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
  const colIndex = new Map(cols.map((z, i) => [z.id, i])); // O(1) column lookup per card
  const cardById = new Map(retro.cards.map((c) => [c.id, c]));
  // First member of each cluster renders the title pill (one pill per cluster).
  const groupHead = new Map<string, string>();
  for (const c of retro.cards) if (c.groupId && !groupHead.has(c.groupId)) groupHead.set(c.groupId, c.id);

  // Connector drag (Miro-style): grab a card's edge handle, pull a curve to the target.
  function boardPoint(clientX: number, clientY: number) {
    const r = boardRef.current?.getBoundingClientRect();
    return r ? { x: (clientX - r.left) / zoom, y: (clientY - r.top) / zoom } : { x: 0, y: 0 };
  }
  function onLinkPreview(from: string, clientX: number, clientY: number) {
    setLinkDrag({ from, ...boardPoint(clientX, clientY) });
  }
  function onLinkEnd(from: string, toId: string | null) {
    if (toId && toId !== from) client.retroLinkCards(from, toId);
    setLinkDrag(null);
  }

  // "Take the lead": publish my viewport (scroll + zoom) while leading; followers mirror it.
  function publishLead(on = true) {
    const el = viewportRef.current;
    client.lead(on, el?.scrollLeft ?? 0, el?.scrollTop ?? 0, zoom);
  }
  function onViewportScroll() {
    if (!leading) return;
    const now = performance.now();
    if (now - lastLead.current < 150) return; // light throttle, like cursors
    lastLead.current = now;
    publishLead();
  }
  useEffect(() => {
    if (leading) publishLead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, leading]);
  // Followers mirror the leader's zoom during render (no stale frame); the scroll is
  // a DOM operation, so it stays in an effect.
  const [seenLead, setSeenLead] = useState(lead);
  if (lead !== seenLead) {
    setSeenLead(lead);
    if (following && lead) setZoom(lead.zoom);
  }
  useEffect(() => {
    if (!following || !lead) return;
    viewportRef.current?.scrollTo({ left: lead.x, top: lead.y, behavior: "smooth" });
  }, [following, lead]);
  const tplDef = RETRO_TEMPLATES[retro.template];
  const freeCanvas = tplDef?.kind === "free";
  const W = (tplDef ? retroSpanOf(tplDef) : cols.length) * ZONE_W;
  // Board height fits the content (no giant empty scroll), capped at the canvas max.
  const boardH = Math.min(CANVAS_H, Math.max(720, ...retro.cards.map((c) => c.y + 200)));

  const theme = retroTheme(retro.template);

  // Fit the board to the viewport WIDTH, but never magnify past 100%. Going fullscreen
  // is about getting more room to see and add cards at a normal, readable size, not
  // blowing up the same few cards. If the board is taller than the screen, you scroll.
  function fitZoom() {
    const el = viewportRef.current;
    if (!el) return;
    const byW = (el.clientWidth - 24) / W;
    setZoom(Math.max(0.5, Math.min(1, byW)));
    el.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }
  const fit = fitZoom;

  // Fit on first mount, and re-fit whenever we enter/leave fullscreen (next frame,
  // so the viewport has already resized to the fullscreen box before we measure).
  useEffect(() => {
    const id = requestAnimationFrame(() => fitZoom());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full, retro.template]);

  // One tap drops a fresh sticky right away — no typing, no Enter. Double-click
  // it to edit the text in place.
  function addInZone(colId: string) {
    client.retroAddCard(colId, "");
  }

  return (
    <div
      className={
        full
          ? "fixed inset-0 z-50 overflow-hidden border-0 p-3 [background:radial-gradient(72rem_44rem_at_50%_-12%,var(--color-iris-100),transparent_60%),#f6f7fb] dark:[background:radial-gradient(72rem_44rem_at_50%_-12%,#241f48,transparent_62%),#0a0a0f]"
          : "relative overflow-hidden rounded-3xl border border-slate-200/80 shadow-inner dark:border-white/10"
      }
    >
      {/* branded fullscreen wordmark · bottom center, clear of the control bar (top-left)
          and zoom cluster (top-right), which can grow wide enough to cover it up top */}
      {full && (
        <div className="pointer-events-none absolute bottom-3.5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 opacity-80">
          <LogoMark size={20} />
          <span className="text-[12px] font-light uppercase tracking-[0.3em] text-slate-700 dark:text-slate-200">
            Scrumlo
          </span>
        </div>
      )}
      {/* zoom + fullscreen controls */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/90 p-1 shadow-soft backdrop-blur dark:border-white/10 dark:bg-[#14141b]/90">
        {freeCanvas && canAct && (
          <button
            onClick={() => addInZone(cols[0].id)}
            aria-label="Add a sticky"
            className="mr-1 rounded-lg bg-iris-600 px-2.5 py-1 text-xs font-semibold text-white shadow hover:bg-iris-500"
          >
            + Sticky
          </button>
        )}
        {isFacil && (
          <button
            onClick={() => {
              const v = !leading;
              setLeading(v);
              if (!v) publishLead(false);
            }}
            aria-pressed={leading}
            title={leading ? "Stop syncing everyone's view to yours" : "Sync everyone's view to yours"}
            className={`mr-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${
              leading ? "bg-iris-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
            }`}
          >
            {leading ? "Stop leading" : "Take the lead"}
          </button>
        )}
        {isFacil && (
          <div className="relative mr-1 border-r border-slate-200 pr-1 dark:border-white/10">
            <button
              onClick={() => setGatherOpen((v) => !v)}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              title="Gather stickies into clusters by tag, votes or author"
            >
              Gather
            </button>
            {gatherOpen && (
              <div className="absolute right-0 top-9 z-40 flex w-32 flex-col rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-[#14141b]">
                {([["tag", "By tag"], ["votes", "By votes"], ["author", "By author"]] as const).map(([by, label]) => (
                  <button
                    key={by}
                    onClick={() => { client.retroSort(by); setGatherOpen(false); }}
                    className="rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <button onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} className="grid h-7 w-7 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Zoom out">−</button>
        <span data-testid="zoom-level" className="w-10 text-center text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom((z) => Math.min(full ? 1.5 : 1.4, +(z + 0.1).toFixed(2)))} className="grid h-7 w-7 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10" aria-label="Zoom in">+</button>
        <button onClick={fit} className="ml-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10">Fit</button>
        <button
          onClick={() => setFull((v) => !v)}
          className="ml-0.5 grid h-7 w-7 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
          aria-label={full ? "Exit fullscreen" : "Fullscreen"}
          title={full ? "Exit fullscreen (Esc)" : "Fullscreen · more room for the wall"}
        >
          {full ? "⤡" : "⤢"}
        </button>
      </div>

      {/* following the leader */}
      {following && lead && (
        <div className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-iris-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
          👀 Following {lead.byName}
          <button onClick={() => useLead.getState().stopFollowing()} className="rounded-full bg-white/20 px-2 py-0.5 font-bold hover:bg-white/30">
            Stop following
          </button>
        </div>
      )}

      {/* in fullscreen the phase rail + timer are hidden · float them back in */}
      {full && (
        <FullscreenBar
          retro={retro}
          isBoard={isBoard}
          isFacil={isFacil}
          client={client}
          timerEndsAt={timerEndsAt}
          timerDurationMs={timerDurationMs}
          onExit={() => setFull(false)}
        />
      )}

      {/* pannable viewport (native scroll) */}
      <div
        ref={viewportRef}
        onScroll={onViewportScroll}
        className={`dot-grid overflow-auto ${
          full
            ? "h-[calc(100dvh-24px)] rounded-2xl border border-slate-200/70 bg-white/50 pt-14 shadow-soft dark:border-white/10 dark:bg-white/[0.02]"
            : "h-[600px]"
        }`}
        style={{ touchAction: "pan-x pan-y" }}
      >
        <div className="mx-auto" style={{ width: W * zoom, height: boardH * zoom }}>
          <div ref={boardRef} onPointerMove={onBoardMove} id="scrumlo-canvas" className="relative origin-top-left dot-grid" style={{ width: W, height: boardH, transform: `scale(${zoom})` }}>
            <ThemedBackdrop template={retro.template} glow={theme.glow} w={W} h={boardH} />
            {/* zone bands */}
            {cols.map((col, i) => {
              const c = columnColor(col.id, i);
              const count = retro.cards.filter((cd) => cd.column === col.id).length;
              return (
                <div
                  key={col.id}
                  className="absolute top-0 border-r border-slate-300 dark:border-white/15"
                  style={{ left: i * ZONE_W, width: freeCanvas ? W : ZONE_W, height: CANVAS_H }}
                >
                  {/* free canvases drop the column furniture · the format IS the structure */}
                  {!freeCanvas && (
                    <>
                      <div className="sticky top-0 flex items-center gap-2 px-4 pt-3">
                        <span className={`h-3 w-3 rounded-full ${c.dot} ring-2 ring-white/70 dark:ring-white/10`} aria-hidden />
                        <span className={`text-base font-extrabold tracking-tight ${c.text} dark:text-slate-100`}>{col.title}</span>
                        <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-black/5 px-1.5 text-xs font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">{count}</span>
                      </div>
                      {canAct && (
                        <div className="px-4 pt-2">
                          <button
                            onClick={() => addInZone(col.id)}
                            className="flex w-full items-center justify-center gap-1.5 rounded-[10px] border-2 border-dashed border-slate-300 py-2 text-sm font-semibold text-slate-400 transition hover:border-iris-400 hover:text-iris-600 dark:border-white/15 dark:text-slate-500 dark:hover:text-iris-300"
                          >
                            <span className="text-base leading-none">+</span> Add a sticky
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* quadrant overlay for matrix formats (axes + corner labels, under everything) */}
            {tplDef?.quad && (
              <div className="pointer-events-none absolute inset-0 z-[2]" aria-hidden>
                <div className="absolute left-1/2 top-0 h-full w-0.5 bg-slate-400/60 dark:bg-white/25" />
                <div className="absolute left-0 top-1/2 h-0.5 w-full bg-slate-400/60 dark:bg-white/25" />
                <span className="absolute left-3 top-1/2 -translate-y-7 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {tplDef.quad.y} ↑
                </span>
                <span className="absolute bottom-3 left-1/2 ml-3 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {tplDef.quad.x} →
                </span>
                {(
                  [
                    ["left-[25%] top-[25%]", 0],
                    ["left-[75%] top-[25%]", 1],
                    ["left-[25%] top-[75%]", 2],
                    ["left-[75%] top-[75%]", 3],
                  ] as const
                ).map(([pos, i]) => (
                  <span
                    key={i}
                    className={`absolute ${pos} -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-3xl font-extrabold tracking-tight text-slate-300/80 dark:text-slate-600/70`}
                  >
                    {tplDef.quad!.labels[i]}
                  </span>
                ))}
              </div>
            )}

            {/* connectors (under the stickies) */}
            <svg className="pointer-events-none absolute inset-0 z-[5]" width={W} height={boardH} aria-hidden>
              <defs>
                <marker id="edge-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 z" fill="rgb(139 92 246)" />
                </marker>
              </defs>
              {retro.edges.map((e) => {
                const f = cardById.get(e.from);
                const t = cardById.get(e.to);
                if (!f || !t) return null;
                const a = edgeAnchors(f, t);
                return (
                  <path
                    key={e.id}
                    data-edge-id={e.id}
                    d={edgePath(a.x1, a.y1, a.x2, a.y2)}
                    fill="none"
                    stroke="rgba(139, 92, 246, 0.75)"
                    strokeWidth={2.5}
                    markerEnd="url(#edge-arrow)"
                  />
                );
              })}
              {/* live preview while pulling a connector off a handle */}
              {linkDrag && cardById.has(linkDrag.from) && (() => {
                const f = cardById.get(linkDrag.from)!;
                const a = edgeAnchors(f, linkDrag);
                return (
                  <path
                    d={edgePath(a.x1, a.y1, linkDrag.x, linkDrag.y)}
                    fill="none"
                    stroke="rgba(139, 92, 246, 0.55)"
                    strokeWidth={2.5}
                    strokeDasharray="6 5"
                    markerEnd="url(#edge-arrow)"
                  />
                );
              })()}
            </svg>
            {canAct &&
              retro.edges.map((e) => {
                const f = cardById.get(e.from);
                const t = cardById.get(e.to);
                if (!f || !t) return null;
                const a = edgeAnchors(f, t);
                return (
                  <button
                    key={e.id}
                    onClick={() => client.retroUnlink(e.id)}
                    aria-label="Remove connector"
                    title="Remove connector"
                    className="absolute z-[25] grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-violet-600 text-[11px] font-bold leading-none text-white opacity-70 shadow hover:opacity-100"
                    style={{ left: (a.x1 + a.x2) / 2, top: (a.y1 + a.y2) / 2 }}
                  >
                    ×
                  </button>
                );
              })}

            {/* stickies */}
            {retro.cards.map((card) => (
              <CanvasCard
                key={card.id}
                card={card}
                c={columnColor(card.column, colIndex.get(card.column) ?? 0)}
                isGroupHead={!!card.groupId && groupHead.get(card.groupId) === card.id}
                zoom={zoom}
                canAct={canAct}
                canVote={canAct && retro.phase === "vote"}
                isFacil={isFacil}
                spotlit={retro.spotlightId === card.id}
                onLinkPreview={onLinkPreview}
                onLinkEnd={onLinkEnd}
                client={client}
              />
            ))}

            {/* live cursors · isolated so they re-render without touching the board */}
            <CursorLayer you={you} w={W} h={boardH} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Other people's live pointers · isolated + memoized so cursor frames re-render
 *  only this layer, never the board. */
const CursorLayer = memo(function CursorLayer({ you, w, h }: { you: string; w: number; h: number }) {
  const cursors = useCursors((s) => s.cursors);
  return (
    <>
      {cursors
        .filter((cu) => cu.id !== you && cu.x >= 0 && cu.x <= w && cu.y >= 0 && cu.y <= h)
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
    </>
  );
});

/**
 * A playful, theme-aware backdrop: a soft color wash at the top plus a faint
 * scatter of the theme's own glyph (sailboats, shields, crowns, rockets…) so the
 * board feels like *that* retro, not a blank grid. Deterministic + decorative.
 */
const ThemedBackdrop = memo(function ThemedBackdrop({
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
});

function tiltOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ((h % 5) - 2) * 0.8;
}

function CanvasCard({
  card,
  c,
  isGroupHead,
  zoom,
  canAct,
  canVote,
  isFacil,
  spotlit,
  onLinkPreview,
  onLinkEnd,
  client,
}: {
  card: RetroCardView;
  c: ColC;
  isGroupHead: boolean;
  zoom: number;
  canAct: boolean;
  canVote: boolean;
  isFacil: boolean;
  spotlit: boolean;
  onLinkPreview: (from: string, clientX: number, clientY: number) => void;
  onLinkEnd: (from: string, toId: string | null) => void;
  client: RoomClient;
}) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  // A just-dropped sticky (yours + still blank) opens straight into edit, focused.
  const [editing, setEditing] = useState(card.mine && card.text === "");
  const [text, setText] = useState(card.text);
  const [pick, setPick] = useState(false);
  const [tagPick, setTagPick] = useState(false);
  const [colorPick, setColorPick] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleText, setTitleText] = useState("");
  const start = useRef({ px: 0, py: 0, cx: 0, cy: 0 });
  const moved = useRef(false);
  const linking = useRef(false); // an edge-handle drag is in flight
  const lastTapAt = useRef(0); // manual double-tap detection (touch)
  const pressed = useRef(false); // a press is in flight · synchronous, unlike the drag state
  const lastLive = useRef(0);

  // Subscribe to ONLY this card's live drag (a teammate dragging it pre-drop), looked
  // up O(1) from the normalized map. A card no one is dragging selects `null` every
  // frame (stable), so only the card actually being moved re-renders.
  const live = useCursors((s) => s.dragsByCard[card.id] ?? null);

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
    // NOTE: do NOT take pointer capture here. Capturing on pointer-down retargets the
    // browser's click/dblclick to the capturing element, which (a) broke desktop
    // double-click-to-edit and (b) makes a touch tap resolve to the wrong inner element.
    // We capture lazily in onMove, only once a real drag begins · so a plain tap/double-
    // tap keeps its natural target and edit-on-(double)click works on mouse AND touch.
    start.current = { px: e.clientX, py: e.clientY, cx: card.x, cy: card.y };
    moved.current = false;
    pressed.current = true;
    e.stopPropagation();
  }
  function onMove(e: React.PointerEvent) {
    if (!pressed.current) return;
    // Don't let this bubble to the board's cursor handler · otherwise it sends a
    // no-drag cursor that races ours and makes the card flicker for everyone else.
    e.stopPropagation();
    const s = start.current;
    if (!moved.current) {
      // Ignore sub-pixel jitter so a stationary tap never counts as a drag (which would
      // suppress the click/dblclick). Once past the threshold, capture and start dragging.
      if (Math.abs(e.clientX - s.px) + Math.abs(e.clientY - s.py) < 4) return;
      moved.current = true;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* capture can fail if the pointer already ended · harmless */
      }
    }
    const nx = s.cx + (e.clientX - s.px) / zoom;
    const ny = s.cy + (e.clientY - s.py) / zoom;
    setDrag({ x: nx, y: ny });
    // Telegraph the drop: hovering a fellow sticky mid-drag rings it as a group target.
    setDropTarget(cardUnderPointer(e.clientX, e.clientY, card.id));
    // Broadcast the in-flight position so others see it glide (throttled ~20/s).
    if (e.timeStamp - lastLive.current >= 50) {
      lastLive.current = e.timeStamp;
      client.cursor(nx, ny, { cardId: card.id, x: Math.round(nx), y: Math.round(ny) });
    }
  }
  function onUp(e: React.PointerEvent) {
    if (!pressed.current) return;
    pressed.current = false;
    if (moved.current && drag) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* not captured (never moved past threshold) · nothing to release */
      }
      // Dropped on top of another sticky? Cluster them. Otherwise free-place.
      const ontoId = cardUnderPointer(e.clientX, e.clientY, card.id)?.dataset.cardId;
      if (ontoId) client.retroGroupCard(card.id, ontoId);
      else client.retroMoveXY(card.id, Math.round(drag.x), Math.round(drag.y));
      client.cursor(drag.x, drag.y); // clear the live-drag flag for everyone
    } else if (e.pointerType === "touch" && canAct && card.mine && !editing) {
      // Double-tap to edit, detected by hand: WebKit (every iPhone) doesn't reliably
      // synthesize dblclick from two taps the way desktop double-click does.
      const now = e.timeStamp;
      if (now - lastTapAt.current < 380) {
        lastTapAt.current = 0;
        setText(card.text);
        setEditing(true);
      } else {
        lastTapAt.current = now;
      }
    }
    setDropTarget(null);
    setDrag(null);
  }
  function saveEdit() {
    const t = text.trim();
    if (!t) { client.retroDeleteCard(card.id); return; } // left blank → drop it
    if (t !== card.text) client.retroEditCard(card.id, t);
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

  // Double-click / double-tap the note text to edit it. Works on mouse and touch alike
  // because we no longer capture the pointer on press (see onDown) · so the browser's
  // native dblclick lands on the text node instead of being retargeted to the card root.
  function onDoubleClick(e: React.MouseEvent) {
    if (!canAct || !card.mine || editing) return;
    if ((e.target as HTMLElement).closest("button,textarea,input")) return;
    setText(card.text);
    setEditing(true);
  }

  return (
    <div
      data-card-id={card.id}
      data-color={card.color ?? undefined}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKey}
      tabIndex={canAct ? 0 : -1}
      role="group"
      aria-label={`Sticky: ${card.text || "(empty)"}.${card.mine ? " Double-click to edit." : ""} Arrow keys to move.`}
      title={card.mine && canAct ? "Double-click to edit" : undefined}
      style={{ left: x, top: y, width: CARD_W, touchAction: "none", rotate: spotlit || drag || live ? "0deg" : `${tiltOf(card.id)}deg` }}
      className={`group absolute select-none rounded-[10px] px-3.5 pb-2.5 pt-3 text-[15px] leading-snug text-slate-800 shadow-[0_6px_16px_-8px_rgba(15,23,42,0.45)] ${(card.color ? stickyTone(card.color) : c).note} ${
        canAct ? "cursor-grab active:cursor-grabbing" : ""
      } ${
        drag
          ? "z-30 scale-[1.03] shadow-[0_18px_30px_-10px_rgba(15,23,42,0.5)]"
          : live
            ? "z-20 scale-[1.02] ring-2 ring-violet-400/70 shadow-[0_14px_26px_-10px_rgba(15,23,42,0.45)] transition-[left,top] duration-75 ease-linear"
            : "z-10 hover:z-20"
      } outline-none focus-visible:ring-2 focus-visible:ring-iris-500 focus-visible:ring-offset-2 ${
        spotlit ? "ring-2 ring-iris-500 ring-offset-2" : ""
      } ${card.groupId && !spotlit && !drag && !live ? "ring-1 ring-violet-300" : ""} ${
        card.discussed && !spotlit ? "opacity-65 saturate-50" : ""
      }`}
    >
      {card.discussed && !spotlit && (
        <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow">✓</span>
      )}
      {canAct && (
        <button
          aria-label="Drag to connect"
          title="Drag onto another sticky to connect them"
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            linking.current = true;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            onLinkPreview(card.id, e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (!linking.current) return;
            e.stopPropagation();
            onLinkPreview(card.id, e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (!linking.current) return;
            linking.current = false;
            e.stopPropagation();
            try {
              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {
              /* never captured · fine */
            }
            onLinkEnd(card.id, cardUnderPointer(e.clientX, e.clientY, card.id)?.dataset.cardId ?? null);
          }}
          className="absolute -right-2.5 top-1/2 z-20 grid h-5 w-5 -translate-y-1/2 cursor-crosshair place-items-center rounded-full border-2 border-white bg-violet-500 opacity-0 shadow transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          style={{ touchAction: "none" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
        </button>
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
      {isGroupHead && card.groupTitle && !editingTitle && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (canAct) { setTitleText(card.groupTitle!); setEditingTitle(true); }
          }}
          aria-label={`Rename cluster · ${card.groupTitle}`}
          title={canAct ? "Rename this cluster" : undefined}
          className="absolute -top-7 left-0 z-20 max-w-[200px] truncate whitespace-nowrap rounded-full bg-violet-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow hover:bg-violet-500"
        >
          {card.groupTitle}
        </button>
      )}
      {isGroupHead && editingTitle && (
        <input
          autoFocus
          aria-label="Cluster name"
          value={titleText}
          onChange={(e) => setTitleText(e.target.value)}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (card.groupId && titleText.trim()) client.retroRenameGroup(card.groupId, titleText.trim());
              setEditingTitle(false);
            } else if (e.key === "Escape") setEditingTitle(false);
          }}
          onBlur={() => setEditingTitle(false)}
          className="absolute -top-7 left-0 z-20 w-40 rounded-full border border-violet-300 bg-white px-2.5 py-0.5 text-[11px] font-bold text-violet-700 outline-none"
        />
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
            } else if (e.key === "Escape") {
              if (!card.text) client.retroDeleteCard(card.id); // never-filled blank → drop it
              else setEditing(false);
            }
          }}
          onBlur={saveEdit}
          rows={2}
          className="w-full resize-none rounded-md border border-black/10 bg-white/70 px-2 py-1 text-[15px] font-medium text-slate-800 outline-none"
        />
      ) : (
        <div className="whitespace-pre-wrap break-words font-medium">
          {/* An abandoned blank (author bailed mid-add) shouldn't look like a broken box. */}
          {card.text || <span className="italic text-slate-400">…</span>}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
            aria-label={`${r.emoji} reaction, ${r.count}${r.mine ? " (you reacted)" : ""}`}
            aria-pressed={r.mine}
            title={r.who.length ? r.who.join(", ") : undefined}
            className="inline-flex items-center gap-0.5 rounded-full bg-white/60 px-1.5 py-0.5 text-xs hover:bg-white/90"
          >
            {r.emoji}
            <span className="font-semibold text-slate-600">{r.count}</span>
          </button>
        ))}
        {canAct && (
          <div className="relative">
            <button onClick={() => setPick((v) => !v)} className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-white/55 px-2 py-0.5 text-xs leading-none text-slate-500 hover:bg-white/90" aria-label="Add reaction"><span className="text-sm">🙂</span><span className="font-bold">+</span></button>
            {pick && (
              <div className="absolute left-0 top-7 z-40 flex w-44 flex-wrap gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-lg">
                {RETRO_REACTIONS.map((e) => (
                  <button key={e} onClick={() => { client.retroReact(card.id, e); setPick(false); }} className="rounded-full px-1 text-base hover:scale-125">{e}</button>
                ))}
              </div>
            )}
          </div>
        )}
        {card.tags.map((tg) => (
          <button
            key={tg}
            onClick={() => canAct && client.retroTagCard(card.id, tg, false)}
            title={canAct ? `Remove tag · ${tg}` : undefined}
            aria-label={`Tag: ${tg}${canAct ? ". Click to remove." : ""}`}
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tagTone(tg)}`}
          >
            {tg}
          </button>
        ))}
        {canAct && (
          <div className="relative">
            <button onClick={() => setTagPick((v) => !v)} className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-full bg-white/55 px-2 py-0.5 text-xs leading-none text-slate-500 hover:bg-white/90" aria-label="Add tag"><span className="text-sm">🏷</span><span className="font-bold">+</span></button>
            {tagPick && (
              <div className="absolute left-0 top-7 z-40 flex gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 shadow-lg">
                {RETRO_TAGS.filter((t) => !card.tags.includes(t)).map((t) => (
                  <button key={t} onClick={() => { client.retroTagCard(card.id, t, true); setTagPick(false); }} className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold hover:scale-105 ${tagTone(t)}`}>{t}</button>
                ))}
              </div>
            )}
          </div>
        )}
        {canAct && card.mine && (
          <div className="relative">
            <button
              onClick={() => setColorPick((v) => !v)}
              className="inline-flex items-center rounded-full bg-white/55 px-2 py-0.5 text-sm leading-none hover:bg-white/90"
              aria-label="Sticky color"
              title="Recolor this sticky"
            >
              🎨
            </button>
            {colorPick && (
              <div className="absolute left-0 top-7 z-40 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-lg">
                {STICKY_COLORS.map((col) => (
                  <button
                    key={col}
                    onClick={() => { client.retroColorCard(card.id, col); setColorPick(false); }}
                    aria-label={col[0].toUpperCase() + col.slice(1)}
                    title={col}
                    className={`h-5 w-5 rounded-full border hover:scale-110 ${card.color === col ? "border-slate-500 ring-2 ring-slate-300" : "border-black/10"}`}
                    style={{ background: STICKY_SWATCH[col] }}
                  />
                ))}
                <button
                  onClick={() => { client.retroColorCard(card.id, null); setColorPick(false); }}
                  className="rounded-full px-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-700"
                  title="Back to the column's color"
                >
                  Auto
                </button>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-1">
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
              title={spotlit ? "Stop spotlight" : "Spotlight · focus the room here"}
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
