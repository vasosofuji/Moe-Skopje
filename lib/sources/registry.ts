import type { LayerId } from "@/lib/layers";
import { air } from "./air";
import { buses } from "./buses";
import { earthquakes } from "./earthquakes";
import { events } from "./events";
import { outages } from "./outages";
import { parkingAdapter } from "./parking";
import { pharmacies } from "./pharmacies";
import { staticAdapter } from "./static";
import type { Adapter } from "./types";
import { waste } from "./waste";
import { weather } from "./weather";

/** id → adapter. Each source task registers its adapter here. */
export const registry: Partial<Record<LayerId, Adapter>> = {
  air,
  weather,
  earthquakes,
  buses,
  parking: parkingAdapter(),
  pharmacies,
  schools: staticAdapter("schools", "schools.geojson", "school"),
  events,
  waste,
  "outages-power": outages["outages-power"],
  "outages-water": outages["outages-water"],
  "outages-heating": outages["outages-heating"],
};
