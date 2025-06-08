import { useSyncExternalStore } from "react";

// Device-level UI preference (not user data): a tiny localStorage flag, falling
// back to the OS setting. Toggling flips `.dark` on <html>.
type Mode = "light" | "dark";
const KEY = "ephem-theme";

function systemPref(): Mode {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function stored(): Mode | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

export function currentMode(): Mode {
  return stored() ?? systemPref();
}

function apply(mode: Mode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
}

/** Call once at boot, before paint, so there's no flash. */
export function initTheme() {
  apply(currentMode());
}

const listeners = new Set<() => void>();
export function toggleTheme() {
  const next: Mode = currentMode() === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* private mode — still applies for the session */
  }
  apply(next);
  listeners.forEach((l) => l());
}

export function useThemeMode(): Mode {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => currentMode(),
    () => "light",
  );
}
