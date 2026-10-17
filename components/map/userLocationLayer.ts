import type { Map as MapLibreMap, PaddingOptions } from "maplibre-gl";
import { onFix, type Fix } from "@/lib/useGeolocation";
import type { LngLat } from "./MapView";
import { removeOverlay, setOverlay, type OverlayLayer } from "./renderLayer";

const SRC = "src-user-location";
/** The halo is never drawn wider than this, so a rough network fix does not wash over the whole city. */
const MAX_HALO_M = 1500;
/** Metres per pixel at zoom 0 for MapLibre's 512 px tiles at Skopje's latitude (42° N). */
const M_PER_PX_Z0 = (40_075_016.686 * Math.cos((42 * Math.PI) / 180)) / 512;

/** Halo radius in pixels: the fix's accuracy in metres, divided by metres per pixel (which halves with every zoom level). */
const haloRadius: unknown = ["interpolate", ["exponential", 2], ["zoom"], 0, ["/", ["get", "accuracy"], M_PER_PX_Z0], 22, ["/", ["get", "accuracy"], M_PER_PX_Z0 / 2 ** 22]];

function layers(blue: string): OverlayLayer[] {
  return [
    { id: "user-halo", type: "circle", paint: { "circle-radius": haloRadius, "circle-color": blue, "circle-opacity": 0.14, "circle-stroke-color": blue, "circle-stroke-opacity": 0.3, "circle-stroke-width": 1 } },
    { id: "user-shadow", type: "circle", paint: { "circle-radius": 10, "circle-color": "#000", "circle-opacity": 0.22, "circle-blur": 0.8, "circle-translate": [0, 1] } },
    { id: "user-dot", type: "circle", paint: { "circle-radius": 7.5, "circle-color": blue, "circle-stroke-color": "#fff", "circle-stroke-width": 3 } },
  ];
}

function draw(map: MapLibreMap, { at, accuracy }: Fix, blue: string) {
  const fc: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [{ type: "Feature", properties: { accuracy: Math.min(accuracy, MAX_HALO_M) }, geometry: { type: "Point", coordinates: at } }],
  };
  setOverlay(map, SRC, fc, layers(blue));
}

/**
 * Keeps the "you are here" dot on the map: a GeoJSON source whose data is replaced on every position update, so a fix costs
 * one setData and no React render. Call again after a style reload (the source is gone then); returns the cleanup.
 */
export function showUserLocation(map: MapLibreMap, blue: string): () => void {
  const off = onFix((fix) => {
    try {
      draw(map, fix, blue);
    } catch {
      // A theme switch is reloading the style; the caller runs this again on style.load.
    }
  });
  return () => {
    off();
    try {
      removeOverlay(map, SRC, layers(blue));
    } catch {
      // The map is already gone.
    }
  };
}

/** Moves the camera to the user: one short ease; if a move is already running, jump to its end instead of stacking another. */
export function centerOnUser(map: MapLibreMap, center: LngLat, padding: PaddingOptions) {
  const to = { center, zoom: 15, padding, essential: true };
  if (map.isMoving()) map.jumpTo(to);
  else map.easeTo({ ...to, duration: 500 });
}
