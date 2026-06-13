import type { EstimateView } from "../../shared/protocol";
import { DECKS } from "../../shared/protocol";
import { numericValue } from "./colors";

// The revealed result for a round: the median card and whether the room was unanimous.
// Deck-aware exactly like TensionLine — numeric decks (Fibonacci) rank by number, word
// decks (t-shirts) rank by deck position, "?"/"☕" don't count — so the reveal flash and
// the tension line always show the same number.
export function estimateMedian(estimate: EstimateView): { median: string | null; unanimous: boolean } {
  const votes = estimate.votes ?? {};
  const deckCards =
    estimate.deck === "custom" && estimate.customDeck?.length
      ? estimate.customDeck
      : (DECKS[estimate.deck] ?? DECKS.fib);
  const numericMode = deckCards.filter((c) => numericValue(c) !== null).length >= 2;
  const scale = numericMode
    ? deckCards.filter((c) => numericValue(c) !== null)
    : deckCards.filter((c) => c !== "?" && c !== "☕");
  const valueOf = (card: string): number | null =>
    numericMode ? numericValue(card) : scale.indexOf(card) >= 0 ? scale.indexOf(card) : null;
  const cardOf = (value: number): string =>
    numericMode ? (scale.find((c) => numericValue(c) === value) ?? String(value)) : (scale[value] ?? "?");

  const values = Object.values(votes)
    .map((c) => valueOf(c))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  if (values.length < 2) return { median: null, unanimous: false };
  const median = values[Math.floor((values.length - 1) / 2)];
  return { median: cardOf(median), unanimous: values[0] === values[values.length - 1] };
}
