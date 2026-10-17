import type { Map as MapLibreMap } from "maplibre-gl";
import { expect, test, vi } from "vitest";
import { featureCenter, renderLayer } from "./renderLayer";

function fakeMap() {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers: { id: string; paint: Record<string, unknown> }[] = [];
  const map = {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string) => sources.set(id, { setData: vi.fn(async () => {}) }),
    addLayer: (l: { id: string; paint: Record<string, unknown> }) => layers.push(l),
  };
  return { map: map as unknown as MapLibreMap, sources, layers };
}

const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

test("first render adds the source and fill, line and circle layers; later renders only swap the data", () => {
  const { map, sources, layers } = fakeMap();
  renderLayer(map, "air", fc, "#123456");
  expect([...sources.keys()]).toEqual(["src-air"]);
  expect(layers.map((l) => l.id)).toEqual(["air-fill", "air-line", "air-circle"]);
  // Severity colours first, the layer colour as the fallback.
  expect(layers[2].paint["circle-color"]).toEqual(
    ["match", ["get", "severity"], 0, "#34c759", 1, "#ffcc00", 2, "#ff9500", 3, "#ff3b30", "#123456"],
  );

  renderLayer(map, "air", fc, "#123456");
  expect(layers).toHaveLength(3);
  expect(sources.get("src-air")!.setData).toHaveBeenCalledWith(fc);
});

test("featureCenter is a point's own position, otherwise the bbox centre", () => {
  expect(featureCenter({ type: "Point", coordinates: [21.4, 42] })).toEqual([21.4, 42]);
  expect(
    featureCenter({ type: "Polygon", coordinates: [[[21, 41], [22, 41], [22, 43], [21, 43], [21, 41]]] }),
  ).toEqual([21.5, 42]);
});
