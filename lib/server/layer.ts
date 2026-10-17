import "server-only";
import { z } from "zod";
import type { LayerId } from "@/lib/layers";
import { registry } from "@/lib/sources/registry";
import { FeatureSchema, type Adapter, type Feature, type LayerResponse } from "@/lib/sources/types";
import { supabaseSnapshots, type SnapshotStore } from "./supabase";

export type { SnapshotStore };

const FeaturesSchema = z.array(FeatureSchema);
const FETCH_TIMEOUT_MS = 8000;
/** A stale/offline answer is re-tried after this long, whatever the adapter's ttl: a fallback must not outlive the outage that caused it. */
const FALLBACK_TTL_MS = 60_000;

// note: per-instance cache; the CDN header does the real work. Concurrent callers share one in-flight fetch per layer.
const cache = new Map<LayerId, { at: number; ttlMs: number; res: LayerResponse }>();
const inflight = new Map<LayerId, Promise<LayerResponse>>();
const defaultSnapshots = supabaseSnapshots();

/** Clears the in-memory cache (tests). */
export const resetLayerCache = () => (cache.clear(), inflight.clear());

type Deps = { now?: () => number; snapshots?: SnapshotStore; timeoutMs?: number };

const iso = (ms: number) => new Date(ms).toISOString();
const collection = (features: Feature[]): GeoJSON.FeatureCollection => ({ type: "FeatureCollection", features });
const reason = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Runs `run` with an AbortSignal and also rejects when the signal fires, for adapters that ignore it. */
function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const signal = AbortSignal.timeout(ms);
  const expired = new Promise<never>((_, reject) =>
    signal.addEventListener("abort", () => reject(new Error(`timed out after ${ms} ms`)), { once: true }),
  );
  return Promise.race([Promise.resolve().then(() => run(signal)), expired]);
}

/** Last resort: a layer never errors, it is just empty and honest about it. */
function offline(id: string, source: LayerResponse["source"], at: number, features: Feature[] = []): LayerResponse {
  return { id, status: "offline", updatedAt: iso(at), source, features: collection(features) };
}

async function seedOf(adapter: Adapter): Promise<Feature[]> {
  try {
    const parsed = FeaturesSchema.safeParse(await adapter.seed());
    if (parsed.success) return parsed.data;
    console.warn(`[layer:${adapter.id}] seed data is invalid: ${parsed.error.message}`);
  } catch (err) {
    console.warn(`[layer:${adapter.id}] seed failed: ${reason(err)}`);
  }
  return [];
}

/** Spec §5.2 steps 2 to 5: live fetch, then latest snapshot (stale), then seed (offline). */
async function resolve(id: LayerId, adapter: Adapter, deps: Deps): Promise<LayerResponse> {
  const now = deps.now ?? Date.now;
  const snapshots = deps.snapshots ?? defaultSnapshots;
  const { source } = adapter;

  let features: Feature[] | null = null;
  try {
    features = FeaturesSchema.parse(await withTimeout((signal) => adapter.fetch(signal), deps.timeoutMs ?? adapter.timeoutMs ?? FETCH_TIMEOUT_MS));
    const min = adapter.minFeatures ?? 0;
    if (features.length < min) throw new Error(`got ${features.length} features, expected at least ${min}`);
  } catch (err) {
    features = null;
    console.warn(`[layer:${id}] live fetch failed: ${reason(err)}`);
  }

  if (features) {
    if (adapter.static) return { id, status: "static", updatedAt: iso(now()), source, features: collection(features) };
    try {
      await snapshots.put(id, features);
    } catch (err) {
      console.warn(`[layer:${id}] snapshot write failed: ${reason(err)}`); // never fails a live response
    }
    return { id, status: "live", updatedAt: iso(now()), source, features: collection(features) };
  }

  if (!adapter.static) {
    try {
      const snap = await snapshots.get(id);
      const parsed = snap && FeaturesSchema.safeParse(snap.payload);
      if (snap && parsed?.success) {
        return { id, status: "stale", updatedAt: snap.fetchedAt, source, features: collection(parsed.data) };
      }
    } catch (err) {
      console.warn(`[layer:${id}] snapshot read failed: ${reason(err)}`);
    }
  }

  return offline(id, source, now(), await seedOf(adapter));
}

/** Spec §5.2. Never throws: the worst case is an empty layer with status "offline". */
export async function getLayer(id: LayerId, deps: Deps = {}): Promise<LayerResponse> {
  const now = deps.now ?? Date.now;
  const adapter = registry[id];
  if (!adapter) return offline(id, { name: id, url: "" }, now());
  try {
    const hit = cache.get(id);
    if (hit && now() - hit.at < hit.ttlMs) return hit.res;
    let pending = inflight.get(id);
    if (!pending) {
      pending = resolve(id, adapter, deps)
        .then((res) => {
          const full = res.status === "live" || res.status === "static";
          cache.set(id, { at: now(), ttlMs: full ? adapter.ttl * 1000 : Math.min(adapter.ttl * 1000, FALLBACK_TTL_MS), res });
          return res;
        })
        .finally(() => inflight.delete(id));
      inflight.set(id, pending);
    }
    return await pending;
  } catch (err) {
    console.warn(`[layer:${id}] unexpected failure: ${reason(err)}`);
    return offline(id, adapter.source, now());
  }
}
