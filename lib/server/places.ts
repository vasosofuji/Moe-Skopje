import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import settlements from "@/data/static/settlements.json";
import { distanceM, inBox } from "@/lib/routing";
import { fold, normalizeName } from "@/lib/sources/geo";
import { bboxOf } from "@/lib/sources/geom";
import { municipalities } from "@/lib/sources/static";
import { streetKey, type StreetCollection } from "@/lib/sources/streets";
import { geocode, resetGeocodeGate, reverseGeocode, type Deps, type Lang } from "./geocode";

export type PlaceKind = "poi" | "address" | "street" | "area";
export type Place = {
  /** Stable per place: "osm:N123" (an OSM node, way "W" or relation "R") from the geocoder, "local:7" from the baked index. */
  id: string;
  name: string;
  /** English name, from the baked index only (a geocoder answers in the language asked for). */
  nameEn?: string;
  kind: PlaceKind;
  /** OSM value of a poi, e.g. "supermarket", "hospital", "mall". */
  category?: string;
  /** "street housenumber, district" (as much of it as is known). */
  address?: string;
  /** The district (geocoder) or municipality (baked index) the place lies in. */
  area?: string;
  lng: number;
  lat: number;
};

export const MAX_PLACES = 8;
export const PlacesQuery = z.object({
  q: z.string().trim().min(2).max(80),
  lang: z.enum(["mk", "en"]).default("mk"),
  /** "lng,lat" of the map centre or the user: biases the geocoder towards it. */
  near: z
    .string()
    .transform((v) => v.split(",").map(Number))
    .pipe(z.tuple([z.number(), z.number()]).refine((p) => inBox(p), "bbox"))
    .optional(),
});
export const ReverseQuery = z.object({ lng: z.coerce.number(), lat: z.coerce.number() }).refine((p) => inBox([p.lng, p.lat]), "bbox");

type Entry = Omit<Place, "id"> & { keys: string[]; order: number };
type Indexed = Entry & { id: string };

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const keyOf = (name: string, street: boolean) => fold(street ? streetKey(name) : normalizeName(name));
const lengthOf = (line: number[][]) => line.slice(1).reduce((sum, p, i) => sum + distanceM(line[i], p), 0);

/** The point halfway along a line, by length. */
function midpoint(line: number[][]): [number, number] {
  let left = lengthOf(line) / 2;
  for (let i = 1; i < line.length; i++) {
    const seg = distanceM(line[i - 1], line[i]);
    if (seg >= left && seg > 0) {
      const f = left / seg;
      return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * f, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * f];
    }
    left -= seg;
  }
  return [line[0][0], line[0][1]];
}

let index: Promise<Indexed[]> | undefined;

