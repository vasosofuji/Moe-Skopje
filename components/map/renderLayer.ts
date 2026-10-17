import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { AQI_COLORS, aqiBand, aqiPosition, metricOf } from "@/lib/aqi";
import { LAYERS, type LayerId } from "@/lib/layers";

// iOS system green, yellow, orange and red for severity 0 to 3.
// ponytail: light-mode hexes in both themes; MapLibre cannot read the CSS variables, resolve them if dark needs its own.
export const SEVERITY_COLORS = ["#34c759", "#ffcc00", "#ff9500", "#ff3b30"] as const;

type Layer = Parameters<MapLibreMap["addLayer"]>[0];
/** A layer spec without its source; the source is filled in when it is added. */
export type OverlayLayer = Omit<Layer, "source"> & Record<string, unknown>;
/** Turns a CSS colour expression (possibly var()) into a colour MapLibre can paint. */
export type Resolve = (css: string) => string;
type FC = GeoJSON.FeatureCollection;

/** A value interpolated over zoom: `byZoom(zoomA, valueA, zoomB, valueB, ...)`. */
const byZoom = (...stops: number[]): unknown => ["interpolate", ["linear"], ["zoom"], ...stops];
const isType = (...types: string[]) => ["in", ["geometry-type"], ["literal", types]] as ["in", unknown, unknown];
const LINES = isType("LineString", "MultiLineString");
const POLYGONS = isType("Polygon", "MultiPolygon");

// ── air heat map
/** Heat-map kernel radius on the ground. The pixel radius doubles with every zoom level, so it stays this size. */
const HEAT_RADIUS_M = 1000;
/** Metres per pixel at zoom 12 in Skopje (MapLibre's 512 px tiles, 42° N): about 14.2. */
const M_PER_PX_Z12 = (40_075_016.686 * Math.cos((42 * Math.PI) / 180)) / (512 * 2 ** 12);
/** MapLibre's kernel is weight × intensity × 1/√(2π) × e^(−1.5 d²/r²); this intensity makes a lone station peak at its own weight. */
const HEAT_INTENSITY = Math.sqrt(2 * Math.PI);
/** Zoom range over which the heat map hands over to the station circles. */
const FADE = [12.5, 13.5] as const;
const kernel = (d: number) => Math.exp((-1.5 * d * d) / (HEAT_RADIUS_M * HEAT_RADIUS_M));
/** `#rrggbb` at zero alpha. MapLibre blends colours unpremultiplied, so fading from transparent black would darken the edge. */
const clear = (hex: string) => {
  const m = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  return m ? `rgba(${m.slice(1).map((h) => parseInt(h, 16)).join(",")},0)` : "rgba(0,0,0,0)";
};

/**
 * Air stations with two flat properties the map styles read: `band` (0..5, the colour) and `heat` (the heat-map weight).
 * A weight is the station's spot on the AQI scale divided by how much its neighbours' kernels overlap it, so the summed
 * heat map shows the level near each station instead of how many sensors stand there (central Skopje has dozens).
 */
export function airHeat(fc: FC): FC {
  const pts = fc.features.flatMap((f) => {
    const v = f.properties?.value;
    if (f.geometry?.type !== "Point" || typeof v !== "number" || !Number.isFinite(v)) return [];
    const [lng, lat] = f.geometry.coordinates;
    const metric = metricOf(f.properties?.detail);
    return [{ f, x: lng * 111_320 * Math.cos((lat * Math.PI) / 180), y: lat * 110_540, t: aqiPosition(metric, v), band: aqiBand(metric, v) }];
  });
  // ponytail: O(n²) over the stations; fine for pulse.eco's ~60 in Skopje, use a grid index past a few thousand.
  const props = new Map(
    pts.map((p) => [p.f, { band: p.band, heat: p.t / pts.reduce((s, q) => s + kernel(Math.hypot(p.x - q.x, p.y - q.y)), 0) }]),
  );
  return { ...fc, features: fc.features.map((f) => (props.has(f) ? { ...f, properties: { ...f.properties, ...props.get(f) } } : f)) };
}

