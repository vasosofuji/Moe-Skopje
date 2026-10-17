import { useSyncExternalStore } from "react";
import type { LngLat } from "@/components/map/MapView";

/** The newest position the browser gave us. `accuracy` is the radius in metres. */
export type Fix = { at: LngLat; accuracy: number; time: number };

/** A fix this young answers a tap at once (the watch keeps refining it in the background). */
const FRESH_MS = 120_000;
/** React hears about a new position only after the user moved this far; the map layer hears about every one. */
const MOVED_M = 25;
const DENIED = 1; // GeolocationPositionError.PERMISSION_DENIED

// A coarse (network) fix is back in a second or two; GPS can take much longer, so it is asked for second.
const COARSE: PositionOptions = { enableHighAccuracy: false, maximumAge: 30_000, timeout: 10_000 };
const FINE: PositionOptions = { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 };

const metres = (a: LngLat, b: LngLat) =>
  Math.hypot((a[0] - b[0]) * 111_320 * Math.cos((a[1] * Math.PI) / 180), (a[1] - b[1]) * 110_540);

/**
 * One position watch for the whole app: coarse first for a quick answer, then high accuracy, paused while the tab is hidden.
 * Exported as a factory so tests can start from a clean state; the app uses the shared instance below.
 */
export function createGeolocation() {
  let fix: Fix | null = null;
  let shared: LngLat | undefined; // what React sees
  let watchId: number | null = null;
  let upgraded = false; // the high-accuracy watch has been tried since the last restart
  let resumeOnShow = false;
  let pending: Promise<LngLat | null> | null = null;
  let settle: ((at: LngLat | null) => void) | null = null;
  const listeners = new Set<() => void>();

  const geo = () => (typeof navigator === "undefined" ? undefined : navigator.geolocation);
  const hidden = () => typeof document !== "undefined" && document.hidden;

  function stop() {
    if (watchId !== null) geo()?.clearWatch(watchId);
    watchId = null;
  }

  function watch(fine: boolean) {
    stop();
    if (hidden()) {
      resumeOnShow = true;
      return;
    }
    watchId = geo()?.watchPosition(received, (e) => failed(e, fine), fine ? FINE : COARSE) ?? null;
  }

  function received({ coords }: GeolocationPosition) {
    const at: LngLat = [coords.longitude, coords.latitude];
    fix = { at, accuracy: coords.accuracy, time: Date.now() };
    if (!shared || metres(shared, at) > MOVED_M) shared = at;
    settle?.(at);
    if (!upgraded) {
      upgraded = true;
      watch(true);
    }
    listeners.forEach((l) => l());
  }

  function failed(e: { code: number }, fine: boolean) {
    if (e.code === DENIED) stop();
    else if (fine) watch(false); // no GPS (indoors, desktop): keep the coarse watch going
    settle?.(null);
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (watchId !== null) resumeOnShow = true;
        stop();
      } else if (resumeOnShow) {
        resumeOnShow = false;
        watch(upgraded);
      }
    });
  }

  return {
    /** The user's position, or null when location is denied, unavailable or timed out. */
    locate(): Promise<LngLat | null> {
      if (!geo()) return Promise.resolve(null);
      if (fix && Date.now() - fix.time < FRESH_MS) return Promise.resolve(fix.at);
      if (!pending) {
        // Stale or none: a new watch always reports its first position straight away, even when the user stands still.
        pending = new Promise((resolve) => {
          settle = (at) => {
            pending = settle = null;
            resolve(at);
          };
        });
        upgraded = false;
        watch(false);
      }
      return pending;
    },
    get: () => fix,
    getShared: () => shared,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

let instance: ReturnType<typeof createGeolocation> | undefined;
const store = () => (instance ??= createGeolocation());

/** Calls `cb` with the current fix, if any, and with every later one. Returns the unsubscribe. For map layers; never re-renders React. */
export function onFix(cb: (fix: Fix) => void): () => void {
  const s = store();
  const run = () => {
    const f = s.get();
    if (f) cb(f);
  };
  run();
  return s.subscribe(run);
}

/** `location` changes on the first fix and then only when the user has moved a street's length, so it is safe in shared context. */
export function useGeolocation() {
  const s = store();
  const location = useSyncExternalStore(s.subscribe, s.getShared, () => undefined);
  return { location, locate: s.locate };
}
