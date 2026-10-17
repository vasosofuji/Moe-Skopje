// Baked OSM parking plus the City Parking zone price (data/seed/parking-zones.json). No lib/server imports (tsx).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { municipalities, staticAdapter, type MunicipalityCollection } from "./static";
import type { Adapter, Feature } from "./types";

type Zones = { zones: { zone: string; pricePerHour: number; municipalities: string[] }[] };

type Ring = number[][];
const inRing = (ring: Ring, x: number, y: number) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const contains = (g: GeoJSON.Polygon | GeoJSON.MultiPolygon, x: number, y: number) =>
  (g.type === "Polygon" ? [g.coordinates] : g.coordinates).some(([outer, ...holes]) => inRing(outer, x, y) && !holes.some((h) => inRing(h, x, y)));

/** name_mk of the municipality containing the point, if any. */
export function municipalityAt(munis: MunicipalityCollection, lng: number, lat: number): string | undefined {
  return munis.features.find((m) => contains(m.geometry, lng, lat))?.properties.name_mk;
}

const PAID_ELSEWHERE = new Set(["private", "customers", "delivery", "no"]);

export function parkingAdapter(): Adapter {
  const base = staticAdapter("parking", "parking.geojson", "parking", {
    source: { name: "OpenStreetMap, City Parking Skopje", url: "https://www.gradskiparking.com.mk/" },
  });
  return {
    ...base,
    async fetch() {
      const [features, munis, zones] = await Promise.all([
        base.fetch(),
        municipalities(),
        readFile(join(process.cwd(), "data", "seed", "parking-zones.json"), "utf8").then((s) => JSON.parse(s) as Zones),
      ]);
      return features.map((f): Feature => {
        const d = f.properties.detail;
        if (f.geometry.type !== "Point" || d?.fee === "no" || PAID_ELSEWHERE.has(String(d?.access))) return f;
        const [lng, lat] = f.geometry.coordinates;
        const muni = municipalityAt(munis, lng, lat);
        const zone = zones.zones.find((z) => muni && z.municipalities.includes(muni));
        if (!zone) return f;
        return { ...f, properties: { ...f.properties, detail: { ...d, zone: zone.zone, zonePrice: zone.pricePerHour } } };
      });
    },
  };
}
