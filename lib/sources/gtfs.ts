// JSP's official GTFS (Modeshift producer feed, regenerated daily): download, unzip, parse into compact indexes.
// No imports from lib/server/*: this runs under tsx too (scripts/check-sources.ts).
import { strFromU8, unzipSync } from "fflate";

export const MODESHIFT_BASE = "https://www.modeshift.app/api/v1/9814b106-2afe-47c8-919b-bdec6a5e521e/transport";
export const GTFS_URL = `${MODESHIFT_BASE}/gtfs/gtfs.zip`;

const TTL_MS = 6 * 3600_000; // how long a parsed feed is trusted
const RETRY_MS = 5 * 60_000; // minimum gap between download attempts
const TIMEOUT_MS = 20_000;
const DAY = 86_400;

// ---- types ----
export type GtfsStop = { id: string; code: string; name: string; lng: number; lat: number };
/** `pts` is [lng, lat, lng, lat, ...]; `dist` (shape_dist_traveled per point) only when every point has one. */
export type GtfsShape = { pts: Float64Array; dist?: Float64Array };
/** One scheduled run. `stops` are in stop_sequence order; `arr`/`dep` are seconds since the start of the service day (may exceed 86 400). */
export type GtfsTrip = {
  id: string;
  route: string; // route_short_name
  headsign: string;
  service: string;
  shape?: string;
  stops: string[];
  arr: Int32Array;
  dep: Int32Array;
  dist?: Float64Array; // stop_times.shape_dist_traveled, only when every stop has one
};
type Calendar = { days: boolean[]; start: string; end: string }; // days[0] = Sunday (Date#getUTCDay), dates as YYYY-MM-DD
type Dep = { sec: number; trip: GtfsTrip };
type Day = { date: string; byStop: Map<string, Dep[]>; lines: Map<string, string[]>; hasToday: boolean };

export type Gtfs = {
  stops: Map<string, GtfsStop>;
  trips: Map<string, GtfsTrip>;
  shapes: Map<string, GtfsShape>;
  calendar: Map<string, Calendar>;
  exceptions: Map<string, Map<string, 1 | 2>>; // date → service → calendar_dates exception_type
  /** Departures and lines for the Skopje date they were last asked for. */
  day?: Day;
};

// ---- CSV ----
function splitQuoted(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c !== '"') {
        cell += c;
      } else if (line[i + 1] === '"') {
        cell += '"'; // "" inside quotes is one quote
        i++;
      } else {
        quoted = false;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      cells.push(cell);
      cell = "";
    } else {
      cell += c;
    }
  }
  cells.push(cell);
  return cells;
}

const oddQuotes = (line: string) => line.includes('"') && line.split('"').length % 2 === 0;

/** Calls `each` with one {column: value} record per row (BOM, CRLF, quoted fields and quoted newlines handled). */
function eachRow(text: string, each: (row: Record<string, string>) => void): void {
  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let header: string[] | undefined;
  while (pos < text.length) {
    let nl = text.indexOf("\n", pos);
    if (nl < 0) nl = text.length;
    let line = text.slice(pos, nl);
    pos = nl + 1;
    while (oddQuotes(line) && pos < text.length) {
      nl = text.indexOf("\n", pos);
      if (nl < 0) nl = text.length;
      line += `\n${text.slice(pos, nl)}`;
      pos = nl + 1;
    }
    if (line.endsWith("\r")) line = line.slice(0, -1);
    if (!line) continue;
    const cells = line.includes('"') ? splitQuoted(line) : line.split(",");
    if (!header) {
      header = cells.map((h) => h.trim());
      continue;
    }
    const row: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) row[header[i]] = cells[i] ?? "";
    each(row);
  }
}