async function build(): Promise<Indexed[]> {
  const streets = JSON.parse(readFileSync(join(process.cwd(), "data", "static", "streets.geojson"), "utf8")) as StreetCollection;
  const entries: Entry[] = [];
  const sums = new Map<string, { lng: number; lat: number; n: number }>();
  for (const { geometry, properties: p } of streets.features) {
    const longest = geometry.coordinates.reduce((a, b) => (lengthOf(b) > lengthOf(a) ? b : a));
    const [lng, lat] = midpoint(longest);
    const sum = sums.get(p.municipality_mk) ?? { lng: 0, lat: 0, n: 0 };
    sums.set(p.municipality_mk, { lng: sum.lng + lng, lat: sum.lat + lat, n: sum.n + 1 });
    entries.push({
      name: p.name_mk,
      nameEn: p.name_en,
      kind: "street",
      address: p.municipality_mk,
      area: p.municipality_mk,
      lng: round5(lng),
      lat: round5(lat),
      keys: [keyOf(p.name_mk, true), ...(p.name_en ? [keyOf(p.name_en, true)] : [])],
      order: 2,
    });
  }
  // A municipality sits at the mean of its streets' midpoints (a street is always near a road, which the router snaps to);
  // with no streets, at the centre of its box.
  const centre = new Map<string, [number, number]>();
  for (const f of (await municipalities()).features) {
    const s = sums.get(f.properties.name_mk);
    const [w, south, e, n] = bboxOf(f.geometry);
    const at: [number, number] = s ? [s.lng / s.n, s.lat / s.n] : [(w + e) / 2, (south + n) / 2];
    centre.set(f.properties.name_mk, at);
    entries.push({
      name: f.properties.name_mk,
      nameEn: f.properties.name_en,
      kind: "area",
      lng: round5(at[0]),
      lat: round5(at[1]),
      keys: [keyOf(f.properties.name_mk, false), keyOf(f.properties.name_en, false)],
      order: 0,
    });
  }
  // ponytail: data/static/settlements.json has no coordinates, so a settlement resolves to the centre of its municipality.
  // Bake lat/lng into it (scripts/bake-osm.ts) when a settlement must land exactly.
  for (const s of settlements as { name_mk: string; name_en?: string; municipality_mk: string }[]) {
    const at = centre.get(s.municipality_mk);
    if (!at) continue;
    entries.push({
      name: s.name_mk,
      nameEn: s.name_en,
      kind: "area",
      address: s.municipality_mk,
      area: s.municipality_mk,
      lng: round5(at[0]),
      lat: round5(at[1]),
      keys: [keyOf(s.name_mk, false), ...(s.name_en ? [keyOf(s.name_en, false)] : [])],
      order: 1,
    });
  }
  // ids follow the baked order: stable until the data is re-baked, so a client must not store one
  return entries.map((e, i) => ({ ...e, id: `local:${i}` }));
}

/** 0 = the whole name, 1 = starts with it, 2 = a later word starts with it, 3 = contains it, -1 = no match. */
function score(keys: string[], q: string): number {
  let best = -1;
  for (const k of keys) {
    const s = k === q ? 0 : k.startsWith(q) ? 1 : k.includes(` ${q}`) ? 2 : k.includes(q) ? 3 : -1;
    if (s >= 0 && (best < 0 || s < best)) best = s;
  }
  return best;
}

type Hit = { place: Place; s: number };

/** Baked streets, settlements and municipalities whose name matches `q` in Latin or Cyrillic, best first (`s` is the match score), at most 8. */
async function localHits(q: string): Promise<Hit[]> {
  const key = fold(streetKey(q)) || fold(q.toLowerCase().trim());
  if (!key) return [];
  index ??= build().catch((err) => {
    index = undefined; // don't cache a failure
    throw err;
  });
  const hits = (await index).flatMap((e) => {
    const s = score(e.keys, key);
    return s < 0 ? [] : [{ e, s }];
  });
  hits.sort((a, b) => a.s - b.s || a.e.order - b.e.order || a.e.name.length - b.e.name.length || a.e.name.localeCompare(b.e.name));
  return hits.slice(0, MAX_PLACES).map(({ e, s }) => ({
    place: { id: e.id, name: e.name, nameEn: e.nameEn, kind: e.kind, address: e.address, area: e.area, lng: e.lng, lat: e.lat },
    s,
  }));
}

/** The baked index alone (no geocoder): streets, settlements and municipalities, best first, at most 8. */
export async function searchLocal(q: string): Promise<Place[]> {
  return (await localHits(q)).map((h) => h.place);
}

// --- Merging -------------------------------------------------------------------------------------------------------------------

const DUPLICATE_M = 80;
// A stop or a car park is a real place but a poor answer to a name search: it shows after the others unless it matches exactly.
const NOISE = new Set(["bus_stop", "platform", "parking", "bicycle_parking", "parking_space", "parking_entrance"]);
/** Lowercase Cyrillic with the Latin transliterated and the letters folded (so "Ramstor" meets "Рамстор"), numbers kept at the end. */
const nameKey = (s: string) => `${fold(normalizeName(s))} ${(s.match(/\d+/g) ?? []).join(" ")}`.trim();

type Cand = { p: Place; k: string; r: number; src: 0 | 1; i: number };

/**
 * One list from both sources. A place the geocoder and the index both know (same name, under 80 m apart) is one place: the
 * geocoder's, with the index's English name. Order: exact name, then prefix, then the rest of the geocoder's list (its own
 * relevance order), then the rest of the index's; bus stops and car parks last.
 */
