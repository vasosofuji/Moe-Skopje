// Routing helpers (R1): request validation, closure exclusion polygons, detour waypoints and the Google Maps / Waze hand-off URLs.
// Pure: no I/O and no imports from lib/server/* (the router calls live in lib/server/route.ts).
import { z } from "zod";
import { simplifyLine } from "./sources/geom";
import type { Feature } from "./sources/types";

export type LngLat = [number, number];
export type Mode = "auto" | "bicycle" | "pedestrian";
export const MODES = ["auto", "bicycle", "pedestrian"] as const;

/** [west, south, east, north]: the Skopje view box. Both ends of a route must be inside it. */
export const SKOPJE_BBOX = [21.25, 41.9, 21.6, 42.1] as const;
const MIN_TRIP_M = 25;
const M_PER_DEG = 111_320;

/** Is the point [lng, lat] inside SKOPJE_BBOX? */
export const inBox = ([lng, lat]: number[]) => lng >= SKOPJE_BBOX[0] && lng <= SKOPJE_BBOX[2] && lat >= SKOPJE_BBOX[1] && lat <= SKOPJE_BBOX[3];

/** Straight-line distance in metres on a local plane (fine at city scale). */
export function distanceM(a: number[], b: number[]): number {
  const k = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot((b[0] - a[0]) * k, b[1] - a[1]) * M_PER_DEG;
}

const Position = z.tuple([z.number(), z.number()]); // [lng, lat]; z.number() rejects NaN and Infinity

/** POST /api/route body. The issue message "bbox" marks a point outside SKOPJE_BBOX (the route answers 400 { code: "bbox" }). */
export const RouteBodySchema = z
  .object({ from: Position, to: Position, mode: z.enum(MODES).default("auto") })
  .refine((b) => inBox(b.from) && inBox(b.to), { message: "bbox" })
  .refine((b) => distanceM(b.from, b.to) >= MIN_TRIP_M, { message: "same" });

// --- Planar geometry ------------------------------------------------------------------------------------------------

type XY = [number, number];
const lenOf = (v: XY) => Math.hypot(v[0], v[1]);

/** Pairs of ring vertices projected to metres around `origin`, and back. */
function plane(origin: number[]) {
  const k = Math.cos((origin[1] * Math.PI) / 180) * M_PER_DEG;
  return {
    to: (p: number[]): XY => [(p[0] - origin[0]) * k, (p[1] - origin[1]) * M_PER_DEG],
    back: (p: XY): LngLat => [origin[0] + p[0] / k, origin[1] + p[1] / M_PER_DEG],
  };
}

export function perimeterM(ring: LngLat[]): number {
  return ring.slice(1).reduce((sum, p, i) => sum + distanceM(ring[i], p), 0);
}

/**
 * A closed ring around a polyline: `radiusM` to either side, square end caps, mitred corners (the mitre is capped at twice the
 * radius). One point gives an octagon. A line gives ONE ring of about 2 x length + 4 x radius, which keeps the total perimeter low
 * (Valhalla caps the sum of all exclude polygons' perimeters).
 * ponytail: a corner sharper than ~60 degrees with legs shorter than the radius can make the ring cross itself; streets are baked
 * with 5 m simplification, so this does not happen in practice. Upgrade to a real offset/union (e.g. polygon-clipping) if it does.
 */
