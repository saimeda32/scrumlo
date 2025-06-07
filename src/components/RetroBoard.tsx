import type { RetroView } from "../../shared/protocol";
import { RETRO_TEMPLATES } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";
import { RetroColumn } from "./RetroColumn";

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
  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        {isFacil ? (
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1">
            {Object.entries(RETRO_TEMPLATES).map(([id, t]) => (
              <button
                key={id}
                onClick={() => client.retroSetTemplate(id)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold ${
                  retro.template === id
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-500">
            {RETRO_TEMPLATES[retro.template]?.label ?? "Retro"}
          </span>
        )}
        {isFacil && (
          <button
            onClick={() => client.retroSetAnonymous(!retro.anonymous)}
            className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
            title={retro.anonymous ? "Currently anonymous — click to show names" : "Currently showing names — click to hide"}
          >
            {retro.anonymous ? "🕶 Anonymous" : "🙂 Names shown"}
          </button>
        )}
        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
          {retro.votesLeft} {retro.votesLeft === 1 ? "vote" : "votes"} left
        </span>
      </div>

      {spotlit && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-5 py-4">
          <span className="mt-0.5 text-indigo-500">◎</span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-400">
              Spotlight — everyone’s looking here
            </div>
            <div className="mt-0.5 whitespace-pre-wrap break-words text-sm font-medium text-slate-800">
              {spotlit.text}
            </div>
          </div>
          {isFacil && (
            <button
              onClick={() => client.retroSpotlight(null)}
              className="shrink-0 rounded-lg border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-white"
            >
              Done
            </button>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

      <p className="mt-8 text-xs text-slate-400">
        {retro.anonymous ? "Cards are anonymous" : "Authors are shown"} · {retro.votesLeft} dot-votes
        each · react with emoji · nothing is stored after the room ends.
      </p>
    </>
  );
}
