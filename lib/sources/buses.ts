// `buses` layer: bus stops from JSP's official GTFS (Modeshift producer feed, refreshed daily), each tagged with the
// lines that serve it today. Stops only, no route lines. Departures and positions live in /api/buses/*.
// No imports from lib/server/*: this runs under tsx too (scripts/check-sources.ts).
import { loadGtfs, stopLines, type Gtfs } from "./gtfs";
import { staticAdapter, toLatin } from "./static";
import type { Adapter, Feature } from "./types";

/** One point per GTFS stop. `detail.stopId` is what /api/buses/stop/[stopId] takes; `detail.lines` is "2,2А,15" (omitted when nothing leaves the stop today). */
export function stopFeatures(g: Gtfs, now: number): Feature[] {
  const lines = stopLines(g, now);
  return [...g.stops.values()].map((s) => {
    const served = lines.get(s.id);
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: {
        id: `bus-stop:${s.id}`,
        kind: "bus-stop",
        title: { mk: s.name, en: toLatin(s.name) },
        detail: { stopId: s.id, ...(s.code ? { code: s.code } : {}), ...(served ? { lines: served.join(",") } : {}) },
      },
    };
  });
}

type Options = {
  /** Defaults to the cached GTFS download. */
  load?: () => Promise<Gtfs>;
  /** Stops to show when the feed is down and there is no snapshot. Defaults to the baked OSM stops. */
  fallback?: Adapter;
  now?: () => number;
};

/**
 * The GTFS download is not tied to getLayer's signal (see loadGtfs), and getLayer waits up to `timeoutMs` for it; finishing it
 * fills the cache for the next request. When it fails the layer falls back to the last snapshot, then to the baked OSM stops.
 */
export function busesAdapter({ load = () => loadGtfs(), fallback = staticAdapter("buses", "bus-stops.geojson", "bus-stop"), now = Date.now }: Options = {}): Adapter {
  return {
    id: "buses",
    ttl: 3600,
    timeoutMs: 20_000, // cold GTFS download + parse takes ~3 s, capped at 20 s by loadGtfs; getLayer's default 8 s would serve OSM stops with ids that are not GTFS ids
    source: { name: "JSP Скопје (GTFS, Modeshift)", url: "https://skopjebus.mk/" },
    minFeatures: 100, // Skopje has ~1300 stops; a handful means a broken feed
    fetch: async () => stopFeatures(await load(), now()),
    seed: () => fallback.fetch().catch(() => []),
  };
}

export const buses = busesAdapter();
