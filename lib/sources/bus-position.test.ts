import { readdirSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { estimateAt, parseVehicles, resetVehicles, scheduleSec, tripPosition } from "./bus-position";
import { MODESHIFT_BASE, parseGtfs } from "./gtfs";

const dir = new URL("./__fixtures__/gtfs-mini/", import.meta.url);
const real = parseGtfs(Object.fromEntries(readdirSync(dir).map((f) => [f, readFileSync(new URL(f, dir), "utf8")])));
const t = (iso: string) => Date.parse(iso);
const hms = (s: string) => s.split(":").reduce((n, p) => n * 60 + Number(p), 0);

// A straight east-west line along latitude 42: stops A, B, C at lng 21.40, 21.41, 21.42 (about 826 m apart).
const SHAPE = (dist?: number[]) =>
  `shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence${dist ? ",shape_dist_traveled" : ""}\n` +
  [21.4, 21.41, 21.42].map((lng, i) => `SH,42,${lng},${i}${dist ? `,${dist[i]}` : ""}`).join("\n");
const TIMES = (dist?: number[]) =>
  `trip_id,arrival_time,departure_time,stop_id,stop_sequence${dist ? ",shape_dist_traveled" : ""}\n` +
  [["A", "10:00:00", "10:00:00"], ["B", "10:05:00", "10:06:00"], ["C", "10:10:00", "10:10:00"]].map(([s, a, d], i) => `T,${a},${d},${s},${i + 1}${dist ? `,${dist[i]}` : ""}`).join("\n");
const synth = ({ shape = SHAPE(), times = TIMES(), shapeId = "SH", stopB = "42,21.41" }: { shape?: string; times?: string; shapeId?: string; stopB?: string } = {}) =>
  parseGtfs({
    "stops.txt": `stop_id,stop_name,stop_lat,stop_lon\nA,A,42,21.40\nB,B,${stopB}\nC,C,42,21.42\n`,
    "routes.txt": "route_id,route_short_name\nR,9\n",
    "trips.txt": `route_id,service_id,trip_id,trip_headsign,shape_id\nR,S,T,Z,${shapeId}\n`,
    "stop_times.txt": times,
    "shapes.txt": shape,
    "calendar_dates.txt": "service_id,date,exception_type\nS,20261017,1\n",
  });
const at = (g: ReturnType<typeof synth>, time: string) => estimateAt(g, g.trips.get("T")!, hms(time));

test("interpolates between stops along the shape by schedule time, dwelling at stops", () => {
  const g = synth();
  expect(at(g, "10:02:30")).toMatchObject({ lat: 42, bearing: 90 }); // due east
  expect(at(g, "10:02:30").lng).toBeCloseTo(21.405, 6); // half way A → B
  expect(at(g, "10:00:00").lng).toBeCloseTo(21.4, 6);
  expect(at(g, "10:05:30").lng).toBeCloseTo(21.41, 6); // dwell at B (arrives 10:05, leaves 10:06)
  expect(at(g, "10:08:00").lng).toBeCloseTo(21.415, 6); // half way B → C
  expect(at(g, "09:00:00").lng).toBeCloseTo(21.4, 6); // not started: waits at the first stop
  expect(at(g, "11:00:00").lng).toBeCloseTo(21.42, 6); // finished: at the last stop
});

test("stops off the line are projected onto it", () => {
  const g = synth({ stopB: "42.0005,21.41" }); // 55 m north of the shape
  expect(at(g, "10:05:30").lng).toBeCloseTo(21.41, 5);
  expect(at(g, "10:05:30").lat).toBeCloseTo(42, 6); // the bus stays on the shape, not on the stop
});

test("stops keep their order along a route that comes back to where it started", () => {
  // East, north, west, then south to 8 m from the start. Stop A sits at the start but is closer to the end of the line (3 m)
  // than to its beginning (8 m): matching each stop to its nearest point on its own would put A at the end and strand B and C.
  const loop = [[21.4, 42], [21.41, 42], [21.41, 42.01], [21.4, 42.01], [21.4, 42.0001]];
  const g = parseGtfs({
    "stops.txt": "stop_id,stop_name,stop_lat,stop_lon\nA,A,42.00007,21.40\nB,B,42.005,21.41\nC,C,42.01,21.405\n",
    "routes.txt": "route_id,route_short_name\nR,9\n",
    "trips.txt": "route_id,service_id,trip_id,trip_headsign,shape_id\nR,S,T,Z,LOOP\n",
    "stop_times.txt": "trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT,10:00:00,10:00:00,A,1\nT,10:05:00,10:05:00,B,2\nT,10:10:00,10:10:00,C,3\n",
    "shapes.txt": `shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\n${loop.map(([lng, lat], i) => `LOOP,${lat},${lng},${i}`).join("\n")}`,
    "calendar_dates.txt": "service_id,date,exception_type\nS,20261017,1\n",
  });
  expect(at(g, "10:00:00")).toMatchObject({ lng: 21.4 });
  expect(at(g, "10:00:00").lat).toBeCloseTo(42, 3); // the start of the line, not its end
  expect(at(g, "10:05:00").lat).toBeCloseTo(42.005, 6);
  expect(at(g, "10:05:00").lng).toBeCloseTo(21.41, 6);
  expect(at(g, "10:10:00").lat).toBeCloseTo(42.01, 6);
  expect(at(g, "10:10:00").lng).toBeCloseTo(21.405, 6);
});

test("uses shape_dist_traveled when both the shape and the stop_times have it", () => {
  // B is declared 1.5 units along (half way to P2) while its coordinates sit on P1: only the distances can say so.
  const g = synth({ shape: SHAPE([0, 1, 2]), times: TIMES([0, 1.5, 2]) });
  expect(at(g, "10:05:30").lng).toBeCloseTo(21.415, 6); // dwell at B = distance 1.5
  expect(at(g, "10:02:30").lng).toBeCloseTo(21.4075, 6); // half way in time → distance 0.75
  // Distances on only one side are no use: back to nearest-point projection.
  const onlyShape = synth({ shape: SHAPE([0, 1, 2]) });
  expect(at(onlyShape, "10:05:30").lng).toBeCloseTo(21.41, 6);
});

test("without a usable shape the bus follows the stops in order", () => {
  for (const g of [synth({ shapeId: "" }), synth({ shapeId: "MISSING" })]) {
    expect(at(g, "10:02:30").lng).toBeCloseTo(21.405, 6);
    expect(at(g, "10:08:00").bearing).toBe(90);
  }
});

test("scheduleSec maps the clock onto a trip that runs past midnight", () => {
  const c = real.trips.get("9.603655")!; // 23:55:20 → 24:10:00
  expect(scheduleSec(c, hms("23:58:00"))).toBe(hms("23:58:00"));
  expect(scheduleSec(c, hms("00:05:00"))).toBe(hms("24:05:00")); // after midnight the trip is still on its Saturday clock
  expect(scheduleSec(c, hms("12:00:00"))).toBe(hms("12:00:00")); // far from the trip: left as is (clamped to the first stop)
  expect(scheduleSec(real.trips.get("9.603621")!, hms("00:05:00"))).toBe(hms("00:05:00"));
});

test("tripPosition on the real fixture: an estimated position between the two stops, with the trip's shape", async () => {
  const now = t("2026-10-17T07:35:00Z"); // 09:35 Saturday: between 1520 (09:33:19) and 1517 (09:36:58)
  const p = await tripPosition(real, "9.603621", now, { apiKey: "" });
  expect(p).toMatchObject({ source: "estimated", updatedAt: new Date(now).toISOString() });
  expect(p!.lng).toBeGreaterThan(21.438);
  expect(p!.lng).toBeLessThan(21.4445);
  expect(p!.lat).toBeCloseTo(41.9924, 2);
  expect(p!.bearing).toBeGreaterThanOrEqual(0);
  expect(p!.bearing).toBeLessThan(360);
  expect(p!.shape.type).toBe("LineString");
  expect(p!.shape.coordinates).toHaveLength(57);
  expect(p!.shape.coordinates[0]).toHaveLength(2);
  expect(await tripPosition(real, "no-such-trip", now, { apiKey: "" })).toBeUndefined();
});

// ---- Modeshift live positions (shape of the response is unknown: defensive parsing only) ----
const NOW = t("2026-10-17T07:35:00Z");
type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
beforeEach(() => {
  resetVehicles();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

test("a 401 from the vehicles API (no valid key) falls back to the estimate and is not retried for 30 s", async () => {
  const f = vi.fn<Fetch>(async () => new Response("", { status: 401 }));
  const p = await tripPosition(real, "9.603621", NOW, { apiKey: "wrong", fetch: f });
  expect(p?.source).toBe("estimated");
  expect(f).toHaveBeenCalledTimes(1);
  expect(f.mock.calls[0][0]).toBe(`${MODESHIFT_BASE}/vehicles`);
  expect((await tripPosition(real, "9.603621", NOW + 10_000, { apiKey: "wrong", fetch: f }))?.source).toBe("estimated");
  expect(f).toHaveBeenCalledTimes(1);
  await tripPosition(real, "9.603621", NOW + 31_000, { apiKey: "wrong", fetch: f });
  expect(f).toHaveBeenCalledTimes(2);
});

test("without a key the vehicles API is never called; with one the key goes in the request", async () => {
  const f = vi.fn<Fetch>(async () => new Response("[]"));
  await tripPosition(real, "9.603621", NOW, { fetch: f });
  await tripPosition(real, "9.603621", NOW, { apiKey: "", fetch: f });
  expect(f).not.toHaveBeenCalled();
  await tripPosition(real, "9.603621", NOW, { apiKey: "secret", fetch: f });
  expect(f).toHaveBeenCalledTimes(1);
  const headers = f.mock.calls[0][1]?.headers as Record<string, string>;
  expect(headers.Authorization).toBe("Bearer secret");
  expect(headers["X-Api-Key"]).toBe("secret");
  expect(f.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
});

test("network errors, HTML, a missing trip and stale fixes all fall back to the estimate", async () => {
  const run = async (f: () => Promise<Response>) => (await tripPosition(real, "9.603621", NOW, { apiKey: "k", fetch: vi.fn(f) }))?.source;
  expect(await run(() => Promise.reject(new Error("offline")))).toBe("estimated");
  resetVehicles();
  expect(await run(async () => new Response("<html>oops</html>"))).toBe("estimated");
  resetVehicles();
  expect(await run(async () => new Response(JSON.stringify([{ tripId: "other", latitude: 41.99, longitude: 21.43 }])))).toBe("estimated");
  resetVehicles();
  const old = [{ tripId: "9.603621", latitude: 41.99, longitude: 21.43, timestamp: NOW / 1000 - 600 }]; // 10 minutes old
  expect(await run(async () => new Response(JSON.stringify(old)))).toBe("estimated");
});

test("a fresh vehicle for the trip gives a live position", async () => {
  const body = [
    { tripId: "other", latitude: 40, longitude: 20 },
    { tripId: "9.603621", latitude: 41.9925, longitude: 21.44, bearing: 123, timestamp: NOW / 1000 - 4 },
  ];
  const p = await tripPosition(real, "9.603621", NOW, { apiKey: "k", fetch: vi.fn(async () => new Response(JSON.stringify(body))) });
  expect(p).toMatchObject({ source: "live", lng: 21.44, lat: 41.9925, bearing: 123, updatedAt: new Date(NOW - 4000).toISOString() });
  expect(p!.shape.coordinates).toHaveLength(57);
});

test("parseVehicles accepts flat lists, GTFS-realtime-style JSON and GeoJSON, and drops junk", () => {
  expect(parseVehicles(null)).toEqual([]);
  expect(parseVehicles("nope")).toEqual([]);
  expect(parseVehicles({})).toEqual([]);
  expect(parseVehicles([{ tripId: "a" }, 5, null, { lat: 999, lng: 1 }])).toEqual([]);
  expect(parseVehicles({ vehicles: [{ trip_id: "a", lat: "41.99", lon: "21.43", heading: 10, updatedAt: "2026-10-17T07:34:50Z" }] })).toEqual([
    { tripId: "a", lng: 21.43, lat: 41.99, bearing: 10, at: t("2026-10-17T07:34:50Z") },
  ]);
  expect(parseVehicles({ entity: [{ vehicle: { trip: { tripId: "b" }, position: { latitude: 41.5, longitude: 21.5, bearing: 270 }, timestamp: 1_792_000_000 } }] })).toEqual([
    { tripId: "b", lng: 21.5, lat: 41.5, bearing: 270, at: 1_792_000_000_000 },
  ]);
  expect(parseVehicles({ type: "FeatureCollection", features: [{ geometry: { type: "Point", coordinates: [21.4, 42] }, properties: { tripId: "c" } }] })).toEqual([{ tripId: "c", lng: 21.4, lat: 42 }]);
});
