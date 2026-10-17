import { beforeEach, expect, test, vi } from "vitest";
import { getLayer, resetLayerCache } from "@/lib/server/layer";
import { memorySnapshots } from "@/lib/server/supabase";

// Real registry, real baked data: the geo layers as getLayer serves them (offline snapshots, no network for the static ones).
const deps = { snapshots: memorySnapshots(), timeoutMs: 2000 };
beforeEach(() => {
  resetLayerCache();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 }))); // power, heating, water all "down"
});

test("baked layers resolve as static; buses merge stops and routes", async () => {
  const [buses, parking, schools] = await Promise.all((["buses", "parking", "schools"] as const).map((id) => getLayer(id, deps)));
  for (const l of [buses, parking, schools]) expect(l.status).toBe("static");
  const kinds = new Set(buses.features.features.map((f) => f.properties?.kind));
  expect(kinds).toEqual(new Set(["bus-stop", "bus-route"]));
  expect(parking.features.features.length).toBeGreaterThan(100);
});

test("outages and pharmacies fall back to a valid seed (offline) when the live source is down", async () => {
  for (const id of ["outages-power", "outages-water", "outages-heating", "pharmacies"] as const) {
    const layer = await getLayer(id, deps);
    expect(layer.status, id).toBe("offline");
    expect(layer.features.features.length, id).toBeGreaterThanOrEqual(2);
  }
  const power = await getLayer("outages-power", deps);
  expect(power.features.features.every((f) => f.properties?.kind === "outage" && /Polygon/.test(f.geometry.type))).toBe(true);
});
