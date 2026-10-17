import type { ExpressionSpecification, Map as MapLibreMap } from "maplibre-gl";

export const styleUrl = (dark: boolean) => `https://tiles.openfreemap.org/styles/${dark ? "dark" : "positron"}`;

// Apple Maps feel: labels recede to neutral greys, roads read as plain white (light) or graphite (dark) ribbons.
const PALETTE = {
  light: { place: "#3a3a3c", label: "#7c7c80", halo: "rgba(255,255,255,0.92)", road: "#ffffff" },
  dark: { place: "#d1d1d6", label: "#8e8e93", halo: "rgba(0,0,0,0.7)", road: "#2c2c2e" },
};

// ponytail: matches OpenMapTiles layer ids (positron, dark); a different basemap needs its own patterns.
const ROAD = /road|highway|street|motorway|trunk|primary|secondary|tertiary|minor|service|bridge|tunnel/;
const NOT_ROAD = /casing|rail|path|track|ferry|aeroway/;

/** Lowers label and road saturation on the loaded basemap. Run on every style.load (setStyle drops paint overrides). */
export function muteStyle(map: MapLibreMap, dark: boolean): void {
  const p = dark ? PALETTE.dark : PALETTE.light;
  for (const { id, type } of map.getStyle().layers) {
    if (type === "symbol" && !id.includes("water")) {
      map.setPaintProperty(id, "text-color", id.includes("place") ? p.place : p.label);
      map.setPaintProperty(id, "text-halo-color", p.halo);
    } else if (type === "line" && ROAD.test(id) && !NOT_ROAD.test(id)) {
      map.setPaintProperty(id, "line-color", p.road);
    }
  }
}

/** MapLibre `text-field` that shows one script: the app language's name, then the next best the tiles carry. */
export function labelField(lang: "mk" | "en"): ExpressionSpecification {
  return lang === "mk"
    ? ["coalesce", ["get", "name:mk"], ["get", "name"]]
    : ["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]];
}

/**
 * Points every named label of the basemap at labelField(lang). Run on every style.load and when the language changes.
 * Symbol layers that show something else (road shields, house numbers, icon-only layers) are left alone.
 */
export function localizeLabels(map: MapLibreMap, lang: "mk" | "en"): void {
  const field = labelField(lang);
  for (const { id, type } of map.getStyle().layers) {
    if (type !== "symbol") continue;
    const current = map.getLayoutProperty(id, "text-field");
    if (current && JSON.stringify(current).includes("name")) map.setLayoutProperty(id, "text-field", field);
  }
}
