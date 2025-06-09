import { useEffect, useState } from "react";

/**
 * A quiet, Claude-style cycling status line · Scrumlo's bit of personality.
 * Rotates phrases with a soft fade. Respects prefers-reduced-motion (no fade,
 * just swaps). Keep it muted and small; it's a mutter, not a billboard.
 */
export function StatusTicker({
  phrases,
  className = "",
}: {
  phrases: readonly string[];
  className?: string;
}) {
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (phrases.length <= 1) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const id = setInterval(() => {
      if (reduce) {
        setI((p) => (p + 1) % phrases.length);
        return;
      }
      setVisible(false);
      setTimeout(() => {
        setI((p) => (p + 1) % phrases.length);
        setVisible(true);
      }, 220);
    }, 2200);

    return () => clearInterval(id);
  }, [phrases.length]);

  return (
    <span
      aria-hidden
      className={`inline-block transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      } ${className}`}
    >
      {phrases[i]}
    </span>
  );
}