/** Rendered features carry nested objects (title, detail) as JSON strings, so styles need flat copies of what they read. */
function prepare(id: LayerId, fc: FC): FC {
  if (id === "air") return airHeat(fc);
  if (id === "parking") {
    return { ...fc, features: fc.features.map((f) => ({ ...f, properties: { ...f.properties, color: String(f.properties?.detail?.color ?? "") } })) };
  }
  return fc;
}

/** The map layers of one data layer, drawn from source `src`. Ids end in -fill, -line, -area or -circle (MapView hit-tests those). */
function layersFor(id: LayerId, src: string, resolve: Resolve): (Layer & { beforeLabels?: boolean })[] {
  const color = resolve(LAYERS[id].color);

  if (id === "air") {
    const band = ["match", ["get", "band"], ...AQI_COLORS.flatMap((c, i) => [i, resolve(c)]), resolve(AQI_COLORS[0])];
    // Transparent at the kernel's edge, then each band's colour at the middle of its sixth of the scale (aqiPosition).
    const ramp = AQI_COLORS.flatMap((c, i) => [(i + 0.5) / 6, resolve(c)]);
    const r12 = HEAT_RADIUS_M / M_PER_PX_Z12;
    return [
      {
        id: "air-heat",
        type: "heatmap",
        source: src,
        maxzoom: FADE[1],
        beforeLabels: true, // street names stay on top
        paint: {
          "heatmap-weight": ["get", "heat"],
          "heatmap-intensity": HEAT_INTENSITY,
          "heatmap-radius": ["interpolate", ["exponential", 2], ["zoom"], 10, r12 / 4, 14, r12 * 4],
          "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, clear(resolve(AQI_COLORS[0])), 0.02, clear(resolve(AQI_COLORS[0])), ...ramp],
          "heatmap-opacity": byZoom(FADE[0], 0.55, FADE[1], 0),
        },
      } as Layer,
      {
        id: "air-circle",
        type: "circle",
        source: src,
        minzoom: FADE[0],
        paint: {
          "circle-radius": byZoom(13, 5, 16, 8),
          "circle-color": band,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-opacity": byZoom(FADE[0], 0, FADE[1], 1),
          "circle-stroke-opacity": byZoom(FADE[0], 0, FADE[1], 1),
        },
      } as Layer,
    ];
  }

  if (id === "outages-power" || id === "outages-water" || id === "outages-heating") {
    return [
      // Affected streets in the outage type's colour.
      {
        id: `${id}-line`,
        type: "line",
        source: src,
        filter: LINES,
        paint: { "line-color": color, "line-width": byZoom(11, 2, 15, 4), "line-opacity": 0.9 },
        layout: { "line-cap": "round", "line-join": "round" },
      } as Layer,
      // Only the municipality is known (detail.approx): a light dashed outline, never a fill that claims the whole area.
      {
        id: `${id}-area`,
        type: "line",
        source: src,
        filter: POLYGONS,
        paint: { "line-color": color, "line-width": 1.5, "line-opacity": 0.7, "line-dasharray": [2, 2] },
      } as Layer,
    ];
  }

  if (id === "parking") {
    const zone: unknown = ["get", "color"];
    return [
      { id: "parking-fill", type: "fill", source: src, filter: POLYGONS, paint: { "fill-color": zone, "fill-opacity": 0.2 } } as Layer,
      {
        id: "parking-line",
        type: "line",
        source: src,
        filter: POLYGONS,
        // The white zone (D) needs a visible edge on the light map.
        paint: { "line-color": ["case", ["==", ["upcase", zone], "#FFFFFF"], "#8e8e93", zone], "line-width": 1 },
      } as Layer,
    ];
  }

  if (id === "buses") {
    // Stops only (spec §11.6): small indigo dots across the city, a little larger at street level.
    return [
      {
        id: "buses-circle",
        type: "circle",
        source: src,
        filter: isType("Point"),
        paint: {
          "circle-radius": byZoom(11, 1.5, 14, 4, 16, 6),
          "circle-color": color,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": byZoom(11, 0.5, 14, 1.5),
        },
      } as Layer,
    ];
  }

  const [s0, s1, s2, s3] = SEVERITY_COLORS;
  const paint = ["match", ["get", "severity"], 0, s0, 1, s1, 2, s2, 3, s3, color];
  return [
    { id: `${id}-fill`, type: "fill", source: src, filter: POLYGONS, paint: { "fill-color": paint, "fill-opacity": 0.25 } } as Layer,
    {
      id: `${id}-line`,
      type: "line",
      source: src,
      filter: isType("LineString", "MultiLineString", "Polygon", "MultiPolygon"),
      paint: { "line-color": paint, "line-width": 2 },
      layout: { "line-cap": "round", "line-join": "round" },
    } as Layer,
    {
      id: `${id}-circle`,
      type: "circle",
      source: src,
      filter: isType("Point", "MultiPoint"),
      // Small dots across the whole city, full-size markers from street level.
      paint: {
        "circle-radius": byZoom(11, 3, 14, 6, 16, 7),
        "circle-color": paint,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": byZoom(11, 1, 14, 2),
      },
    } as Layer,
  ];
}

