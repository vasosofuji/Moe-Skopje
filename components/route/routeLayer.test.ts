import type { Map as MapLibreMap } from "maplibre-gl";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { clearRoute, drawRoute, lineBounds, ROUTE_SOURCE } from "./routeLayer";

type Added = { id: string; paint: Record<string, unknown> };

function fakeMap(styleLayers: { id: string; source?: string }[] = []) {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers: Added[] = [];
  const befores: (string | undefined)[] = [];
  const map = {
    getStyle: () => ({ layers: styleLayers }),
    getSource: (id: string) => sources.get(id),
    addSource: (id: string) => sources.set(id, { setData: vi.fn(async () => {}) }),
    addLayer: (l: Added, before?: string) => (layers.push(l), befores.push(before)),
    getLayer: (id: string) => layers.find((l) => l.id === id),
    removeLayer: (id: string) => layers.splice(layers.findIndex((l) => l.id === id), 1),
    removeSource: (id: string) => sources.delete(id),
  };
  return { map: map as unknown as MapLibreMap, sources, layers, befores };
}

const line: GeoJSON.LineString = { type: "LineString", coordinates: [[21.4, 42.0], [21.41, 42.01], [21.43, 41.99]] };

beforeEach(() => {
  vi.stubGlobal("document", { documentElement: {} });
  vi.stubGlobal("getComputedStyle", () => ({ getPropertyValue: () => " #0a84ff " }));
});
afterEach(() => vi.unstubAllGlobals());

test("draws a white casing under a 5 px system-blue line, beneath the data layers", () => {
  const { map, sources, layers, befores } = fakeMap([{ id: "background" }, { id: "air-circle", source: "src-air" }]);
  drawRoute(map, line);
  expect([...sources.keys()]).toEqual([ROUTE_SOURCE]);
  expect(layers.map((l) => l.id)).toEqual(["route-casing", "route-line", "route-ends"]);
  expect(layers[0].paint).toMatchObject({ "line-color": "#ffffff", "line-width": 9 });
  expect(layers[1].paint).toMatchObject({ "line-color": "#0a84ff", "line-width": 5 });
  expect(befores).toEqual(["air-circle", "air-circle", "air-circle"]);
});

test("drawing again swaps the data, and clearing removes the layers and the source", () => {
  const { map, sources, layers } = fakeMap();
  drawRoute(map, line);
  drawRoute(map, line);
  expect(layers).toHaveLength(3);
  expect(sources.get(ROUTE_SOURCE)!.setData).toHaveBeenCalledTimes(1);
  clearRoute(map);
  expect(layers).toHaveLength(0);
  expect(sources.size).toBe(0);
  expect(() => clearRoute(map)).not.toThrow();
});

test("lineBounds is the southwest and northeast corner", () => {
  expect(lineBounds(line)).toEqual([[21.4, 41.99], [21.43, 42.01]]);
});
