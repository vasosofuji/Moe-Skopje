import { readFileSync } from "node:fs";
import { afterEach, expect, test } from "vitest";
import { ZONES, bufferLines, buildZones, matchEntries, matchStats, parseZonePage, type ZoneEntry, type ZoneId } from "./parking-zones";
import { setStreets, type StreetCollection, type StreetFeature } from "./streets";

afterEach(() => setStreets());

// A saved copy of https://www.gradskiparking.com.mk/zonsko-parking-zoni.nspx (fetched 2026-10-17).
const html = readFileSync(new URL("./__fixtures__/gradski-zoni.html", import.meta.url), "utf8");

// --- parseZonePage ----------------------------------------------------------------------------------------------------

test("parseZonePage reads every zone entry of the saved page under the right colour zone", () => {
  const entries = parseZonePage(html);
  expect(entries).toHaveLength(36);
  const per = (z: ZoneId) => entries.filter((e) => e.zone === z).length;
  expect([per("A0"), per("A"), per("B"), per("C"), per("D")]).toEqual([4, 3, 5, 11, 13]);
  expect(entries[0]).toMatchObject({ zone: "A0", name: "Средно водно", location: "Средно водно", spots: 154 });
  expect(entries[0].code).toMatch(/^[АA]0$/);
});

test("parseZonePage: location after 'Локација', without it, inline in the heading, and missing", () => {
  const by = (name: string) => parseZonePage(html).find((e) => e.name.includes(name))!;
  expect(by("Даме Груев 1")).toMatchObject({ zone: "A", name: "Даме Груев 1", location: "ул. Даме Груев- пред полициска станица Беко", spots: 53 });
  // a location list item that does not start with "Локација"
  expect(by("МИДА").location).toContain("Орце Николов");
  expect(by("МИДА").spots).toBe(79);
  // the heading itself carries "Локација Булевар Илинден"
  const tennis = by("Тениски клуб");
  expect(tennis).toMatchObject({ zone: "D", name: "Тениски клуб АБЦ", spots: 33 });
  expect(tennis.location).toContain("Илинден");
  // "(продолжение Ц45)" has no location at all
  expect(by("продолжение")).toMatchObject({ zone: "C", location: "", spots: 193 });
  // two entries for Д8: the second lists streets only
  const d8 = parseZonePage(html).filter((e) => /^[ДD]8$/.test(e.code));
  expect(d8).toHaveLength(2);
  expect(d8[1].location).toContain("Владимир Комаров");
});

test("parseZonePage finds nothing in a page without zone sections, instead of inventing zones", () => {
  expect(parseZonePage("<html><body><div class='article-holder'><p>1. Зона А1- Нешто</p></div></body></html>")).toEqual([]);
  expect(parseZonePage("")).toEqual([]);
});

// --- matchEntries -----------------------------------------------------------------------------------------------------

const street = (name_mk: string, municipality_mk: string, lng: number): StreetFeature => ({
  type: "Feature",
  geometry: { type: "MultiLineString", coordinates: [[[lng, 42.0], [lng + 0.002, 42.0]]] },
  properties: { name_mk, municipality_mk },
});
const STREETS: StreetCollection = {
  type: "FeatureCollection",
  features: [
    street("Даме Груев", "Центар", 21.43),
    street("Маршал Тито", "Центар", 21.44),
    street("Јане Сандански", "Аеродром", 21.47),
    street("Бојмија", "Аеродром", 21.48),
    street("Илинден", "Аеродром", 21.49),
    street("Илинден", "Центар", 21.45),
  ],
};
const entry = (zone: ZoneId, name: string, location: string): ZoneEntry => ({ zone, code: "X1", name, location });

test("matchEntries finds the streets of a location, preferring the zone's municipality (Центар for A0 to C, Аеродром for D)", () => {
  setStreets(STREETS);
  const [a, b, c, d, e] = matchEntries([
    entry("A", "Даме Груев 1", "ул. Даме Груев- пред полициска станица Беко"),
    entry("A", "Камен мост", 'ул. "Црвена Скопска Општина" (Маршал Тито)'),
    entry("D", "Бисер", 'Населба Аеродром (Булевар "Јане Сандански")'),
    entry("C", "Зоолошка", 'Булевар "Илинден"'),
    entry("D", "Тенис", 'Булевар "Илинден"'),
  ]);
  expect(a.streets.map((s) => s.properties.name_mk)).toEqual(["Даме Груев"]);
  expect(b.streets.map((s) => s.properties.name_mk)).toEqual(["Маршал Тито"]);
  expect(c.streets.map((s) => s.properties.name_mk)).toEqual(["Јане Сандански"]);
  expect(d.streets.map((s) => s.properties.municipality_mk)).toEqual(["Центар"]); // two Илинден: the zone's own municipality
  expect(e.streets.map((s) => s.properties.municipality_mk)).toEqual(["Аеродром"]);
});

test("matchEntries only looks in the name when the name itself says ул./бул., and an area with no street stays unmatched", () => {
  setStreets(STREETS);
  const [byName, area, landmark] = matchEntries([
    entry("A0", "ул. Бојмија", ""),
    entry("A0", "Средно водно", "Средно водно"),
    entry("B", "Даме Груев", "Бристол"), // a lot called after a street, but its location is a landmark: not guessed from the name
  ]);
  expect(byName.streets).toHaveLength(1);
  expect(area.streets).toEqual([]);
  expect(landmark.streets).toEqual([]);
});

