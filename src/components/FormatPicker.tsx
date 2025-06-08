import type { Activity, PickMode } from "../../shared/protocol";
import { RETRO_TEMPLATES, DECKS, DECK_LABELS } from "../../shared/protocol";
import { retroTheme } from "../lib/retroThemes";
import type { RoomClient } from "../net/socket";
import { IconPerson, IconOrder, IconList } from "./icons";

const PICK_MODES: { mode: PickMode; label: string; desc: string; Icon: typeof IconPerson }[] = [
  { mode: "person", label: "Pick a person", desc: "One teammate at random", Icon: IconPerson },
  { mode: "order", label: "Shuffle order", desc: "Everyone in a random order", Icon: IconOrder },
  { mode: "list", label: "Pick from a list", desc: "Your own options or topics", Icon: IconList },
];

/**
 * A visual chooser for the current activity — retro format, estimation deck, or
 * picker mode — with a small preview of each. The facilitator picks; everyone
 * else can browse. Makes the formats discoverable instead of buried in a toolbar.
 */
export function FormatPicker({
  activity,
  retroTemplate,
  deck,
  pickMode,
  isFacil,
  client,
  onClose,
}: {
  activity: Activity;
  retroTemplate: string;
  deck: string;
  pickMode: PickMode;
  isFacil: boolean;
  client: RoomClient;
  onClose: () => void;
}) {
  const title =
    activity === "retro"
      ? "Choose a retro format"
      : activity === "estimate"
        ? "Choose an estimation deck"
        : "Choose a picker mode";

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm dark:bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#14141b]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          {isFacil ? "Tap one to switch the whole room." : "The facilitator chooses the format."}
        </p>

        <div className="grid gap-3 overflow-y-auto sm:grid-cols-2">
          {activity === "retro" &&
            Object.entries(RETRO_TEMPLATES).map(([id, tpl]) => {
              const theme = retroTheme(id);
              const active = id === retroTemplate;
              return (
                <button
                  key={id}
                  disabled={!isFacil}
                  onClick={() => {
                    if (isFacil && !active) client.retroSetTemplate(id);
                    onClose();
                  }}
                  className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${theme.panel} ${theme.panelDark} p-3 text-left transition enabled:hover:scale-[1.02] disabled:cursor-default ${
                    active
                      ? "border-iris-500 ring-2 ring-iris-400"
                      : "border-slate-200/70 dark:border-white/10"
                  }`}
                >
                  <span className="pointer-events-none absolute -right-3 -top-4 select-none text-6xl opacity-20">
                    {theme.motif}
                  </span>
                  <div className="relative flex items-center gap-1.5">
                    <span className="text-base">{theme.motif}</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{tpl.label}</span>
                    {active && <span className="ml-auto text-xs font-bold text-iris-600 dark:text-iris-300">current</span>}
                  </div>
                  <div className="relative mt-2 flex flex-wrap gap-1">
                    {tpl.columns.map((col) => (
                      <span
                        key={col.id}
                        className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-black/30 dark:text-slate-300"
                      >
                        {col.emoji} {col.title}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}

          {activity === "estimate" &&
            Object.keys(DECKS).map((d) => {
              const active = d === deck;
              return (
                <button
                  key={d}
                  disabled={!isFacil}
                  onClick={() => {
                    if (isFacil && !active) client.setDeck(d);
                    onClose();
                  }}
                  className={`rounded-2xl border p-3 text-left transition enabled:hover:scale-[1.02] disabled:cursor-default ${
                    active
                      ? "border-iris-500 ring-2 ring-iris-400"
                      : "border-slate-200 dark:border-white/10"
                  } bg-white dark:bg-white/5`}
                >
                  <div className="flex items-center">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {DECK_LABELS[d] ?? d}
                    </span>
                    {active && <span className="ml-auto text-xs font-bold text-iris-600 dark:text-iris-300">current</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {DECKS[d].slice(0, 9).map((card) => (
                      <span
                        key={card}
                        className="grid h-7 w-6 place-items-center rounded-md border border-slate-200 text-xs font-bold text-slate-700 dark:border-white/10 dark:text-slate-200"
                      >
                        {card}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}

          {activity === "pick" &&
            PICK_MODES.map(({ mode, label, desc, Icon }) => {
              const active = mode === pickMode;
              return (
                <button
                  key={mode}
                  disabled={!isFacil}
                  onClick={() => {
                    if (isFacil && !active) client.pickSetMode(mode);
                    onClose();
                  }}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition enabled:hover:scale-[1.02] disabled:cursor-default ${
                    active
                      ? "border-iris-500 ring-2 ring-iris-400"
                      : "border-slate-200 dark:border-white/10"
                  } bg-white dark:bg-white/5`}
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-iris-50 text-iris-600 dark:bg-iris-500/15 dark:text-iris-300">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      {label}
                      {active && <span className="ml-2 text-xs font-bold text-iris-600 dark:text-iris-300">current</span>}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{desc}</div>
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
