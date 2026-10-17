import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { LayerId } from "@/lib/layers";
import type { LayerResponse } from "@/lib/sources/types";
import type { Feature } from "@/lib/sources/types";
import { encodePolyline6 } from "../../test/polyline6";
import { ROUTE_PER_IP, ROUTE_PER_MINUTE, allowRoute, handleRoute, resetRouteLimits } from "./route";

const NOW = Date.parse("2026-10-17T10:00:00+02:00");
const FROM: [number, number] = [21.4, 42.0];
const TO: [number, number] = [21.46, 42.0];
const FREE: [number, number][] = [FROM, TO];
/** North around the closure at 21.43. */
const DETOUR: [number, number][] = [FROM, [21.42, 42.0], [21.42, 42.003], [21.44, 42.003], [21.44, 42.0], TO];

const closure = (id: string, over: Partial<Feature["properties"]> = {}, geometry: GeoJSON.Geometry = { type: "LineString", coordinates: [[21.43, 41.999], [21.43, 42.001]] }): Feature => ({
  type: "Feature",
  geometry,
  properties: { id, kind: "regime", title: { mk: `мк ${id}`, en: `en ${id}` }, startsAt: "2026-10-17T08:00:00+02:00", endsAt: "2026-10-17T14:00:00+02:00", ...over },
});

const layerOf = (features: Feature[], status: LayerResponse["status"] = "live") =>
  async (id: LayerId): Promise<LayerResponse> => ({ id, status, updatedAt: "", source: { name: "", url: "" }, features: { type: "FeatureCollection", features: id === "roadworks" ? features : [] } });

const valhalla = (points: [number, number][], km = 3.2, s = 410) => Response.json({ trip: { summary: { length: km, time: s }, legs: [{ shape: encodePolyline6(points) }] } });

/** What we send upstream, as far as these tests look at it. */
type Sent = { costing?: string; exclude_polygons?: number[][][]; options: { avoid_polygons: { type: string; coordinates: unknown[] } } };

/** Answers each upstream call with the next reply; records [url, init, body]. */
function upstream(...replies: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit; body: Sent }[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {}, body: JSON.parse(String(init?.body)) });
    const reply = replies[calls.length - 1] ?? replies[replies.length - 1];
    if (reply instanceof Error) throw reply;
    return reply.clone();
  }) as unknown as typeof globalThis.fetch;
  return { calls, fetch };
}

const request = (body: unknown, ip = "203.0.113.7") =>
  new Request("http://localhost/api/route", { method: "POST", headers: { "x-real-ip": ip }, body: typeof body === "string" ? body : JSON.stringify(body) });
const deps = (fetch: typeof globalThis.fetch, features: Feature[] = []) => ({ fetch, now: () => NOW, layer: layerOf(features), gapMs: 0, sleep: async () => {} });
const body = { from: FROM, to: TO, mode: "auto" };

beforeEach(() => resetRouteLimits());
afterEach(() => vi.unstubAllEnvs());

// --- happy paths ------------------------------------------------------------------------------------------------------------------

test("no closures: one Valhalla call, the route as it is, a plain Google link and a Waze link", async () => {
  const up = upstream(valhalla(FREE));
  const res = await handleRoute(request(body), deps(up.fetch));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({
    geometry: { type: "LineString", coordinates: [[21.4, 42], [21.46, 42]] },
    distanceM: 3200,
    durationS: 410,
    detourM: 0,
    avoided: [],
    unavoidable: [],
    googleMapsUrl: "https://www.google.com/maps/dir/?api=1&origin=42,21.4&destination=42,21.46&travelmode=driving",
    wazeUrl: "https://waze.com/ul?ll=42,21.46&navigate=yes",
    wazeDestinationOnly: true,
    provider: "valhalla",
  });
  expect(up.calls).toHaveLength(1);
  expect(up.calls[0].url).toBe("https://valhalla1.openstreetmap.de/route");
  expect(up.calls[0].body).toEqual({ locations: [{ lon: 21.4, lat: 42 }, { lon: 21.46, lat: 42 }], costing: "auto", directions_type: "none" });
  const headers = up.calls[0].init.headers as Record<string, string>;
  expect(headers["User-Agent"]).toMatch(/^MoeSkopje\/1\.0 /); // an identifying agent, as the FOSSGIS terms ask
});

