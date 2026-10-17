// Adapter contract, spec §5.1.
import { z } from "zod";

export type Status = "live" | "stale" | "offline" | "static"; // static = baked dataset (OSM routes, zones)

export type Feature = GeoJSON.Feature<
  GeoJSON.Geometry,
  {
    id: string;
    kind: string; // 'air-station' | 'outage' | 'bus-stop' | ...
    title: { mk: string; en: string };
    severity?: 0 | 1 | 2 | 3; // drives colour
    value?: number;
    unit?: string;
    startsAt?: string;
    endsAt?: string;
    detail?: Record<string, string | number>;
  }
>;

const Position = z.array(z.number()).min(2); // [lng, lat, alt?]; z.number() also rejects NaN and Infinity
// note: GeometryCollection is not accepted; no adapter emits it. Add a branch if one ever does.
const GeometrySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: Position }),
  z.object({ type: z.literal("MultiPoint"), coordinates: z.array(Position) }),
  z.object({ type: z.literal("LineString"), coordinates: z.array(Position) }),
  z.object({ type: z.literal("MultiLineString"), coordinates: z.array(z.array(Position)) }),
  z.object({ type: z.literal("Polygon"), coordinates: z.array(z.array(Position)) }),
  z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(z.array(z.array(Position))) }),
]);

/** Every adapter output (and every stored snapshot or seed) passes through this before use. */
export const FeatureSchema: z.ZodType<Feature> = z.object({
  type: z.literal("Feature"),
  geometry: GeometrySchema,
  properties: z.object({
    id: z.string(),
    kind: z.string(),
    title: z.object({ mk: z.string(), en: z.string() }),
    severity: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
    value: z.number().optional(),
    unit: z.string().optional(),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    detail: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  }),
});

export interface Adapter {
  id: string; // 'air' | 'weather' | 'outages-power' | ...
  ttl: number; // seconds
  /** How long getLayer waits for fetch() before falling back. Default 8000. */
  timeoutMs?: number;
  source: { name: string; url: string };
  /** Throws on failure. getLayer passes a signal that aborts after `timeoutMs` (default 8 s); adapters should hand it to their fetch calls. */
  fetch(signal?: AbortSignal): Promise<Feature[]>;
  /** Fewer features than this counts as a failed fetch (a 200 with changed markup parses to []). Default 0. */
  minFeatures?: number;
  /** Baked dataset: status "static", never snapshotted. */
  static?: boolean;
  /** Fallback data when the live fetch fails and there is no snapshot. Never throws; resolves [] when there is none (see loadSeed). */
  seed(): Promise<Feature[]>;
}

export interface LayerResponse {
  id: string;
  status: Status;
  updatedAt: string;
  source: { name: string; url: string };
  features: GeoJSON.FeatureCollection;
}
