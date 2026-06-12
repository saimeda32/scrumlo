/** Distill a revealed health check into one word the room can react to.
 *  Flat thresholds on the overall average; a wide gap between the best and
 *  worst dimension overrides — agreement matters more than the mean. */
export function pulseVerdict(results: { avg: number }[]): { word: string; tone: "good" | "ok" | "bad" } | null {
  if (!results.length) return null;
  const avgs = results.map((r) => r.avg);
  const overall = avgs.reduce((a, b) => a + b, 0) / avgs.length;
  if (Math.max(...avgs) - Math.min(...avgs) >= 1.8) return { word: "Divided", tone: "ok" };
  if (overall >= 4.5) return { word: "Thriving", tone: "good" };
  if (overall >= 4.0) return { word: "Humming", tone: "good" };
  if (overall >= 3.5) return { word: "Cruising", tone: "good" };
  if (overall >= 3.0) return { word: "Steady", tone: "ok" };
  if (overall >= 2.5) return { word: "Wobbly", tone: "ok" };
  if (overall >= 2.0) return { word: "Strained", tone: "bad" };
  return { word: "Mayday", tone: "bad" };
}