function merge(q: string, geo: Place[], local: Hit[]): Place[] {
  const qk = nameKey(q);
  const cands: Cand[] = [
    ...geo.map((p, i): Cand => {
      const k = nameKey(p.name);
      return { p, k, r: k === qk ? 0 : k.startsWith(qk) ? 1 : 2, src: 0, i };
    }),
    ...local.map(({ place, s }, i): Cand => ({ p: place, k: nameKey(place.name), r: Math.min(s, 2), src: 1, i })),
  ];
  const kept: Cand[] = [];
  for (const c of cands) {
    const twin = kept.find((o) => o.k === c.k && distanceM([o.p.lng, o.p.lat], [c.p.lng, c.p.lat]) < DUPLICATE_M);
    if (!twin) {
      kept.push(c);
      continue;
    }
    twin.r = Math.min(twin.r, c.r);
    twin.p.nameEn ??= c.p.nameEn;
  }
  const last = (c: Cand) => (c.r > 0 && c.p.category && NOISE.has(c.p.category) ? 1 : 0);
  return kept
    .sort((a, b) => last(a) - last(b) || a.r - b.r || a.src - b.src || a.i - b.i)
    .slice(0, MAX_PLACES)
    .map((c) => c.p);
}

/**
 * Real places (shops, cafes, schools, hospitals, malls, monuments, addresses with house numbers, streets, neighbourhoods)
 * from the geocoder, merged with the baked index. `live` is false when no geocoder answered and only the index did.
 */
export async function searchPlaces(
  q: string,
  opts: { lang?: Lang; near?: [number, number] } = {},
  deps: Deps = {},
): Promise<{ places: Place[]; live: boolean }> {
  const [local, geo] = await Promise.all([
    localHits(q),
    geocode(q, { lang: opts.lang ?? "mk", near: opts.near }, deps).then(
      (places) => ({ places, live: true }),
      (err) => {
        console.warn(`[places] no geocoder answered: ${err instanceof Error ? err.message : String(err)}`);
        return { places: [] as Place[], live: false };
      },
    ),
  ]);
  return { places: merge(q, geo.places, local), live: geo.live };
}

// --- Cache and limits ----------------------------------------------------------------------------------------------------------
// OSM's geocoders are volunteer-run (see geocode.ts): answer repeats from memory, and cap what one client, and all clients,
// can ask of us. A refused request is not recorded.
// ponytail: the cache, the counters and the Nominatim gate are in memory and per warm server instance, so with N instances the
// ceilings are N times higher (and so is the upstream rate), and a cold start forgets everything. Move them to a shared store
// (Supabase) before running more than one instance, or host our own Photon. The s-maxage below lets the CDN absorb repeats meanwhile.
export const PLACES_PER_IP = 60;
export const PLACES_PER_MINUTE = 300;
const CACHE_MAX = 500;
const CACHE_TTL_MS = 10 * 60_000;

/** A Map is insertion-ordered: re-inserting on every read keeps the least recently used entry first. */
function lru<T>() {
  const m = new Map<string, { v: T; at: number }>();
  return {
    get(k: string, now: number): T | undefined {
      const e = m.get(k);
      if (!e) return undefined;
      m.delete(k);
      if (now - e.at >= CACHE_TTL_MS) return undefined;
      m.set(k, e);
      return e.v;
    },
    set(k: string, v: T, now: number) {
      m.delete(k);
      m.set(k, { v, at: now });
      if (m.size > CACHE_MAX) m.delete(m.keys().next().value as string);
    },
    clear: () => m.clear(),
  };
}
const searches = lru<Place[]>();
const reverses = lru<{ name: string; address?: string } | null>();

const byIp = new Map<string, number[]>();
let all: number[] = [];
const within = (times: number[] | undefined, now: number) => (times ?? []).filter((t) => now - t < 60_000);
const ipOf = (req: Request) => req.headers.get("x-real-ip")?.trim() || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

