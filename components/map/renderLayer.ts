import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { LayerId } from "@/lib/layers";

// iOS system green, yellow, orange and red for severity 0 to 3.
// ponytail: light-mode hexes in both themes; MapLibre cannot read the CSS variables, resolve them if dark needs its own.
export const SEVERITY_COLORS = ["#34c759", "#ffcc00", "#ff9500", "#ff3b30"] as const;

const isType = (...types: string[]) => ["in", ["geometry-type"], ["literal", types]] as ["in", unknown, unknown];

/**
 * Adds or updates source `src-${id}` and its three layers: `${id}-fill` (polygons at .25 opacity), `${id}-line`
 * (lines and polygon outlines) and `${id}-circle` (points, radius 7, white 2 px stroke).
 * Features are coloured by `severity` when present, otherwise by `color`, which must be a resolved CSS colour.
 * An update only swaps the data; after a style switch the source is gone and everything is added again.
 */
export function renderLayer(map: MapLibreMap, id: LayerId, fc: GeoJSON.FeatureCollection, color: string): void {
  const src = `src-${id}`;
  const existing = map.getSource(src) as GeoJSONSource | undefined;
  if (existing) {
    void existing.setData(fc);
    return;
  }

  const [s0, s1, s2, s3] = SEVERITY_COLORS;
  const paint = ["match", ["get", "severity"], 0, s0, 1, s1, 2, s2, 3, s3, color] as ["match", ...unknown[]];
  type Layer = Parameters<MapLibreMap["addLayer"]>[0];

  map.addSource(src, { type: "geojson", data: fc });
  map.addLayer({
    id: `${id}-fill`,
    type: "fill",
    source: src,
    filter: isType("Polygon", "MultiPolygon"),
    paint: { "fill-color": paint, "fill-opacity": 0.25 },
  } as Layer);
  map.addLayer({
    id: `${id}-line`,
    type: "line",
    source: src,
    filter: isType("LineString", "MultiLineString", "Polygon", "MultiPolygon"),
    paint: { "line-color": paint, "line-width": 2 },
    layout: { "line-cap": "round", "line-join": "round" },
  } as Layer);
  map.addLayer({
    id: `${id}-circle`,
    type: "circle",
    source: src,
    filter: isType("Point", "MultiPoint"),
    paint: { "circle-radius": 7, "circle-color": paint, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
  } as Layer);
}

/** Centre of a geometry's bounding box, as [lng, lat]. A point is its own centre. */
export function featureCenter(geometry: GeoJSON.Geometry): [number, number] {
  if (geometry.type === "Point") return [geometry.coordinates[0], geometry.coordinates[1]];
  const pts: number[][] = [];
  const walk = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === "number") pts.push(c as number[]);
    else if (Array.isArray(c)) c.forEach(walk);
  };
  walk(geometry.type === "GeometryCollection" ? geometry.geometries.map((g) => featureCenter(g)) : geometry.coordinates);
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  return [(Math.min(...lngs) + Math.max(...lngs)) / 2, (Math.min(...lats) + Math.max(...lats)) / 2];
}
