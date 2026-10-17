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

test("a stale or offline answer is re-fetched after 61 s, however long the adapter ttl is; a live one is not", async () => {
  const failing = setAdapter({ ttl: 3600, fetch: vi.fn(async () => Promise.reject(new Error("boom"))) });
  const snapshots = memorySnapshots();

  expect((await getLayer("air", { now, snapshots })).status).toBe("offline");
  await getLayer("air", { now: () => NOW + 59_000, snapshots });
  expect(failing.fetch).toHaveBeenCalledTimes(1);
  await getLayer("air", { now: () => NOW + 61_000, snapshots });
  expect(failing.fetch).toHaveBeenCalledTimes(2);

  resetLayerCache();
  const live = setAdapter({ ttl: 3600 });
  await getLayer("air", { now, snapshots });
  await getLayer("air", { now: () => NOW + 61_000, snapshots });
  expect(live.fetch).toHaveBeenCalledTimes(1);

  resetLayerCache();
  const stale = setAdapter({ ttl: 3600, fetch: vi.fn(async () => Promise.reject(new Error("boom"))) });
  expect((await getLayer("air", { now, snapshots: memorySnapshots({ air: snapshot }) })).status).toBe("stale");
  await getLayer("air", { now: () => NOW + 61_000, snapshots: memorySnapshots({ air: snapshot }) });
  expect(stale.fetch).toHaveBeenCalledTimes(2);
});

test("the race honors the adapter's own timeoutMs, and the deps override wins", async () => {
  const slow = (ms: number) => vi.fn((signal?: AbortSignal) => new Promise<Feature[]>((resolve, reject) => {
    const t = setTimeout(() => resolve([feat("late")]), ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(new Error("aborted"))), { once: true });
  }));
  setAdapter({ timeoutMs: 400, fetch: slow(150) });
  expect((await getLayer("air", { snapshots: memorySnapshots() })).status).toBe("live"); // 150 ms < 400 ms (default budget is 8 s)

  resetLayerCache();
  setAdapter({ timeoutMs: 40, fetch: slow(300) });
  expect((await getLayer("air", { snapshots: memorySnapshots() })).status).toBe("offline"); // adapter budget exceeded

  resetLayerCache();
  setAdapter({ timeoutMs: 40, fetch: slow(150) });
  expect((await getLayer("air", { snapshots: memorySnapshots(), timeoutMs: 400 })).status).toBe("live");
});

test("concurrent calls for one layer share a single adapter.fetch", async () => {
  const adapter = setAdapter();
  const snapshots = memorySnapshots();

  const all = await Promise.all([1, 2, 3, 4, 5, 6].map(() => getLayer("air", { now, snapshots })));

  expect(adapter.fetch).toHaveBeenCalledTimes(1);
  expect(new Set(all.map((r) => r.updatedAt)).size).toBe(1);
  expect(all.every((r) => r.status === "live")).toBe(true);
});
