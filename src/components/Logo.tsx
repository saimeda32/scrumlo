// Ephem's mark: a crescent moon in the iris badge · the ephemeral motif
// ("estimate, retro, forgotten"; the room fades when everyone leaves).

export function LogoMark({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-iris-500 to-violet-500 shadow-[0_4px_12px_-3px_rgba(99,102,241,0.55)] ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none">
        <path
          d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
          fill="white"
          fillOpacity="0.95"
        />
      </svg>
    </span>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className="text-[17px] font-bold tracking-tight text-slate-900 dark:text-white">Ephem</span>
    </span>
  );
}
