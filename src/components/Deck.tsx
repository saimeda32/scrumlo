import { DECKS } from "../../shared/protocol";
import { IconCoffee } from "./icons";

// A tiny deterministic resting tilt per card, so the hand looks dealt, not stamped.
function tilt(i: number, n: number): number {
  return (i - (n - 1) / 2) * 1.5;
}

export function Deck({
  deck,
  customDeck,
  yourVote,
  disabled,
  onVote,
}: {
  deck: string;
  customDeck?: string[];
  yourVote: string | null;
  disabled: boolean;
  onVote: (card: string) => void;
}) {
  const cards = deck === "custom" && customDeck?.length ? customDeck : (DECKS[deck] ?? DECKS.fib);
  return (
    <div data-testid="deck" className="flex flex-wrap items-end justify-center gap-2 px-1 pb-1 pt-4">
      {cards.map((c, i) => {
        const selected = c === yourVote;
        const face = c === "☕" ? <IconCoffee className="h-6 w-6" /> : c;
        return (
          <button
            key={c}
            disabled={disabled}
            onClick={() => onVote(c)}
            aria-pressed={selected}
            title={c === "☕" ? "I need a break" : c === "?" ? "Not enough info to estimate" : `Vote ${c}`}
            style={{ rotate: selected ? "0deg" : `${tilt(i, cards.length)}deg` }}
            className={`group relative grid h-24 w-[64px] place-items-center rounded-xl border-2 text-3xl font-black tabular-nums shadow-[0_6px_16px_-8px_rgba(15,23,42,0.4)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-iris-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 ${
              selected
                ? "z-10 -translate-y-6 scale-105 border-iris-500 bg-gradient-to-br from-iris-500 to-violet-600 text-white shadow-[0_18px_32px_-10px_rgba(99,102,241,0.7)] ring-2 ring-iris-300 dark:ring-iris-400/40"
                : "border-slate-200 bg-white text-slate-800 enabled:hover:z-10 enabled:hover:-translate-y-3 enabled:hover:rotate-0 enabled:hover:border-iris-300 enabled:hover:shadow-[0_16px_28px_-10px_rgba(15,23,42,0.5)] dark:border-white/10 dark:bg-[#1b1b24] dark:text-slate-100"
            }`}
          >
            {/* corner pips, like a real card */}
            <span className={`pointer-events-none absolute left-1.5 top-1 text-[11px] font-bold ${selected ? "text-white/80" : "text-slate-400 dark:text-slate-500"}`}>
              {c}
            </span>
            <span className={`pointer-events-none absolute bottom-1 right-1.5 rotate-180 text-[11px] font-bold ${selected ? "text-white/80" : "text-slate-400 dark:text-slate-500"}`}>
              {c}
            </span>
            {face}
          </button>
        );
      })}
    </div>
  );
}
