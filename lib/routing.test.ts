import { expect, test } from "vitest";
import { encodePolyline6 } from "../test/polyline6";
import {
  RouteBodySchema,
  activeClosures,
  bufferLine,
  crossedBy,
  decodePolyline6,
  googleMapsUrl,
  perimeterM,
  sampleWaypoints,
  wazeUrl,
  type LngLat,
} from "./routing";
import type { Feature } from "./sources/types";

const M = 111_320; // metres per degree of latitude
const dLng = (m: number, lat = 42) => m / (M * Math.cos((lat * Math.PI) / 180));
const dLat = (m: number) => m / M;

/** Even-odd point-in-ring, for asserting on buffers. */
function inside(ring: LngLat[], [x, y]: LngLat) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

// --- request validation ---------------------------------------------------------------------------------------------

const A: LngLat = [21.4254, 41.9981];
const B: LngLat = [21.3898, 42.0042];

test("RouteBodySchema accepts two points in the Skopje box and defaults the mode to auto", () => {
  expect(RouteBodySchema.parse({ from: A, to: B, mode: "bicycle" })).toEqual({ from: A, to: B, mode: "bicycle" });
  expect(RouteBodySchema.parse({ from: A, to: B }).mode).toBe("auto");
});

test("RouteBodySchema rejects a point outside 21.25,41.90,21.60,42.10 with the issue 'bbox'", () => {
  for (const far of [[21.2, 42.0], [21.65, 42.0], [21.4, 41.8], [21.4, 42.2]]) {
    const res = RouteBodySchema.safeParse({ from: A, to: far });
    expect(res.success).toBe(false);
    expect(res.error?.issues.map((i) => i.message)).toContain("bbox");
  }
  expect(RouteBodySchema.safeParse({ from: [21.25, 41.9], to: [21.6, 42.1] }).success).toBe(true); // the corners are inside
});

test("RouteBodySchema rejects malformed bodies", () => {
  const bad = [
    {},
    { from: A },
    { from: A, to: "x" },
    { from: [21.4], to: B },
    { from: [21.4, 42, 7], to: B },
    { from: [Number.NaN, 42], to: B },
    { from: ["21.4", "42"], to: B },
    { from: A, to: B, mode: "boat" },
    { from: A, to: A }, // nothing to route
  ];
  for (const body of bad) expect(RouteBodySchema.safeParse(body).success, JSON.stringify(body)).toBe(false);
});

// --- polygon buffer ---------------------------------------------------------------------------------------------------

test("bufferLine around a straight 100 m line: a closed ring that holds points within 15 m and not points 20 m away", () => {
  const line: LngLat[] = [[21.4, 42.0], [21.4 + dLng(100), 42.0]];
  const ring = bufferLine(line, 15);
  expect(ring[0]).toEqual(ring[ring.length - 1]);
  const mid = 21.4 + dLng(50);
  expect(inside(ring, [mid, 42.0 + dLat(10)])).toBe(true);
  expect(inside(ring, [mid, 42.0 - dLat(10)])).toBe(true);
  expect(inside(ring, [mid, 42.0 + dLat(20)])).toBe(false);
  expect(inside(ring, [21.4 - dLng(10), 42.0])).toBe(true); // the end caps reach 15 m past the ends
  expect(inside(ring, [21.4 + dLng(110), 42.0])).toBe(true);
  expect(inside(ring, [21.4 - dLng(20), 42.0])).toBe(false);
  expect(inside(ring, [21.4 + dLng(120), 42.0])).toBe(false);
  // ~ 2 x (100 + 30) + 2 x 30 m; the Valhalla limit is on the total perimeter
  expect(perimeterM(ring)).toBeGreaterThan(300);
  expect(perimeterM(ring)).toBeLessThan(340);
});

test("bufferLine follows a corner: the corner vertex and both legs are covered, a point well outside the corner is not", () => {
  const line: LngLat[] = [[21.4, 42.0], [21.4 + dLng(100), 42.0], [21.4 + dLng(100), 42.0 + dLat(100)]];
  const ring = bufferLine(line, 15);
  for (const p of [line[0], line[1], line[2], [21.4 + dLng(50), 42.0], [21.4 + dLng(100), 42.0 + dLat(50)]] as LngLat[]) expect(inside(ring, p)).toBe(true);
  expect(inside(ring, [21.4 + dLng(100) - dLng(40), 42.0 + dLat(40)])).toBe(false); // inside the L, away from both legs
});

