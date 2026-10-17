import type { LayerId } from "@/lib/layers";
import type { Adapter } from "./types";

/** id → adapter. Starts empty; each source task registers its adapter here. */
export const registry: Partial<Record<LayerId, Adapter>> = {};
