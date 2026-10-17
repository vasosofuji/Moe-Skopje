// Where a bus is: live from Modeshift's vehicles API when MODESHIFT_API_KEY is set, otherwise estimated from the timetable.
// No imports from lib/server/*: this runs under tsx too.
import { MODESHIFT_BASE, skopjeClock, type Gtfs, type GtfsTrip } from "./gtfs";

const VEHICLES_URL = `${MODESHIFT_BASE}/vehicles`;
const M_PER_DEG = 111_195; // metres per degree of latitude
const DAY = 86_400;
const FRESH_MS = 5_000; // one vehicles request serves every poll for this long
const BACKOFF_MS = 30_000; // after a failure (401, network, junk) the API is left alone this long
const STALE_MS = 5 * 60_000; // a GPS fix older than this is ignored
const rad = (deg: number) => (deg * Math.PI) / 180;
const round7 = (x: number) => Math.round(x * 1e7) / 1e7;

// ---- estimated position ----
/** A polyline [lng, lat, ...] with a measure per vertex (metres, or the feed's shape_dist_traveled units). */
type Path = { pts: Float64Array; m: Float64Array };

function cumulative(pts: Float64Array): Float64Array {
  const m = new Float64Array(pts.length / 2);
  for (let i = 1; i < m.length; i++) {
    const kx = Math.cos(rad(pts[2 * i + 1])) * M_PER_DEG;
    m[i] = m[i - 1] + Math.hypot((pts[2 * i] - pts[2 * i - 2]) * kx, (pts[2 * i + 1] - pts[2 * i - 1]) * M_PER_DEG);
  }
  return m;
}

/** The trip's shape, or the line through its stops when it has none (or the shape id is unknown). */
function pointsOf(g: Gtfs, trip: GtfsTrip): Float64Array {
  const shape = trip.shape ? g.shapes.get(trip.shape) : undefined;
  if (shape && shape.pts.length >= 4) return shape.pts;
  return Float64Array.from(trip.stops.flatMap((id) => [g.stops.get(id)!.lng, g.stops.get(id)!.lat]));
}

/**
 * Measure of each stop along the path. Each stop goes to its nearest point on the line, but the stops must keep their
 * order along it, so the segments are chosen together (best total fit, segment index never decreasing) rather than one
 * by one: a route that doubles back along the same street, or passes a stop twice, would otherwise jump ahead and strand
 * the rest. A stop further than CAP from the line stops pulling on the fit (it is not on this shape), and the order
 * of its neighbours decides where it lands.
 */
function project({ pts, m }: Path, stops: Array<{ lng: number; lat: number }>): number[] {
  const CAP = 300; // metres
  const nSeg = m.length - 1;
  const t = new Float64Array(stops.length * nSeg); // where on the segment the stop is nearest, 0..1
  const back = new Int32Array(stops.length * nSeg); // best segment of the previous stop
  let cost = new Float64Array(nSeg);
  stops.forEach(({ lng, lat }, j) => {
    const kx = Math.cos(rad(lat)) * M_PER_DEG;
    const next = new Float64Array(nSeg);
    let bestCost = 0;
    let bestSeg = 0;
    for (let i = 0; i < nSeg; i++) {
      if (j > 0 && (i === 0 || cost[i] < bestCost)) [bestCost, bestSeg] = [cost[i], i]; // cheapest previous segment at or before i
      const ax = (pts[2 * i] - lng) * kx;
      const ay = (pts[2 * i + 1] - lat) * M_PER_DEG;
      const dx = (pts[2 * i + 2] - lng) * kx - ax;
      const dy = (pts[2 * i + 3] - lat) * M_PER_DEG - ay;
      const len2 = dx * dx + dy * dy;
      const along = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
      const d = Math.hypot(ax + along * dx, ay + along * dy);
      t[j * nSeg + i] = along;
      back[j * nSeg + i] = bestSeg;
      next[i] = bestCost + Math.min(d, CAP) + 1e-3 * d; // the small term breaks ties towards the nearer segment
    }
    cost = next;
  });
  let seg = cost.indexOf(Math.min(...cost));
  const chosen = new Array<number>(stops.length);
  for (let j = stops.length - 1; j >= 0; j--) {
    chosen[j] = seg;
    seg = back[j * nSeg + seg];
  }
  let prev = 0;
  return chosen.map((i, j) => (prev = Math.max(prev, m[i] + t[j * nSeg + i] * (m[i + 1] - m[i]))));
}

type Layout = { path: Path; stopM: number[] };
const layouts = new WeakMap<GtfsTrip, Layout>(); // dropped together with the feed; the UI polls one trip every 10 s

