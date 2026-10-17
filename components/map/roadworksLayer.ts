import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import type { LayerId } from "@/lib/layers";

// Roadworks drawn on their own, because the three kinds of feature read differently on a map:
//   closure: dashed line (a street you cannot drive down), solid dot when only a point is known;
//   works:   a thinner solid line;
//   regime:  a point with a small glyph (a change to how traffic flows, such as one-way or a lane closed).
// Same contract as renderLayer (source `src-roadworks`, data swapped in place, everything re-added after a style switch),
// so MapView can call either one.

const LINES = ["LineString", "MultiLineString"];
const isLine = ["in", ["geometry-type"], ["literal", LINES]] as ["in", unknown, unknown];
const isPoint = ["in", ["geometry-type"], ["literal", ["Point", "MultiPoint"]]] as ["in", unknown, unknown];
const kind = ["get", "kind"];
const GLYPH = "roadworks-regime";

/** Two opposing arrows in white, 16 px at pixel ratio 2. Drawn in code so no icon file or font has to load. */
function glyphImage(): ImageData {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#ffffff";
  g.lineWidth = 2.6;
  g.lineCap = g.lineJoin = "round";
  g.beginPath();
  g.moveTo(8, 12);
  g.lineTo(24, 12);
  g.moveTo(20, 8);
  g.lineTo(24, 12);
  g.lineTo(20, 16);
  g.moveTo(24, 21);
  g.lineTo(8, 21);
  g.moveTo(12, 17);
  g.lineTo(8, 21);
  g.lineTo(12, 25);
  g.stroke();
  return g.getImageData(0, 0, 32, 32);
}

/** Adds or updates `src-roadworks` and its layers. `color` must be a resolved CSS colour (the `--c-roadworks` orange). */
export function renderRoadworks(map: MapLibreMap, _id: LayerId, fc: GeoJSON.FeatureCollection, color: string): void {
  const src = "src-roadworks";
  const existing = map.getSource(src) as GeoJSONSource | undefined;
  if (existing) {
    void existing.setData(fc);
    return;
  }
  type Layer = Parameters<MapLibreMap["addLayer"]>[0];
  const add = (layer: object) => map.addLayer(layer as Layer); // filters and paints are built from plain arrays; the style spec checks them at runtime
  const byKind = (closure: number, regime: number, other: number) => ["match", kind, "closure", closure, "regime", regime, other];
  const radius = ["interpolate", ["linear"], ["zoom"], 11, byKind(4, 5, 3), 14, byKind(7, 9, 6)];

  map.addSource(src, { type: "geojson", data: fc });
  // Works (and regime lines): solid and thin, so a closure is the loudest thing on a street.
  add({
    id: "roadworks-works",
    type: "line",
    source: src,
    filter: ["all", isLine, ["!=", kind, "closure"]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": color, "line-width": 2.5 },
  });
  add({
    id: "roadworks-line",
    type: "line",
    source: src,
    filter: ["all", isLine, ["==", kind, "closure"]],
    layout: { "line-join": "round" },
    paint: { "line-color": color, "line-width": 4, "line-dasharray": [2, 1.5] },
  });
  // Invisible and wide so a thin line is easy to tap. Named `-fill` because MapView's hit test looks at `<layer>-circle`
  // and `<layer>-fill`; a line layer works there as well.
  add({
    id: "roadworks-fill",
    type: "line",
    source: src,
    filter: isLine,
    paint: { "line-color": color, "line-width": 20, "line-opacity": 0 },
  });
  add({
    id: "roadworks-circle",
    type: "circle",
    source: src,
    filter: isPoint,
    paint: { "circle-radius": radius, "circle-color": color, "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
  });
  if (!map.hasImage(GLYPH)) map.addImage(GLYPH, glyphImage(), { pixelRatio: 2 });
  add({
    id: "roadworks-glyph",
    type: "symbol",
    source: src,
    filter: ["all", isPoint, ["==", kind, "regime"]],
    layout: { "icon-image": GLYPH, "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-size": ["interpolate", ["linear"], ["zoom"], 11, 0.6, 14, 1] },
  });
}
