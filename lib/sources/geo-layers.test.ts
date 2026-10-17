import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getLayer, resetLayerCache } from "@/lib/server/layer";
import { memorySnapshots } from "@/lib/server/supabase";

// Real registry, real baked data: the geo layers as getLayer serves them (offline snapshots, no network for the static ones).
let deps = { snapshots: memorySnapshots(), timeoutMs: 2000 };
beforeEach(() => {
  deps = { snapshots: memorySnapshots(), timeoutMs: 2000 };
  resetLayerCache();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 }))); // power, heating, water all "down"
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("baked layers resolve as static; buses merge stops and routes", async () => {
  const [buses, parking, schools] = await Promise.all((["buses", "parking", "schools"] as const).map((id) => getLayer(id, deps)));
  for (const l of [buses, parking, schools]) expect(l.status).toBe("static");
  const kinds = new Set(buses.features.features.map((f) => f.properties?.kind));
  expect(kinds).toEqual(new Set(["bus-stop", "bus-route"]));
  expect(parking.features.features.length).toBeGreaterThan(100);
});

test("water: announcements for today that name no place serve the seed (demo data), not an empty live layer", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }).setSystemTime(Date.parse("2026-10-17T10:00:00Z"));
  const html =
    '<div id="pills-tabContent"><p>Ве известуваме дека на ден 17.10.2026 поради дефект на ул. Непозната бр.5 од 09:00 часот до 12:00 часот.</p></div>';
  vi.stubGlobal("fetch", vi.fn(async () => new Response(html)));
  const layer = await getLayer("outages-water", deps);
  vi.useRealTimers();
  expect(layer.status).toBe("offline");
  expect(layer.features.features.length).toBeGreaterThanOrEqual(2);
});

test("water: a live page with nothing announced for today is an honest empty live layer, not demo data", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }).setSystemTime(Date.parse("2026-10-17T10:00:00Z")); // the fixture's newest announcement is 15.10
  const html = readFileSync(new URL("./__fixtures__/vodovod.html", import.meta.url), "utf8");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(html)));
  const layer = await getLayer("outages-water", deps);
  vi.useRealTimers();
  expect(layer.status).toBe("live");
  expect(layer.features.features).toEqual([]);
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
