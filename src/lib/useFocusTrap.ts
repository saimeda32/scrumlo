import { useEffect, useRef } from "react";

/**
 * Trap keyboard focus within a dialog while it's open, and restore focus to the
 * element that opened it on close. Attach the returned ref to the dialog root.
 */
export function useFocusTrap<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const prev = document.activeElement as HTMLElement | null;
    const sel =
      'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(sel)).filter((e) => e.offsetParent !== null);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, []);
  return ref;
}
