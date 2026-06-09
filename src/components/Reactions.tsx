import { useEffect, useState } from "react";
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
        <FloatingEmote key={e.id} emoji={e.emoji} x={e.x} onDone={() => remove(e.id)} />
      ))}
    </div>
  );
}

function FloatingEmote({ emoji, x, onDone }: { emoji: string; x: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <span className="animate-emote absolute bottom-20 text-3xl drop-shadow" style={{ right: `${28 + x}px` }}>
      {emoji}
    </span>
  );
}

/** The launcher: a corner button that pops open the emoji row. */
export function ReactionBar({ client }: { client: RoomClient }) {
  const [open, setOpen] = useState(false);
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
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close reactions" : "Send a reaction"}
        aria-expanded={open}
        className={`grid h-11 w-11 place-items-center rounded-full border text-xl shadow-soft backdrop-blur transition ${
          open
            ? "border-iris-300 bg-iris-600 text-white"
            : "border-slate-200 bg-white/90 text-slate-600 hover:border-iris-300 hover:text-iris-600 dark:border-white/10 dark:bg-[#14141b]/90 dark:text-slate-300"
        }`}
      >
        {open ? "✕" : "🎉"}
      </button>
    </div>
  );
}
