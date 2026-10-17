import "server-only";
import { z } from "zod";
import { SKOPJE_BBOX } from "@/lib/routing";
import type { Place } from "./places";

// Real places (shops, cafes, hospitals, addresses) come from OpenStreetMap through a geocoder, never from our baked data.
// Primary: Photon (komoot's public instance; PHOTON_URL points at another one, e.g. our own). Fallback, only when Photon fails
// or takes over 3 s: Nominatim on openstreetmap.org, whose usage policy allows 1 request per second, an identifying
// User-Agent and no bulk use, so its calls go through a gate. Both are cached and rate limited by the caller (places.ts).
// note: the gate is in memory, per warm server instance, so N instances can send N calls a second to Nominatim. Move it to a
// shared store (Supabase) before running more than one instance, or host our own Photon.

export type Lang = "mk" | "en";
export type Deps = {
  fetch?: typeof fetch;
  now?: () => number;
  gapMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const LIMIT = 8;
const PHOTON_TIMEOUT_MS = 3000;
const NOMINATIM_TIMEOUT_MS = 4000;
const GAP_MS = 1100; // Nominatim calls start at least this far apart
const MAX_QUEUE = 4; // calls waiting for their turn; one more is refused rather than left to time out
const REVERSE_RADIUS_KM = 0.3;

const [W, S, E, N] = SKOPJE_BBOX;
const photonBase = () => (process.env.PHOTON_URL || "https://photon.komoot.io").replace(/\/+$/, "");
const userAgent = () => `MoeSkopje/1.0 (Skopje city-data app, place search${process.env.ROUTER_CONTACT ? `; ${process.env.ROUTER_CONTACT}` : ""})`;

// --- The gate ------------------------------------------------------------------------------------------------------------------

let gate: Promise<unknown> = Promise.resolve();
let lastCall = -Infinity;
let queued = 0;

/** Test hook: forget the gate. */
export function resetGeocodeGate() {
  gate = Promise.resolve();
  lastCall = -Infinity;
  queued = 0;
}

/** Runs `call` once its turn comes: strictly one at a time, `gapMs` after the previous one began. */
function spaced<T>(call: () => Promise<T>, deps: Deps): Promise<T> {
  if (queued >= MAX_QUEUE) return Promise.reject(new Error("nominatim: queue full"));
  queued++;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const turn = gate.then(async () => {
    const wait = lastCall + (deps.gapMs ?? GAP_MS) - now();
    if (wait > 0) await sleep(wait);
    lastCall = now();
    queued--;
  });
  gate = turn.catch(() => {});
  return turn.then(call);
}

// --- Fetching ------------------------------------------------------------------------------------------------------------------

async function getJson(url: URL, timeoutMs: number, deps: Deps): Promise<unknown> {
  const referer = process.env.NEXT_PUBLIC_SITE_URL;
  const res = await (deps.fetch ?? fetch)(url, {
    headers: { "User-Agent": userAgent(), Accept: "application/json", ...(referer ? { Referer: referer } : {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${url.host} HTTP ${res.status}`);
  return res.json(); // an HTML error page throws here
}

const withParams = (base: string, params: Record<string, string>) => {
  const u = new URL(base);
  u.search = new URLSearchParams(params).toString();
  return u;
};

// --- Mapping -------------------------------------------------------------------------------------------------------------------

const s = z.string().optional();
const PhotonFeature = z.object({
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
  properties: z.object({
    osm_type: s, osm_id: z.number().optional(), osm_value: s, type: s, name: s, housenumber: s, street: s, district: s, locality: s, city: s,
  }),
});
const NominatimRow = z.object({
  osm_type: z.string(), osm_id: z.number(), lat: z.string(), lon: z.string(), category: s, type: s, addresstype: s, name: s, display_name: z.string(),
  address: z.record(z.string(), z.string()).optional(),
});

/** The pieces every geocoder row is built from. `sub` is the first of the district-like names that is not the place's own name. */
function place(id: string, lng: number, lat: number, kind: Place["kind"], name: string, category: string | undefined, line: string | undefined, subs: (string | undefined)[]): Place {
  const sub = subs.find((x) => x && x !== name);
  const address = [line, sub].filter(Boolean).join(", ");
  return { id, name, kind, ...(kind === "poi" && category ? { category } : {}), ...(address ? { address } : {}), ...(sub ? { area: sub } : {}), lng, lat };
}

const AREA_TYPES = new Set(["city", "district", "locality", "county", "state", "country"]); // Photon's `type`; a shop or a house is "house"

/** One Photon feature as a Place, or null when it has no usable name or point. */
export function mapPhoton(raw: unknown): Place | null {
  const f = PhotonFeature.safeParse(raw);
  if (!f.success) return null;
  const [lng, lat] = f.data.geometry.coordinates;
  const p = f.data.properties;
  const line = p.street && p.housenumber ? `${p.street} ${p.housenumber}` : undefined;
  const kind = p.type === "street" ? "street" : AREA_TYPES.has(p.type ?? "") ? "area" : p.name ? "poi" : "address";
  const name = p.name || line;
  if (!name) return null;
  const id = p.osm_type && p.osm_id ? `osm:${p.osm_type}${p.osm_id}` : `photon:${lng},${lat}`;
  // A street's or a district's own name is not an address line; a poi's is the street it stands on.
  return place(id, lng, lat, kind, name, p.osm_value, kind === "poi" || kind === "address" ? (line ?? p.street) : undefined, [p.district, p.locality, p.city]);
}

/** One Nominatim jsonv2 row (with addressdetails) as a Place, or null when it has no usable name or point. */
export function mapNominatim(raw: unknown): Place | null {
  const r = NominatimRow.safeParse(raw);
  if (!r.success) return null;
  const lng = Number(r.data.lon);
  const lat = Number(r.data.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const a = r.data.address ?? {};
  const line = a.road && a.house_number ? `${a.road} ${a.house_number}` : undefined;
  const area = (r.data.category === "place" || r.data.category === "boundary") && r.data.type !== "house";
  const kind = r.data.addresstype === "road" ? "street" : area ? "area" : r.data.name ? "poi" : "address";
  const name = r.data.name || line || r.data.display_name.split(",")[0].trim();
  const id = `osm:${r.data.osm_type[0].toUpperCase()}${r.data.osm_id}`;
  return place(id, lng, lat, kind, name, r.data.type, kind === "poi" || kind === "address" ? (line ?? a.road) : undefined, [a.suburb, a.neighbourhood, a.city_district, a.city, a.town, a.village]);
}

// --- Search and reverse ----------------------------------------------------------------------------------------------------------

const Features = z.object({ features: z.array(z.unknown()) });
const flat = (rows: unknown[], map: (r: unknown) => Place | null) => rows.flatMap((r) => map(r) ?? []);

/** Up to 8 places inside the Skopje box matching `q`. Photon first; Nominatim when Photon fails. Throws when both do. */
export async function geocode(q: string, opts: { lang: Lang; near?: [number, number] }, deps: Deps = {}): Promise<Place[]> {
  const photon = withParams(`${photonBase()}/api/`, {
    q,
    bbox: SKOPJE_BBOX.join(","),
    limit: String(LIMIT),
    ...(opts.lang === "en" ? { lang: "en" } : {}), // Photon has no Macedonian: the default is the local name
    ...(opts.near ? { lat: String(opts.near[1]), lon: String(opts.near[0]) } : {}),
  });
  try {
    return flat(Features.parse(await getJson(photon, PHOTON_TIMEOUT_MS, deps)).features, mapPhoton);
  } catch (err) {
    console.warn(`[places] photon failed, trying nominatim: ${err instanceof Error ? err.message : String(err)}`);
  }
  const nominatim = withParams("https://nominatim.openstreetmap.org/search", {
    format: "jsonv2",
    q,
    viewbox: `${W},${N},${E},${S}`, // left, top, right, bottom
    bounded: "1",
    limit: String(LIMIT),
    "accept-language": opts.lang,
    addressdetails: "1",
  });
  const rows = await spaced(() => getJson(nominatim, NOMINATIM_TIMEOUT_MS, deps), deps);
  return flat(z.array(z.unknown()).parse(rows), mapNominatim);
}

/** The nearest house, shop or street within 300 m of the point, or null. Photon only; throws when it fails. */
export async function reverseGeocode(lng: number, lat: number, deps: Deps = {}): Promise<Place | null> {
  const u = withParams(`${photonBase()}/reverse`, { lon: String(lng), lat: String(lat), limit: "1", radius: String(REVERSE_RADIUS_KM) });
  u.searchParams.append("layer", "house"); // not the city or the municipality, whatever is closest
  u.searchParams.append("layer", "street");
  return flat(Features.parse(await getJson(u, PHOTON_TIMEOUT_MS, deps)).features, mapPhoton)[0] ?? null;
}
