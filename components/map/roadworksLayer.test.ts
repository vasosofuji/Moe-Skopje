import type { Map as MapLibreMap } from "maplibre-gl";
import { expect, test, vi } from "vitest";
import { renderRoadworks } from "./roadworksLayer";

type Added = { id: string; type: string; filter?: unknown; paint?: Record<string, unknown>; layout?: Record<string, unknown> };

function fakeMap() {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers: Added[] = [];
  const map = {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string) => sources.set(id, { setData: vi.fn(async () => {}) }),
    addLayer: (l: Added) => layers.push(l),
    hasImage: () => true, // the glyph is drawn on a canvas, which node has none of
    addImage: vi.fn(),
  };
  return { map: map as unknown as MapLibreMap, sources, layers };
}

const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

test("closures are thick dashed lines, works thinner solid lines, regimes dots with a glyph", () => {
  const { map, sources, layers } = fakeMap();
  renderRoadworks(map, "roadworks", fc, "#ff6a13");
  expect([...sources.keys()]).toEqual(["src-roadworks"]);
  const by = Object.fromEntries(layers.map((l) => [l.id, l]));
  expect(Object.keys(by)).toEqual(["roadworks-works", "roadworks-line", "roadworks-fill", "roadworks-circle", "roadworks-glyph"]);

  expect(by["roadworks-line"].paint).toMatchObject({ "line-color": "#ff6a13", "line-width": 4, "line-dasharray": [2, 1.5] });
  expect(by["roadworks-works"].paint).not.toHaveProperty("line-dasharray");
  expect(by["roadworks-works"].paint!["line-width"]).toBeLessThan(4);
  expect(JSON.stringify(by["roadworks-line"].filter)).toContain('"closure"');
  expect(JSON.stringify(by["roadworks-works"].filter)).toContain("!=");
  expect(by["roadworks-circle"].type).toBe("circle");
  expect(JSON.stringify(by["roadworks-glyph"].filter)).toContain('"regime"');
  // MapView's hit test reads `<layer>-circle` and `<layer>-fill`: the invisible wide line is what makes thin lines tappable.
  expect(by["roadworks-fill"].paint).toMatchObject({ "line-opacity": 0, "line-width": 20 });
});

test("a second render only swaps the data", () => {
  const { map, sources, layers } = fakeMap();
  renderRoadworks(map, "roadworks", fc, "#ff6a13");
  const count = layers.length;
  renderRoadworks(map, "roadworks", fc, "#ff6a13");
  expect(layers).toHaveLength(count);
  expect(sources.get("src-roadworks")!.setData).toHaveBeenCalledWith(fc);
});
