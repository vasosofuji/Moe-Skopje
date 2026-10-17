import { useEffect, useSyncExternalStore } from "react";

/**
 * Stale-while-revalidate for small JSON endpoints (departures, the outage week, data health): one cache per page, so a
 * widget that remounts (a tab switch, a reopened card) shows its last answer at once and refreshes behind it.
 * `read` turns a response into data or throws; a throw, like a network error, keeps the last good answer (null if none).
 */
const FRESH_MS = 5_000; // remounts and siblings within this share one request
type Entry = { at: number; data: unknown };
const cache = new Map<string, Entry>();
const inflight = new Set<string>();
const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

export async function revalidate<T>(url: string, read: (res: Response) => Promise<T>, now = Date.now()): Promise<void> {
  const prev = cache.get(url);
  if (inflight.has(url) || (prev && now - prev.at < FRESH_MS)) return;
  inflight.add(url);
  let data: unknown = prev?.data ?? null;
  try {
    data = await read(await fetch(url));
  } catch {
    // Offline, an HTTP error or a bad body: keep what we had.
  }
  inflight.delete(url);
  cache.set(url, { at: Date.now(), data });
  listeners.forEach((l) => l());
}

/** Cached answer for `url`: undefined until the first one, then data, or null when it never succeeded. Polls every `pollMs` while visible. */
export function useFetched<T>(url: string | undefined, read: (res: Response) => Promise<T>, pollMs = 0): T | null | undefined {
  const entry = useSyncExternalStore(subscribe, () => (url ? cache.get(url) : undefined), () => undefined);

  useEffect(() => {
    if (!url) return;
    const tick = () => {
      if (document.visibilityState === "visible") void revalidate(url, read);
    };
    tick();
    if (!pollMs) return;
    const timer = setInterval(tick, pollMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [url, read, pollMs]);

  return entry ? (entry.data as T | null) : undefined;
}