/** The shape (or stop line) and each stop's measure along it. */
function layout(g: Gtfs, trip: GtfsTrip): Layout {
  const hit = layouts.get(trip);
  if (hit) return hit;
  const pts = pointsOf(g, trip);
  const shape = trip.shape ? g.shapes.get(trip.shape) : undefined;
  let made: Layout;
  if (shape?.pts === pts && shape.dist && trip.dist) {
    made = { path: { pts, m: shape.dist }, stopM: Array.from(trip.dist) };
  } else {
    const path = { pts, m: cumulative(pts) };
    // Without a shape the line runs through the stops themselves, so each stop sits at its own vertex.
    made = { path, stopM: shape?.pts === pts ? project(path, trip.stops.map((id) => g.stops.get(id)!)) : Array.from(path.m) };
  }
  layouts.set(trip, made);
  return made;
}

/** Compass bearing in whole degrees of the first non-degenerate segment at or after i (else before). */
function bearingAt({ pts, m }: Path, i: number): number | undefined {
  const seg = (j: number) => {
    const dx = (pts[2 * j + 2] - pts[2 * j]) * Math.cos(rad(pts[2 * j + 1]));
    const dy = pts[2 * j + 3] - pts[2 * j + 1];
    return dx === 0 && dy === 0 ? undefined : Math.round(((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360) % 360;
  };
  for (let j = i; j < m.length - 1; j++) if (seg(j) !== undefined) return seg(j);
  for (let j = i - 1; j >= 0; j--) if (seg(j) !== undefined) return seg(j);
}

function pointAt(path: Path, x: number): { lng: number; lat: number; bearing?: number } {
  const { pts, m } = path;
  let lo = 0;
  let hi = m.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (m[mid] <= x) lo = mid;
    else hi = mid - 1;
  }
  const span = m[lo + 1] - m[lo];
  const f = span > 0 ? Math.max(0, Math.min(1, (x - m[lo]) / span)) : 0;
  const bearing = bearingAt(path, lo);
  return {
    lng: round7(pts[2 * lo] + f * (pts[2 * lo + 2] - pts[2 * lo])),
    lat: round7(pts[2 * lo + 1] + f * (pts[2 * lo + 3] - pts[2 * lo + 1])),
    ...(bearing === undefined ? {} : { bearing }),
  };
}

/**
 * Where the trip is at `sec` seconds into its service day, interpolated by time between the previous and next stop
 * along the shape. Before the first departure the bus waits at the first stop, after the last arrival it sits at the last.
 */
export function estimateAt(g: Gtfs, trip: GtfsTrip, sec: number): { lng: number; lat: number; bearing?: number } {
  const { path, stopM } = layout(g, trip);
  const last = trip.stops.length - 1;
  let x: number;
  if (sec <= trip.dep[0]) x = stopM[0];
  else if (sec >= trip.arr[last]) x = stopM[last];
  else {
    let i = 0;
    while (sec >= trip.arr[i + 1]) i++; // the leg that ends after `sec`
    if (sec <= trip.dep[i]) x = stopM[i]; // still at stop i
    else {
      const span = trip.arr[i + 1] - trip.dep[i];
      x = stopM[i] + (span > 0 ? (sec - trip.dep[i]) / span : 1) * (stopM[i + 1] - stopM[i]);
    }
  }
  return pointAt(path, x);
}

/** Time on the trip's own clock: after midnight a trip that started yesterday is at 24:xx, not 00:xx. */
export function scheduleSec(trip: GtfsTrip, nowSec: number): number {
  const start = trip.dep[0];
  const end = trip.arr[trip.arr.length - 1];
  const within = (s: number) => s >= start && s <= end;
  return within(nowSec) || !within(nowSec + DAY) ? nowSec : nowSec + DAY;
}

// ---- live positions ----
export type Vehicle = { tripId?: string; lng: number; lat: number; bearing?: number; at?: number };

const at = (o: unknown, path: string): unknown => path.split(".").reduce<unknown>((v, k) => (v !== null && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), o);
const paths = (names: string[]) => ["", "properties."].flatMap((prefix) => names.map((n) => prefix + n));
const first = (o: unknown, list: string[]) => list.map((p) => at(o, p)).find((v) => v !== undefined && v !== null && v !== "");
const number = (v: unknown) => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};
const millis = (v: unknown) => {
  const n = number(v);
  if (n !== undefined) return n < 1e11 ? n * 1000 : n; // seconds or milliseconds since the epoch
  const d = typeof v === "string" ? Date.parse(v) : NaN;
  return Number.isNaN(d) ? undefined : d;
};

