import { useEffect, useRef, useState } from "react";

const COLORS = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/**
 * A wheel of names/items that spins and lands on `winner` whenever `nonce` bumps.
 * Deterministic landing: the server already chose the winner; we just rotate to it.
 */
export function Wheel({
  candidates,
  winner,
  nonce,
  spinning,
  onSettle,
}: {
  candidates: string[];
  winner: string | null;
  nonce: number;
  spinning: boolean;
  onSettle: () => void;
}) {
  const [rotation, setRotation] = useState(0);
  const lastNonce = useRef(nonce);

  const n = Math.max(candidates.length, 1);
  const seg = 360 / n;

  useEffect(() => {
    if (nonce === lastNonce.current) return;
    lastNonce.current = nonce;
    // Can't land on a winner that isn't on the wheel (a member left / list item was
    // removed between the spin and the snapshot). Release the lock instead of hanging.
    const idx = winner ? candidates.indexOf(winner) : -1;
    if (idx < 0) {
      onSettle();
      return;
    }
    // angle that lands slice idx's center under the top pointer
    const targetMod = -(idx + 0.5) * seg;
    setRotation((cur) => {
      let next = cur - (((cur % 360) + 360) % 360) + targetMod;
      while (next < cur + 360 * 5) next += 360; // at least 5 full turns
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  const cx = 100;
  const cy = 100;
  const r = 96;

  return (
    <div className="relative mx-auto h-64 w-64">
      {/* pointer */}
      <div className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2">
        <div className="h-0 w-0 border-x-[10px] border-t-[16px] border-x-transparent border-t-slate-900 drop-shadow dark:border-t-white" />
      </div>
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? "transform 3.6s cubic-bezier(0.16,1,0.3,1)" : "none",
        }}
        onTransitionEnd={() => spinning && onSettle()}
      >
        {candidates.map((name, i) => {
          const a0 = -90 + i * seg;
          const a1 = -90 + (i + 1) * seg;
          const [x0, y0] = polar(cx, cy, r, a0);
          const [x1, y1] = polar(cx, cy, r, a1);
          const large = seg > 180 ? 1 : 0;
          const mid = -90 + (i + 0.5) * seg;
          const [lx, ly] = polar(cx, cy, r * 0.62, mid);
          // Keep labels right-side-up: flip any that would land in the lower half.
          const baseRot = mid + 90;
          const textRot = baseRot > 90 && baseRot < 270 ? baseRot + 180 : baseRot;
          const d =
            n === 1
              ? `M ${cx - r},${cy} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`
              : `M ${cx},${cy} L ${x0.toFixed(2)},${y0.toFixed(2)} A ${r},${r} 0 ${large},1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`;
          return (
            <g key={i}>
              <path d={d} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth={1.5} />
              <text
                x={lx}
                y={ly}
                transform={`rotate(${textRot} ${lx} ${ly})`}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={n > 8 ? 8 : 10}
                fontWeight={700}
                fill="#fff"
              >
                {name.length > 12 ? name.slice(0, 11) + "…" : name}
              </text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={12} fill="#fff" stroke="#e2e8f0" strokeWidth={2} />
      </svg>
    </div>
  );
}