test("matchStats counts the entries that name a location, how many of them matched, and which did not", () => {
  setStreets(STREETS);
  const m = matchEntries([
    entry("A", "1", "ул. Даме Груев"),
    entry("A", "2", "ул. Маршал Тито и ул. Даме Груев"),
    entry("A0", "3", "Средно водно"),
    entry("C", "4", ""),
  ]);
  expect(matchStats(m)).toEqual({ entries: 4, withLocation: 3, matched: 2, streets: 2, unmatched: ["Средно водно"] });
});

// --- bufferLines ------------------------------------------------------------------------------------------------------

const M = 111_320; // metres per degree of latitude
const areaM2 = (ring: number[][], lat: number) => {
  const kx = M * Math.cos((lat * Math.PI) / 180);
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * kx * (ring[i + 1][1] * M) - ring[i + 1][0] * kx * (ring[i][1] * M);
  return Math.abs(a) / 2;
};

test("bufferLines turns a 100 m street into one rounded 25 m band of about 100 x 50 m plus two half circles", () => {
  const lng100m = 100 / (M * Math.cos((42 * Math.PI) / 180));
  const poly = bufferLines([[[21.4, 42.0], [21.4 + lng100m, 42.0]]], 25);
  expect(poly).toHaveLength(1);
  const [ring] = poly[0];
  expect(ring[0]).toEqual(ring[ring.length - 1]); // closed
  const expected = 100 * 50 + Math.PI * 25 * 25; // 6963 m²
  expect(areaM2(ring, 42)).toBeGreaterThan(expected * 0.93);
  expect(areaM2(ring, 42)).toBeLessThan(expected * 1.03);
  const lats = ring.map((p) => p[1]);
  expect(((Math.max(...lats) - Math.min(...lats)) * M)).toBeGreaterThan(48);
  expect(((Math.max(...lats) - Math.min(...lats)) * M)).toBeLessThan(51);
});

test("bufferLines merges streets that meet or overlap into one polygon, and keeps distant ones apart", () => {
  const l1 = [[21.4, 42.0], [21.402, 42.0]];
  const l2 = [[21.402, 42.0], [21.402, 42.002]]; // joins l1 at a corner
  const far = [[21.45, 42.05], [21.452, 42.05]];
  expect(bufferLines([l1, l2], 25)).toHaveLength(1);
  expect(bufferLines([l1, l2, far], 25)).toHaveLength(2);
  expect(bufferLines([], 25)).toEqual([]);
  expect(bufferLines([[[21.4, 42.0]]], 25)).toEqual([]); // a single point is not a street
});

// --- buildZones -------------------------------------------------------------------------------------------------------

test("buildZones makes one feature per zone with colour, titles and the price when the price list has the zone", () => {
  setStreets(STREETS);
  const matches = matchEntries([entry("A", "Даме Груев 1", "ул. Даме Груев"), entry("D", "Бојмија", "ул. Бојмија"), entry("C", "Нема", "Средно водно")]);
  const zones = buildZones(matches, { A: 40, D: 30 });
  expect(zones.map((z) => z.properties.zone)).toEqual(["A", "D"]); // C matched nothing, so it is not drawn
  expect(zones[0].properties).toEqual({ zone: "A", color: ZONES.A.color, title: ZONES.A.title, price: 40 });
  expect(zones[1].properties.color).toBe("#FFFFFF");
  expect(zones.every((z) => z.geometry.type === "MultiPolygon" && z.geometry.coordinates.length >= 1)).toBe(true);
  expect(buildZones(matches, {})[0].properties).not.toHaveProperty("price");
});

test("ZONES uses City Parking's colours: A0 orange, A red, B yellow, C green, D white", () => {
  expect(Object.entries(ZONES).map(([k, z]) => [k, z.title.en])).toEqual([
    ["A0", "Orange zone (A0)"],
    ["A", "Red zone (A)"],
    ["B", "Yellow zone (B)"],
    ["C", "Green zone (C)"],
    ["D", "White zone (D)"],
  ]);
});

// --- the baked data (data/static/parking-zones.geojson, scripts/bake-parking.ts) ---------------------------------------------

test("the baked parking zones are valid polygons in Skopje, one per colour zone, with City Parking colours", () => {
  const fc = JSON.parse(readFileSync(new URL("../../data/static/parking-zones.geojson", import.meta.url), "utf8")) as GeoJSON.FeatureCollection<
    GeoJSON.Polygon | GeoJSON.MultiPolygon,
    { zone: ZoneId; color: string; title: { mk: string; en: string }; price?: number }
  >;
  const ids = fc.features.map((f) => f.properties.zone);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toEqual(expect.arrayContaining(["A", "B", "C", "D"]));
  for (const f of fc.features) {
    expect(f.properties.color).toBe(ZONES[f.properties.zone].color);
    expect(f.properties.title).toEqual(ZONES[f.properties.zone].title);
    expect(f.geometry.type).toMatch(/Polygon/);
    const pts: number[][] = [];
    const walk = (c: unknown): void => (Array.isArray(c) && typeof c[0] === "number" ? void pts.push(c as number[]) : (c as unknown[]).forEach(walk));
    walk(f.geometry.coordinates);
    expect(pts.length).toBeGreaterThan(8);
    expect(pts.every(([x, y]) => x > 21.25 && x < 21.6 && y > 41.9 && y < 42.1)).toBe(true);
  }
  expect(fc.features.find((f) => f.properties.zone === "A")!.properties.price).toBe(40);
  expect(fc.features.find((f) => f.properties.zone === "D")!.properties.price).toBe(30);
});
