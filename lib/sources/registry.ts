import type { LayerId } from "@/lib/layers";
import { parkingAdapter } from "./parking";
import { staticAdapter, staticBuses } from "./static";
import type { Adapter } from "./types";

/** id → adapter. Starts empty; each source task registers its adapter here. */
export const registry: Partial<Record<LayerId, Adapter>> = {
  buses: staticBuses(),
  parking: parkingAdapter(),
  schools: staticAdapter("schools", "schools.geojson", "school"),
};
