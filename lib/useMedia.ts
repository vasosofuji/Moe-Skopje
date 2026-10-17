import { useCallback, useSyncExternalStore } from "react";

/** Whether `query` matches. False on the server and during hydration, so the first client render matches the HTML. */
export function useMedia(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => matchMedia(query).matches, () => false);
}

/** Desktop layout: ≥1024 px (Global Constraints). */
export const useIsDesktop = () => useMedia("(min-width: 1024px)");

const noSubscribe = () => () => {};

/** False on the server and during hydration, true afterwards. Gates UI that depends on client-only state (prefs, layout). */
export const useHydrated = () => useSyncExternalStore(noSubscribe, () => true, () => false);
