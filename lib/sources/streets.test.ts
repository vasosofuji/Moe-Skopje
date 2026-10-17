import { readFileSync } from "node:fs";
import { afterEach, expect, test } from "vitest";
import { findStreets, locateStreets, mergeStreets, setStreets, streetKey, type StreetCollection, type StreetFeature } from "./streets";
import type { MunicipalityCollection } from "./static";

const square = (w: number, s: number, e: number, n: number): GeoJSON.Polygon => ({ type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] });
const MUNIS: MunicipalityCollection = {
  type: "FeatureCollection",
  features: [
    { type: "Feature", geometry: square(21.38, 41.98, 21.42, 42.02), properties: { name_mk: "Карпош", name_en: "Karposh" } },
    { type: "Feature", geometry: square(21.42, 41.98, 21.46, 42.02), properties: { name_mk: "Аеродром", name_en: "Aerodrom" } },
  ],
};

afterEach(() => setStreets());

test("streetKey drops the ул./бул./булевар prefix, case, script and punctuation: one key per street", () => {
  const key = streetKey("Булевар Партизански Одреди");
  expect(key).toBe("партизански одреди");
  expect(streetKey("бул. Партизански одреди")).toBe(key);
  expect(streetKey("Bul. Partizanski Odredi")).toBe(key);
  expect(streetKey("ул. 11 Октомври")).toBe("11 октомври");
  expect(streetKey("Кузман Јосифоски-Питу")).toBe("кузман јосифоски питу");
  expect(streetKey("улица")).toBe(""); // nothing but a prefix is not a name
});

test("mergeStreets merges ways of one name into a MultiLineString, simplified to ~5 m and rounded to 5 decimals", () => {
  const out = mergeStreets(
    [
      { name_mk: "Партизанска", name_en: "Partizanska", coords: [[21.39, 42.0], [21.395, 42.0000001], [21.4, 42.0]] },
      { name_mk: "ул. Партизанска", coords: [[21.4, 42.0], [21.41, 42.001234567]] },
    ],
    MUNIS,
  );
  expect(out).toHaveLength(1);
  expect(out[0].geometry).toEqual({ type: "MultiLineString", coordinates: [[[21.39, 42.0], [21.4, 42.0]], [[21.4, 42.0], [21.41, 42.00123]]] });
  expect(out[0].properties).toEqual({ name_mk: "Партизанска", name_en: "Partizanska", municipality_mk: "Карпош" });
});

test("mergeStreets keeps one feature per street per municipality, by the municipality most of a way's vertices are in", () => {
  const out = mergeStreets(
    [
      { name_mk: "Прва", coords: [[21.39, 42.0], [21.395, 42.0]] },
      { name_mk: "Прва", coords: [[21.43, 42.0], [21.44, 42.0]] },
      // two vertices in Аеродром, one in Карпош → Аеродром
      { name_mk: "Река", coords: [[21.41, 42.0], [21.43, 42.0], [21.44, 42.0]] },
    ],
    MUNIS,
  );
  const by = (n: string) => out.filter((f) => f.properties.name_mk === n).map((f) => f.properties.municipality_mk).sort();
  expect(by("Прва")).toEqual(["Аеродром", "Карпош"]);
  expect(by("Река")).toEqual(["Аеродром"]);
});

test("mergeStreets drops ways outside every municipality and unnamed ways", () => {
  const out = mergeStreets(
    [
      { name_mk: "Далечна", coords: [[21.9, 42.5], [21.91, 42.5]] },
      { name_mk: "ул.", coords: [[21.39, 42.0], [21.395, 42.0]] },
    ],
    MUNIS,
  );
  expect(out).toEqual([]);
});

// --- findStreets ------------------------------------------------------------------------------------------------------

