import { afterEach, beforeEach, expect, test, vi } from "vitest";
import current from "./__fixtures__/pulse-current.json";
import avg from "./__fixtures__/pulse-avg.json";
import sensors from "./__fixtures__/pulse-sensor.json";
import { air, fetchPm10Trend, parseAir, resetAirCache } from "./air";
import { FeatureSchema } from "./types";
import { GET as airTrendRoute } from "@/app/api/air-trend/route";

// The fixture's newest reading is 2026-10-17T10:45:02Z.
const NOW = Date.parse("2026-10-17T11:00:00Z");
const names = new Map(sensors.map((s) => [s.sensorId, s.description]));
const reading = (sensorId: string, type: string, value: string, stamp = "2026-10-17T10:50:00Z") => ({
  sensorId,
  stamp,
  type,
  position: "41.99,21.43",
  value,
});

test("air fixture → one feature per sensor with pm data, values numeric", () => {
  const features = parseAir(current, names, NOW);
  expect(features.length).toBeGreaterThan(10);
  for (const f of features) {
    expect(() => FeatureSchema.parse(f)).not.toThrow();
    expect(Number.isFinite(f.properties.value)).toBe(true);
    expect(f.properties.unit).toBe("µg/m³");
  }
  const centar = features.find((f) => f.properties.id === "air-1000");
  expect(centar?.properties.title.en).toBe("MOEPP Centar");
  expect(centar?.properties.detail?.official).toBe(1);
  expect(features.find((f) => f.properties.id.startsWith("air-sensor_dev"))?.properties.detail?.official).toBeUndefined();
  // pulse.eco positions are "lat,lng"; GeoJSON is [lng, lat].
  const [lng, lat] = centar!.geometry.type === "Point" ? centar!.geometry.coordinates : [];
  expect([Math.round(lng), Math.round(lat)]).toEqual([21, 42]);
});

test("air ignores readings older than 3 hours", () => {
  const rows = [
    reading("a", "pm10", "30", "2026-10-17T07:00:01Z"), // 3 h minus 1 s ago
    reading("b", "pm10", "30", "2026-10-17T06:59:59Z"), // just over 3 h
  ];
  const features = parseAir(rows, new Map(), Date.parse("2026-10-17T10:00:00Z"));
  expect(features.map((f) => f.properties.id)).toEqual(["air-a"]);
});

test("air keeps the latest reading per type, drops NaN, and falls back to pm25", () => {
  const rows = [
    reading("s", "pm10", "80", "2026-10-17T10:00:00Z"),
    reading("s", "pm10", "20", "2026-10-17T10:30:00Z"),
    reading("s", "pm25", "9"),
    reading("s", "no2", "41"),
    reading("s", "noise_dba", "55"),
    reading("s", "temperature", "14"),
    reading("p", "pm25", "12"),
    reading("p", "pm10", "n/a"),
    reading("x", "pm10", ""),
    reading("y", "temperature", "10"), // no particulate data at all
  ];
  const byId = Object.fromEntries(parseAir(rows, new Map(), NOW).map((f) => [f.properties.id, f.properties]));
  expect(Object.keys(byId).sort()).toEqual(["air-p", "air-s"]);
  expect(byId["air-s"]).toMatchObject({ value: 20, severity: 0, detail: { pm10: 20, pm25: 9, no2: 41, noise: 55, temperature: 14 } });
  expect(byId["air-p"]).toMatchObject({ value: 12, severity: 0, detail: { pm25: 12, metric: "pm25" } });
  expect(byId["air-p"].detail).not.toHaveProperty("pm10");
  expect(byId["air-s"].detail).not.toHaveProperty("metric"); // PM10 stations are rated on PM10
});

test("a PM2.5-only station is rated on PM2.5 bands, not PM10 ones", () => {
  // <=10 green, <=20 yellow-green, <=25 yellow, <=50 orange, <=75 red, above purple -> severity 0, 0, 1, 2, 3, 3
  const severity = (pm25: string) => parseAir([reading("p", "pm25", pm25)], new Map(), NOW)[0].properties.severity;
  expect([5, 10, 15, 20, 21, 25, 26, 50, 51, 75, 76, 200].map((v) => severity(String(v)))).toEqual([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 3, 3]);
  // 30 ug/m3 of PM2.5 is unhealthy for sensitive groups; read as PM10 it would have been "good"
  expect(severity("30")).toBe(2);
});

