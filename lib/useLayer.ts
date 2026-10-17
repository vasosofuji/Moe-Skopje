import { useEffect, useSyncExternalStore } from "react";
import type { LayerId } from "@/lib/layers";
import type { LayerResponse } from "@/lib/sources/types";

const POLL_MS = 60_000;
/** A copy younger than this is reused, so the map, a card and a row showing one layer share one request. */
const FRESH_MS = 50_000;

// One cache for the whole page. `data` is undefined after a 404 (layer not registered) or before any good response.
// `sig` is the features' JSON: a poll that returns the same features keeps the old object, so the map skips setData.
type Entry = { at: number; data?: LayerResponse; sig?: string };
const cache = new Map<LayerId, Entry>();
const inflight = new Set<LayerId>();
const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

/**
 * Fetches GET /api/layers/:id unless a request is already running or the cached copy is fresh.
 * A non-OK response clears the data; a network error (offline) keeps the last good copy.
 */
export async function refreshLayer(id: LayerId, now = Date.now()): Promise<void> {
  const prev = cache.get(id);
  if (inflight.has(id) || (prev && now - prev.at < FRESH_MS)) return;
  inflight.add(id);
  let data = prev?.data;
  let sig = prev?.sig;
  try {
    const res = await fetch(`/api/layers/${id}`);
    data = res.ok ? ((await res.json()) as LayerResponse) : undefined;
    sig = data ? JSON.stringify(data.features) : undefined;
    if (data && prev?.data && sig === prev.sig) data = { ...data, features: prev.data.features };
  } catch {
    // Offline or a broken body: keep showing what we had.
  }
  inflight.delete(id);
  cache.set(id, { at: Date.now(), data, sig });
  listeners.forEach((l) => l());
}

/** Last response for `id`, if any. For event handlers (map clicks, search) that need data outside React. */
export const getCachedLayer = (id: LayerId) => cache.get(id)?.data;

/** Every layer that has data right now. */
export const cachedLayers = () =>
  [...cache].flatMap(([id, e]) => (e.data ? [{ id, data: e.data }] : []));

/**
 * Layer data, re-fetched every 60 s while `enabled` and the tab is visible (and once more when it becomes visible).
 * `loading` is true until the first response arrives; afterwards a missing `data` means the layer is empty or unknown.
 */
export function useLayer(id: LayerId, enabled: boolean): { data?: LayerResponse; loading: boolean } {
  const entry = useSyncExternalStore(subscribe, () => cache.get(id), () => undefined);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refreshLayer(id);
    };
    tick();
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [id, enabled]);

  return { data: entry?.data, loading: enabled && !entry };
}
