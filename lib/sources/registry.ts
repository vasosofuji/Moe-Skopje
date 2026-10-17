import type { LayerId } from "@/lib/layers";
import { reportsAdapter } from "./reports";
import type { Adapter } from "./types";

/** id → adapter. Each source task registers its adapter here. */
export const registry: Partial<Record<LayerId, Adapter>> = {
  reports: reportsAdapter,
};
