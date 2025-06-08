import type { RetroView } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";
import { RetroCanvas } from "./RetroCanvas";
import { retroTheme } from "../lib/retroThemes";
import { RetroGlyph } from "./RetroGlyph";

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
              Spin for a card to discuss
            </button>
          ) : (
            <>
              <span className="rounded-xl bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                Every sticky had its moment. Nicely done.
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

      <p className="mb-3 flex items-center gap-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <RetroGlyph template={retro.template} className="h-5 w-5 shrink-0" style={{ color: theme.glow }} />
        {theme.blurb}
      </p>

      <RetroCanvas retro={retro} canAct={canAct} isFacil={isFacil} client={client} />

      <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">
        {retro.anonymous ? "Anonymous by default" : "Authors shown"}. Five dot-votes each. Drag a
        sticky anywhere, zoom to fit, react. The wall forgets when you go.
      </p>
    </>
  );
}
