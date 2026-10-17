// Baked OSM datasets (scripts/bake-osm.ts → data/static/*.geojson) as adapters.
// No imports from lib/server/*: this runs under tsx too (server-only throws there).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { LayerId } from "../layers";
import { loadSeed } from "./seed";
import type { Adapter, Feature } from "./types";

const OSM = { name: "OpenStreetMap", url: "https://www.openstreetmap.org/" };
const dataDir = () => join(process.cwd(), "data", "static");

// Macedonian Cyrillic → Latin, used for `title.en` when OSM has no `name:en`.
const LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", ѓ: "gj", е: "e", ж: "ž", з: "z", ѕ: "dz", и: "i", ј: "j", к: "k", л: "l", љ: "lj",
  м: "m", н: "n", њ: "nj", о: "o", п: "p", р: "r", с: "s", т: "t", ќ: "kj", у: "u", ф: "f", х: "h", ц: "c", ч: "č", џ: "dž", ш: "š",
};
export function toLatin(s: string): string {
  return [...s]
    .map((ch) => {
      const lat = LATIN[ch.toLowerCase()];
      if (lat === undefined) return ch;
      return ch === ch.toLowerCase() ? lat : lat[0].toUpperCase() + lat.slice(1);
    })
    .join("");
}

// Shown when OSM has neither a name nor a ref.
const UNNAMED: Record<string, { mk: string; en: string }> = {
  "bus-stop": { mk: "Автобуска постојка", en: "Bus stop" },
  "bus-route": { mk: "Линија", en: "Line" },
  parking: { mk: "Паркинг", en: "Parking" },
  pharmacy: { mk: "Аптека", en: "Pharmacy" },
  school: { mk: "Училиште", en: "School" },
};

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export type StaticOptions = {
  /** Property holding the Macedonian title. Default "name"; `name_en` is the English one when titleFrom is "name". */
  titleFrom?: string;
  source?: Adapter["source"];
  /** Directory of the GeoJSON files (tests). Default data/static. */
  dir?: string;
};

/** One baked OSM feature → adapter Feature. Unused string/number properties become `detail`. */
export function toFeature(f: GeoJSON.Feature, kind: string, titleFrom = "name"): Feature {
  const { osm_id, name_en, ...props } = (f.properties ?? {}) as Record<string, unknown>;
  const ref = text(props.ref);
  const unnamed = UNNAMED[kind] ?? { mk: kind, en: kind };
  const own = text(props[titleFrom]);
  const mk = own ?? (ref ? `${unnamed.mk} ${ref}` : unnamed.mk);
  const en = (titleFrom === "name" && text(name_en)) || (own ? toLatin(own) : ref ? `${unnamed.en} ${ref}` : unnamed.en);
  const detail: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(props)) {
    if (k !== titleFrom && (typeof v === "number" || text(v))) detail[k] = v as string | number;
  }
  return {
    type: "Feature",
    geometry: f.geometry,
    properties: { id: `${kind}:${String(osm_id ?? f.id)}`, kind, title: { mk, en }, ...(Object.keys(detail).length ? { detail } : {}) },
  } as Feature;
}

/** Adapter over a baked file. Status is always "static"; an empty file counts as a failed fetch. */
export function staticAdapter(id: LayerId, file: string, kind: string, opts: StaticOptions = {}): Adapter {
  return {
    id,
    ttl: 86400,
    static: true,
    minFeatures: 1,
    source: opts.source ?? OSM,
    async fetch() {
      const fc = JSON.parse(await readFile(join(opts.dir ?? dataDir(), file), "utf8")) as GeoJSON.FeatureCollection;
      return fc.features.map((f) => toFeature(f, kind, opts.titleFrom));
    },
    seed: () => loadSeed(id),
  };
}

/** `buses` layer: stops plus routes from the baked files. Task 9 wraps this. */
export function staticBuses(opts: StaticOptions = {}): Adapter {
  const stops = staticAdapter("buses", "bus-stops.geojson", "bus-stop", opts);
  const routes = staticAdapter("buses", "bus-routes.geojson", "bus-route", opts);
  return { ...stops, fetch: async () => [...(await stops.fetch()), ...(await routes.fetch())] };
}

export type MunicipalityCollection = GeoJSON.FeatureCollection<
  GeoJSON.Polygon | GeoJSON.MultiPolygon,
  { name_mk: string; name_en: string }
>;

let municipalitiesCache: Promise<MunicipalityCollection> | undefined;

/** The 10 Skopje municipality polygons from data/static/municipalities.geojson (spec §5.3). Memoised. */
export function municipalities(): Promise<MunicipalityCollection> {
  municipalitiesCache ??= readFile(join(dataDir(), "municipalities.geojson"), "utf8")
    .then((s) => JSON.parse(s) as MunicipalityCollection)
    .catch((err) => {
      municipalitiesCache = undefined; // don't cache a failure
      throw err;
    });
  return municipalitiesCache;
}
