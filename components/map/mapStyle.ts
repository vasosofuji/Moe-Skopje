import type { Map as MapLibreMap } from "maplibre-gl";

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