test("PM10 wins when a station has both, and its severity ignores PM2.5", () => {
  const [f] = parseAir([reading("b", "pm10", "20"), reading("b", "pm25", "90")], new Map(), NOW);
  expect(f.properties).toMatchObject({ value: 20, severity: 0 });
  expect(f.properties.detail).not.toHaveProperty("metric");
});

beforeEach(() => {
  resetAirCache();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("air.fetch reads /current and caches /sensor for 24 h", async () => {
  const fetchMock = vi.fn(async (url: string | URL | Request) => Response.json(String(url).endsWith("/rest/sensor") ? sensors : current));
  vi.stubGlobal("fetch", fetchMock);
  const first = await air.fetch();
  expect(first.length).toBeGreaterThan(10);
  expect(first.find((f) => f.properties.id === "air-1000")?.properties.title.mk).toBe("MOEPP Centar");
  await air.fetch();
  const sensorCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/rest/sensor")).length;
  expect(sensorCalls()).toBe(1);
  vi.setSystemTime(NOW + 24 * 3600_000 + 1000);
  await air.fetch();
  expect(sensorCalls()).toBe(2);
});

test("air.fetch rejects when pulse.eco is down", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
  await expect(air.fetch()).rejects.toThrow(/503/);
});

test("fetchPm10Trend returns the daily city averages with their Skopje dates, oldest first", async () => {
  const fetchMock = vi.fn<typeof fetch>(async () => Response.json(avg));
  vi.stubGlobal("fetch", fetchMock);
  const trend = await fetchPm10Trend();
  expect(trend.map((p) => p.value)).toEqual([17, 9, 4, 5, 5, 8, 10]);
  expect(trend[0].date).toBe("2026-10-10");
  expect(trend.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date))).toBe(true);
  expect(String(fetchMock.mock.calls[0][0])).toContain(
    "/rest/avgData/day?sensorId=-1&type=pm10&from=2026-10-10T11:00:00Z&to=2026-10-17T11:00:00Z",
  );
});

test("GET /api/air-trend is cached for 10 minutes on success and 1 minute on a 502", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(avg)));
  const ok = await airTrendRoute();
  expect(ok.status).toBe(200);
  expect(ok.headers.get("cache-control")).toBe("public, s-maxage=600, stale-while-revalidate=6000");
  expect(((await ok.json()) as { date: string; value: number }[]).map((p) => p.value)).toEqual([17, 9, 4, 5, 5, 8, 10]);

  vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 503 })));
  const down = await airTrendRoute();
  expect(down.status).toBe(502);
  expect(down.headers.get("cache-control")).toBe("public, s-maxage=60");
  expect(await down.json()).toEqual([]);
});

test("parseAir drops sensors outside the Skopje box, all-zero readings and non-finite values", () => {
  const at = (id: string, position: string, pm10: string, pm25: string) => [
    { ...reading(id, "pm10", pm10), position },
    { ...reading(id, "pm25", pm25), position },
  ];
  const ids = parseAir(
    [
      ...current,
      ...at("belgium", "50.854,2.86", "5", "3"), // a community sensor with a wrong position
      ...at("dead", "41.99,21.43", "0", "0"),
      ...at("nan", "41.99,21.43", "n/a", "n/a"),
      ...at("edge", "42.1,21.25", "7", "4"), // on the box edge: kept
    ],
    names,
    NOW,
  ).map((f) => f.properties.id);
  expect(ids).not.toContain("air-belgium");
  expect(ids).not.toContain("air-dead");
  expect(ids).not.toContain("air-nan");
  expect(ids).toContain("air-edge");
  for (const f of parseAir(current, names, NOW)) {
    const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
    expect(lng).toBeGreaterThanOrEqual(21.25);
    expect(lng).toBeLessThanOrEqual(21.6);
    expect(lat).toBeGreaterThanOrEqual(41.9);
    expect(lat).toBeLessThanOrEqual(42.1);
    expect(Number(f.properties.detail?.pm10 ?? 0) > 0 || Number(f.properties.detail?.pm25 ?? 0) > 0).toBe(true);
  }
});
