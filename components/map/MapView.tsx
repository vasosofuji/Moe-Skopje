"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { IControl, MapGeoJSONFeature, Map as MapLibreMap } from "maplibre-gl";
import { createContext, memo, useContext, useEffect, useEffectEvent, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import { LAYER_IDS, LAYERS, type LayerId } from "@/lib/layers";
import type { Feature } from "@/lib/sources/types";
import { getCachedLayer, useLayer } from "@/lib/useLayer";
import { localizeLabels, muteStyle, styleUrl } from "./mapStyle";
import { HIGHLIGHT_LAYERS, hitLayersOf, removeOverlay, renderLayer, setOverlay } from "./renderLayer";
import { renderRoadworks } from "./roadworksLayer";

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
  // The features object only changes when a poll brings different features (useLayer keeps it otherwise), so a 60 s
  // poll with nothing new never re-tiles the source.
  const features = useLayer(id, enabled).data?.features;
  useEffect(() => {
    // Roadworks get their own renderer (closures, works and regimes each look different); everything else goes through renderLayer.
    const draw = (fc: GeoJSON.FeatureCollection) =>
      id === "roadworks" ? renderRoadworks(map, id, fc, cssColor(LAYERS[id].color)) : renderLayer(map, id, fc, cssColor);
    try {
      if (enabled && features) draw(features);
      else if (map.getSource(`src-${id}`)) draw(EMPTY);
    } catch {
      // A theme switch is reloading the style ("Style is not done loading"); its style.load bumps styleKey and re-runs this.
    }
  }, [map, id, enabled, features, styleKey]);
  return null;
}

/**
 * The outage picked in the Explore widget (or tapped on the map), drawn over everything in its type's colour.
 * It reads its own layer, so it shows even while that layer is switched off.
 */
function OutageHighlight({ map, highlight, styleKey }: { map: MapLibreMap; highlight: Highlight | null; styleKey: number }) {
  const fc = useLayer(highlight?.layer ?? "outages-power", highlight !== null).data?.features;
  useEffect(() => {
    if (!highlight) return;
    const color = cssColor(LAYERS[highlight.layer].color);
    const features = (fc?.features ?? [])
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
  }, [map, highlight, fc, styleKey]);
  return null;
}

/**
 * Full-bleed MapLibre map. maplibre-gl is imported inside an effect so the server never loads it.
 * Positron in light mode, Dark in dark mode; a theme change reloads the style and re-adds every data layer.
 */
export const MapView = memo(function MapView({
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
  const { t, lang } = useT();
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
  const reportNoWorker = useEffectEvent(onTileError);

  useEffect(() => {
    let m: MapLibreMap | undefined;
    let cancelled = false;
    void import("maplibre-gl").then(({ Map: MapLibre, setWorkerUrl }) => {
      if (cancelled || !container.current) return;
      setWorkerUrl(WORKER_URL);
      // A missing worker file (install hook skipped) would leave a dead map; say so with the same toast as a tile outage.
      fetch(WORKER_URL, { method: "HEAD" })
        .then((r) => !cancelled && !r.ok && reportNoWorker())
        .catch(() => !cancelled && reportNoWorker());
      appliedDark.current = initialDark();
      m = new MapLibre({
        container: container.current,
        style: styleUrl(appliedDark.current),
        center: CENTER,
        zoom: 12,
        maxBounds: BOUNDS,
        // Phone budget: no label fade-in on every pan, no pitch, and at most 2x pixels (3x screens triple the fill cost).
        fadeDuration: 0,
        maxPitch: 0,
        pixelRatio: Math.min(devicePixelRatio, 2),
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

  // Labels in one script, the app's language: on every style load (styleKey) and when the language changes.
  useEffect(() => {
    if (!map || styleKey === 0) return;
    try {
      localizeLabels(map, lang);
    } catch {
      // A theme switch is reloading the style; its style.load bumps styleKey and re-runs this.
    }
  }, [map, lang, styleKey]);

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
      // Compact, bottom-right, and collapsed: MapLibre opens a compact control by default, so close it right after adding.
      const ctrl = new AttributionControl({ compact: true, customAttribution: link });
      map.addControl(ctrl, "bottom-right");
      control = ctrl;
      const el = map.getContainer().querySelector(".maplibregl-ctrl-attrib");
      el?.classList.remove("maplibregl-compact-show");
      el?.removeAttribute("open");
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
      // The region carries the style's own background so a slow first paint shows dark grey / map beige, not black.
      className={cx("absolute inset-0", dark ? "bg-[#1c1c1e]" : "bg-[#f2f2f7]")}
    >
      {/* MapLibre puts an unlayered position: relative on its container, so this inner div only sizes it. */}
      <div ref={container} className={cx("h-full w-full transition-opacity duration-700", ready ? "opacity-100" : "opacity-0")} />
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
},
// A sheet snap or tab switch re-renders the shell with a fresh layers array; the map only cares about its contents.
// The callbacks are read through useEffectEvent, so a new identity needs no re-render.
(a, b) => a.dark === b.dark && a.layers.join() === b.layers.join());
