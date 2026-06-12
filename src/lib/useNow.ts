import { useCallback, useSyncExternalStore } from "react";

/** The current time as an external store (which it is): re-renders every `ms`
 *  while `active`, without setState-in-effect clock plumbing. Reads are quantized
 *  to the tick so getSnapshot stays stable within a frame. */
export function useNow(active: boolean, ms = 200): number {
  const subscribe = useCallback(
    (onTick: () => void) => {
      if (!active) return () => {};
      const id = setInterval(onTick, ms);
      return () => clearInterval(id);
    },
    [active, ms],
  );
  const read = useCallback(() => (active ? Math.floor(Date.now() / ms) * ms : 0), [active, ms]);
  return useSyncExternalStore(subscribe, read);
}