test("a closure on the route: a second call excludes it, the detour is returned with waypoints for Google", async () => {
  const up = upstream(valhalla(FREE, 3.2, 410), valhalla(DETOUR, 4.1, 520));
  const res = await handleRoute(request({ ...body, mode: "bicycle" }), deps(up.fetch, [closure("r1")]));
  const out = await res.json();
  expect(res.status).toBe(200);
  expect(up.calls).toHaveLength(2);
  expect(up.calls[0].body.exclude_polygons).toBeUndefined();
  expect(up.calls[1].body).toMatchObject({ costing: "bicycle" });
  const rings = up.calls[1].body.exclude_polygons!;
  expect(rings).toHaveLength(1);
  expect(rings[0][0]).toEqual(rings[0].at(-1)); // closed
  const xs = rings[0].map((p) => p[0]);
  const ys = rings[0].map((p) => p[1]);
  expect([Math.min(...xs) < 21.43, Math.max(...xs) > 21.43, Math.min(...ys) < 41.999, Math.max(...ys) > 42.001]).toEqual([true, true, true, true]); // around the closure, about 15 m wider
  expect(out).toMatchObject({
    avoided: [{ id: "r1", title: { mk: "мк r1", en: "en r1" } }],
    unavoidable: [],
    distanceM: 4100,
    durationS: 520,
    detourM: 900,
    provider: "valhalla",
    wazeUrl: "https://waze.com/ul?ll=42,21.46&navigate=yes",
    wazeDestinationOnly: true,
    googleMapsUrl: "https://www.google.com/maps/dir/?api=1&origin=42,21.4&destination=42,21.46&travelmode=bicycling&waypoints=42,21.42%7C42.003,21.42%7C42.003,21.44%7C42,21.44",
  });
});

test("a closure the free route does not touch costs no second call and is not reported", async () => {
  const up = upstream(valhalla(FREE));
  const far = closure("far", {}, { type: "LineString", coordinates: [[21.43, 42.01], [21.43, 42.012]] });
  const out = await (await handleRoute(request(body), deps(up.fetch, [far]))).json();
  expect(up.calls).toHaveLength(1);
  expect(out.avoided).toEqual([]);
});

test("closures that are over, not started, or on demo data are ignored", async () => {
  const features = [closure("over", { endsAt: "2026-10-17T09:00:00+02:00" }), closure("later", { startsAt: "2026-10-18T08:00:00+02:00", endsAt: "2026-10-18T12:00:00+02:00" })];
  const up = upstream(valhalla(FREE));
  await handleRoute(request(body), deps(up.fetch, features));
  expect(up.calls).toHaveLength(1);

  const demo = upstream(valhalla(FREE));
  await handleRoute(request(body), { ...deps(demo.fetch), layer: layerOf([closure("demo")], "offline") });
  expect(demo.calls).toHaveLength(1); // a closure from seed data is never detoured around
});

test("only the roadworks layer is asked for closures: water and heating outages do not close a road", async () => {
  const asked: string[] = [];
  const layer = async (id: LayerId) => (asked.push(id), layerOf([])(id));
  await handleRoute(request(body), { ...deps(upstream(valhalla(FREE)).fetch), layer });
  expect(asked).toEqual(["roadworks"]);
});

test("no way around the closure: the free route comes back with the closure listed as unavoidable", async () => {
  const up = upstream(valhalla(FREE), Response.json({ error_code: 442, error: "No path could be found for input" }, { status: 400 }));
  const res = await handleRoute(request(body), deps(up.fetch, [closure("r1")]));
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ avoided: [], unavoidable: [{ id: "r1" }], distanceM: 3200, detourM: 0 });
});

test("spaces the two upstream calls by more than a second (FOSSGIS: one request per second)", async () => {
  const sleep = vi.fn(async () => {});
  const up = upstream(valhalla(FREE), valhalla(DETOUR));
  await handleRoute(request(body), { fetch: up.fetch, now: () => NOW, layer: layerOf([closure("r1")]), gapMs: 1100, sleep });
  expect(sleep.mock.calls).toEqual([[1100]]); // the first call goes straight out, the second waits
});

test("a full queue refuses the request instead of letting it time out", async () => {
  const waiting: (() => void)[] = [];
  const sleep = () => new Promise<void>((resolve) => waiting.push(resolve));
  const up = upstream(valhalla(FREE));
  const answers: number[] = [];
  const all = Array.from({ length: 7 }, (_, i) =>
    handleRoute(request(body, `198.51.100.${i}`), { fetch: up.fetch, now: () => NOW, layer: layerOf([]), gapMs: 1100, sleep }).then((r) => void answers.push(r.status)),
  );
  await new Promise((r) => setTimeout(r, 10));
  // the first request goes straight out, four wait for their turn, the rest are turned away at once
  expect(answers.filter((s) => s === 429).length).toBeGreaterThanOrEqual(2);
  while (waiting.length) {
    waiting.shift()!();
    await new Promise((r) => setTimeout(r, 0));
  }
  await Promise.all(all);
  expect(answers.filter((s) => s === 200).length).toBeGreaterThanOrEqual(4);
  expect(answers.every((s) => s === 200 || s === 429)).toBe(true);
});

