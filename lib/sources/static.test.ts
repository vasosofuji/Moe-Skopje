import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { parkingAdapter } from "./parking";
import { FeatureSchema } from "./types";
import { municipalities, staticAdapter, staticBuses, toLatin } from "./static";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "moe-static-"));
  const point = (osm_id: string, props: object) => ({ type: "Feature", geometry: { type: "Point", coordinates: [21.43, 42] }, properties: { osm_id, ...props } });
  await writeFile(join(dir, "bus-stops.geojson"), JSON.stringify({ type: "FeatureCollection", features: [point("node/1", { name: "Карпош", name_en: "Karposh", ref: "7" }), point("node/2", {})] }));
  await writeFile(join(dir, "bus-routes.geojson"), JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "LineString", coordinates: [[21.4, 42], [21.5, 42]] }, properties: { osm_id: "relation/9", ref: "22" } }] }));
  await writeFile(join(dir, "empty.geojson"), JSON.stringify({ type: "FeatureCollection", features: [] }));
});
afterAll(() => rm(dir, { recursive: true, force: true }));

test("staticAdapter maps OSM name / name:en to title, is static with ttl 86400, and falls back for unnamed features", async () => {
  const a = staticAdapter("buses", "bus-stops.geojson", "bus-stop", { dir });
  expect(a).toMatchObject({ id: "buses", ttl: 86400, static: true });
  const [named, unnamed] = await a.fetch();
  expect(named.properties).toMatchObject({ id: "bus-stop:node/1", kind: "bus-stop", title: { mk: "Карпош", en: "Karposh" }, detail: { ref: "7" } });
  expect(unnamed.properties.title).toEqual({ mk: "Автобуска постојка", en: "Bus stop" });
  expect(FeatureSchema.safeParse(named).success).toBe(true);
});

test("staticAdapter transliterates the title when only a Cyrillic name exists, and titleFrom picks another property", async () => {
  expect(toLatin("Ѓорче Петров")).toBe("Gjorče Petrov");
  const a = staticAdapter("buses", "bus-stops.geojson", "bus-stop", { dir, titleFrom: "ref" });
  const [stop] = await a.fetch();
  expect(stop.properties.title).toEqual({ mk: "7", en: "7" });
});

test("buses merges stops and routes; an empty baked file is a failed fetch (minFeatures)", async () => {
  const kinds = (await staticBuses({ dir }).fetch()).map((f) => f.properties.kind);
  expect(kinds).toEqual(["bus-stop", "bus-stop", "bus-route"]);
  const empty = staticAdapter("schools", "empty.geojson", "school", { dir });
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

test("baked datasets validate; parking in Центар gets the zone A price", async () => {
  const parking = await parkingAdapter().fetch();
  expect(parking.length).toBeGreaterThan(100);
  expect(parking.every((f) => FeatureSchema.safeParse(f).success)).toBe(true);
  expect(parking.find((f) => f.properties.detail?.zone === "A")?.properties.detail?.zonePrice).toBe(40);
  const buses = await staticBuses().fetch();
  expect(buses.filter((f) => f.properties.kind === "bus-stop").length).toBeGreaterThan(300);
  expect(buses.some((f) => f.properties.kind === "bus-route")).toBe(true);
});
