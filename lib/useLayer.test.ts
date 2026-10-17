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
