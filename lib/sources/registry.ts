import type { LayerId } from "@/lib/layers";
import { air } from "./air";
import { earthquakes } from "./earthquakes";
import { reportsAdapter } from "./reports";
import type { Adapter } from "./types";
import { weather } from "./weather";

/** id → adapter. Each source task registers its adapter here. */
export const registry: Partial<Record<LayerId, Adapter>> = {
  air,
  weather,
  earthquakes,
  reports: reportsAdapter,
};
