// The `parking` layer (spec §11.7): City Parking's zone polygons, baked by scripts/bake-parking.ts into
// data/static/parking-zones.geojson (zone list from gradskiparking.com.mk matched to OSM streets, buffered, unioned). No lib/server imports (tsx).
import { loadSeed } from "./seed";
import { readStatic } from "./static";
import type { Adapter, Feature } from "./types";

type ZoneProps = { zone: string; color: string; title: { mk: string; en: string }; price?: number };

export function parkingAdapter(): Adapter {
  return {
    id: "parking",
    ttl: 86400,
    static: true,
    minFeatures: 1,
    source: { name: "Градски паркинг Скопје", url: "https://www.gradskiparking.com.mk/zonsko-parking-zoni.nspx" },
    async fetch() {
      const fc = JSON.parse(await readStatic("parking-zones.geojson")) as GeoJSON.FeatureCollection<GeoJSON.Geometry, ZoneProps>;
      return fc.features.map(
        ({ geometry, properties: p }): Feature => ({
          type: "Feature",
          geometry,
          properties: {
            id: `parking-zone:${p.zone}`,
            kind: "parking-zone",
            title: p.title,
            ...(p.price === undefined ? {} : { value: p.price, unit: "МКД/час" }),
            detail: { zone: p.zone, color: p.color },
          },
        }),
      );
    },
    seed: () => loadSeed("parking"),
  };
}
