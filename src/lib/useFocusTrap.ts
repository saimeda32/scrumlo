import { useEffect, useRef } from "react";

// Ref-counted body-scroll lock shared across dialogs, so opening one stops the page
// behind it from scrolling (and on mobile keeps the background put) without a second
// dialog's cleanup unlocking too early.
let scrollLocks = 0;

/**
 * Trap keyboard focus within a dialog while it's open, restore focus to the element
 * that opened it on close, and lock background scroll. Attach the returned ref to the
 * dialog root.
 */
export function useFocusTrap<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (scrollLocks++ === 0) document.body.style.overflow = "hidden";
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
      if (--scrollLocks === 0) document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, []);
  return ref;
}
