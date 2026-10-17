// One-off Overpass export → data/static/*.geojson (runtime data, committed). Run: npm run bake:osm [dataset ...]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import osmtogeojson from "osmtogeojson";
import { normalizeName } from "../lib/sources/geo";
import { municipalityAt, toLatin, type MunicipalityCollection } from "../lib/sources/static";
import { mergeStreets, type Way } from "../lib/sources/streets";

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const BBOX = "41.90,21.25,42.10,21.60"; // S,W,N,E, Overpass order
const OUT_DIR = join(process.cwd(), "data", "static");
const DEFAULT_MINUTES = 15; // each dataset is time-boxed
const MUNI = "^(Општина )?(Центар|Карпош|Аеродром|Кисела Вода|Гази Баба|Чаир|Бутел|Шуто Оризари|Ѓорче Петров|Сарај)$";
const MUNI_NAMES = 10;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const q = (body: string, out: string) => `[out:json][timeout:60];(${body});${out}`;
const muni = (key: string) => `rel["boundary"="administrative"]["admin_level"~"^[78]$"]["${key}"~"${MUNI}"](${BBOX});`;

type Props = Record<string, string | undefined>;
type Dataset = {
  file: string;
  query: string;
  /** Keeps the wanted features and reduces their properties. */
  pick: (f: GeoJSON.Feature<GeoJSON.Geometry, Props>) => GeoJSON.Feature | null;
  /** Overpass time-box in minutes (default 15). */
  minutes?: number;
  /** Turns raw Overpass elements into features itself, for datasets too big to run through osmtogeojson. */
  raw?: (elements: unknown[]) => GeoJSON.Feature<GeoJSON.Geometry, Props>[];
  /** Serialises the picked features when the file is not a FeatureCollection. */
  format?: (features: GeoJSON.Feature[]) => Promise<{ body: string; count: number }>;
};

/** Overpass tags with `:` → `_`, only the listed keys. */
const tags = (p: Props, keys: string[]) => {
  const out: Record<string, string> = {};
  for (const k of keys) if (p[k]) out[k.replace(/:/g, "_")] = p[k];
  return out;
};
const base = (f: GeoJSON.Feature<GeoJSON.Geometry, Props>, geometry: GeoJSON.Geometry, keys: string[]): GeoJSON.Feature => ({
  type: "Feature",
  geometry,
  properties: { osm_id: String(f.id), ...tags(f.properties, ["name", "name:en", ...keys]) },
});

const round5 = (c: unknown): unknown => (Array.isArray(c) ? c.map(round5) : typeof c === "number" ? Math.round(c * 1e5) / 1e5 : c);
const rounded = (g: GeoJSON.Geometry) => ({ ...g, coordinates: round5((g as GeoJSON.Point).coordinates) }) as GeoJSON.Geometry;

/** `out center` ways/relations arrive as point features at their centre; keep points only. */
const point = (keys: string[]): Dataset["pick"] => (f) =>
  f.geometry.type === "Point" ? base(f, rounded(f.geometry), keys) : null;

// "13 Ноември" and "11 Октомври" are neighbourhoods, but in outage text they read as dates, and matching drops digits.
const DATE_LIKE = /^\d+\s+(јануари|февруари|март|април|мај|јуни|јули|август|септември|октомври|ноември|декември)(\s|$)/i;
const jsonLines = (items: unknown[]) => items.map((x) => JSON.stringify(x)).join(",\n");

/**
 * Settlement gazetteer (spec §5.3): named place nodes → { name_mk, name_en?, municipality_mk }, municipality by
 * point-in-polygon against the baked municipalities.geojson. Nodes outside all 10 are dropped, and so is a name that
 * is in two municipalities, is a municipality's own name (matchMunicipality finds those without help) or looks like a date.
 */
async function settlementRows(features: GeoJSON.Feature[]): Promise<{ body: string; count: number }> {
  const munis = JSON.parse(await readFile(join(OUT_DIR, "municipalities.geojson"), "utf8")) as MunicipalityCollection;
  const own = new Set(munis.features.map((m) => normalizeName(m.properties.name_mk)));
  const byName = new Map<string, { name_mk: string; name_en?: string; municipality_mk: string }[]>();
  for (const f of features) {
    if (f.geometry.type !== "Point") continue;
    const p = f.properties as Record<string, string | undefined>;
    const name_mk = p.name_mk ?? p.name;
    if (!name_mk) continue;
    const municipality_mk = municipalityAt(munis, f.geometry.coordinates[0], f.geometry.coordinates[1]);
    if (!municipality_mk) continue;
    const key = normalizeName(name_mk);
    if (!key || own.has(key) || DATE_LIKE.test(name_mk.trim())) continue;
    byName.set(key, [...(byName.get(key) ?? []), { name_mk, ...(p.name_en ? { name_en: p.name_en } : {}), municipality_mk }]);
  }
  const rows = [...byName.values()]
    .filter((hits) => hits.every((h) => h.municipality_mk === hits[0].municipality_mk))
    .map((hits) => hits[0])
    .sort((a, b) => a.municipality_mk.localeCompare(b.municipality_mk, "mk") || a.name_mk.localeCompare(b.name_mk, "mk"));
  return { body: `[\n${jsonLines(rows)}\n]\n`, count: rows.length };
}