/** Records one request and says whether it is allowed: 60 per IP a minute, 300 a minute across the instance. */
export function allowPlaces(ip: string, now = Date.now()): boolean {
  const mine = within(byIp.get(ip), now);
  all = within(all, now);
  if (mine.length >= PLACES_PER_IP || all.length >= PLACES_PER_MINUTE) return false;
  byIp.set(ip, [...mine, now]);
  all.push(now);
  if (byIp.size > 1000) for (const [k, v] of byIp) if (!within(v, now).length) byIp.delete(k); // forget IPs that went quiet
  return true;
}

/** Test hook: forget the caches, the counters and the geocoder gate. */
export function resetPlacesState() {
  searches.clear();
  reverses.clear();
  byIp.clear();
  all = [];
  resetGeocodeGate();
}

// --- Handlers ------------------------------------------------------------------------------------------------------------------

const fail = (status: number, code: string) => Response.json({ code }, { status });
const CACHEABLE = { "Cache-Control": "public, s-maxage=300" };
const round = (n: number, decimals: number) => Math.round(n * 10 ** decimals) / 10 ** decimals;

/**
 * GET /api/places?q=&lang=mk|en&near=lng,lat → up to 8 `{ id, name, nameEn?, kind, category?, address?, area?, lng, lat }`.
 * `q` is 2 to 80 characters; `near` (optional) is inside the Skopje box. Answers 400 { code: "input" }, 429 { code: "rate" };
 * with no geocoder reachable it still answers 200 from the baked index (and is not cached).
 */
export async function handlePlaces(req: Request, deps: Deps = {}): Promise<Response> {
  const sp = new URL(req.url).searchParams;
  const parsed = PlacesQuery.safeParse({ q: sp.get("q") ?? "", lang: sp.get("lang") || undefined, near: sp.get("near") || undefined });
  if (!parsed.success) return fail(400, "input");
  const now = (deps.now ?? Date.now)();
  if (!allowPlaces(ipOf(req), now)) return fail(429, "rate");

  const { q, lang } = parsed.data;
  // ~1 km: the most a cache entry (and the Photon call behind it) can tell apart
  const near = parsed.data.near && ([round(parsed.data.near[0], 2), round(parsed.data.near[1], 2)] as [number, number]);
  const key = [q.normalize("NFC").toLowerCase().replace(/\s+/g, " "), lang, near?.join(",") ?? ""].join("|");
  const hit = searches.get(key, now);
  if (hit) return Response.json(hit, { headers: CACHEABLE });

  const { places, live } = await searchPlaces(q, { lang, near }, deps);
  if (!live) return Response.json(places, { headers: { "Cache-Control": "no-store" } });
  searches.set(key, places, now);
  return Response.json(places, { headers: CACHEABLE });
}

/**
 * GET /api/places/reverse?lng=&lat= → `{ name, address? }` of the nearest house, shop or street within 300 m ("set on map").
 * Answers 400 { code: "input" } (a point outside the Skopje box included), 404 { code: "none" }, 429 { code: "rate" },
 * 502 { code: "geocoder" }.
 */
export async function handleReverse(req: Request, deps: Deps = {}): Promise<Response> {
  const sp = new URL(req.url).searchParams;
  const parsed = ReverseQuery.safeParse({ lng: sp.get("lng") ?? undefined, lat: sp.get("lat") ?? undefined });
  if (!parsed.success) return fail(400, "input");
  const now = (deps.now ?? Date.now)();
  if (!allowPlaces(ipOf(req), now)) return fail(429, "rate");

  const lng = round(parsed.data.lng, 4); // ~10 m
  const lat = round(parsed.data.lat, 4);
  const key = `${lng},${lat}`;
  let found = reverses.get(key, now);
  if (found === undefined) {
    try {
      const p = await reverseGeocode(lng, lat, deps);
      found = p && { name: p.name, ...(p.address ? { address: p.address } : {}) };
    } catch (err) {
      console.warn(`[places] reverse failed: ${err instanceof Error ? err.message : String(err)}`);
      return fail(502, "geocoder");
    }
    reverses.set(key, found, now);
  }
  return found ? Response.json(found, { headers: CACHEABLE }) : fail(404, "none");
}