/** Every layer id renderLayer may add for `id`, for hit-testing. */
export const hitLayersOf = (id: LayerId) => [`${id}-circle`, `${id}-fill`, `${id}-line`, `${id}-area`];

/** Id of the basemap's first label layer: layers added before it sit under the street names. */
const firstLabel = (map: MapLibreMap) => map.getStyle?.()?.layers.find((l) => l.type === "symbol")?.id;

/**
 * Adds or updates source `src-${id}` and its layers (see layersFor): air is a heat map handing over to station circles,
 * outages are street lines (dashed outlines where only the municipality is known), parking zones are tinted polygons,
 * buses are stop dots, every other layer gets the generic fill / line / circle trio coloured by `severity` or the layer colour.
 * An update only swaps the data; after a style switch the source is gone and everything is added again.
 */
export function renderLayer(map: MapLibreMap, id: LayerId, fc: FC, resolve: Resolve): void {
  const src = `src-${id}`;
  const data = prepare(id, fc);
  const existing = map.getSource(src) as GeoJSONSource | undefined;
  if (existing) {
    void existing.setData(data);
    return;
  }
  map.addSource(src, { type: "geojson", data });
  for (const { beforeLabels, ...layer } of layersFor(id, src, resolve)) map.addLayer(layer, beforeLabels ? firstLabel(map) : undefined);
}

/** Adds a GeoJSON source with its layers, or only swaps the data when it is already on the map. For overlays (highlight, tracked bus). */
export function setOverlay(map: MapLibreMap, id: string, fc: FC, layers: OverlayLayer[]): void {
  const existing = map.getSource(id) as GeoJSONSource | undefined;
  if (existing) {
    void existing.setData(fc);
    return;
  }
  map.addSource(id, { type: "geojson", data: fc });
  for (const layer of layers) map.addLayer({ ...layer, source: id } as Layer);
}

/** Removes an overlay added by setOverlay; a no-op once a style switch has dropped it. */
export function removeOverlay(map: MapLibreMap, id: string, layers: OverlayLayer[]): void {
  for (const { id: layerId } of layers) if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(id)) map.removeSource(id);
}

/** The highlighted outage's streets: a wide faint band under a solid line (a glow made of width, not blur), or a dashed outline for a municipality. */
export const HIGHLIGHT_LAYERS: OverlayLayer[] = [
  { id: "hl-glow", type: "line", filter: LINES, paint: { "line-color": ["get", "color"], "line-width": byZoom(11, 10, 16, 22), "line-opacity": 0.22 }, layout: { "line-cap": "round", "line-join": "round" } },
  { id: "hl-line", type: "line", filter: LINES, paint: { "line-color": ["get", "color"], "line-width": byZoom(11, 4, 16, 7) }, layout: { "line-cap": "round", "line-join": "round" } },
  { id: "hl-area", type: "line", filter: POLYGONS, paint: { "line-color": ["get", "color"], "line-width": 2.5, "line-dasharray": [2, 1.5] } },
];

/** The tracked trip's route, drawn faintly under its bus marker. */
export const TRIP_LAYERS: OverlayLayer[] = [
  { id: "trip-shape", type: "line", filter: LINES, paint: { "line-color": ["get", "color"], "line-width": byZoom(11, 3, 16, 6), "line-opacity": 0.4 }, layout: { "line-cap": "round", "line-join": "round" } },
];

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