// Roads people can name in an outage notice. Footpaths, steps, tracks and the like are left out to keep the file small.
const NOT_ROADS = "^(footway|path|steps|cycleway|bridleway|track|corridor|elevator|platform|proposed|construction|raceway)$";
// Wider than BBOX: Сарај reaches west to 21.15, Бутел north to 42.16 and Гази Баба east to 21.59, outside the Skopje view box.
const STREET_BBOX = "41.89,21.14,42.16,21.60";
const street = (key: string) => `way["highway"]["highway"!~"${NOT_ROADS}"]["${key}"](${STREET_BBOX});`;

type OverpassWay = { type?: string; id?: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] };

/** `out geom` ways → LineString features carrying only the names. */
function streetWays(elements: unknown[]): GeoJSON.Feature<GeoJSON.Geometry, Props>[] {
  return (elements as OverpassWay[]).flatMap((w) => {
    const name = w.tags?.["name:mk"] ?? w.tags?.name ?? w.tags?.["name:en"];
    if (w.type !== "way" || !name || !w.geometry || w.geometry.length < 2) return [];
    return [
      {
        type: "Feature" as const,
        geometry: { type: "LineString" as const, coordinates: w.geometry.map((p) => [p.lon, p.lat]) },
        properties: { name_mk: name, ...(w.tags?.["name:en"] ? { name_en: w.tags["name:en"] } : {}) } as Props,
      },
    ];
  });
}

/** Street index: ways merged per street and municipality, simplified (lib/sources/streets.ts mergeStreets). */
async function streetRows(features: GeoJSON.Feature[]): Promise<{ body: string; count: number }> {
  const munis = JSON.parse(await readFile(join(OUT_DIR, "municipalities.geojson"), "utf8")) as MunicipalityCollection;
  const ways: Way[] = features.map((f) => {
    const p = f.properties as { name_mk: string; name_en?: string };
    return { name_mk: p.name_mk, name_en: p.name_en, coords: (f.geometry as GeoJSON.LineString).coordinates };
  });
  const streets = mergeStreets(ways, munis);
  console.log(`  ${ways.length} named ways → ${streets.length} streets in ${new Set(streets.map((s) => s.properties.municipality_mk)).size} municipalities`);
  return { body: `{"type":"FeatureCollection","features":[
${jsonLines(streets)}
]}
`, count: streets.length };
}

