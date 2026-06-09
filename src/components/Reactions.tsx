import { memo, useEffect, useState } from "react";
import { EMOTES } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";
import { useEmotes } from "../store/emoteStore";

/** The full-screen layer that floats reactions up from the bottom-right and removes
 *  them when their animation ends. Isolated so emotes never re-render the Room. */
export function ReactionLayer() {
  const emotes = useEmotes((s) => s.emotes);
  const remove = useEmotes((s) => s.remove);
  return (
    <div className="pointer-events-none fixed inset-0 z-[55] overflow-hidden" aria-hidden>
      {emotes.map((e) => (
        <FloatingEmote key={e.id} id={e.id} emoji={e.emoji} x={e.x} name={e.name} remove={remove} />
      ))}
    </div>
  );
}

// Stable id + remove (zustand actions are stable) so the removal timer is set ONCE
// per emote instead of being reset on every render during a burst.
const FloatingEmote = memo(function FloatingEmote({
  id,
  emoji,
  x,
  name,
  remove,
}: {
  id: number;
  emoji: string;
  x: number;
  name?: string;
  remove: (id: number) => void;
}) {
  useEffect(() => {
    const t = setTimeout(() => remove(id), 2600);
    return () => clearTimeout(t);
  }, [id, remove]);
  return (
    <span
      className="animate-emote absolute bottom-20 flex flex-col items-center gap-0.5"
      style={{ right: `${28 + x}px` }}
    >
      <span className="text-3xl drop-shadow">{emoji}</span>
      {name && (
        <span className="max-w-[7rem] truncate rounded-full bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
          {name}
        </span>
      )}
    </span>
  );
});

/** One bottom-right dock holding both room-wide controls: spin a name (facilitator
 *  only, greyed out for everyone else) and send a floating reaction. Grouping them in
 *  a single pill reads as a deliberate toolbar instead of two loose corner buttons. */
export function ActionDock({
  client,
  count,
  isFacil,
}: {
  client: RoomClient;
  count: number;
  isFacil: boolean;
}) {
  const [open, setOpen] = useState(false);
  const canSpin = isFacil && count >= 2;
  const spinTitle = !isFacil
    ? "Only the facilitator can spin"
    : count < 2
      ? "Need at least two people to spin"
      : "Spin to pick a person";

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="animate-rise flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 px-2 py-1.5 shadow-soft backdrop-blur dark:border-white/10 dark:bg-[#14141b]/95">
          {EMOTES.map((e) => (
            <button
              key={e}
              onClick={() => client.emote(e)}
              aria-label={`React ${e}`}
              className="rounded-full px-1 text-2xl transition hover:scale-125"
            >
              {e}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 p-1 shadow-soft backdrop-blur dark:border-white/10 dark:bg-[#14141b]/90">
        <button
          onClick={() => canSpin && client.spotlightPick()}
          disabled={!canSpin}
          title={spinTitle}
          aria-label="Spin to pick a person"
          className="grid h-10 w-10 place-items-center rounded-full text-xl text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-white/10"
        >
          🎲
        </button>
        <span className="h-5 w-px bg-slate-200 dark:bg-white/10" />
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close reactions" : "Send a reaction"}
          aria-expanded={open}
          className={`grid h-10 w-10 place-items-center rounded-full text-xl transition ${
            open
              ? "bg-iris-600 text-white"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
          }`}
        >
          {open ? "✕" : "😀"}
        </button>
      </div>
    </div>
  );
}
