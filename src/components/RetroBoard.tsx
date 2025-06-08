import type { RetroView } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";
import { RetroColumn } from "./RetroColumn";
import { retroTheme } from "../lib/retroThemes";
import { RetroGlyph } from "./RetroGlyph";

// Fixed scatter slots for the themed scene props (faint, behind the content).
const SCENE_SLOTS = [
  { top: "9%", left: "2%", size: 60, rot: -10, op: 0.1 },
  { top: "56%", left: "91%", size: 104, rot: 12, op: 0.09 },
  { top: "82%", left: "7%", size: 54, rot: 8, op: 0.09 },
  { top: "30%", left: "60%", size: 46, rot: -7, op: 0.07 },
  { top: "72%", left: "46%", size: 76, rot: 5, op: 0.06 },
];

export function RetroBoard({
  retro,
  isFacil,
  canAct,
  client,
}: {
  retro: RetroView;
  isFacil: boolean;
  canAct: boolean;
  client: RoomClient;
}) {
  const spotlit = retro.cards.find((c) => c.id === retro.spotlightId) ?? null;
  const total = retro.cards.length;
  const discussedCount = retro.cards.filter((c) => c.discussed).length;
  const anyLeft = discussedCount < total;
  const theme = retroTheme(retro.template);
  // Lay the board out to the format's own column count, so a 4-zone format (Avengers,
  // GOT, Sailboat…) fills one row of 4 instead of dropping the 4th onto a second row.
  const n = retro.columns.length;
  const lgCols =
    n >= 5 ? "lg:grid-cols-5" : n === 4 ? "lg:grid-cols-4" : n === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3";
  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        {/* format is chosen via the Format picker (toolbar button); here we keep the
            quick toggles. */}
        <span className="min-w-0 flex-1" />
        {isFacil && (
          <button
            onClick={() => client.retroSetAnonymous(!retro.anonymous)}
            className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:border-iris-300 hover:text-iris-600 dark:border-white/10 dark:text-slate-400 dark:hover:text-iris-300"
            title={retro.anonymous ? "Currently anonymous · click to show names" : "Currently showing names · click to hide"}
          >
            {retro.anonymous ? "🕶 Anonymous" : "🙂 Names shown"}
          </button>
        )}
        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-300">
          {retro.votesLeft} {retro.votesLeft === 1 ? "vote" : "votes"} left
        </span>
      </div>

      {isFacil && total > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {anyLeft ? (
            <button
              onClick={() => client.retroPickRandom()}
              className="rounded-xl bg-iris-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-iris-600/20 hover:bg-iris-500"
            >
              🎲 Discuss a random card
            </button>
          ) : (
            <>
              <span className="rounded-xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700">
                ✓ Every sticky discussed · nice work
              </span>
              <button
                onClick={() => client.retroResetDiscussed()}
                className="text-xs font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
              >
                run another pass
              </button>
            </>
          )}
          {anyLeft && (
            <span className="text-xs font-medium text-slate-400">
              {discussedCount} / {total} discussed
            </span>
          )}
        </div>
      )}

      {spotlit && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-iris-200 bg-iris-50/70 px-5 py-4 dark:border-iris-500/25 dark:bg-iris-500/10">
          <span className="mt-0.5 text-iris-500 dark:text-iris-300">◎</span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-iris-400">
              Spotlight · everyone’s looking here
            </div>
            <div className="mt-0.5 whitespace-pre-wrap break-words text-sm font-medium text-slate-800 dark:text-slate-100">
              {spotlit.text}
            </div>
          </div>
          {isFacil && (
            <button
              onClick={() => client.retroSpotlight(null)}
              className="shrink-0 rounded-lg border border-iris-200 px-2.5 py-1 text-xs font-semibold text-iris-600 hover:bg-white dark:border-iris-500/30 dark:text-iris-300 dark:hover:bg-white/5"
            >
              Done
            </button>
          )}
        </div>
      )}

      {/* the board · a dot-grid workspace with the theme's color mood + scene motif */}
      <div className="dot-grid relative overflow-hidden rounded-3xl border border-slate-200/80 p-4 shadow-inner sm:p-6 dark:border-white/10">
        {/* theme color wash · gives each format a mood instead of flat grey */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-50"
          aria-hidden
          style={{
            background: `radial-gradient(80% 70% at 82% -8%, ${theme.glow}2e, transparent 60%), radial-gradient(55% 55% at 6% 112%, ${theme.glow}1f, transparent 60%)`,
          }}
        />
        {/* bespoke glyph art · custom marks, tinted with the theme accent (no stock emoji) */}
        <RetroGlyph
          template={retro.template}
          className="pointer-events-none absolute -bottom-16 -right-12 h-[320px] w-[320px] opacity-[0.12]"
          style={{ color: theme.glow }}
        />
        {SCENE_SLOTS.slice(0, 3).map((s, i) => (
          <RetroGlyph
            key={i}
            template={retro.template}
            className="pointer-events-none absolute"
            style={{
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              opacity: s.op,
              transform: `rotate(${s.rot}deg)`,
              color: theme.glow,
            }}
          />
        ))}
        <p className="relative mb-5 flex items-center gap-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <RetroGlyph template={retro.template} className="h-5 w-5 shrink-0" style={{ color: theme.glow }} />
          {theme.blurb}
        </p>

        <div className={`relative grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 ${lgCols}`}>
          {retro.columns.map((col, i) => (
            <RetroColumn
              key={col.id}
              column={col}
              index={i}
              cards={retro.cards.filter((c) => c.column === col.id)}
              canAct={canAct}
              isFacil={isFacil}
              spotlightId={retro.spotlightId}
              client={client}
            />
          ))}
        </div>
      </div>

      <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">
        {retro.anonymous ? "Stickies are anonymous" : "Authors are shown"} · {retro.votesLeft}{" "}
        dot-votes each · react with emoji · nothing is stored after the room ends.
      </p>
    </>
  );
}