const LISTS = ["vehicles", "data", "items", "results", "entity", "entities", "features", "positions", "data.vehicles"];
const LAT = paths(["latitude", "lat", "position.latitude", "position.lat", "location.latitude", "location.lat"]).concat("geometry.coordinates.1");
const LNG = paths(["longitude", "lng", "lon", "long", "position.longitude", "position.lng", "position.lon", "location.longitude", "location.lng", "location.lon"]).concat("geometry.coordinates.0");
const TRIP = paths(["tripId", "trip_id", "trip.tripId", "trip.trip_id", "trip.id", "trip"]);
const BEARING = paths(["bearing", "heading", "course", "direction", "position.bearing", "position.heading"]);
const TIME = paths(["timestamp", "updatedAt", "updated_at", "lastUpdate", "last_update", "lastUpdated", "time", "position.timestamp"]);

/**
 * Vehicles from whatever JSON Modeshift answers with. The shape is not documented (the endpoint answers 401 without a
 * key), so this takes a bare array or one under a common key, GTFS-realtime-style entities, or GeoJSON features, and
 * silently skips rows without usable coordinates. Never throws.
 */
export function parseVehicles(json: unknown): Vehicle[] {
  const rows = Array.isArray(json) ? json : (LISTS.map((k) => at(json, k)).find(Array.isArray) as unknown[] | undefined) ?? [];
  const out: Vehicle[] = [];
  for (const row of rows) {
    const inner = at(row, "vehicle");
    const o = inner !== null && typeof inner === "object" ? inner : row; // GTFS-realtime wraps the vehicle in an entity
    const lat = number(first(o, LAT));
    const lng = number(first(o, LNG));
    if (lat === undefined || lng === undefined || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const trip = first(o, TRIP);
    const bearing = number(first(o, BEARING));
    const time = millis(first(o, TIME));
    out.push({
      ...(typeof trip === "string" || typeof trip === "number" ? { tripId: String(trip) } : {}),
      lng,
      lat,
      ...(bearing === undefined ? {} : { bearing }),
      ...(time === undefined ? {} : { at: time }),
    });
  }
  return out;
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
let cache: { at: number; ttl: number; list: Vehicle[] } | undefined;
let pending: Promise<Vehicle[]> | undefined;

/** Forgets the cached vehicle list (tests). */
export function resetVehicles(): void {
  cache = undefined;
  pending = undefined;
}

async function fetchVehicles(key: string, now: number, f: Fetcher): Promise<Vehicle[]> {
  try {
    // The auth scheme is not documented: send the key the two usual ways, both to Modeshift only.
    const res = await f(VEHICLES_URL, { headers: { Authorization: `Bearer ${key}`, "X-Api-Key": key, Accept: "application/json" }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cache = { at: now, ttl: FRESH_MS, list: parseVehicles(await res.json()) };
  } catch (err) {
    console.warn(`[buses] live vehicles unavailable, using the timetable estimate: ${err instanceof Error ? err.message : String(err)}`);
    cache = { at: now, ttl: BACKOFF_MS, list: [] };
  }
  return cache.list;
}

function vehicles(key: string, now: number, f: Fetcher): Promise<Vehicle[]> {
  if (cache && now - cache.at < cache.ttl) return Promise.resolve(cache.list);
  return (pending ??= fetchVehicles(key, now, f).finally(() => (pending = undefined)));
}

// ---- the endpoint's answer ----
export type Position = {
  source: "live" | "estimated";
  lng: number;
  lat: number;
  bearing?: number;
  updatedAt: string;
  shape: GeoJSON.LineString;
};

/**
 * Position of one trip, or undefined when the feed has no such trip. Live when an `apiKey` is given (the route handler
 * passes MODESHIFT_API_KEY; secrets are only read under app/api) and the vehicles API lists a fresh fix for this trip id;
 * otherwise estimated from the timetable at `now`. A live failure never fails the call.
 */
export async function tripPosition(
  g: Gtfs,
  tripId: string,
  now: number,
  opts: { apiKey?: string; fetch?: Fetcher } = {},
): Promise<Position | undefined> {
  const trip = g.trips.get(tripId);
  if (!trip) return undefined;
  const pts = pointsOf(g, trip);
  const shape: GeoJSON.LineString = { type: "LineString", coordinates: Array.from({ length: pts.length / 2 }, (_, i) => [round7(pts[2 * i]), round7(pts[2 * i + 1])]) };

  const key = opts.apiKey;
  if (key) {
    const list = await vehicles(key, now, opts.fetch ?? ((url, init) => fetch(url, init)));
    const v = list.find((x) => x.tripId === tripId && (x.at === undefined || now - x.at <= STALE_MS));
    if (v) return { source: "live", lng: v.lng, lat: v.lat, ...(v.bearing === undefined ? {} : { bearing: v.bearing }), updatedAt: new Date(v.at ?? now).toISOString(), shape };
  }
  return { source: "estimated", ...estimateAt(g, trip, scheduleSec(trip, skopjeClock(now).sec)), updatedAt: new Date(now).toISOString(), shape };
}
