import type { LayerId } from "@/lib/layers";
import { outages } from "./outages";
import { parkingAdapter } from "./parking";
import { pharmacies } from "./pharmacies";
import { staticAdapter, staticBuses } from "./static";
import type { Adapter } from "./types";

/** id → adapter. Starts empty; each source task registers its adapter here. */
export const registry: Partial<Record<LayerId, Adapter>> = {
  buses: staticBuses(),
  parking: parkingAdapter(),
  pharmacies,
  schools: staticAdapter("schools", "schools.geojson", "school"),
  "outages-power": outages["outages-power"],
  "outages-water": outages["outages-water"],
  "outages-heating": outages["outages-heating"],
};