const line = (lng: number): GeoJSON.MultiLineString => ({ type: "MultiLineString", coordinates: [[[lng, 42.0], [lng + 0.001, 42.0]]] });
const street = (name_mk: string, municipality_mk: string, lng: number, name_en?: string): StreetFeature => ({
  type: "Feature",
  geometry: line(lng),
  properties: { name_mk, ...(name_en ? { name_en } : {}), municipality_mk },
});
const FIXTURE: StreetCollection = {
  type: "FeatureCollection",
  features: [
    street("Партизанска", "Карпош", 21.39),
    street("Партизанска", "Аеродром", 21.43),
    street("Иво Лола Рибар", "Аеродром", 21.44, "Ivo Lola Ribar"),
    street("Рибар", "Карпош", 21.4),
    street("Јане Сандански", "Аеродром", 21.447),
    street("Борка Талески", "Карпош", 21.385),
    street("11 Октомври", "Центар", 21.41),
    street("Мир", "Карпош", 21.382),
    street("Македонија", "Карпош", 21.383),
    street("Аеродром", "Аеродром", 21.45),
    street("Прва", "Карпош", 21.384),
  ],
};
const names = (fs: StreetFeature[]) => fs.map((f) => `${f.properties.name_mk}/${f.properties.municipality_mk}`);

test("findStreets finds a street in free text with prefix, house numbers and a municipality", () => {
  setStreets(FIXTURE);
  expect(names(findStreets("ул. Партизанска бр. 12–40, Карпош", "Карпош"))).toEqual(["Партизанска/Карпош"]);
  // without a municipality, every street of that name comes back
  expect(names(findStreets("ул. Партизанска бр. 12–40, Карпош")).sort()).toEqual(["Партизанска/Аеродром", "Партизанска/Карпош"]);
  expect(findStreets("ул. Партизанска бр. 12–40", "Центар")).toEqual([]);
});

test("findStreets handles ул./бул./булевар prefixes glued to the name, Latin script and mixed case", () => {
  setStreets(FIXTURE);
  for (const text of ["бул. Иво Лола Рибар", "Булевар Иво Лола Рибар бр. 3", "Бул.Иво Лола Рибар", "bul. Ivo Lola Ribar 5", "ИВО ЛОЛА РИБАР"]) {
    expect(names(findStreets(text)), text).toEqual(["Иво Лола Рибар/Аеродром"]);
  }
});

test("findStreets prefers the longest street name and reports each street once, in order of appearance", () => {
  setStreets(FIXTURE);
  expect(names(findStreets("ул. Борка Талески, Иво Лола Рибар и Борка Талески", "Карпош"))).toEqual(["Борка Талески/Карпош"]);
  expect(names(findStreets("Иво Лола Рибар, ул. Борка Талески"))).toEqual(["Иво Лола Рибар/Аеродром", "Борка Талески/Карпош"]);
  // "Рибар" is also a street (in Карпош), but inside the longer name it is not a second match, with or without a municipality filter
  expect(names(findStreets("Иво Лола Рибар"))).toEqual(["Иво Лола Рибар/Аеродром"]);
  expect(findStreets("Иво Лола Рибар", "Карпош")).toEqual([]);
  expect(names(findStreets("ул. Рибар", "Карпош"))).toEqual(["Рибар/Карпош"]);
});

test("findStreets needs the whole token: a street name inside a longer word, or half a two-word name, does not match", () => {
  setStreets(FIXTURE);
  expect(findStreets("Мирковци и Мирослав")).toEqual([]);
  expect(findStreets("ул. Борка")).toEqual([]);
  expect(findStreets("Талески")).toEqual([]);
});

test("findStreets does not take common words, municipality names or short names for a street unless ул./бул. names them", () => {
  setStreets(FIXTURE);
  expect(findStreets("Во Република Македонија, во Аеродром, мир и прва помош")).toEqual([]);
  expect(names(findStreets("ул. Македонија"))).toEqual(["Македонија/Карпош"]);
  expect(names(findStreets("улица Аеродром"))).toEqual(["Аеродром/Аеродром"]);
  expect(names(findStreets("ул. Мир, бул. Прва"))).toEqual(["Мир/Карпош", "Прва/Карпош"]);
  // "Јане Сандански" is a neighbourhood of Аеродром too (data/static/settlements.json)
  expect(findStreets("Јане Сандански")).toEqual([]);
  expect(names(findStreets("бул. Јане Сандански"))).toEqual(["Јане Сандански/Аеродром"]);
});

test("findStreets keeps the digits of a numbered street name", () => {
  setStreets(FIXTURE);
  expect(names(findStreets("ул. 11 Октомври бр. 5"))).toEqual(["11 Октомври/Центар"]);
  expect(findStreets("на 15 октомври, Октомври")).toEqual([]);
});

