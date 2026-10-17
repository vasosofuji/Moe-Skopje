import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import settlements from "@/data/static/settlements.json";
import { distanceM } from "@/lib/routing";
import { fold, normalizeName } from "@/lib/sources/geo";
import { bboxOf } from "@/lib/sources/geom";
import { municipalities } from "@/lib/sources/static";
import { streetKey, type StreetCollection } from "@/lib/sources/streets";

export type PlaceKind = "street" | "settlement" | "municipality";
export type Place = {
  name: string;
  nameEn?: string;
  kind: PlaceKind;
  /** Municipality the place lies in (streets and settlements). */
  area?: string;
  lng: number;
  lat: number;
};

export const MAX_PLACES = 8;
export const PlacesQuery = z.object({ q: z.string().trim().min(1).max(60) });

type Entry = Place & { keys: string[] };

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const keyOf = (name: string, kind: PlaceKind) => fold(kind === "street" ? streetKey(name) : normalizeName(name));
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

let index: Promise<Entry[]> | undefined;

async function build(): Promise<Entry[]> {
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
      area: p.municipality_mk,
      lng: round5(lng),
      lat: round5(lat),
      keys: [keyOf(p.name_mk, "street"), ...(p.name_en ? [keyOf(p.name_en, "street")] : [])],
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
      kind: "municipality",
      lng: round5(at[0]),
      lat: round5(at[1]),
      keys: [keyOf(f.properties.name_mk, "municipality"), keyOf(f.properties.name_en, "municipality")],
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
      kind: "settlement",
      area: s.municipality_mk,
      lng: round5(at[0]),
      lat: round5(at[1]),
      keys: [keyOf(s.name_mk, "settlement"), ...(s.name_en ? [keyOf(s.name_en, "settlement")] : [])],
    });
  }
  return entries;
}

const KIND_RANK: Record<PlaceKind, number> = { municipality: 0, settlement: 1, street: 2 };

/** 0 = the whole name, 1 = starts with it, 2 = a later word starts with it, 3 = contains it, -1 = no match. */
function score(keys: string[], q: string): number {
  let best = -1;
  for (const k of keys) {
    const s = k === q ? 0 : k.startsWith(q) ? 1 : k.includes(` ${q}`) ? 2 : k.includes(q) ? 3 : -1;
    if (s >= 0 && (best < 0 || s < best)) best = s;
  }
  return best;
}

/** Streets, settlements and municipalities whose name matches `q` in Latin or Cyrillic, best first, at most 8. */
export async function searchPlaces(q: string): Promise<Place[]> {
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
  hits.sort(
    (a, b) => a.s - b.s || KIND_RANK[a.e.kind] - KIND_RANK[b.e.kind] || a.e.name.length - b.e.name.length || a.e.name.localeCompare(b.e.name),
  );
  return hits.slice(0, MAX_PLACES).map(({ e: { name, nameEn, kind, area, lng, lat } }) => ({ name, nameEn, kind, area, lng, lat }));
}
