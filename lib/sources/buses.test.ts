import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test, vi } from "vitest";
import { timetable } from "./bus-timetable";
import { buses, busesAdapter, nextDepartures, stopLines } from "./buses";
import { registry } from "./registry";
import { toFeature } from "./static";
import { FeatureSchema, type Adapter, type Feature } from "./types";

// 1 degree of latitude is about 111 195 m, so 0.00018 deg is 20 m and 0.00045 deg is 50 m.
const stop = (id: string, lng: number, lat: number): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lng, lat] },
  properties: { id, kind: "bus-stop", title: { mk: id, en: id } },
});
const route = (ref: string | undefined, geometry: GeoJSON.Geometry): Feature => ({
  type: "Feature",
  geometry,
  properties: { id: `bus-route:${ref}`, kind: "bus-route", title: { mk: `Линија ${ref}`, en: `Line ${ref}` }, ...(ref ? { detail: { ref } } : {}) },
});
const east = (ref: string | undefined) => route(ref, { type: "LineString", coordinates: [[21.4, 42], [21.41, 42]] });
const hangs = () => new Promise<Response>(() => {});
const base = (features: Feature[], ttl = 86400): Adapter => ({ id: "buses", ttl, static: true, minFeatures: 1, source: { name: "OSM", url: "" }, fetch: async () => features, seed: async () => [] });

test("nextDepartures respects headway and service hours", () => {
  // Pin the seed line the assertions below rely on.
  expect(timetable["2"]).toMatchObject({ headwayMin: 10, firstAt: "05:00", lastAt: "23:00" });
  const at = (iso: string, n?: number) => nextDepartures("bus-stop:x", new Date(iso), n, ["2"]).map((d) => d.at);

  // Winter (+01:00) and summer (+02:00) both land on Skopje wall-clock time, whatever the server's zone.
  expect(at("2026-01-15T22:55:00+01:00")).toEqual(["23:00"]); // last departure only, nothing wraps to tomorrow
  expect(at("2026-07-15T22:55:00+02:00")).toEqual(["23:00"]);
  expect(at("2026-07-15T20:55:00Z")).toEqual(["23:00"]); // 20:55 UTC is 22:55 Skopje
  expect(at("2026-07-15T21:55:00Z")).toEqual([]); // 21:55 UTC is 23:55 Skopje: service is over
  expect(at("2026-07-15T04:00:00+02:00")).toEqual(["05:00", "05:10", "05:20"]); // before service: first three
  expect(at("2026-07-15T12:01:00+02:00")).toEqual(["12:10", "12:20", "12:30"]);
  expect(at("2026-07-15T12:10:00+02:00", 1)).toEqual(["12:10"]); // a departure in this very minute still counts
  expect(at("2026-07-15T23:30:00+02:00")).toEqual([]);
});

test("nextDepartures merges lines by time, ignores unknown lines, and returns [] for an unregistered stop", () => {
  const now = new Date("2026-07-15T04:00:00+02:00");
  expect(nextDepartures("bus-stop:x", now, 3, ["5", "2", "999"])).toEqual([
    { line: "5", at: "05:00" },
    { line: "2", at: "05:00" },
    { line: "5", at: "05:08" },
  ]);
  expect(nextDepartures("bus-stop:never-registered", now)).toEqual([]);
});

test("the seed timetable has 10 well-formed approximate lines that exist in the baked routes", async () => {
  const entries = Object.entries(timetable);
  expect(entries).toHaveLength(10);
  const routes = JSON.parse(await readFile(join(process.cwd(), "data", "static", "bus-routes.geojson"), "utf8")) as GeoJSON.FeatureCollection;
  const refs = new Set(routes.features.map((f) => f.properties?.ref));
  for (const [line, t] of entries) {
    expect(refs.has(line), `line ${line} is in bus-routes.geojson`).toBe(true);
    expect(t.note).toBe("approximate");
    expect(t.headwayMin).toBeGreaterThan(0);
    expect(t.firstAt).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    expect(t.lastAt).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    expect(t.firstAt < t.lastAt).toBe(true);
  }
});

