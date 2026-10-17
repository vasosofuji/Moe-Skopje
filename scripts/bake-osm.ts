// One-off Overpass export → data/static/*.geojson (runtime data, committed). Run: npm run bake:osm [dataset ...]
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import osmtogeojson from "osmtogeojson";
import { toLatin } from "../lib/sources/static";

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const BBOX = "41.90,21.25,42.10,21.60"; // S,W,N,E, Overpass order
const OUT_DIR = join(process.cwd(), "data", "static");
const DEADLINE = Date.now() + 15 * 60_000; // whole bake is time-boxed
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
  parking: {
    file: "parking.geojson",
    query: q(`nwr["amenity"="parking"](${BBOX});`, "out center;"),
    pick: point(["parking", "fee", "capacity", "access", "operator"]),
  },
  pharmacies: {
    file: "pharmacies.geojson",
    query: q(`nwr["amenity"="pharmacy"](${BBOX});`, "out center;"),
    pick: point(["opening_hours", "phone", "operator", "website", "addr:street", "addr:housenumber"]),
  },
  schools: {
    file: "schools.geojson",
    query: q(`nwr["amenity"~"^(school|kindergarten)$"](${BBOX});`, "out center;"),
    pick: point(["amenity", "operator", "addr:street", "addr:housenumber"]),
  },
};

/** POSTs to the first endpoint that answers 200 with a usable body; retries all endpoints with backoff until the deadline. */
async function overpass(query: string): Promise<{ elements: unknown[] }> {
  const errors: string[] = [];
  for (let round = 0; Date.now() < DEADLINE; round++) {
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
  throw new Error(`All Overpass endpoints failed within 15 min:\n${errors.slice(-9).join("\n")}`);
}

async function bake(name: string, ds: Dataset) {
  console.log(`${name}: querying Overpass`);
  const json = await overpass(ds.query);
  const all = osmtogeojson(json, { flatProperties: true }).features as GeoJSON.Feature<GeoJSON.Geometry, Props>[];
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
  const body = `{"type":"FeatureCollection","features":[\n${features.map((f) => JSON.stringify(f)).join(",\n")}\n]}\n`;
  await writeFile(join(OUT_DIR, ds.file), body);
  console.log(`${name}: ${features.length} features → data/static/${ds.file} (${(body.length / 1024).toFixed(0)} KB)`);
  return features.length;
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
