import { useEffect, useState } from "react";
import type { EstimateView } from "../../shared/protocol";
import { estimateMedian } from "../lib/estimateResult";

/** A one-shot reveal flourish: the instant the facilitator reveals, the room's median
 *  flashes big in the center of the screen, holds a beat, then fades. Fires for everyone
 *  (it keys off the shared phase flipping to "revealed"), never blocks clicks, and the
 *  tension line below carries the same number once it's gone. */
export function EstimateReveal({ estimate }: { estimate: EstimateView }) {
  const [prevPhase, setPrevPhase] = useState(estimate.phase);
  const [shown, setShown] = useState<{ median: string; unanimous: boolean } | null>(null);
  const [leaving, setLeaving] = useState(false);

  // Detect the voting→revealed flip during render (React's sanctioned reset-on-change,
  // same as SpotlightLayer) — not on every snapshot of the reveal, and not for someone
  // who joins after it's already revealed.
  if (estimate.phase !== prevPhase) {
    setPrevPhase(estimate.phase);
    if (prevPhase !== "revealed" && estimate.phase === "revealed") {
      const { median, unanimous } = estimateMedian(estimate);
      if (median) {
        setShown({ median, unanimous });
        setLeaving(false);
      }
    }
  }

  // Hold a beat, fade, then clear it.
  useEffect(() => {
    if (!shown) return;
    const fade = setTimeout(() => setLeaving(true), 2700);
    const gone = setTimeout(() => setShown(null), 3000);
    return () => {
      clearTimeout(fade);
      clearTimeout(gone);
    };
  }, [shown]);

  if (!shown) return null;
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[65] grid place-items-center p-4 transition-opacity duration-300 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="animate-pop flex flex-col items-center gap-1.5 rounded-[2rem] border border-iris-200 bg-white/95 px-14 py-10 text-center shadow-2xl backdrop-blur dark:border-iris-500/30 dark:bg-[#14141b]/95">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-iris-500 dark:text-iris-400">
          {shown.unanimous ? "Unanimous" : "Median"}
        </span>
        <span className="text-8xl font-extrabold leading-none tracking-tight text-slate-900 dark:text-white">
          {shown.median}
        </span>
        <span className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
          {shown.unanimous ? "the whole room agreed" : "where the room landed"}
        </span>
      </div>
    </div>
  );
}