test("stopLines snaps stops within maxM of a route's geometry, deduplicates and sorts the refs", () => {
  const stops = [
    stop("near", 21.405, 42.00018), // 20 m north of the line
    stop("far", 21.405, 42.00045), // 50 m
    stop("end", 21.4101, 42), // about 8 m past the end of the line
    stop("past", 21.4105, 42), // about 41 m past it
    stop("multi", 21.505, 42.00018),
  ];
  const routes = [
    east("15"),
    east("2"),
    east("15"), // the other direction of the same line
    east("2A"),
    east(undefined), // no ref: ignored
    route("9", { type: "MultiLineString", coordinates: [[[21.4, 42], [21.401, 42]], [[21.5, 42], [21.51, 42]]] }),
  ];
  const lines = stopLines(stops, routes);
  expect(lines.get("near")).toEqual(["2", "2A", "15"]); // natural order, no duplicates
  expect(lines.has("far")).toBe(false);
  expect(lines.get("end")).toEqual(["2", "2A", "15"]);
  expect(lines.has("past")).toBe(false);
  expect(lines.get("multi")).toEqual(["9"]); // second part of the MultiLineString
  expect(stopLines([stops[1]], routes, 60).get("far")).toEqual(["2", "2A", "15"]); // wider threshold
});

test("stopLines on the baked Skopje data finds lines for most stops, including the busiest seeded lines", async () => {
  const read = async (file: string) => (JSON.parse(await readFile(join(process.cwd(), "data", "static", file), "utf8")) as GeoJSON.FeatureCollection).features;
  const stops = (await read("bus-stops.geojson")).map((f) => toFeature(f, "bus-stop"));
  const routes = (await read("bus-routes.geojson")).map((f) => toFeature(f, "bus-route"));
  const lines = stopLines(stops, routes);
  expect(lines.size).toBeGreaterThan(stops.length / 2);
  const served = new Set([...lines.values()].flat());
  for (const line of Object.keys(timetable)) expect(served.has(line), `line ${line} serves some stop`).toBe(true);
});

test("the buses adapter adds detail.lines to snapped stops and stays static", async () => {
  const adapter = busesAdapter({ base: base([stop("bus-stop:a", 21.405, 42.00018), stop("bus-stop:b", 21.405, 42.01), east("2"), east("15")]), probe: hangs });
  expect(adapter).toMatchObject({ id: "buses", ttl: 86400, static: true, minFeatures: 1 });
  const out = await adapter.fetch();
  expect(out.find((f) => f.properties.id === "bus-stop:a")?.properties.detail).toEqual({ lines: "2,15" });
  expect(out.find((f) => f.properties.id === "bus-stop:b")?.properties.detail).toBeUndefined();
  expect(out.every((f) => FeatureSchema.safeParse(f).success)).toBe(true);
  // The 3-argument form finds the lines the adapter registered.
  expect(nextDepartures("bus-stop:a", new Date("2026-07-15T04:00:00+02:00"), 1)).toEqual([{ line: "2", at: "05:00" }]);
});

test("the JSP probe never delays fetch, runs at most once per ttl, and records reachability", async () => {
  let t = 0;
  const probe = vi.fn((url: string, init: RequestInit) => {
    void url;
    void init;
    return hangs(); // JSP hangs: fetch() must not wait for it
  });
  const adapter = busesAdapter({ base: base([stop("bus-stop:a", 21.4, 42)], 100), probe, now: () => t });
  await adapter.fetch();
  await adapter.fetch();
  expect(probe).toHaveBeenCalledTimes(1);
  expect(probe.mock.calls[0][0]).toBe("http://jsp.com.mk/");
  expect(probe.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  expect(adapter.jspReachable()).toBeNull(); // still waiting
  t = 100_000; // one ttl later
  await adapter.fetch();
  expect(probe).toHaveBeenCalledTimes(2);

  const up = busesAdapter({ base: base([stop("bus-stop:a", 21.4, 42)]), probe: async () => new Response("ok") });
  await up.fetch();
  await vi.waitFor(() => expect(up.jspReachable()).toBe(true));
  const down = busesAdapter({ base: base([stop("bus-stop:a", 21.4, 42)]), probe: () => Promise.reject(new Error("TLS")) });
  await down.fetch();
  await vi.waitFor(() => expect(down.jspReachable()).toBe(false));
  expect(up.static).toBe(true); // reachable or not, no live data is parsed yet: the status stays static
});

test("the registry serves the wrapped buses adapter", () => {
  expect(registry.buses).toBe(buses);
});
