import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { parkingAdapter } from "./parking";
import { FeatureSchema } from "./types";
import { municipalities, setStaticReader, staticAdapter, staticBuses, toLatin } from "./static";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "moe-static-"));
  const point = (osm_id: string, props: object) => ({ type: "Feature", geometry: { type: "Point", coordinates: [21.43, 42] }, properties: { osm_id, ...props } });
  await writeFile(join(dir, "bus-stops.geojson"), JSON.stringify({ type: "FeatureCollection", features: [point("node/1", { name: "Карпош", name_en: "Karposh", ref: "7" }), point("node/2", {})] }));
  await writeFile(join(dir, "bus-routes.geojson"), JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "LineString", coordinates: [[21.4, 42], [21.5, 42]] }, properties: { osm_id: "relation/9", ref: "22" } }] }));
  await writeFile(join(dir, "empty.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }));
});
afterAll(() => rm(dir, { recursive: true, force: true }));
// The production read site is a fixed path (see the I4 guard in build-paths.test.ts); tests swap the whole reader instead.
const useFixtures = () => setStaticReader((file) => readFile(join(dir, file), "utf8"));
afterEach(() => setStaticReader());

test("staticAdapter maps OSM name / name:en to title, is static with ttl 86400, and falls back for unnamed features", async () => {
  useFixtures();
  const a = staticAdapter("buses", "bus-stops.geojson", "bus-stop");
  expect(a).toMatchObject({ id: "buses", ttl: 86400, static: true });
  const [named, unnamed] = await a.fetch();
  expect(named.properties).toMatchObject({ id: "bus-stop:node/1", kind: "bus-stop", title: { mk: "Карпош", en: "Karposh" }, detail: { ref: "7" } });
  expect(unnamed.properties.title).toEqual({ mk: "Автобуска постојка", en: "Bus stop" });
  expect(FeatureSchema.safeParse(named).success).toBe(true);
});

test("staticAdapter transliterates the title when only a Cyrillic name exists, and titleFrom picks another property", async () => {
  useFixtures();
  expect(toLatin("Ѓорче Петров")).toBe("Gjorče Petrov");
  const a = staticAdapter("buses", "bus-stops.geojson", "bus-stop", { titleFrom: "ref" });
  const [stop] = await a.fetch();
  expect(stop.properties.title).toEqual({ mk: "7", en: "7" });
});

test("buses merges stops and routes; an empty baked file is a failed fetch (minFeatures)", async () => {
  useFixtures();
  const kinds = (await staticBuses().fetch()).map((f) => f.properties.kind);
  expect(kinds).toEqual(["bus-stop", "bus-stop", "bus-route"]);
  const empty = staticAdapter("schools", "empty.geojson", "school");
  expect(await empty.fetch()).toHaveLength(0);
  expect(empty.minFeatures).toBe(1);
});

test("municipalities() returns exactly the 10 baked polygons", async () => {
  const fc = await municipalities();
  expect(fc.features).toHaveLength(10);
  expect(fc.features.map((f) => f.properties.name_mk).sort()).toEqual(
    ["Аеродром", "Бутел", "Гази Баба", "Карпош", "Кисела Вода", "Сарај", "Центар", "Чаир", "Шуто Оризари", "Ѓорче Петров"].sort(),
  );
  expect(fc.features.every((f) => /Polygon/.test(f.geometry.type) && f.properties.name_en)).toBe(true);
});

test("baked datasets validate; parking is the five City Parking zone polygons with colour and price", async () => {
  const parking = await parkingAdapter().fetch();
  expect(parking.map((f) => f.properties.detail?.zone)).toEqual(["A0", "A", "B", "C", "D"]);
  expect(parking.every((f) => FeatureSchema.safeParse(f).success && /Polygon/.test(f.geometry.type))).toBe(true);
  const a = parking.find((f) => f.properties.detail?.zone === "A")!;
  expect(a.properties).toMatchObject({ id: "parking-zone:A", kind: "parking-zone", title: { mk: "Црвена зона (А)", en: "Red zone (A)" }, value: 40, unit: "МКД/час", detail: { zone: "A", color: "#FF3B30" } });
  const a0 = parking.find((f) => f.properties.detail?.zone === "A0")!;
  expect(a0.properties.value).toBeUndefined(); // the price list has no A0 price
  const buses = await staticBuses().fetch();
  expect(buses.filter((f) => f.properties.kind === "bus-stop").length).toBeGreaterThan(300);
  expect(buses.some((f) => f.properties.kind === "bus-route")).toBe(true);
});

test("parkingAdapter is a static layer of the baked zone file; an empty file counts as a failed fetch", async () => {
  const a = parkingAdapter();
  expect(a).toMatchObject({ id: "parking", static: true, minFeatures: 1, source: { name: "Градски паркинг Скопје" } });
  setStaticReader(async () => JSON.stringify({ type: "FeatureCollection", features: [] }));
  expect(await a.fetch()).toEqual([]); // minFeatures 1 makes getLayer fall back
});

test("setStaticReader() with no argument goes back to the baked files", async () => {
  useFixtures();
  expect(await staticBuses().fetch()).toHaveLength(3);
  setStaticReader();
  expect((await staticBuses().fetch()).length).toBeGreaterThan(300);
});
