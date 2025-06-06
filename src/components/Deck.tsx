import { DECKS } from "../../shared/protocol";

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
            className={`h-16 w-12 rounded-xl border text-lg font-extrabold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              selected
                ? "-translate-y-2 border-indigo-600 bg-indigo-600 text-white shadow-md"
                : "border-slate-200 bg-white text-slate-800 hover:-translate-y-1 hover:border-indigo-400"
            }`}
          >
            {c}
          </button>
        );
      })}
    </div>
  );
}