export function bufferLine(line: number[][], radiusM = 15): LngLat[] {
  const { to, back } = plane(line[0]);
  const pts = line.map(to).filter((p, i, all) => i === 0 || lenOf([p[0] - all[i - 1][0], p[1] - all[i - 1][1]]) > 0.01);
  if (pts.length === 1) {
    const ring = Array.from({ length: 8 }, (_, i): LngLat => back([pts[0][0] + radiusM * Math.cos((i * Math.PI) / 4), pts[0][1] + radiusM * Math.sin((i * Math.PI) / 4)]));
    return [...ring, ring[0]];
  }
  const dir = pts.slice(1).map((p, i): XY => {
    const v: XY = [p[0] - pts[i][0], p[1] - pts[i][1]];
    return [v[0] / lenOf(v), v[1] / lenOf(v)];
  });
  const left = (d: XY): XY => [-d[1], d[0]];
  const last = pts.length - 1;
  /** The offset of vertex i to the side `sign` (+1 left, -1 right). */
  const side = (i: number, sign: 1 | -1): XY => {
    const p = pts[i];
    if (i === 0 || i === last) {
      const d = dir[i === 0 ? 0 : last - 1];
      const n = left(d);
      const along = i === 0 ? -radiusM : radiusM; // end caps reach one radius past the ends
      return [p[0] + sign * n[0] * radiusM + d[0] * along, p[1] + sign * n[1] * radiusM + d[1] * along];
    }
    const n1 = left(dir[i - 1]);
    const n2 = left(dir[i]);
    const m: XY = [n1[0] + n2[0], n1[1] + n2[1]];
    if (lenOf(m) < 1e-6) return [p[0] + sign * n2[0] * radiusM, p[1] + sign * n2[1] * radiusM]; // a U-turn: bevel
    const u: XY = [m[0] / lenOf(m), m[1] / lenOf(m)];
    const scale = Math.min(radiusM / Math.max(u[0] * n2[0] + u[1] * n2[1], 1e-6), 2 * radiusM);
    return [p[0] + sign * u[0] * scale, p[1] + sign * u[1] * scale];
  };
  const idx = pts.map((_, i) => i);
  const ring = [...idx.map((i) => side(i, 1)), ...idx.map((i) => side(i, -1)).reverse()].map(back);
  return [...ring, ring[0]];
}

function pointInRing(ring: number[][], [x, y]: number[]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const segmentsCross = (a: number[], b: number[], c: number[], d: number[]) =>
  cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;

// --- Closures ---------------------------------------------------------------------------------------------------------

export type Closure = { id: string; title: { mk: string; en: string }; rings: LngLat[][] };

const LEAD_MS = 30 * 60_000; // a closure starting within half an hour counts: the trip is about to happen

/** Is this feature something a driver cannot get through right now? Closures and regimes only (utility outages leave the road open). */
function blocks(f: Feature, now: number): boolean {
  const { kind, startsAt, endsAt, detail } = f.properties;
  if (detail?.approx) return false; // only a municipality or a city centre is known: no street to avoid
  const blocking = kind === "closure" || kind === "regime";
  return blocking && (!startsAt || Date.parse(startsAt) <= now + LEAD_MS) && (!endsAt || Date.parse(endsAt) >= now);
}

function ringsOf(g: GeoJSON.Geometry): LngLat[][] {
  switch (g.type) {
    case "Point":
      return [bufferLine([g.coordinates])];
    case "MultiPoint":
      return g.coordinates.map((p) => bufferLine([p]));
    case "LineString":
      return [bufferLine(g.coordinates)];
    case "MultiLineString":
      return g.coordinates.map((l) => bufferLine(l));
    default:
      return []; // areas are never a street
  }
}

/** The features that close a street at `now`, each with the exclusion rings around its geometry (about 15 m on either side). */
export function activeClosures(features: Feature[], now: number): Closure[] {
  return features
    .filter((f) => blocks(f, now))
    .map((f) => ({ id: f.properties.id, title: f.properties.title, rings: ringsOf(f.geometry) }))
    .filter((c) => c.rings.length > 0);
}

/** The closures a route (positions in order) runs through: a vertex inside a ring, or a segment cutting a ring edge. */
export function crossedBy(route: number[][], closures: Closure[]): Closure[] {
  return closures.filter((c) =>
    c.rings.some((ring) => {
      const xs = ring.map((p) => p[0]);
      const ys = ring.map((p) => p[1]);
      const [w, e, s, n] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      return route.some((p, i) => {
        const q = route[i - 1] ?? p;
        if (Math.max(p[0], q[0]) < w || Math.min(p[0], q[0]) > e || Math.max(p[1], q[1]) < s || Math.min(p[1], q[1]) > n) return false; // clear of the ring's box
        return pointInRing(ring, p) || (i > 0 && ring.some((r, j) => j > 0 && segmentsCross(q, p, ring[j - 1], r)));
      });
    }),
  );
}

// --- Waypoints for Google Maps -----------------------------------------------------------------------------------------

const FAR_M = 40; // a vertex this far from the free route belongs to the detour
const TURN_DEG = 30;

function distToLineM(p: number[], line: number[][]): number {
  const { to } = plane(p);
  const q = to(p); // [0, 0]
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = to(line[i - 1]);
    const b = to(line[i]);
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / len2));
    best = Math.min(best, Math.hypot(q[0] - (a[0] + t * dx), q[1] - (a[1] + t * dy)));
  }
  return best;
}

