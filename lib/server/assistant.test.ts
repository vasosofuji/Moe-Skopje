import { afterEach, expect, test } from "vitest";
import type { Feature, LayerResponse } from "@/lib/sources/types";
import { ASSISTANT_PER_HOUR, allowMessage, findPlace, makeTools, summarizeLayer } from "./assistant";
import { POST } from "@/app/api/assistant/route";

const point = (id: string, lng: number, lat: number, severity?: 0 | 1 | 2 | 3): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lng, lat] },
  properties: { id, kind: "air-station", title: { mk: `Станица ${id}`, en: `Station ${id}` }, severity, value: 40, unit: "µg/m³" },
});

const layer = (features: Feature[], status: LayerResponse["status"] = "live", minutesAgo = 3): LayerResponse => ({
  id: "air",
  status,
  updatedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  source: { name: "Pulse.eco", url: "https://skopje.pulse.eco" },
  features: { type: "FeatureCollection", features },
});

const rows = (text: string) => text.split("\n").filter((l) => /^s\d+ \|/.test(l));

test("summarizeLayer caps at 15 features and includes status + age", () => {
  const features = Array.from({ length: 20 }, (_, i) => point(`s${i}`, 21.4 + i / 100, 42, i === 7 ? 3 : 0));
  const text = summarizeLayer(layer(features, "stale", 3), "mk");

  expect(text).toContain("status stale");
  expect(text).toContain("3 min");
  expect(text).toContain("Pulse.eco");
  expect(rows(text)).toHaveLength(15);
  expect(rows(text)[0]).toMatch(/^s7 \| Станица s7 \| 40 µg\/m³ \|/); // highest severity first, title in the asked language
  expect(summarizeLayer(layer(features), "en")).toContain("Station s7");
  expect(summarizeLayer(layer([], "offline"), "en")).toContain("demo data");
});

test("summarizeLayer with near sorts by distance", () => {
  const features = [point("s1", 21.5, 42.05, 3), point("s2", 21.43, 42.0), point("s3", 21.45, 42.01)];
  const ids = rows(summarizeLayer(layer(features), "en", [21.425, 41.998])).map((l) => l.split(" | ")[0]);
  expect(ids).toEqual(["s2", "s3", "s1"]);
});

test("find_place matches Latin input to Cyrillic name", async () => {
  const [first] = await findPlace("karpos");
  expect(first.name).toBe("Карпош");
  // a point inside the Skopje bbox (21.25,41.90,21.60,42.10)
  expect(first.lng).toBeGreaterThan(21.25);
  expect(first.lng).toBeLessThan(21.6);
  expect(first.lat).toBeGreaterThan(41.9);
  expect(first.lat).toBeLessThan(42.1);

  expect((await findPlace("Aerodrom"))[0].name).toBe("Аеродром");
  expect((await findPlace("ka")).length).toBeLessThanOrEqual(5);
  expect(await findPlace("k")).toEqual([]); // one letter is too short to search
});

test("the tools are get_layer, list_reports and find_place, with eager input streaming", () => {
  const tools = makeTools("mk", []);
  expect(tools.map((t) => t.name)).toEqual(["get_layer", "list_reports", "find_place"]);
  expect(tools.every((t) => t.eager_input_streaming)).toBe(true);
});

test("allowMessage lets 20 messages per device through each hour", () => {
  const t0 = 1_000_000;
  for (let i = 0; i < ASSISTANT_PER_HOUR; i++) expect(allowMessage("device-a", t0 + i)).toBe(true);
  expect(allowMessage("device-a", t0 + 100)).toBe(false);
  expect(allowMessage("device-b", t0 + 100)).toBe(true); // per device
  expect(allowMessage("device-a", t0 + 60 * 60_000 + 1)).toBe(true); // the oldest one has aged out
});

const savedKey = process.env.ANTHROPIC_API_KEY;
afterEach(() => {
  if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = savedKey;
});

test("POST /api/assistant is 503 { code: disabled } without ANTHROPIC_API_KEY", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const res = await POST(
    new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json", "x-device-id": "0b6f1c1e-7a52-4b43-8d0e-9f3a7c2b1d11" },
      body: JSON.stringify({ lang: "mk", messages: [{ role: "user", content: "Каков е воздухот во Карпош?" }] }),
    }),
  );
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({ code: "disabled" });
});