test("bufferLine around a single point is an octagon-ish ring of the given radius", () => {
  const ring = bufferLine([[21.4, 42.0]], 15);
  expect(ring[0]).toEqual(ring[ring.length - 1]);
  expect(inside(ring, [21.4, 42.0])).toBe(true);
  expect(inside(ring, [21.4 + dLng(10), 42.0])).toBe(true);
  expect(inside(ring, [21.4 + dLng(20), 42.0])).toBe(false);
});

// --- exclusion set from fixture closures --------------------------------------------------------------------------------

const NOW = Date.parse("2026-10-17T10:00:00+02:00");
const line = (lng: number): GeoJSON.LineString => ({ type: "LineString", coordinates: [[lng, 42.0], [lng + 0.002, 42.001]] });
const feature = (id: string, kind: string, over: Partial<Feature["properties"]> = {}, geometry: GeoJSON.Geometry = line(21.4)): Feature => ({
  type: "Feature",
  geometry,
  properties: { id, kind, title: { mk: `мк ${id}`, en: `en ${id}` }, ...over },
});
const ids = (fs: Feature[], now = NOW) => activeClosures(fs, now).map((c) => c.id);

test("activeClosures keeps closures and regimes that are on now, with a ring per line and the bilingual title", () => {
  const out = activeClosures([feature("r1", "regime", { startsAt: "2026-10-17T08:00:00+02:00", endsAt: "2026-10-17T14:00:00+02:00" })], NOW);
  expect(out).toHaveLength(1);
  expect(out[0]).toMatchObject({ id: "r1", title: { mk: "мк r1", en: "en r1" } });
  expect(out[0].rings).toHaveLength(1);
  expect(out[0].rings[0][0]).toEqual(out[0].rings[0].at(-1));
});

test("activeClosures drops ended, not-yet-started, approximate and plain works", () => {
  const fs = [
    feature("on", "closure"), // no dates: in force
    feature("ended", "regime", { endsAt: "2026-10-17T09:00:00+02:00" }),
    feature("tomorrow", "regime", { startsAt: "2026-10-18T08:00:00+02:00", endsAt: "2026-10-18T12:00:00+02:00" }),
    feature("soon", "regime", { startsAt: "2026-10-17T10:20:00+02:00", endsAt: "2026-10-17T12:00:00+02:00" }), // within the 30 min lead
    feature("approx", "closure", { detail: { approx: 1 } }),
    feature("works", "works"),
  ];
  expect(ids(fs)).toEqual(["on", "soon"]);
});

test("activeClosures never treats utility outages (water, heating, power) as closures: the road stays open", () => {
  const outage = (id: string, type: string, detail: Record<string, string | number> = {}) =>
    feature(id, "outage", { startsAt: "2026-10-17T08:00:00+02:00", endsAt: "2026-10-17T16:00:00+02:00", detail: { type, ...detail } });
  expect(ids([outage("w", "water"), outage("h", "heating"), outage("p", "power"), outage("wa", "water", { approx: 1 })])).toEqual([]);
});

test("activeClosures turns a point into a ring around it and accepts a MultiLineString", () => {
  const point = feature("pt", "closure", {}, { type: "Point", coordinates: [21.41, 42.0] });
  const multi = feature("mu", "closure", {}, { type: "MultiLineString", coordinates: [[[21.4, 42.0], [21.401, 42.0]], [[21.41, 42.0], [21.411, 42.0]]] });
  const out = activeClosures([point, multi], NOW);
  expect(inside(out[0].rings[0], [21.41, 42.0])).toBe(true);
  expect(out[1].rings).toHaveLength(2);
});

