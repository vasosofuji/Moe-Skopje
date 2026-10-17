"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { MapGeoJSONFeature, Map as MapLibreMap } from "maplibre-gl";
import { createContext, useContext, useEffect, useEffectEvent, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import { LAYER_IDS, LAYERS, type LayerId } from "@/lib/layers";
import type { Feature } from "@/lib/sources/types";
import { getCachedLayer, useLayer } from "@/lib/useLayer";
import { muteStyle, styleUrl } from "./mapStyle";
import { HIGHLIGHT_LAYERS, hitLayersOf, removeOverlay, renderLayer, setOverlay } from "./renderLayer";

export type LngLat = [number, number];
export type BBox = [west: number, south: number, east: number, north: number];
/** An outage picked in the Explore widget: its group id (`detail.outage` of its street features) and its layer. */
export type Highlight = { id: string; layer: LayerId };
/** A departure picked in a stop card, followed on the map by BusTracker. */
export type Trip = { tripId: string; route: string; headsign: string };

/** What the shell exposes to everything drawn over the map. */
export type MapApi = {
  flyTo(lngLat: LngLat, zoom?: number): void;
  /** Fits the camera to a box, clear of the panels. */
  showArea(bbox: BBox): void;
  /** Lowers the phone sheet to its peek so the map shows; a no-op on wider screens. */
  reveal(): void;
  select(feature: Feature | null): void;
  map?: MapLibreMap;
  /** The user's position, once they allowed location. */
  location?: LngLat;
  /** Asks for the user's position (and flies there when `fly`); resolves false when denied or unavailable. */
  locate(fly?: boolean): Promise<boolean>;
  highlight: Highlight | null;
  setHighlight(h: Highlight | null): void;
  trip: Trip | null;
  track(trip: Trip | null): void;
};

export const MapContext = createContext<MapApi>({
  flyTo() {},
  showArea() {},
  reveal() {},
  select() {},
  locate: async () => false,
  highlight: null,
  setHighlight() {},
  trip: null,
  track() {},
});
export const useMap = () => useContext(MapContext);

export const CENTER: LngLat = [21.4254, 41.9981];
const BOUNDS: [LngLat, LngLat] = [
  [21.25, 41.9],
  [21.6, 42.1],
];
/** Copied there by scripts/copy-maplibre-worker.mjs: the bundle can't serve it from next to maplibre's own chunk. */
const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";
const HIT_LAYERS = LAYER_IDS.flatMap(hitLayersOf);
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** MapLibre cannot read CSS variables, so `var(--c-air)` is resolved against the current theme first. */
export function cssColor(expr: string): string {
  const name = /^var\((--[\w-]+)\)$/.exec(expr)?.[1];
  if (!name) return expr;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#8e8e93";
}

/** Top feature from our layers within a finger-sized box around a screen point, looked up in the layer data. */
function hitTest(map: MapLibreMap, x: number, y: number): { feature: Feature; layer: LayerId } | null {
  const layers = HIT_LAYERS.filter((l) => map.getLayer(l));
  if (!layers.length) return null;
  const hit: MapGeoJSONFeature | undefined = map.queryRenderedFeatures(
    [
      [x - 10, y - 10],
      [x + 10, y + 10],
    ],
    { layers },
  )[0];
  if (!hit) return null;
  // Rendered features carry nested properties (title, detail) as JSON strings, so return the original instead.
  const layer = hit.layer.id.replace(/-(circle|fill|line|area)$/, "") as LayerId;
  const found = getCachedLayer(layer)?.features.features.find((f) => f.properties?.id === hit.properties.id);
  return found ? { feature: found as Feature, layer } : null;
}

/** Keeps one layer's data on the map; renders nothing itself. */
function LayerSource({ map, id, enabled, styleKey }: { map: MapLibreMap; id: LayerId; enabled: boolean; styleKey: number }) {
  const { data } = useLayer(id, enabled);
  useEffect(() => {
    try {
      if (enabled && data) renderLayer(map, id, data.features, cssColor);
      else if (map.getSource(`src-${id}`)) renderLayer(map, id, EMPTY, cssColor);
    } catch {
      // A theme switch is reloading the style ("Style is not done loading"); its style.load bumps styleKey and re-runs this.
    }
  }, [map, id, enabled, data, styleKey]);
  return null;
}

/**
 * The outage picked in the Explore widget (or tapped on the map), drawn over everything in its type's colour.
 * It reads its own layer, so it shows even while that layer is switched off.
 */
function OutageHighlight({ map, highlight, styleKey }: { map: MapLibreMap; highlight: Highlight | null; styleKey: number }) {
  const { data } = useLayer(highlight?.layer ?? "outages-power", highlight !== null);
  useEffect(() => {
    if (!highlight) return;
    const color = cssColor(LAYERS[highlight.layer].color);
    const features = (data?.features.features ?? [])
      .filter((f) => f.properties?.detail?.outage === highlight.id || f.properties?.id === highlight.id)
      .map((f) => ({ ...f, properties: { color } }));
    try {
      setOverlay(map, "src-highlight", { type: "FeatureCollection", features }, HIGHLIGHT_LAYERS);
    } catch {
      // A theme switch is reloading the style; styleKey re-runs this.
    }
    return () => {
      try {
        removeOverlay(map, "src-highlight", HIGHLIGHT_LAYERS);
      } catch {
        // The map is already gone.
      }
    };
  }, [map, highlight, data, styleKey]);
  return null;
}

/**
 * Full-bleed MapLibre map. maplibre-gl is imported inside an effect so the server never loads it.
 * Positron in light mode, Dark in dark mode; a theme change reloads the style and re-adds every data layer.
 */
export function MapView({
  layers,
  dark,
  onReady,
  onTileError,
}: {
  layers: LayerId[];
  dark: boolean;
  onReady(map: MapLibreMap | undefined): void;
  onTileError(): void;
}) {
  const { t } = useT();
  const { map, select, location, highlight, setHighlight } = useMap();
  const container = useRef<HTMLDivElement>(null);
  const appliedDark = useRef<boolean | null>(null);
  const [styleKey, setStyleKey] = useState(0);
  const [ready, setReady] = useState(false);

  const onStyleLoad = useEffectEvent((m: MapLibreMap) => {
    muteStyle(m, appliedDark.current ?? false);
    setStyleKey((k) => k + 1);
  });
  const onClick = useEffectEvent((m: MapLibreMap, x: number, y: number) => {
    const hit = hitTest(m, x, y);
    select(hit?.feature ?? null);
    // A tapped outage street lights up its whole outage; a tap on empty map clears the highlight.
    const outage = hit?.feature.properties.detail?.outage;
    if (!hit) setHighlight(null);
    else if (typeof outage === "string") setHighlight({ id: outage, layer: hit.layer });
  });
  const onError = useEffectEvent((sourceId?: string) => {
    if (!sourceId?.startsWith("src-")) onTileError(); // our GeoJSON sources never come from the tile server
  });
  const initialDark = useEffectEvent(() => dark);
  const reportMap = useEffectEvent(onReady);

  useEffect(() => {
    let m: MapLibreMap | undefined;
    let cancelled = false;
    void import("maplibre-gl").then(({ Map: MapLibre, setWorkerUrl }) => {
      if (cancelled || !container.current) return;
      setWorkerUrl(WORKER_URL);
      appliedDark.current = initialDark();
      m = new MapLibre({
        container: container.current,
        style: styleUrl(appliedDark.current),
        center: CENTER,
        zoom: 12,
        maxBounds: BOUNDS,
        // Default attribution (bottom-right, compact on small maps) stays on: OSM licence. globals.css restyles and places it.
      });
      const map = m;
      map.on("style.load", () => onStyleLoad(map));
      map.once("load", () => setReady(true));
      map.on("error", (e) => onError((e as { sourceId?: string }).sourceId));
      map.on("click", (e) => onClick(map, e.point.x, e.point.y));
      map.on("mousemove", (e) => {
        map.getCanvas().style.cursor = hitTest(map, e.point.x, e.point.y) ? "pointer" : "";
      });
      reportMap(map);
    });
    return () => {
      cancelled = true;
      m?.remove();
      reportMap(undefined);
    };
  }, []);

  // Theme change: a full reload (diff: false) so style.load fires and our layers are added back.
  useEffect(() => {
    if (!map || appliedDark.current === dark) return;
    appliedDark.current = dark;
    map.setStyle(styleUrl(dark), { diff: false });
  }, [map, dark]);

  // "You are here" dot.
  useEffect(() => {
    if (!map || !location) return;
    let marker: { remove(): void } | undefined;
    let cancelled = false;
    void import("maplibre-gl").then(({ Marker }) => {
      if (cancelled) return;
      const el = document.createElement("div");
      el.className = "user-dot";
      el.setAttribute("aria-label", t("map.myLocation"));
      marker = new Marker({ element: el }).setLngLat(location).addTo(map);
    });
    return () => {
      cancelled = true;
      marker?.remove();
    };
  }, [map, location, t]);

  return (
    <div
      role="region"
      aria-label={t("map.region")}
      className={cx("absolute inset-0 transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}
    >
      {/* MapLibre puts an unlayered position: relative on its container, so this inner div only sizes it. */}
      <div ref={container} className="h-full w-full" />
      {map && styleKey > 0 && (
        <>
          {LAYER_IDS.map((id) => (
            <LayerSource key={id} map={map} id={id} enabled={layers.includes(id)} styleKey={styleKey} />
          ))}
          <OutageHighlight map={map} highlight={highlight} styleKey={styleKey} />
        </>
      )}
    </div>
  );
}
