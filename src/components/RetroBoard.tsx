import type { RetroView } from "../../shared/protocol";
import { RETRO_TEMPLATES } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";
import { RetroColumn } from "./RetroColumn";

export function RetroBoard({
  retro,
  isFacil,
  client,
}: {
  retro: RetroView;
  isFacil: boolean;
  client: RoomClient;
}) {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {isFacil ? (
          <div className="flex gap-1">
            {Object.entries(RETRO_TEMPLATES).map(([id, t]) => (
              <button
                key={id}
                onClick={() => client.retroSetTemplate(id)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  retro.template === id
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-slate-400 hover:bg-slate-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs font-semibold text-slate-400">
            {RETRO_TEMPLATES[retro.template]?.label ?? "Retro"}
          </span>
        )}
        <span className="ml-auto rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
          {retro.votesLeft} {retro.votesLeft === 1 ? "vote" : "votes"} left
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {retro.columns.map((col, i) => (
          <RetroColumn
            key={col.id}
            column={col}
            index={i}
            cards={retro.cards.filter((c) => c.column === col.id)}
            client={client}
          />
        ))}
      </div>

      <p className="mt-8 text-xs text-slate-400">
        Cards are anonymous · {retro.votesLeft} dot-votes each · nothing is stored after the room ends.
      </p>
    </>
  );
}
