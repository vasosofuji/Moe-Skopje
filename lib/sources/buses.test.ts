import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { buses, busesAdapter, stopFeatures } from "./buses";
import { parseGtfs } from "./gtfs";
import { registry } from "./registry";
import { FeatureSchema } from "./types";

const dir = new URL("./__fixtures__/gtfs-mini/", import.meta.url);
const g = parseGtfs(Object.fromEntries(readdirSync(dir).map((f) => [f, readFileSync(new URL(f, dir), "utf8")])));
const SAT = Date.parse("2026-10-17T07:30:00Z"); // 09:30 Saturday in Skopje

test("stopFeatures: one point per GTFS stop, title = stop_name, detail.lines = today's route short names, no route lines", () => {
  const features = stopFeatures(g, SAT);
  expect(features).toHaveLength(27);
  expect(features.every((f) => FeatureSchema.safeParse(f).success)).toBe(true);
  expect(new Set(features.map((f) => f.properties.kind))).toEqual(new Set(["bus-stop"]));
  expect(features.find((f) => f.properties.id === "bus-stop:1513")).toEqual({
    type: "Feature",
    geometry: { type: "Point", coordinates: [21.430099, 41.994781] },
    properties: {
      id: "bus-stop:1513",
      kind: "bus-stop",
      title: { mk: "ЦЕНТАР РЕКОРД-КОН ЗАПАД", en: "CENTAR REKORD-KON ZAPAD" },
      detail: { stopId: "1513", code: "1", lines: "5" },
    },
  });
  expect(features.find((f) => f.properties.id === "bus-stop:1765")?.properties.detail?.lines).toBeUndefined(); // terminus: no boarding
  // The lines are today's: on Monday only line 7 runs.
  const monday = stopFeatures(g, Date.parse("2026-10-19T07:30:00Z"));
  expect(monday.find((f) => f.properties.id === "bus-stop:1513")?.properties.detail?.lines).toBe("7");
});

test("the adapter lists GTFS stops; a failed download rejects so getLayer can use the snapshot or the OSM seed", async () => {
  const adapter = busesAdapter({ load: async () => g, now: () => SAT });
  expect(adapter).toMatchObject({ id: "buses", minFeatures: 100 });
  expect(adapter.static).toBeUndefined(); // live data: the layer is "live", never "static"
  expect(await adapter.fetch()).toHaveLength(27);
  const down = busesAdapter({ load: async () => Promise.reject(new Error("gtfs down")) });
  await expect(down.fetch()).rejects.toThrow("gtfs down");
});

test("the seed is the baked OSM stops: points only, valid, with no GTFS stop id to ask departures for", async () => {
  const seed = await busesAdapter({ load: async () => g }).seed();
  expect(seed.length).toBeGreaterThan(300);
  expect(seed.every((f) => f.properties.kind === "bus-stop" && f.geometry.type === "Point")).toBe(true);
  expect(seed.every((f) => FeatureSchema.safeParse(f).success)).toBe(true);
  expect(seed.some((f) => f.properties.detail?.stopId !== undefined)).toBe(false);
});

test("the registry serves the GTFS buses adapter", () => {
  expect(registry.buses).toBe(buses);
});

test("the buses layer waits up to 20 s for a cold GTFS load (getLayer would give up at 8 s)", () => {
  expect(buses.timeoutMs).toBe(20_000);
});
