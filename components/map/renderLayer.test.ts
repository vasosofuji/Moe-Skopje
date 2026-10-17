import type { Map as MapLibreMap } from "maplibre-gl";
import { expect, test, vi } from "vitest";
import { aqiPosition } from "@/lib/aqi";
import { airHeat, featureCenter, renderLayer } from "./renderLayer";

function fakeMap() {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers: { id: string; type: string; paint: Record<string, unknown>; before?: string }[] = [];
  const map = {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string) => sources.set(id, { setData: vi.fn(async () => {}) }),
    addLayer: (l: (typeof layers)[number], before?: string) => layers.push({ ...l, before }),
    getStyle: () => ({ layers: [{ id: "roads", type: "line" }, { id: "road-labels", type: "symbol" }] }),
  };
  return { map: map as unknown as MapLibreMap, sources, layers };
}

const fc = (features: GeoJSON.Feature[] = []): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });
const station = (lng: number, lat: number, value: number, detail: Record<string, string | number> = {}): GeoJSON.Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lng, lat] },
  properties: { id: `s${lng}${lat}${value}`, kind: "air-station", value, detail },
});
const same = (c: string) => c;

test("first render adds the source and fill, line and circle layers; later renders only swap the data", () => {
  const { map, sources, layers } = fakeMap();
  renderLayer(map, "pharmacies", fc(), () => "#123456");
  expect([...sources.keys()]).toEqual(["src-pharmacies"]);
  expect(layers.map((l) => l.id)).toEqual(["pharmacies-fill", "pharmacies-line", "pharmacies-circle"]);
  // Severity colours first, the layer colour as the fallback.
  expect(layers[2].paint["circle-color"]).toEqual(
    ["match", ["get", "severity"], 0, "#34c759", 1, "#ffcc00", 2, "#ff9500", 3, "#ff3b30", "#123456"],
  );

  renderLayer(map, "pharmacies", fc(), same);
  expect(layers).toHaveLength(3);
  expect(sources.get("src-pharmacies")!.setData).toHaveBeenCalledWith(fc());
});

test("air is a heat map under the street names handing over to band-coloured station circles", () => {
  const { map, layers } = fakeMap();
  renderLayer(map, "air", fc([station(21.43, 42, 30)]), same);
  expect(layers.map((l) => [l.id, l.type, l.before])).toEqual([
    ["air-heat", "heatmap", "road-labels"],
    ["air-circle", "circle", undefined],
  ]);
  expect(layers[0].paint["heatmap-weight"]).toEqual(["get", "heat"]);
  expect((layers[1].paint["circle-color"] as unknown[]).slice(0, 2)).toEqual(["match", ["get", "band"]]);
});

test("outages draw street lines and a dashed outline for municipality fallbacks, never a fill", () => {
  const { map, layers } = fakeMap();
  renderLayer(map, "outages-water", fc(), () => "#0a84ff");
  expect(layers.map((l) => [l.id, l.type])).toEqual([
    ["outages-water-line", "line"],
    ["outages-water-area", "line"],
  ]);
  expect(layers[1].paint["line-dasharray"]).toBeDefined();
});

test("parking zones read their own colour; buses are stop dots only", () => {
  const { map, sources, layers } = fakeMap();
  const zone: GeoJSON.Feature = {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [[[21, 42], [21.1, 42], [21.1, 42.1], [21, 42]]] },
    properties: { id: "parking-zone:A", detail: { zone: "A", color: "#FF3B30" } },
  };
  renderLayer(map, "parking", fc([zone]), same);
  renderLayer(map, "parking", fc([zone]), same);
  const sent = sources.get("src-parking")!.setData.mock.calls[0][0] as GeoJSON.FeatureCollection;
  expect(sent.features[0].properties?.color).toBe("#FF3B30");
  expect(layers.find((l) => l.id === "parking-fill")!.paint["fill-color"]).toEqual(["get", "color"]);

  renderLayer(map, "buses", fc(), same);
  expect(layers.filter((l) => l.id.startsWith("buses")).map((l) => l.id)).toEqual(["buses-circle"]);
});

test("airHeat: a lone station weighs its spot on the AQI scale; stations on top of each other share it", () => {
  const lone = airHeat(fc([station(21.3, 42, 30), station(21.5, 42, 15, { metric: "pm25" })]));
  expect(lone.features[0].properties).toMatchObject({ band: 1 });
  expect(lone.features[0].properties!.heat).toBeCloseTo(aqiPosition("pm10", 30), 3);
  expect(lone.features[1].properties).toMatchObject({ band: 1 }); // 15 µg/m³ PM2.5 is the second band
  expect(lone.features[1].properties!.heat).toBeCloseTo(aqiPosition("pm25", 15), 3);

  // Ten sensors on one corner add up to that corner's level, not ten times it.
  const crowd = airHeat(fc(Array.from({ length: 10 }, (_, i) => station(21.43 + i * 1e-6, 42, 30))));
  const total = crowd.features.reduce((s, f) => s + (f.properties!.heat as number), 0);
  expect(total).toBeCloseTo(aqiPosition("pm10", 30), 3);

  const line: GeoJSON.Feature = { type: "Feature", geometry: { type: "LineString", coordinates: [[21, 42], [21.1, 42]] }, properties: { id: "x" } };
  expect(airHeat(fc([line])).features[0]).toBe(line);
});

test("featureCenter is a point's own position, otherwise the bbox centre", () => {
  expect(featureCenter({ type: "Point", coordinates: [21.4, 42] })).toEqual([21.4, 42]);
  expect(
    featureCenter({ type: "Polygon", coordinates: [[[21, 41], [22, 41], [22, 43], [21, 43], [21, 41]]] }),
  ).toEqual([21.5, 42]);
});
