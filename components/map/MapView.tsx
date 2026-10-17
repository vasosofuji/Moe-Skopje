"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { IControl, MapGeoJSONFeature, Map as MapLibreMap } from "maplibre-gl";
import { createContext, useContext, useEffect, useEffectEvent, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import { LAYER_IDS, LAYERS, type LayerId } from "@/lib/layers";
import type { Feature } from "@/lib/sources/types";
import { getCachedLayer, useLayer } from "@/lib/useLayer";
import { muteStyle, styleUrl } from "./mapStyle";
import { renderLayer } from "./renderLayer";
import { renderRoadworks } from "./roadworksLayer";

export type LngLat = [number, number];

/** What the shell exposes to everything drawn over the map. */
export type MapApi = {
  flyTo(lngLat: LngLat, zoom?: number): void;
  select(feature: Feature | null): void;
  map?: MapLibreMap;
  /** The user's position, once they allowed location. */
  location?: LngLat;
  /** Asks for the user's position (and flies there when `fly`); resolves false when denied or unavailable. */
  locate(fly?: boolean): Promise<boolean>;
};

export const MapContext = createContext<MapApi>({ flyTo() {}, select() {}, locate: async () => false });
export const useMap = () => useContext(MapContext);

export const CENTER: LngLat = [21.4254, 41.9981];
const BOUNDS: [LngLat, LngLat] = [
  [21.25, 41.9],
  [21.6, 42.1],
];
/** Copied there by scripts/copy-maplibre-worker.mjs: the bundle can't serve it from next to maplibre's own chunk. */
const WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";
const HIT_LAYERS =LAYER_IDS.flatMap((id) => [`${id}-circle`, `${id}-fill`]);
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/** MapLibre cannot read CSS variables, so `var(--c-air)` is resolved against the current theme first. */
function cssColor(expr: string): string {
  const name = /^var\((--[\w-]+)\)$/.exec(expr)?.[1];
  if (!name) return expr;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#8e8e93";
}

/** Top feature from our layers within a finger-sized box around a screen point, looked up in the layer data. */
function hitTest(map: MapLibreMap, x: number, y: number): Feature | null {
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
  const id = hit.layer.id.replace(/-(circle|fill)$/, "") as LayerId;
  const found = getCachedLayer(id)?.features.features.find((f) => f.properties?.id === hit.properties.id);
  return (found as Feature | undefined) ?? null;
}

/** Keeps one layer's data on the map; renders nothing itself. */
function LayerSource({ map, id, enabled, styleKey }: { map: MapLibreMap; id: LayerId; enabled: boolean; styleKey: number }) {
  const { data } = useLayer(id, enabled);
  useEffect(() => {
    const color = cssColor(LAYERS[id].color);
    const draw = id === "roadworks" ? renderRoadworks : renderLayer; // closures, works and regimes each look different
    try {
      if (enabled && data) draw(map, id, data.features, color);
      else if (map.getSource(`src-${id}`)) draw(map, id, EMPTY, color);
    } catch {
      // A theme switch is reloading the style ("Style is not done loading"); its style.load bumps styleKey and re-runs this.
    }
  }, [map, id, enabled, data, styleKey]);
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
  const { map, select, location } = useMap();
  const container = useRef<HTMLDivElement>(null);
  const appliedDark = useRef<boolean | null>(null);
  const [styleKey, setStyleKey] = useState(0);
  const [ready, setReady] = useState(false);

  const onStyleLoad = useEffectEvent((m: MapLibreMap) => {
    muteStyle(m, appliedDark.current ?? false);
    setStyleKey((k) => k + 1);
  });
  const onClick = useEffectEvent((m: MapLibreMap, x: number, y: number) => select(hitTest(m, x, y)));
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
        // Attribution stays on (OSM licence, FOSSGIS terms): see the control added below. globals.css restyles and places it.
        attributionControl: false,
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

  // Attribution: the style's own (OpenFreeMap, OpenMapTiles, OSM contributors) plus the FOSSGIS-required "fix the map" link.
  // Added here, not through the constructor, so the link follows the UI language.
  useEffect(() => {
    if (!map) return;
    let control: IControl | undefined;
    let cancelled = false;
    void import("maplibre-gl").then(({ AttributionControl }) => {
      if (cancelled) return;
      const link = `<a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">${t("route.fixTheMap")}</a>`;
      const ctrl = new AttributionControl({ customAttribution: link });
      map.addControl(ctrl);
      control = ctrl;
    });
    return () => {
      cancelled = true;
      try {
        if (control) map.removeControl(control);
      } catch {
        // The map is already being torn down.
      }
    };
  }, [map, t]);

  return (
    <div
      role="region"
      aria-label={t("map.region")}
      className={cx("absolute inset-0 transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")}
    >
      {/* MapLibre puts an unlayered position: relative on its container, so this inner div only sizes it. */}
      <div ref={container} className="h-full w-full" />
      {map &&
        styleKey > 0 &&
        LAYER_IDS.map((id) => (
          <LayerSource key={id} map={map} id={id} enabled={layers.includes(id)} styleKey={styleKey} />
        ))}
    </div>
  );
}
