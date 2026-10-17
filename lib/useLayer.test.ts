import { afterEach, expect, test, vi } from "vitest";
import { getCachedLayer, refreshLayer } from "./useLayer";

afterEach(() => vi.unstubAllGlobals());

const ok = (body: unknown) => ({ ok: true, json: async () => body });

test("concurrent and fresh refreshes share one request; a stale copy is re-fetched", async () => {
  const fetch = vi.fn(async () => ok({ id: "air", features: { type: "FeatureCollection", features: [] } }));
  vi.stubGlobal("fetch", fetch);
  await Promise.all([refreshLayer("air"), refreshLayer("air")]);
  await refreshLayer("air");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(getCachedLayer("air")?.id).toBe("air");

  await refreshLayer("air", Date.now() + 60_000);
  expect(fetch).toHaveBeenCalledTimes(2);
});

test("a 404 clears the data; a network error keeps the last good copy", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ok({ id: "buses" })));
  await refreshLayer("buses");
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
  await refreshLayer("buses", Date.now() + 60_000);
  expect(getCachedLayer("buses")?.id).toBe("buses");

  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })));
  await refreshLayer("buses", Date.now() + 120_000);
  expect(getCachedLayer("buses")).toBeUndefined();
});

test("a poll with the same features keeps the old features object, so the map skips setData", async () => {
  const fc = (n: number) => ({ type: "FeatureCollection", features: [{ type: "Feature", properties: { n }, geometry: null }] });
  vi.stubGlobal("fetch", vi.fn(async () => ok({ id: "weather", updatedAt: "a", features: fc(1) })));
  await refreshLayer("weather");
  const first = getCachedLayer("weather")?.features;

  vi.stubGlobal("fetch", vi.fn(async () => ok({ id: "weather", updatedAt: "b", features: fc(1) })));
  await refreshLayer("weather", Date.now() + 60_000);
  expect(getCachedLayer("weather")?.updatedAt).toBe("b");
  expect(getCachedLayer("weather")?.features).toBe(first);

  vi.stubGlobal("fetch", vi.fn(async () => ok({ id: "weather", updatedAt: "c", features: fc(2) })));
  await refreshLayer("weather", Date.now() + 120_000);
  expect(getCachedLayer("weather")?.features).not.toBe(first);
});
