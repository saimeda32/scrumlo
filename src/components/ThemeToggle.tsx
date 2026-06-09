import { toggleTheme, useThemeMode } from "../lib/theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const mode = useThemeMode();
  const dark = mode === "dark";
  return (
    <button
      onClick={toggleTheme}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={`grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white/70 text-slate-500 transition hover:text-slate-800 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:text-white ${className}`}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {dark ? (
          <circle cx="12" cy="12" r="4" />
        ) : (
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        )}
        {dark && (
          <g>
            <line x1="12" y1="2" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="22" />
            <line x1="4.9" y1="4.9" x2="6.3" y2="6.3" />
            <line x1="17.7" y1="17.7" x2="19.1" y2="19.1" />
            <line x1="2" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="22" y2="12" />
            <line x1="4.9" y1="19.1" x2="6.3" y2="17.7" />
            <line x1="17.7" y1="6.3" x2="19.1" y2="4.9" />
          </g>
        )}
      </svg>
    </button>
  );
}