test("crossedBy returns the closures a route runs through, including one it ends inside", () => {
  const [across, ends, away] = activeClosures(
    [feature("across", "closure", {}, { type: "LineString", coordinates: [[21.41, 41.999], [21.41, 42.001]] }), feature("ends", "closure", {}, { type: "Point", coordinates: [21.43, 42.0] }), feature("away", "closure", {}, { type: "Point", coordinates: [21.42, 42.01] })],
    NOW,
  );
  const route: LngLat[] = [[21.4, 42.0], [21.43, 42.0]];
  expect(crossedBy(route, [across, ends, away]).map((c) => c.id)).toEqual(["across", "ends"]);
});

// --- waypoint sampling ----------------------------------------------------------------------------------------------------

const FREE: LngLat[] = [[21.4, 42.0], [21.46, 42.0]];
/** North around a closure on the free route: four corners. */
const DETOUR: LngLat[] = [[21.4, 42.0], [21.42, 42.0], [21.42, 42.003], [21.44, 42.003], [21.44, 42.0], [21.46, 42.0]];

test("sampleWaypoints returns the turning points of the detour, in route order", () => {
  expect(sampleWaypoints(DETOUR, FREE)).toEqual([[21.42, 42.0], [21.42, 42.003], [21.44, 42.003], [21.44, 42.0]]);
});

test("sampleWaypoints returns nothing when the route is the free route", () => {
  expect(sampleWaypoints(FREE, FREE)).toEqual([]);
  expect(sampleWaypoints([[21.4, 42.0], [21.43, 42.00001], [21.46, 42.0]], FREE)).toEqual([]);
});

test("sampleWaypoints never returns more than 8, keeping the sharpest turns", () => {
  // a staircase of 20 right-angle turns, far from the free route
  const stairs: LngLat[] = [[21.4, 42.0]];
  for (let i = 1; i <= 20; i++) stairs.push(i % 2 ? [21.4 + 0.001 * i, 42.0 + 0.001 * (i - 1)] : [21.4 + 0.001 * (i - 1), 42.0 + 0.001 * i]);
  stairs.push([21.46, 42.0]);
  const wp = sampleWaypoints(stairs, FREE);
  expect(wp.length).toBeGreaterThan(0);
  expect(wp.length).toBeLessThanOrEqual(8);
  const order = wp.map((p) => stairs.findIndex((q) => q[0] === p[0] && q[1] === p[1]));
  expect(order.every((i) => i > 0)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
});

test("sampleWaypoints falls back to the middle of a smooth detour with no sharp turn", () => {
  const arc: LngLat[] = [];
  for (let i = 0; i <= 12; i++) arc.push([21.4 + 0.005 * i, 42.0 + 0.0035 * Math.sin((Math.PI * i) / 12)]);
  const wp = sampleWaypoints(arc, FREE);
  expect(wp).toHaveLength(1);
  expect(wp[0]).toEqual(arc[6]);
});

// --- hand-off URLs -------------------------------------------------------------------------------------------------------

test("googleMapsUrl builds the dir/?api=1 form, lat,lng order, waypoints joined by an encoded pipe", () => {
  expect(googleMapsUrl(A, B, "auto", [[21.41, 42.001], [21.4, 42.003]])).toBe(
    "https://www.google.com/maps/dir/?api=1&origin=41.9981,21.4254&destination=42.0042,21.3898&travelmode=driving&waypoints=42.001,21.41%7C42.003,21.4",
  );
});

test("googleMapsUrl maps the mode and omits waypoints when there are none", () => {
  expect(googleMapsUrl(A, B, "bicycle", [])).toBe("https://www.google.com/maps/dir/?api=1&origin=41.9981,21.4254&destination=42.0042,21.3898&travelmode=bicycling");
  expect(googleMapsUrl(A, B, "pedestrian", [])).toContain("&travelmode=walking");
});

test("wazeUrl is destination-only", () => {
  expect(wazeUrl(B)).toBe("https://waze.com/ul?ll=42.0042,21.3898&navigate=yes");
});

// --- Valhalla shape --------------------------------------------------------------------------------------------------------

test("decodePolyline6 returns [lng, lat] positions", () => {
  const pts: LngLat[] = [[21.4254, 41.9981], [21.3898, 42.0042], [21.389812, 42.004213]];
  expect(decodePolyline6(encodePolyline6(pts))).toEqual(pts);
});
