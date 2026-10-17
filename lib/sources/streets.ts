// Baked OSM street index (scripts/bake-osm.ts → data/static/streets.geojson) and free-text street matching (spec §11.8).
// Outage text names streets ("ул. Партизанска бр. 12–40, Карпош"); findStreets turns that into street geometry.
// No imports from lib/server/* (this runs under tsx too).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import gazetteer from "../../data/static/settlements.json";
import { MUNICIPALITIES, normalizeName } from "./geo";
import { simplifyLine } from "./geom";
import { municipalityAt, type MunicipalityCollection } from "./static";

export type StreetProps = { name_mk: string; name_en?: string; municipality_mk: string };
export type StreetFeature = GeoJSON.Feature<GeoJSON.MultiLineString, StreetProps>;
export type StreetCollection = GeoJSON.FeatureCollection<GeoJSON.MultiLineString, StreetProps>;

// "ул.", "бул." and friends, after normalizeName (so "Ul." and "Bul." arrive here as "ул" and "бул" too).
const PREFIX = new Set(["ул", "улица", "бул", "булев", "булевар"]);

const tokens = (s: string) => normalizeName(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * The matching key of a street name: lowercase Cyrillic words (numbers kept) without the ул./бул./булевар prefix.
 * "Булевар Партизански Одреди", "бул. Партизански одреди" and "Bul. Partizanski Odredi" are one key; a bare prefix is "".
 */
export function streetKey(name: string): string {
  const t = tokens(name);
  while (t.length && PREFIX.has(t[0])) t.shift();
  return t.join(" ");
}

// --- Bake time ----------------------------------------------------------------------------------------------------------

export type Way = { name_mk: string; name_en?: string; coords: number[][] };

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const SAMPLES = 16;

/** The municipality most of the way's vertices lie in (evenly sampled when the way has more than 16), or undefined when none does. */
function majorityMunicipality(coords: number[][], munis: MunicipalityCollection): string | undefined {
  const step = Math.max(1, Math.ceil(coords.length / SAMPLES));
  const votes = new Map<string, number>();
  for (let i = 0; i < coords.length; i += step) {
    const m = municipalityAt(munis, coords[i][0], coords[i][1]);
    if (m) votes.set(m, (votes.get(m) ?? 0) + 1);
  }
  return [...votes].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/**
 * OSM ways → one MultiLineString per street per municipality. Ways merge when they share a streetKey and a municipality
 * (the one most of their vertices are in); ways outside all municipalities and ways without a real name are dropped.
 * Lines are Douglas-Peucker simplified to `toleranceM` metres and rounded to 5 decimals (about 1 m).
 */
export function mergeStreets(ways: Way[], munis: MunicipalityCollection, toleranceM = 5): StreetFeature[] {
  type Group = { names: Map<string, number>; en?: string; lines: number[][][]; muni: string };
  const groups = new Map<string, Group>();
  for (const w of ways) {
    const key = streetKey(w.name_mk);
    if (!key) continue;
    const muni = majorityMunicipality(w.coords, munis);
    if (!muni) continue;
    const line = simplifyLine(w.coords, toleranceM).map(([x, y]) => [round5(x), round5(y)]);
    if (line.length < 2) continue;
    const g: Group = groups.get(`${key}|${muni}`) ?? { names: new Map(), lines: [], muni };
    g.names.set(w.name_mk, (g.names.get(w.name_mk) ?? 0) + 1);
    g.en ??= w.name_en?.trim() || undefined;
    g.lines.push(line);
    groups.set(`${key}|${muni}`, g);
  }
  return [...groups.values()]
    .map((g): StreetFeature => {
      const name_mk = [...g.names].sort((a, b) => b[1] - a[1])[0][0]; // the most common spelling; the first one on a tie
      return {
        type: "Feature",
        geometry: { type: "MultiLineString", coordinates: g.lines },
        properties: { name_mk, ...(g.en ? { name_en: g.en } : {}), municipality_mk: g.muni },
      };
    })
    .sort((a, b) => a.properties.municipality_mk.localeCompare(b.properties.municipality_mk, "mk") || a.properties.name_mk.localeCompare(b.properties.name_mk, "mk"));
}

// --- Run time -----------------------------------------------------------------------------------------------------------

// The read site spells the path out (process.cwd(), "data", "static", ...): Next traces the whole project for a directory
// held in a variable (see build-paths.test.ts). Tests swap the data with setStreets, never the path.
let data: StreetCollection | undefined;
/** Test hook: serve this collection instead of data/static/streets.geojson. Call without an argument to read the baked file again. */
export const setStreets = (fc?: StreetCollection) => void (data = fc);
// ponytail: one synchronous read of a ~5 MB file per server instance, on first use; move to an async reader if it ever shows in a profile.
const streets = (): StreetCollection => (data ??= JSON.parse(readFileSync(join(process.cwd(), "data", "static", "streets.geojson"), "utf8")) as StreetCollection);

// A name that is also an ordinary word, a month, a municipality or a neighbourhood is only a street when ул./бул. says so.
// ponytail: a hand-picked word list plus the 10 municipality names and the baked settlements; extend it when a false positive shows up.
const COMMON = new Set<string>([
  ...MUNICIPALITIES.map(streetKey),
  ...(gazetteer as { name_mk: string; name_en?: string }[]).flatMap((s) => [streetKey(s.name_mk), s.name_en ? streetKey(s.name_en) : ""]),
  ...["јануари", "февруари", "март", "април", "мај", "јуни", "јули", "август", "септември", "октомври", "ноември", "декември"],
  ...["македонија", "скопје", "градски", "државен", "државна", "република", "народен", "народна", "нова", "ново", "стара", "старо", "голема", "мала", "главна", "главен"],
]);
COMMON.delete("");
const SHORT = 4; // a single word of up to 4 letters ("Мир", "Прва") is more likely a word than a street

type Entry = { key: string[]; risky: boolean; f: StreetFeature };
const indexes = new WeakMap<StreetCollection, Map<string, Entry[]>>();

/**
 * Every key a street answers to: its full name, and the name without the "Народен херој" title or the "-Nickname" tail OSM
 * often adds ("Народен Херој Борка Талески-Црниот" is "ул. Борка Талески" in a notice). A tail is only cut off a name of
 * two or more words, so "Дамовски-ошенски" and "Македонско-косовска бригада" keep their whole name.
 */
function nameKeys(raw: string): string[] {
  const noNick = streetKey(raw.replace(/(?<=\p{L})\s*[-–]\s*\p{L}+$/u, ""));
  const keys = [streetKey(raw), noNick.includes(" ") ? noNick : ""];
  return [...new Set(keys.flatMap((k) => [k, k.replace(/^народен херој /, "")]))].filter(Boolean);
}

/** Streets by the first word of each of their names (Cyrillic and English). */
function indexOf(fc: StreetCollection): Map<string, Entry[]> {
  let idx = indexes.get(fc);
  if (idx) return idx;
  idx = new Map();
  for (const f of fc.features) {
    const keys = new Set([f.properties.name_mk, f.properties.name_en].flatMap((n) => (n ? nameKeys(n) : [])));
    for (const k of keys) {
      const key = k.split(" ");
      const risky = COMMON.has(k) || (key.length === 1 && key[0].length <= SHORT);
      const list = idx.get(key[0]) ?? [];
      list.push({ key, risky, f });
      idx.set(key[0], list);
    }
  }
  indexes.set(fc, idx);
  return idx;
}

/**
 * Streets named in free text such as "ул. Партизанска бр. 12–40, Карпош", in order of appearance, each once.
 * A street counts only when all words of its name appear in a row as whole words (any script or case; house numbers and
 * ул./бул./булевар are ignored), the longest name wins over a shorter one inside it, and a name that doubles as an
 * everyday word or a place name needs the ул./бул. in front. With `municipality`, only that municipality's streets.
 */
export function findStreets(text: string, municipality?: string, fc: StreetCollection = streets()): StreetFeature[] {
  const idx = indexOf(fc);
  const t = tokens(text);
  const muni = municipality ? normalizeName(municipality) : undefined;
  const found: StreetFeature[] = [];
  for (let i = 0; i < t.length; ) {
    const hits = (idx.get(t[i]) ?? []).filter((e) => e.key.every((k, j) => t[i + j] === k) && (!e.risky || PREFIX.has(t[i - 1] ?? "")));
    if (!hits.length) {
      i++;
      continue;
    }
    // the longest name is settled over every municipality first, then filtered: "Јане Сандански" in another municipality
    // must not leave its last word to match a different street called "Сандански" here
    const longest = Math.max(...hits.map((e) => e.key.length));
    for (const e of hits) {
      if (e.key.length === longest && !found.includes(e.f) && (!muni || normalizeName(e.f.properties.municipality_mk) === muni)) found.push(e.f);
    }
    i += longest;
  }
  return found;
}

/**
 * The streets a notice means, for a notice that says it is in `municipality`: a street of that name in that municipality;
 * failing that, the street of that name when exactly one other municipality has one (a border street filed under its
 * neighbour). A name that several other municipalities have but this one lacks is ambiguous and skipped.
 */
export function locateStreets(text: string, municipality: string, fc?: StreetCollection): StreetFeature[] {
  const muni = normalizeName(municipality);
  const byName = new Map<string, StreetFeature[]>();
  for (const f of findStreets(text, undefined, fc)) {
    const key = streetKey(f.properties.name_mk);
    byName.set(key, [...(byName.get(key) ?? []), f]);
  }
  return [...byName.values()].flatMap((group) => {
    const here = group.filter((f) => normalizeName(f.properties.municipality_mk) === muni);
    if (here.length) return here;
    return new Set(group.map((f) => f.properties.municipality_mk)).size === 1 ? group : [];
  });
}