/** Heading change in degrees at b, walking a -> b -> c. */
function turnDeg(a: number[], b: number[], c: number[]): number {
  const { to } = plane(b);
  const [p, q, r] = [to(a), to(b), to(c)];
  const [ux, uy, vx, vy] = [q[0] - p[0], q[1] - p[1], r[0] - q[0], r[1] - q[1]];
  return Math.abs((Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy) * 180) / Math.PI);
}

/**
 * Up to `max` waypoints that pin `route` to its detour around `free` (the route without exclusions): the sharpest turns, in route
 * order, among the vertices from just before the route leaves the free route to just after it comes back. A smooth detour with no
 * sharp turn gets one waypoint at its apex. Nothing when the route never leaves the free route.
 */
export function sampleWaypoints(route: LngLat[], free: number[][], max = 8): LngLat[] {
  const v = simplifyLine(route, 15) as LngLat[];
  const far = v.map((p) => distToLineM(p, free));
  const first = far.findIndex((d) => d > FAR_M);
  if (first < 0) return [];
  const lastFar = far.length - 1 - [...far].reverse().findIndex((d) => d > FAR_M);
  const picks = v
    .map((p, i) => ({ i, angle: i > 0 && i < v.length - 1 ? turnDeg(v[i - 1], p, v[i + 1]) : 0 }))
    .filter((c) => c.i >= first - 1 && c.i <= lastFar + 1 && c.angle >= TURN_DEG)
    .sort((a, b) => b.angle - a.angle)
    .slice(0, max)
    .sort((a, b) => a.i - b.i);
  if (picks.length) return picks.map((c) => v[c.i]);
  return [v[far.indexOf(Math.max(...far))]];
}

// --- Hand-off URLs --------------------------------------------------------------------------------------------------------

const num = (v: number) => String(Math.round(v * 1e6) / 1e6);
const latLng = (p: number[]) => `${num(p[1])},${num(p[0])}`;
const TRAVEL: Record<Mode, string> = { auto: "driving", bicycle: "bicycling", pedestrian: "walking" };

/** Google Maps directions, `lat,lng` order. Google takes at most 9 waypoints; the caller passes at most 8. */
export function googleMapsUrl(from: number[], to: number[], mode: Mode, waypoints: number[][]): string {
  const wp = waypoints.length ? `&waypoints=${waypoints.map(latLng).join("%7C")}` : "";
  return `https://www.google.com/maps/dir/?api=1&origin=${latLng(from)}&destination=${latLng(to)}&travelmode=${TRAVEL[mode]}${wp}`;
}

/** Waze deep link. Waze takes a destination only: no waypoints, so it picks its own route to it. */
export const wazeUrl = (to: number[]) => `https://waze.com/ul?ll=${latLng(to)}&navigate=yes`;

// --- Router output --------------------------------------------------------------------------------------------------------

/** Valhalla's encoded `shape` (polyline, 6 decimals, lat before lng) → [lng, lat] positions. */
export function decodePolyline6(shape: string): LngLat[] {
  const out: LngLat[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = shape.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < shape.length) {
    lat += next();
    lng += next();
    out.push([lng / 1e6, lat / 1e6]);
  }
  return out;
}
