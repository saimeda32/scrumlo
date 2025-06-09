// Scrumlo's mark: a sprint-cycle loop in the iris badge. The agile loop that
// comes around each sprint and clears when the room ends ("estimate, retro,
// forgotten"). One clean arrow reads as scrum/cycle at any size; the dot at its
// heart is the moment you capture before it poofs.

export function LogoMark({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-iris-500 to-violet-500 shadow-[0_4px_12px_-3px_rgba(99,102,241,0.55)] ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.66} height={size * 0.66} viewBox="0 0 24 24" fill="none">
        {/* sprint loop + arrowhead */}
        <g stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.5 12a8.5 8.5 0 1 1-8.5-8.5c2.4 0 4.66.95 6.36 2.6L20.5 8" />
          <path d="M20.5 3v5h-5" />
        </g>
        {/* the captured moment at the center */}
        <circle cx="12" cy="12" r="2.4" fill="white" />
      </svg>
    </span>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className="text-[17px] font-bold tracking-tight text-slate-900 dark:text-white">Scrumlo</span>
    </span>
  );
}