const DATASETS: Record<string, Dataset> = {
  municipalities: {
    file: "municipalities.geojson",
    query: q(muni("name") + muni("name:mk"), "out geom;"),
    pick: (f) => {
      if (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon") return null;
      const p = f.properties;
      const name_mk = (p["name:mk"] ?? p.name ?? "").replace(/^Општина /, "");
      return {
        type: "Feature",
        geometry: rounded(f.geometry),
        // OSM name:en is "Municipality of Karposh"; the app wants the bare name
        properties: { name_mk, name_en: p["name:en"]?.replace(/^Municipality of /, "") ?? toLatin(name_mk) },
      };
    },
  },
  "bus-stops": {
    file: "bus-stops.geojson",
    query: q(`node["highway"="bus_stop"](${BBOX});`, "out;"),
    pick: point(["ref", "route_ref", "operator", "network", "shelter", "bench"]),
  },
  "bus-routes": {
    file: "bus-routes.geojson",
    query: q(`rel["route"="bus"](${BBOX});`, "out geom;"),
    pick: (f) =>
      // lines only: osmtogeojson also emits the route's stop/platform nodes and member ways
      String(f.id).startsWith("relation/") && (f.geometry.type === "LineString" || f.geometry.type === "MultiLineString")
        ? base(f, rounded(f.geometry), ["ref", "from", "to", "operator", "network"])
        : null,
  },
  pharmacies: {
    file: "pharmacies.geojson",
    query: q(`nwr["amenity"="pharmacy"](${BBOX});`, "out center;"),
    pick: point(["opening_hours", "phone", "operator", "website", "addr:street", "addr:housenumber"]),
  },
  settlements: {
    file: "settlements.json",
    query: q(`node["place"~"^(suburb|neighbourhood|quarter|village|hamlet)$"](${BBOX});`, "out;"),
    pick: point(["name:mk"]),
    format: settlementRows,
  },
  streets: {
    file: "streets.geojson",
    minutes: 10,
    // out geom: ways carry their coordinates, so no node lookups; name:mk / name:en only matter when `name` is missing
    query: q(street("name") + street("name:mk") + street("name:en"), "out geom;"),
    raw: streetWays,
    pick: (f) => f,
    format: streetRows,
  },
  schools: {
    file: "schools.geojson",
    query: q(`nwr["amenity"~"^(school|kindergarten)$"](${BBOX});`, "out center;"),
    pick: point(["amenity", "operator", "addr:street", "addr:housenumber"]),
  },
};

/** POSTs to the first endpoint that answers 200 with a usable body; retries all endpoints with backoff until the deadline. */
async function overpass(query: string, minutes: number): Promise<{ elements: unknown[] }> {
  const deadline = Date.now() + minutes * 60_000;
  const errors: string[] = [];
  for (let round = 0; Date.now() < deadline; round++) {
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          body: new URLSearchParams({ data: query }),
          // overpass-api.de answers 406 to requests without a User-Agent
          headers: { "User-Agent": "moe-skopje-bake/1.0", Accept: "application/json" },
          signal: AbortSignal.timeout(60_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { elements?: unknown[]; remark?: string };
        if (json.remark?.includes("runtime error") || !json.elements) throw new Error(json.remark ?? "no elements in response");
        return { elements: json.elements };
      } catch (err) {
        const msg = `${url}: ${err instanceof Error ? err.message : String(err)}`;
        console.warn(`  ${msg}`);
        errors.push(msg);
      }
    }
    await sleep(Math.min(5_000 * 2 ** round, 60_000));
  }
  throw new Error(`All Overpass endpoints failed within ${minutes} min:\n${errors.slice(-9).join("\n")}`);
}

async function bake(name: string, ds: Dataset) {
  console.log(`${name}: querying Overpass`);
  const json = await overpass(ds.query, ds.minutes ?? DEFAULT_MINUTES);
  const all = ds.raw ? ds.raw(json.elements) : (osmtogeojson(json, { flatProperties: true }).features as GeoJSON.Feature<GeoJSON.Geometry, Props>[]);
  let features = all.map(ds.pick).filter((f): f is GeoJSON.Feature => f !== null);

  if (name === "municipalities") {
    // a municipality can be mapped twice (levels 7 and 8, or per-name/name:mk hits): keep one per name
    const byName = new Map<string, GeoJSON.Feature>();
    for (const f of features) byName.set((f.properties as { name_mk: string }).name_mk, f);
    features = [...byName.values()];
    if (features.length !== MUNI_NAMES) {
      const got = features.map((f) => (f.properties as { name_mk: string }).name_mk).sort().join(", ");
      throw new Error(`municipalities: expected exactly ${MUNI_NAMES}, got ${features.length}: ${got}`);
    }
  }
  if (features.length === 0) throw new Error(`${name}: 0 features`);
  if (name === "bus-stops" && features.length <= 300) throw new Error(`bus-stops: expected over 300, got ${features.length}`);

  // one feature per line keeps git diffs and merges readable
  const { body, count } = ds.format
    ? await ds.format(features)
    : { body: `{"type":"FeatureCollection","features":[\n${jsonLines(features)}\n]}\n`, count: features.length };
  if (count === 0) throw new Error(`${name}: 0 rows after filtering`);
  await writeFile(join(OUT_DIR, ds.file), body);
  console.log(`${name}: ${count} features → data/static/${ds.file} (${(body.length / 1024).toFixed(0)} KB)`);
  return count;
}

async function main() {
  const only = process.argv.slice(2);
  const names = only.length ? only : Object.keys(DATASETS);
  const unknown = names.filter((n) => !DATASETS[n]);
  if (unknown.length) throw new Error(`unknown dataset(s): ${unknown.join(", ")}; known: ${Object.keys(DATASETS).join(", ")}`);
  await mkdir(OUT_DIR, { recursive: true });
  const counts: Record<string, number> = {};
  for (const name of names) counts[name] = await bake(name, DATASETS[name]);
  console.log("done", counts);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
