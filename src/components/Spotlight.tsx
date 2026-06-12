import { useEffect, useState } from "react";
import type { Member } from "../../shared/protocol";
import type { RoomClient } from "../net/socket";
import { useSpotlight } from "../store/spotlightStore";
import { Wheel } from "./Wheel";

async function fireConfetti() {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  try {
    const confetti = (await import("canvas-confetti")).default;
    confetti({ particleCount: 120, spread: 70, startVelocity: 40, origin: { y: 0.42 } });
  } catch {
    /* confetti is pure delight; never block on it */
  }
}

/** The shared spin overlay. Everyone in the room (spectators too) sees the same wheel
 *  land on the same name, because the server chose the winner. The wheel stays mounted
 *  but hidden so its nonce-change animation fires the first time a spin arrives. */
export function SpotlightLayer({
  members,
  client,
  canSpin,
}: {
  members: Member[];
  client: RoomClient;
  canSpin: boolean;
}) {
  const current = useSpotlight((s) => s.current);
  const clear = useSpotlight((s) => s.clear);
  const [winner, setWinner] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [visible, setVisible] = useState(false);

  // A new spin (bumped nonce) opens the overlay and starts the wheel. Adjusted
  // during render (React's sanctioned reset-on-prop-change), so the wheel never
  // paints a stale frame the way an after-paint effect would.
  if (current && current.nonce !== nonce) {
    setWinner(current.name);
    setNonce(current.nonce);
    setSpinning(true);
    setVisible(true);
  }

  // Linger on the result, then dissolve (true to the room: nothing sticks around).
  useEffect(() => {
    if (!visible || spinning) return;
    const t = setTimeout(() => {
      setVisible(false);
      clear();
    }, 4200);
    return () => clearTimeout(t);
  }, [visible, spinning, clear]);

  // Escape closes it.
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setVisible(false);
        clear();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, clear]);

  const candidates = members.map((m) => m.name);
  const close = () => {
    setVisible(false);
    clear();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick a person"
      onClick={close}
      className={`fixed inset-0 z-[60] grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm transition-opacity duration-200 ${
        visible ? "" : "pointer-events-none opacity-0"
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[21rem] max-w-[92vw] rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-2xl dark:border-white/10 dark:bg-[#14141b]"
      >
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {spinning ? "Spinning for a name" : "And it lands on"}
        </div>
        <div className="mt-3">
          <Wheel
            candidates={candidates}
            winner={winner}
            nonce={nonce}
            spinning={spinning}
            onSettle={() => {
              setSpinning(false);
              fireConfetti();
            }}
          />
        </div>
        <div aria-live="polite" className="mt-3 flex h-10 items-center justify-center">
          {!spinning && winner ? (
            <span className="text-3xl font-extrabold text-iris-600 dark:text-iris-400">{winner}</span>
          ) : null}
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          {canSpin && (
            <button
              onClick={() => client.spotlightPick()}
              disabled={spinning || candidates.length < 2}
              className="rounded-xl bg-iris-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-iris-500 disabled:opacity-50"
            >
              Spin again
            </button>
          )}
          <button
            onClick={close}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
