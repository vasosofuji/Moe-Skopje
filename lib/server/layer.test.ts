import { beforeEach, expect, test, vi } from "vitest";
import type { Adapter, Feature } from "@/lib/sources/types";
import { getLayer, resetLayerCache } from "./layer";
import { memorySnapshots } from "./supabase";

// getLayer reads the adapter from the registry; tests swap it for their own adapters.
const { registry } = vi.hoisted(() => ({ registry: {} as Record<string, Adapter> }));
vi.mock("@/lib/sources/registry", () => ({ registry }));

const NOW = Date.parse("2026-10-17T10:00:00Z");
const now = () => NOW;

const feat = (id: string): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [21.43, 42.0] },
  properties: { id, kind: "air-station", title: { mk: "Центар", en: "Centar" }, severity: 1, value: 12, unit: "µg/m³" },
});

function setAdapter(over: Partial<Adapter> = {}): Adapter {
  const adapter: Adapter = {
    id: "air",
    ttl: 60,
    source: { name: "Test source", url: "https://example.test" },
    fetch: vi.fn(async () => [feat("a"), feat("b")]),
    seed: vi.fn(async () => [feat("seed")]),
    ...over,
  };
  registry.air = adapter;
  return adapter;
}

const snapshot = { payload: [feat("snap")], fetchedAt: "2026-10-17T08:00:00.000Z" };
const ids = (res: Awaited<ReturnType<typeof getLayer>>) => res.features.features.map((f) => f.properties?.id);

beforeEach(() => {
  resetLayerCache();
  delete registry.air;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

test("live fetch returns status live and writes a snapshot", async () => {
  const snapshots = memorySnapshots();
  const put = vi.spyOn(snapshots, "put");
  setAdapter();

  const res = await getLayer("air", { now, snapshots });

  expect(res.status).toBe("live");
  expect(res.updatedAt).toBe(new Date(NOW).toISOString());
  expect(res.source).toEqual({ name: "Test source", url: "https://example.test" });
  expect(ids(res)).toEqual(["a", "b"]);
  expect(put).toHaveBeenCalledTimes(1);
  expect(put).toHaveBeenCalledWith("air", expect.arrayContaining([expect.objectContaining({ type: "Feature" })]));
});

test("adapter throws → latest snapshot with status stale and its fetchedAt", async () => {
  setAdapter({ fetch: vi.fn(async () => Promise.reject(new Error("boom"))) });

  const res = await getLayer("air", { now, snapshots: memorySnapshots({ air: snapshot }) });

  expect(res.status).toBe("stale");
  expect(res.updatedAt).toBe(snapshot.fetchedAt);
  expect(ids(res)).toEqual(["snap"]);
});

test("adapter throws, no snapshot → seed with status offline", async () => {
  setAdapter({ fetch: vi.fn(async () => Promise.reject(new Error("boom"))) });

  const res = await getLayer("air", { now, snapshots: memorySnapshots() });

  expect(res.status).toBe("offline");
  expect(ids(res)).toEqual(["seed"]);
});

test("fewer features than minFeatures counts as failure → stale", async () => {
  setAdapter({ minFeatures: 1, fetch: vi.fn(async () => []) });

  const res = await getLayer("air", { now, snapshots: memorySnapshots({ air: snapshot }) });

  expect(res.status).toBe("stale");
  expect(ids(res)).toEqual(["snap"]);
});

test("invalid feature shape counts as failure → stale", async () => {
  const bad = { type: "Feature", geometry: null, properties: { id: 1 } } as unknown as Feature;
  setAdapter({ fetch: vi.fn(async () => [bad]) });

  const res = await getLayer("air", { now, snapshots: memorySnapshots({ air: snapshot }) });

  expect(res.status).toBe("stale");
  expect(ids(res)).toEqual(["snap"]);
});

test("second call within ttl does not call adapter.fetch again", async () => {
  const adapter = setAdapter({ ttl: 60 });
  const snapshots = memorySnapshots();

  await getLayer("air", { now, snapshots });
  await getLayer("air", { now: () => NOW + 59_000, snapshots });
  expect(adapter.fetch).toHaveBeenCalledTimes(1);

  await getLayer("air", { now: () => NOW + 61_000, snapshots });
  expect(adapter.fetch).toHaveBeenCalledTimes(2);
});

test("static adapter → status static, no snapshot write", async () => {
  const snapshots = memorySnapshots();
  const put = vi.spyOn(snapshots, "put");
  setAdapter({ static: true });

  const res = await getLayer("air", { now, snapshots });

  expect(res.status).toBe("static");
  expect(ids(res)).toEqual(["a", "b"]);
  expect(put).not.toHaveBeenCalled();
});
