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
  expect(parking.features.features.map((f) => f.properties?.kind)).toEqual(Array(5).fill("parking-zone")); // zone polygons, not OSM lots
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
  expect(power.features.features.every((f) => f.properties?.kind === "outage" && f.geometry.type === "MultiLineString")).toBe(true); // street-level seeds
});

test("/api/outages with every source down: the seeds are a 7-day schedule of street-level demo outages starting today", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }).setSystemTime(Date.parse("2026-10-17T08:00:00Z")); // 10:00 in Skopje
  const { GET } = await import("@/app/api/outages/route");
  const res = await GET(new Request("http://localhost/api/outages?days=7"));
  const { days } = (await res.json()) as { days: { date: string; items: { type: string; status: string; streets: string[]; bbox: number[] }[] }[] };
  expect(days).toHaveLength(7);
  expect(days[0].date).toBe("2026-10-17");
  const all = days.flatMap((d) => d.items);
  expect(new Set(all.map((i) => i.type))).toEqual(new Set(["water", "power", "heating"]));
  expect(days[0].items.map((i) => i.type).sort()).toEqual(["heating", "power", "water"]); // seeds are rebased so the first outage of each layer is today
  expect(days.filter((d) => d.items.length > 0).length).toBeGreaterThanOrEqual(5); // spread over the week
  for (const i of all) {
    expect(i.status).toBe("offline"); // demo data, honestly flagged
    expect(i.streets.length).toBeGreaterThan(0);
    expect(i.bbox[0]).toBeLessThan(i.bbox[2]);
  }
});