test("findStreets also knows a street by its name without the title or the nickname OSM adds", () => {
  setStreets({
    type: "FeatureCollection",
    features: [
      street("Народен Херој Борка Талески-Црниот", "Карпош", 21.39),
      street("Илија Димовски-Гоче", "Центар", 21.41),
      street("12-та Македонска бригада", "Центар", 21.42),
    ],
  });
  for (const text of ["ул. Борка Талески бр. 4", "Борка Талески-Црниот", "Народен херој Борка Талески Црниот", "Borka Taleski"]) {
    expect(names(findStreets(text)), text).toEqual(["Народен Херој Борка Талески-Црниот/Карпош"]);
  }
  expect(names(findStreets("ул. Илија Димовски"))).toEqual(["Илија Димовски-Гоче/Центар"]);
  expect(names(findStreets("12-та Македонска бригада"))).toEqual(["12-та Македонска бригада/Центар"]);
  expect(findStreets("Македонска бригада")).toEqual([]); // a tail of the name is not the street
  expect(findStreets("ул. Народен херој")).toEqual([]); // nor is the title alone
});

test("locateStreets takes the notice's own municipality first, a border street when only one other municipality has it, and skips an ambiguous name", () => {
  setStreets(FIXTURE);
  // two Партизанска: the notice says Карпош, so that one
  expect(names(locateStreets("ул. Партизанска бр. 3", "Карпош"))).toEqual(["Партизанска/Карпош"]);
  expect(names(locateStreets("ул. Партизанска бр. 3", "Karpoš"))).toEqual(["Партизанска/Карпош"]);
  // 11 Октомври is only in Центар: a notice filed under Карпош still means that street
  expect(names(locateStreets("ул. 11 Октомври, ул. Борка Талески", "Карпош"))).toEqual(["11 Октомври/Центар", "Борка Талески/Карпош"]);
  // Партизанска exists in two other municipalities, not in Центар: which one is unknowable
  expect(locateStreets("ул. Партизанска", "Центар")).toEqual([]);
  expect(locateStreets("нема улици", "Карпош")).toEqual([]);
});

test("findStreets is [] for empty text", () => {
  setStreets(FIXTURE);
  expect(findStreets("")).toEqual([]);
  expect(findStreets("   ,  ")).toEqual([]);
});

// --- the baked data (data/static/streets.geojson, scripts/bake-osm.ts) -----------------------------------------------------

const baked = (): StreetCollection => JSON.parse(readFileSync(new URL("../../data/static/streets.geojson", import.meta.url), "utf8")) as StreetCollection;

test("the baked street index is a MultiLineString collection with a municipality on every street, at most 6 MB", () => {
  const size = readFileSync(new URL("../../data/static/streets.geojson", import.meta.url)).length;
  expect(size).toBeLessThanOrEqual(6 * 1024 * 1024);
  const fc = baked();
  expect(fc.features.length).toBeGreaterThan(1000);
  const munis = new Set(["Центар", "Карпош", "Аеродром", "Кисела Вода", "Гази Баба", "Чаир", "Бутел", "Шуто Оризари", "Ѓорче Петров", "Сарај"]);
  for (const f of fc.features) {
    expect(f.geometry.type).toBe("MultiLineString");
    expect(f.properties.name_mk).toBeTruthy();
    expect(munis.has(f.properties.municipality_mk)).toBe(true);
  }
  // one feature per street per municipality
  const keys = fc.features.map((f) => `${streetKey(f.properties.name_mk)}|${f.properties.municipality_mk}`);
  expect(new Set(keys).size).toBe(keys.length);
});

test("findStreets on the baked data finds well-known Skopje streets and ignores the municipality name", () => {
  setStreets(baked());
  const hit = findStreets("бул. Партизански одреди бр. 12–40, Центар");
  expect(hit.length).toBeGreaterThan(0);
  expect(hit.every((f) => streetKey(f.properties.name_mk) === "партизански одреди")).toBe(true);
  expect(findStreets("Карпош Аеродром Центар Чаир")).toEqual([]);
});
