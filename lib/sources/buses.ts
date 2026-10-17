// `buses` layer: the baked OSM stops and routes, each stop tagged with the lines that pass it.
// No imports from lib/server/*: this runs under tsx too (scripts/check-sources.ts).
import { setStopLines } from "./bus-timetable";
import { staticBuses } from "./static";
import type { Adapter, Feature } from "./types";

export { nextDepartures } from "./bus-timetable";

const JSP_URL = "http://jsp.com.mk/";
const PROBE_TIMEOUT_MS = 8000;
const M_PER_DEG = 111_195; // metres per degree of latitude (and of longitude at the equator)

/** Distance in metres from the origin to the segment (ax,ay)-(bx,by), all in metres. */
function distanceToSegment(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

const lineParts = (g: GeoJSON.Geometry): number[][][] => (g.type === "LineString" ? [g.coordinates] : g.type === "MultiLineString" ? g.coordinates : []);

/**
 * Which lines serve which stop. OSM bus stops rarely carry `route_ref`, so a stop belongs to a route when it lies within
 * `maxM` metres of the route's geometry. `routes` need `detail.ref`; the result lists each stop's refs once, in natural
 * order ("2", "2A", "15"), and omits stops no route passes.
 * ponytail: equirectangular metres (fine at Skopje's latitude) and a brute-force scan of every segment, run once per process.
 */
export function stopLines(stops: Feature[], routes: Feature[], maxM = 30): Map<string, string[]> {
  const found = new Map<string, Set<string>>();
  for (const r of routes) {
    const ref = r.properties.detail?.ref;
    if (ref === undefined || ref === "") continue;
    const parts = lineParts(r.geometry);
    for (const s of stops) {
      if (s.geometry.type !== "Point") continue;
      const [lng, lat] = s.geometry.coordinates;
      const kx = M_PER_DEG * Math.cos((lat * Math.PI) / 180);
      const near = parts.some((part) =>
        part.some((c, i) => i > 0 && distanceToSegment((part[i - 1][0] - lng) * kx, (part[i - 1][1] - lat) * M_PER_DEG, (c[0] - lng) * kx, (c[1] - lat) * M_PER_DEG) <= maxM),
      );
      if (!near) continue;
      const refs = found.get(s.properties.id) ?? new Set<string>();
      found.set(s.properties.id, refs.add(String(ref)));
    }
  }
  return new Map([...found].map(([id, refs]) => [id, [...refs].sort((a, b) => a.localeCompare(b, "en", { numeric: true }))]));
}

export type BusesAdapter = Adapter & {
  /** Whether the last jsp.com.mk probe got an HTTP 2xx; null while unprobed or still waiting. */
  jspReachable(): boolean | null;
};

type Options = {
  base?: Adapter;
  /** Defaults to global fetch. */
  probe?: (url: string, init: RequestInit) => Promise<Response>;
  now?: () => number;
};

/**
 * The static buses adapter plus `detail.lines` on every stop, and a reachability probe of jsp.com.mk (unreachable when
 * last tried). The probe is fire-and-forget, at most once per ttl, so it never slows a response. There is no live JSP
 * parser yet, so the layer stays `static` whether or not JSP answers.
 */
export function busesAdapter({ base = staticBuses(), probe = (url, init) => fetch(url, init), now = Date.now }: Options = {}): BusesAdapter {
  let jspUp: boolean | null = null;
  let probedAt = -Infinity;
  let lines: Map<string, string[]> | undefined;

  return {
    ...base,
    jspReachable: () => jspUp,
    async fetch(signal) {
      if (now() - probedAt >= base.ttl * 1000) {
        probedAt = now();
        jspUp = null;
        probe(JSP_URL, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) }).then(
          (res) => void (jspUp = res.ok),
          () => void (jspUp = false),
        );
      }
      const features = await base.fetch(signal);
      const byStop = (lines ??= stopLines(
        features.filter((f) => f.properties.kind === "bus-stop"),
        features.filter((f) => f.properties.kind === "bus-route"),
      ));
      setStopLines(byStop);
      return features.map((f) => {
        const refs = byStop.get(f.properties.id);
        return refs ? { ...f, properties: { ...f.properties, detail: { ...f.properties.detail, lines: refs.join(",") } } } : f;
      });
    },
  };
}

export const buses = busesAdapter();