const num = (s: string | undefined) => (s === undefined || s.trim() === "" ? NaN : Number(s));
const round6 = (x: number) => Math.round(x * 1e6) / 1e6;
const isoDate = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`; // 20261017 → 2026-10-17
const toSec = (s: string | undefined) => {
  const m = /^\s*(\d+):(\d\d):(\d\d)\s*$/.exec(s ?? "");
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : NaN;
};
const SERVICE_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// ---- parsing ----
type Acc = { seq: number[]; stop: string[]; arr: number[]; dep: number[]; dist: number[] };

/**
 * Parses the GTFS text files into compact indexes; the raw text is not kept.
 * ponytail: a stop_times row with no time at all is dropped (JSP always sets arrival and departure); interpolating
 * the untimed stops between timepoints would be the upgrade if a feed ever needs it.
 */
export function parseGtfs(files: Record<string, string>): Gtfs {
  const stops = new Map<string, GtfsStop>();
  eachRow(files["stops.txt"] ?? "", (r) => {
    const lat = num(r.stop_lat);
    const lng = num(r.stop_lon);
    if (!r.stop_id || !Number.isFinite(lat) || !Number.isFinite(lng) || (r.location_type && r.location_type !== "0")) return;
    stops.set(r.stop_id, { id: r.stop_id, code: r.stop_code ?? "", name: r.stop_name ?? "", lng: round6(lng), lat: round6(lat) });
  });
  if (stops.size === 0) throw new Error("gtfs: stops.txt has no stops");

  const routes = new Map<string, string>();
  eachRow(files["routes.txt"] ?? "", (r) => routes.set(r.route_id, r.route_short_name || r.route_long_name || r.route_id));

  const meta = new Map<string, { route: string; service: string; headsign: string; shape?: string }>();
  eachRow(files["trips.txt"] ?? "", (r) => {
    if (r.trip_id) meta.set(r.trip_id, { route: routes.get(r.route_id) ?? r.route_id, service: r.service_id, headsign: r.trip_headsign ?? "", shape: r.shape_id || undefined });
  });

  const acc = new Map<string, Acc>();
  eachRow(files["stop_times.txt"] ?? "", (r) => {
    if (!meta.has(r.trip_id) || !stops.has(r.stop_id)) return;
    let arr = toSec(r.arrival_time);
    let dep = toSec(r.departure_time);
    if (Number.isNaN(arr) && Number.isNaN(dep)) return;
    if (Number.isNaN(arr)) arr = dep;
    if (Number.isNaN(dep)) dep = arr;
    let a = acc.get(r.trip_id);
    if (!a) acc.set(r.trip_id, (a = { seq: [], stop: [], arr: [], dep: [], dist: [] }));
    a.seq.push(Number(r.stop_sequence));
    a.stop.push(r.stop_id);
    a.arr.push(arr);
    a.dep.push(dep);
    a.dist.push(num(r.shape_dist_traveled));
  });

  const trips = new Map<string, GtfsTrip>();
  for (const [id, a] of acc) {
    if (a.seq.length < 2) continue;
    const order = a.seq.map((_, i) => i);
    if (a.seq.some((s, i) => i > 0 && s < a.seq[i - 1])) order.sort((x, y) => a.seq[x] - a.seq[y]);
    const m = meta.get(id)!;
    const dist = order.map((i) => a.dist[i]);
    trips.set(id, {
      id,
      ...m,
      stops: order.map((i) => a.stop[i]),
      arr: Int32Array.from(order, (i) => a.arr[i]),
      dep: Int32Array.from(order, (i) => a.dep[i]),
      dist: dist.every(Number.isFinite) ? Float64Array.from(dist) : undefined,
    });
  }
  if (trips.size === 0) throw new Error("gtfs: no trips with stop_times");

  const used = new Set([...trips.values()].map((t) => t.shape));
  const pending = new Map<string, { seq: number[]; lng: number[]; lat: number[]; dist: number[] }>();
  eachRow(files["shapes.txt"] ?? "", (r) => {
    if (!used.has(r.shape_id)) return;
    let p = pending.get(r.shape_id);
    if (!p) pending.set(r.shape_id, (p = { seq: [], lng: [], lat: [], dist: [] }));
    p.seq.push(Number(r.shape_pt_sequence));
    p.lng.push(Number(r.shape_pt_lon));
    p.lat.push(Number(r.shape_pt_lat));
    p.dist.push(num(r.shape_dist_traveled));
  });
  const shapes = new Map<string, GtfsShape>();
  for (const [id, p] of pending) {
    const order = p.seq.map((_, i) => i);
    if (p.seq.some((s, i) => i > 0 && s < p.seq[i - 1])) order.sort((x, y) => p.seq[x] - p.seq[y]);
    const dist = order.map((i) => p.dist[i]);
    shapes.set(id, {
      pts: Float64Array.from(order.flatMap((i) => [p.lng[i], p.lat[i]])),
      dist: dist.every(Number.isFinite) ? Float64Array.from(dist) : undefined,
    });
  }

  const calendar = new Map<string, Calendar>();
  eachRow(files["calendar.txt"] ?? "", (r) =>
    calendar.set(r.service_id, { days: SERVICE_DAYS.map((d) => r[d] === "1"), start: isoDate(r.start_date), end: isoDate(r.end_date) }),
  );
  const exceptions = new Map<string, Map<string, 1 | 2>>();
  eachRow(files["calendar_dates.txt"] ?? "", (r) => {
    const date = isoDate(r.date);
    const type = r.exception_type === "1" ? 1 : r.exception_type === "2" ? 2 : undefined;
    if (!type) return;
    if (!exceptions.has(date)) exceptions.set(date, new Map());
    exceptions.get(date)!.set(r.service_id, type);
  });

  return { stops, trips, shapes, calendar, exceptions };
}

const NEEDED = new Set(["stops.txt", "routes.txt", "trips.txt", "stop_times.txt", "calendar.txt", "calendar_dates.txt", "shapes.txt"]);

/** Unzips a GTFS zip (only the files we read) and parses it. Throws on a corrupt zip or an empty feed. */
export function unzipGtfs(zip: Uint8Array): Gtfs {
  const raw = unzipSync(zip, { filter: (f) => NEEDED.has(f.name) });
  return parseGtfs(Object.fromEntries(Object.entries(raw).map(([name, bytes]) => [name, strFromU8(bytes)])));
}

// ---- service calendar ----
/** service_ids running on a date ("YYYY-MM-DD"): calendar.txt weekday and range, then calendar_dates.txt adds (1) and removals (2). */
export function activeServices(g: Gtfs, date: string): Set<string> {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const out = new Set<string>();
  for (const [id, c] of g.calendar) if (c.days[dow] && date >= c.start && date <= c.end) out.add(id);
  for (const [id, type] of g.exceptions.get(date) ?? []) {
    if (type === 1) out.add(id);
    else out.delete(id);
  }
  return out;
}

const clock = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Skopje",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** The Skopje date (YYYY-MM-DD) and seconds into that day at an instant. The server clock is UTC: never use local getters. */
export function skopjeClock(now: number): { date: string; sec: number } {
  const p = Object.fromEntries(clock.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, sec: (Number(p.hour) * 60 + Number(p.minute)) * 60 + Number(p.second) };
}

const prevDate = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) - DAY * 1000).toISOString().slice(0, 10);

// ---- per-day departures ----
const natural = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

/**
 * Departures per stop for one Skopje date, sorted by time in seconds since that midnight: today's services, plus the
 * part of yesterday's services that runs past 24:00. A trip's last stop is left out (the bus only arrives there).
 * Built once per date and kept on the feed.
 */
function dayIndex(g: Gtfs, date: string): Day {
  if (g.day?.date === date) return g.day;
  const today = activeServices(g, date);
  const yesterday = activeServices(g, prevDate(date));
  const byStop = new Map<string, Dep[]>();
  const lineSets = new Map<string, Set<string>>();
  let hasToday = false;
  const add = (stop: string, sec: number, trip: GtfsTrip) => {
    const list = byStop.get(stop);
    if (list) list.push({ sec, trip });
    else byStop.set(stop, [{ sec, trip }]);
  };
  for (const trip of g.trips.values()) {
    const isToday = today.has(trip.service);
    const wasYesterday = yesterday.has(trip.service);
    hasToday ||= isToday;
    for (let i = 0; i < trip.stops.length - 1 && (isToday || wasYesterday); i++) {
      if (isToday) {
        add(trip.stops[i], trip.dep[i], trip);
        const set = lineSets.get(trip.stops[i]);
        if (set) set.add(trip.route);
        else lineSets.set(trip.stops[i], new Set([trip.route]));
      }
      if (wasYesterday && trip.dep[i] >= DAY) add(trip.stops[i], trip.dep[i] - DAY, trip);
    }
  }
  for (const list of byStop.values()) list.sort((a, b) => a.sec - b.sec);
  const lines = new Map([...lineSets].map(([stop, set]) => [stop, [...set].sort(natural)]));
  return (g.day = { date, byStop, lines, hasToday });
}

/** Route short names with a departure from each stop on today's (Skopje) date, once each, in natural order ("2", "2А", "15"). */
export function stopLines(g: Gtfs, now: number): Map<string, string[]> {
  return dayIndex(g, skopjeClock(now).date).lines;
}

export type Departure = { tripId: string; route: string; headsign: string; at: string; inMin: number };

const hhmm = (sec: number) => `${String(Math.floor(sec / 3600) % 24).padStart(2, "0")}:${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}`;

/**
 * The next `limit` departures from a stop today in Skopje, soonest first. `at` is wall-clock "HH:MM" (a 24:10 departure
 * reads "00:10"); `inMin` counts whole minutes, so a departure in the current minute is 0 and still listed.
 */
export function departures(g: Gtfs, stopId: string, now: number, limit = 8): Departure[] {
  const { date, sec } = skopjeClock(now);
  const nowMin = Math.floor(sec / 60);
  const out: Departure[] = [];
  for (const d of dayIndex(g, date).byStop.get(stopId) ?? []) {
    const min = Math.floor(d.sec / 60);
    if (min < nowMin) continue;
    out.push({ tripId: d.trip.id, route: d.trip.route, headsign: d.trip.headsign, at: hhmm(d.sec), inMin: min - nowMin });
    if (out.length >= limit) break;
  }
  return out;
}

// ---- download and cache ----
let cur: { g: Gtfs; at: number; tried: number } | undefined;
let inflight: Promise<Gtfs> | undefined;

/** Forgets the cached feed (tests). */
export function resetGtfs(): void {
  cur = undefined;
  inflight = undefined;
}

async function download(now: number): Promise<Gtfs> {
  if (cur) cur.tried = now; // other callers keep the old index while this one downloads, and a failure is not retried for 5 min
  try {
    // Deliberately not tied to getLayer's 8 s signal: a cold download may take longer, and finishing it fills the cache for the next request.
    const res = await fetch(GTFS_URL, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`gtfs.zip: HTTP ${res.status}`);
    const g = unzipGtfs(new Uint8Array(await res.arrayBuffer()));
    cur = { g, at: now, tried: now };
    return g;
  } catch (err) {
    if (!cur) throw err;
    console.warn(`[gtfs] refresh failed, serving the feed from ${new Date(cur.at).toISOString()}: ${err instanceof Error ? err.message : String(err)}`);
    return cur.g;
  }
}

/**
 * The parsed feed, downloaded at most every 6 h per server instance. Refreshed early (but not within 5 min of the last
 * attempt) when the cached feed has no trips for today's Skopje date: the producer regenerates it daily, so after
 * midnight the old one only covers yesterday. A failed refresh keeps serving the old feed; with nothing cached it throws.
 */
export function loadGtfs(now: number = Date.now()): Promise<Gtfs> {
  if (cur) {
    const outdated = now - cur.at >= TTL_MS || !dayIndex(cur.g, skopjeClock(now).date).hasToday;
    if (!outdated || now - cur.tried < RETRY_MS) return Promise.resolve(cur.g);
  }
  return (inflight ??= download(now).finally(() => (inflight = undefined)));
}
