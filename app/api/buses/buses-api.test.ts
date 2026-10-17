import { readdirSync, readFileSync } from "node:fs";
import { strToU8, zipSync } from "fflate";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { resetVehicles } from "@/lib/sources/bus-position";
import { resetGtfs } from "@/lib/sources/gtfs";
import { GET as stopRoute } from "./stop/[stopId]/route";
import { GET as tripRoute } from "./trip/[tripId]/route";

// The real-feed fixture served as the GTFS zip; the clock is pinned to 09:30 Saturday 17.10.2026 in Skopje (UTC+2).
const dir = new URL("../../../lib/sources/__fixtures__/gtfs-mini/", import.meta.url);
const zip = zipSync(Object.fromEntries(readdirSync(dir).map((f) => [f, strToU8(readFileSync(new URL(f, dir), "utf8"))])));
const stop = (stopId: string) => stopRoute(new Request("http://x/"), { params: Promise.resolve({ stopId }) });
const trip = (tripId: string) => tripRoute(new Request("http://x/"), { params: Promise.resolve({ tripId }) });
const up = () => vi.stubGlobal("fetch", vi.fn(async () => new Response(zip as BodyInit)));

beforeEach(() => {
  resetGtfs();
  resetVehicles();
  vi.stubEnv("MODESHIFT_API_KEY", ""); // no key: positions are estimated
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ["Date"] }).setSystemTime(Date.parse("2026-10-17T07:30:00Z"));
  up();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("GET /api/buses/stop/:id lists the next departures", async () => {
  const res = await stop("1513");
  expect(res.status).toBe(200);
  expect(res.headers.get("Cache-Control")).toMatch(/^public, s-maxage=\d+, stale-while-revalidate=\d+$/);
  expect(await res.json()).toEqual([
    { tripId: "9.603621", route: "5", headsign: "ДЕКСИОН", at: "09:40", inMin: 10 },
    { tripId: "9.603622", route: "5", headsign: "ДЕКСИОН", at: "10:12", inMin: 42 },
  ]);
  expect((await (await stop("bus-stop:1513")).json()).length).toBe(2); // the layer's feature id works too
  expect(await (await stop("1765")).json()).toEqual([]); // a real stop with nothing leaving it is an empty list, not a 404
});

test("GET /api/buses/stop/:id is 404 for a stop that is not in the feed", async () => {
  for (const id of ["999999", "", "../etc/passwd", "bus-stop:node/123"]) {
    const res = await stop(id);
    expect(res.status, id).toBe(404);
    expect(await res.json()).toEqual({ error: "unknown stop" });
  }
});

test("GET /api/buses/trip/:id returns an estimated position and the trip's shape", async () => {
  const res = await trip("9.603621");
  expect(res.status).toBe(200);
  expect(res.headers.get("Cache-Control")).toMatch(/^public, s-maxage=\d+, stale-while-revalidate=\d+$/);
  const body = await res.json();
  expect(Object.keys(body).sort()).toEqual(["bearing", "lat", "lng", "shape", "source", "updatedAt"]);
  expect(body).toMatchObject({ source: "estimated", updatedAt: "2026-10-17T07:30:00.000Z" });
  expect(body.shape.type).toBe("LineString");
  expect(body.shape.coordinates.length).toBeGreaterThan(10);
});

test("with MODESHIFT_API_KEY set the trip route sends it to the vehicles API: a fix gives a live position, a 401 an estimate", async () => {
  vi.stubEnv("MODESHIFT_API_KEY", "k");
  const fix = [{ tripId: "9.603621", latitude: 41.9925, longitude: 21.44, bearing: 200, timestamp: Date.parse("2026-10-17T07:29:55Z") / 1000 }];
  const answer = (vehicles: Response) => vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) => (url.endsWith("/vehicles") ? vehicles : new Response(zip as BodyInit)));

  const f = answer(new Response(JSON.stringify(fix)));
  vi.stubGlobal("fetch", f);
  expect(await (await trip("9.603621")).json()).toMatchObject({ source: "live", lng: 21.44, lat: 41.9925, bearing: 200, updatedAt: "2026-10-17T07:29:55.000Z" });
  const call = f.mock.calls.find(([url]) => url.endsWith("/vehicles"))!;
  expect((call[1]?.headers as Record<string, string>).Authorization).toBe("Bearer k");

  resetGtfs();
  resetVehicles();
  vi.stubGlobal("fetch", answer(new Response("", { status: 401 })));
  const res = await trip("9.603621");
  expect(res.status).toBe(200);
  expect((await res.json()).source).toBe("estimated");
});

test("GET /api/buses/trip/:id is 404 for an unknown trip", async () => {
  const res = await trip("1.2.3");
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: "unknown trip" });
});

test("both routes answer 503 (not cached) when the feed cannot be downloaded", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 502 })));
  for (const res of [await stop("1513"), await trip("9.603621")]) {
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  }
});