// --- errors ---------------------------------------------------------------------------------------------------------------------------

test("a malformed body is 400 input; a point outside the Skopje box is 400 bbox; neither reaches the router", async () => {
  const up = upstream(valhalla(FREE));
  for (const bad of ["not json", {}, { from: FROM }, { from: FROM, to: TO, mode: "boat" }, { from: FROM, to: FROM }]) {
    const res = await handleRoute(request(bad), deps(up.fetch));
    expect([res.status, (await res.json()).code]).toEqual([400, "input"]);
  }
  for (const far of [[21.7, 42.0], [21.4, 41.5]]) {
    const res = await handleRoute(request({ from: FROM, to: far }), deps(up.fetch));
    expect([res.status, (await res.json()).code]).toEqual([400, "bbox"]);
  }
  expect(up.calls).toHaveLength(0);
});

test("a router that is down is 502 router; a route that does not exist is 404 noroute", async () => {
  expect(await (await handleRoute(request(body), deps(upstream(new Error("boom")).fetch))).json()).toEqual({ code: "router" });
  const down = await handleRoute(request(body), deps(upstream(new Response("busy", { status: 503 })).fetch));
  expect(down.status).toBe(502);
  const garbled = await handleRoute(request(body), deps(upstream(Response.json({ hello: "world" })).fetch));
  expect(garbled.status).toBe(502);
  const none = await handleRoute(request(body), deps(upstream(Response.json({ error_code: 171 }, { status: 400 })).fetch));
  expect([none.status, (await none.json()).code]).toEqual([404, "noroute"]);
});

test("with ORS_API_KEY, OpenRouteService answers when Valhalla is down, and gets the exclusion polygons", async () => {
  vi.stubEnv("ORS_API_KEY", "test-key");
  const ors = (coordinates: number[][], distance: number) => Response.json({ features: [{ geometry: { type: "LineString", coordinates }, properties: { summary: { distance, duration: 600 } } }] });
  const up = upstream(new Response("down", { status: 503 }), ors(FREE, 3300), ors(DETOUR, 4300));
  const res = await handleRoute(request(body), deps(up.fetch, [closure("r1")]));
  const out = await res.json();
  expect(res.status).toBe(200);
  expect(up.calls.map((c) => c.url)).toEqual([
    "https://valhalla1.openstreetmap.de/route",
    "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
    "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
  ]);
  expect((up.calls[1].init.headers as Record<string, string>).Authorization).toBe("test-key");
  expect(up.calls[1].body).toEqual({ coordinates: [FROM, TO] });
  expect(up.calls[2].body.options.avoid_polygons).toMatchObject({ type: "MultiPolygon" });
  expect(up.calls[2].body.options.avoid_polygons.coordinates).toHaveLength(1);
  expect(out).toMatchObject({ provider: "ors", distanceM: 4300, durationS: 600, avoided: [{ id: "r1" }] });
});

test("without ORS_API_KEY a Valhalla failure is the end of it", async () => {
  const up = upstream(new Response("down", { status: 503 }));
  expect((await handleRoute(request(body), deps(up.fetch))).status).toBe(502);
  expect(up.calls).toHaveLength(1);
});

// --- rate limits ----------------------------------------------------------------------------------------------------------------------

test("allowRoute: 30 per IP in 10 minutes, then it frees up", () => {
  expect(ROUTE_PER_IP).toBe(30);
  for (let i = 0; i < 30; i++) expect(allowRoute("1.1.1.1", NOW + i)).toBe(true);
  expect(allowRoute("1.1.1.1", NOW + 31)).toBe(false);
  expect(allowRoute("2.2.2.2", NOW + 31)).toBe(true); // another address
  expect(allowRoute("1.1.1.1", NOW + 9 * 60_000)).toBe(false);
  expect(allowRoute("1.1.1.1", NOW + 10 * 60_000 + 1)).toBe(true);
});

test("allowRoute: 120 a minute across all addresses, and a refused request is not counted", () => {
  expect(ROUTE_PER_MINUTE).toBe(120);
  for (let i = 0; i < 120; i++) expect(allowRoute(`10.0.0.${i}`, NOW + i)).toBe(true);
  expect(allowRoute("10.9.9.9", NOW + 500)).toBe(false);
  expect(allowRoute("10.9.9.9", NOW + 60_001)).toBe(true); // a minute later
});

test("the handler answers 429 rate once the IP is over its quota, before the router is asked", async () => {
  const up = upstream(valhalla(FREE));
  for (let i = 0; i < 30; i++) expect((await handleRoute(request(body), deps(up.fetch))).status).toBe(200);
  const res = await handleRoute(request(body), deps(up.fetch));
  expect([res.status, (await res.json()).code]).toEqual([429, "rate"]);
  expect(up.calls).toHaveLength(30);
});
