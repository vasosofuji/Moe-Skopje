import { beforeEach, expect, test, vi } from "vitest";
import type { Adapter, Feature } from "@/lib/sources/types";
import { getLayer, resetLayerCache } from "./layer";
import { memorySnapshots, type SnapshotStore } from "./supabase";

// Failure modes around the chain; the main fallback order is covered in layer.test.ts.
const { registry } = vi.hoisted(() => ({ registry: {} as Record<string, Adapter> }));
vi.mock("@/lib/sources/registry", () => ({ registry }));

const NOW = Date.parse("2026-10-17T10:00:00Z");
const now = () => NOW;

const feat = (id: string): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [21.43, 42.0] },
  properties: { id, kind: "air-station", title: { mk: "Центар", en: "Centar" } },
});

const boom = () => Promise.reject(new Error("boom"));

function setAdapter(over: Partial<Adapter> = {}): Adapter {
  return (registry.air = {
    id: "air",
    ttl: 60,
    source: { name: "Test source", url: "https://example.test" },
    fetch: vi.fn(async () => [feat("a")]),
    seed: vi.fn(async () => [feat("seed")]),
    ...over,
  });
}

beforeEach(() => {
  resetLayerCache();
  delete registry.air;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

test("never throws: fetch, snapshot read and seed all failing gives an empty offline layer", async () => {
  setAdapter({ fetch: boom, seed: boom });
  const snapshots: SnapshotStore = { get: boom, put: boom };

  const res = await getLayer("air", { now, snapshots });

  expect(res.status).toBe("offline");
  expect(res.features).toEqual({ type: "FeatureCollection", features: [] });
  expect(res.source.name).toBe("Test source");
});

test("an id with no adapter gives an empty offline layer", async () => {
  const res = await getLayer("waste", { now, snapshots: memorySnapshots() });
  expect(res.status).toBe("offline");
  expect(res.features.features).toEqual([]);
});

test("a fetch that never settles times out and falls back to the snapshot", async () => {
  setAdapter({ fetch: () => new Promise<Feature[]>(() => {}) });
  const snapshots = memorySnapshots({ air: { payload: [feat("snap")], fetchedAt: "2026-10-17T08:00:00.000Z" } });

  const res = await getLayer("air", { now, snapshots, timeoutMs: 20 });

  expect(res.status).toBe("stale");
});

test("a failing snapshot write does not fail a live response", async () => {
  setAdapter();
  const snapshots: SnapshotStore = { get: async () => null, put: boom };

  const res = await getLayer("air", { now, snapshots });

  expect(res.status).toBe("live");
});

test("a fallback response is cached for the ttl too, so a dead source is not retried on every request", async () => {
  const adapter = setAdapter({ fetch: vi.fn(boom) });
  const snapshots = memorySnapshots();

  await getLayer("air", { now, snapshots });
  await getLayer("air", { now: () => NOW + 30_000, snapshots });

  expect(adapter.fetch).toHaveBeenCalledTimes(1);
});
