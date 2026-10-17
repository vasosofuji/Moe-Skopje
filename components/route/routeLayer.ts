import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";

export const ROUTE_SOURCE = "route-src";
export const ROUTE_LAYERS = ["route-ends", "route-line", "route-casing"] as const;

/** MapLibre cannot read CSS variables, so resolve the system blue (it differs between light and dark) when drawing. */
const systemBlue = () => getComputedStyle(document.documentElement).getPropertyValue("--system-blue").trim() || "#007aff";

const point = (coordinates: number[], end: 0 | 1): GeoJSON.Feature => ({ type: "Feature", geometry: { type: "Point", coordinates }, properties: { end } });

/**
 * Draws the route in its own source and layers: a white casing, the system-blue line (5 px) and a dot at each end.
 * Calling it again swaps the data; after a theme switch (the style reload drops sources) it adds everything again.
 * The layers go under the data layers (`src-*`) already on the map, so markers stay tappable on top of the line.
 */
export function drawRoute(map: MapLibreMap, line: GeoJSON.LineString): void {
  const fc: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [{ type: "Feature", geometry: line, properties: {} }, point(line.coordinates[0], 0), point(line.coordinates[line.coordinates.length - 1], 1)],
  };
  const existing = map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined;
  if (existing) {
    void existing.setData(fc);
    return;
  }
  const blue = systemBlue();
  const before = map.getStyle().layers.find((l) => (l as { source?: string }).source?.startsWith("src-"))?.id;
  map.addSource(ROUTE_SOURCE, { type: "geojson", data: fc });
  map.addLayer(
    {
      id: "route-casing",
      type: "line",
      source: ROUTE_SOURCE,
      filter: ["==", ["geometry-type"], "LineString"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#ffffff", "line-width": 9 },
    },
    before,
  );
  map.addLayer(
    {
      id: "route-line",
      type: "line",
      source: ROUTE_SOURCE,
      filter: ["==", ["geometry-type"], "LineString"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": blue, "line-width": 5 },
    },
    before,
  );
  map.addLayer(
    {
      id: "route-ends",
      type: "circle",
      source: ROUTE_SOURCE,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": 6,
        "circle-color": ["case", ["==", ["get", "end"], 1], blue, "#ffffff"],
        "circle-stroke-color": ["case", ["==", ["get", "end"], 1], "#ffffff", blue],
        "circle-stroke-width": 3,
      },
    },
    before,
  );
}

/** Takes the route off the map. Safe to call when nothing is drawn or the map is already gone. */
export function clearRoute(map: MapLibreMap): void {
  try {
    for (const id of ROUTE_LAYERS) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(ROUTE_SOURCE)) map.removeSource(ROUTE_SOURCE);
  } catch {
    // The map was removed, or a style reload is in progress and has already dropped them.
  }
}

/** [west, south, east, north] of a line, for fitBounds. */
export function lineBounds(line: GeoJSON.LineString): [[number, number], [number, number]] {
  const xs = line.coordinates.map((c) => c[0]);
  const ys = line.coordinates.map((c) => c[1]);
  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ];
}
