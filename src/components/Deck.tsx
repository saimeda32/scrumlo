import { DECKS } from "../../shared/protocol";
import { IconCoffee } from "./icons";

export function Deck({
  deck,
  yourVote,
  disabled,
  onVote,
}: {
  deck: string;
  yourVote: string | null;
  disabled: boolean;
  onVote: (card: string) => void;
}) {
  const cards = DECKS[deck] ?? DECKS.fib;
  return (
    <div data-testid="deck" className="flex flex-wrap gap-2">
      {cards.map((c) => {
        const selected = c === yourVote;
        return (
          <button
            key={c}
            disabled={disabled}
            onClick={() => onVote(c)}
            aria-pressed={selected}
            className={`h-16 w-12 rounded-xl border text-lg font-extrabold transition focus-visible:ring-2 focus-visible:ring-iris-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40 ${
              selected
                ? "-translate-y-2 border-iris-600 bg-iris-600 text-white shadow-md"
                : "border-slate-200 bg-white text-slate-800 enabled:hover:-translate-y-1 enabled:hover:border-iris-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:enabled:hover:border-iris-400"
            }`}
          >
            {c === "☕" ? <IconCoffee className="mx-auto h-5 w-5" /> : c}
          </button>
        );
      })}
    </div>
  );
}
