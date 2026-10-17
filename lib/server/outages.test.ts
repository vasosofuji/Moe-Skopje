import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Feature, LayerResponse, Status } from "@/lib/sources/types";
import { groupOutages } from "./outages";

vi.mock("./layer", () => ({ getLayer: vi.fn() }));
import { getLayer } from "./layer";
import { GET } from "@/app/api/outages/route";

const line = (lng: number, lat = 42.0): GeoJSON.MultiLineString => ({ type: "MultiLineString", coordinates: [[[lng, lat], [lng + 0.01, lat + 0.005]]] });

/** One street feature of an outage group, as the outage adapters emit it. */
const street = (id: "outages-water" | "outages-power" | "outages-heating", name: string, municipality: string, startsAt: string, endsAt: string, lng: number, extra: Record<string, string | number> = {}): Feature => {
  const outage = `${id}:${municipality}:${startsAt}:${endsAt}`;
  return {
    type: "Feature",
    geometry: line(lng),
    properties: {
      id: `${outage}:${name}`,
      kind: "outage",
      title: { mk: name, en: name },
      severity: 2,
      startsAt,
      endsAt,
      detail: { municipality, type: id.replace("outages-", ""), outage, streets: name, ...extra },
    },
  };
};
const layer = (id: string, features: Feature[], status: Status = "live"): LayerResponse => ({
  id,
  status,
  updatedAt: "2026-10-17T08:00:00.000Z",
  source: { name: "t", url: "" },
  features: { type: "FeatureCollection", features },
});

const NOW = Date.parse("2026-10-17T08:00:00Z"); // 10:00 on 17 October in Skopje (+02:00)

test("groupOutages returns exactly `days` Skopje days starting today, empty days included", () => {
  const out = groupOutages([layer("outages-water", [])], NOW, 7);
  expect(out.map((d) => d.date)).toEqual(["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]);
  expect(out.every((d) => d.items.length === 0)).toBe(true);
  expect(groupOutages([], NOW, 3).map((d) => d.date)).toEqual(["2026-10-17", "2026-10-18", "2026-10-19"]);
});

test("the days follow Europe/Skopje, not UTC, and cross the DST switch by date", () => {
  // 00:30 on 18 October in Skopje is still the 17th in UTC
  const late = Date.parse("2026-10-17T22:30:00Z");
  expect(groupOutages([], late, 2).map((d) => d.date)).toEqual(["2026-10-18", "2026-10-19"]);
  // the clocks go back on 25 October 2026; the date list does not skip or repeat a day
  const across = Date.parse("2026-10-24T10:00:00Z");
  expect(groupOutages([], across, 3).map((d) => d.date)).toEqual(["2026-10-24", "2026-10-25", "2026-10-26"]);
});

test("an outage starting at 01:00 Skopje time on the 18th (23:00 UTC on the 17th) belongs to the 18th", () => {
  const f = street("outages-power", "Борка Талески", "Карпош", "2026-10-18T01:00:00+02:00", "2026-10-18T05:00:00+02:00", 21.4);
  const out = groupOutages([layer("outages-power", [f])], NOW, 7);
  expect(out.map((d) => d.items.length)).toEqual([0, 1, 0, 0, 0, 0, 0]);
});

test("the street features of one outage become one item with all its streets and the union bbox", () => {
  const a = street("outages-water", "Ванчо Мицков", "Карпош", "2026-10-17T09:00:00+02:00", "2026-10-17T15:00:00+02:00", 21.4);
  const b = { ...street("outages-water", "Бранислав Нушиќ", "Карпош", "2026-10-17T09:00:00+02:00", "2026-10-17T15:00:00+02:00", 21.41, {}), geometry: line(21.41, 41.99) };
  const out = groupOutages([layer("outages-water", [a, b])], NOW, 7);
  expect(out[0].items).toHaveLength(1);
  expect(out[0].items[0]).toEqual({
    id: "outages-water:Карпош:2026-10-17T09:00:00+02:00:2026-10-17T15:00:00+02:00",
    type: "water",
    status: "live",
    startsAt: "2026-10-17T09:00:00+02:00",
    endsAt: "2026-10-17T15:00:00+02:00",
    municipality: "Карпош",
    streets: ["Ванчо Мицков", "Бранислав Нушиќ"],
    bbox: [21.4, 41.99, 21.42, 42.005],
  });
});

test("water, power and heating are merged into one list per day, ordered by start time then type, with each layer's own status", () => {
  const w = street("outages-water", "А", "Карпош", "2026-10-17T13:00:00+02:00", "2026-10-17T16:00:00+02:00", 21.4);
  const p = street("outages-power", "Б", "Аеродром", "2026-10-17T09:00:00+02:00", "2026-10-17T12:00:00+02:00", 21.45);
  const h = street("outages-heating", "В", "Центар", "2026-10-17T09:00:00+02:00", "2026-10-17T20:00:00+02:00", 21.43);
  const out = groupOutages([layer("outages-water", [w]), layer("outages-power", [p], "offline"), layer("outages-heating", [h], "stale")], NOW, 7);
  expect(out[0].items.map((i) => [i.type, i.status])).toEqual([["heating", "stale"], ["power", "offline"], ["water", "live"]]); // same start: by type
});

test("an outage that spans several days is listed on each of them; one that ended or lies beyond the window is not", () => {
  const long = street("outages-heating", "Беласица", "Центар", "2026-10-18T06:00:00+02:00", "2026-10-20T18:00:00+02:00", 21.43);
  const ended = street("outages-power", "Стара", "Карпош", "2026-10-17T06:00:00+02:00", "2026-10-17T09:30:00+02:00", 21.4); // over at 09:30, now is 10:00
  const later = street("outages-power", "Далечна", "Карпош", "2026-10-30T06:00:00+01:00", "2026-10-30T09:00:00+01:00", 21.4);
  const ids = groupOutages([layer("outages-heating", [long]), layer("outages-power", [ended, later])], NOW, 7).map((d) => d.items.map((i) => i.streets[0]));
  expect(ids).toEqual([[], ["Беласица"], ["Беласица"], ["Беласица"], [], [], []]);
});

test("an outage that ends exactly at midnight does not spill into the next day", () => {
  const f = street("outages-power", "Полноќ", "Карпош", "2026-10-17T22:00:00+02:00", "2026-10-18T00:00:00+02:00", 21.4);
  expect(groupOutages([layer("outages-power", [f])], NOW, 7).map((d) => d.items.length)).toEqual([1, 0, 0, 0, 0, 0, 0]);
});

test("an approximate outage (municipality polygon) lists its raw street text and the polygon's bbox", () => {
  const poly: Feature = {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [[[21.35, 41.96], [21.44, 41.96], [21.44, 42.04], [21.35, 42.04], [21.35, 41.96]]] },
    properties: {
      id: "outages-power:Карпош:2026-10-17T09:00:00+02:00:2026-10-17T14:00:00+02:00",
      kind: "outage",
      title: { mk: "Карпош", en: "Karposh" },
      startsAt: "2026-10-17T09:00:00+02:00",
      endsAt: "2026-10-17T14:00:00+02:00",
      detail: { municipality: "Карпош", type: "power", approx: 1, streets: "ул. Непозната бр. 5; ул. Друга", outage: "outages-power:Карпош:2026-10-17T09:00:00+02:00:2026-10-17T14:00:00+02:00" },
    },
  };
  const [item] = groupOutages([layer("outages-power", [poly])], NOW, 7)[0].items;
  expect(item.streets).toEqual(["ул. Непозната бр. 5", "ул. Друга"]);
  expect(item.bbox).toEqual([21.35, 41.96, 21.44, 42.04]);
  expect(item.municipality).toBe("Карпош");
});

test("a feature without detail.outage (an old snapshot) is an item of its own, typed from its layer", () => {
  const old: Feature = {
    type: "Feature",
    geometry: line(21.4),
    properties: { id: "outages-water:Карпош:2026-10-17T09:00:00+02:00", kind: "outage", title: { mk: "Карпош", en: "Karposh" }, startsAt: "2026-10-17T09:00:00+02:00", endsAt: "2026-10-17T15:00:00+02:00" },
  };
  const [item] = groupOutages([layer("outages-water", [old])], NOW, 7)[0].items;
  expect(item).toMatchObject({ id: "outages-water:Карпош:2026-10-17T09:00:00+02:00", type: "water", municipality: "Карпош", streets: [] });
});

// --- GET /api/outages --------------------------------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.mocked(getLayer).mockImplementation(async (id) => {
    const f = street(id as "outages-water", "Ванчо Мицков", "Карпош", "2026-10-18T09:00:00+02:00", "2026-10-18T15:00:00+02:00", 21.4);
    return layer(id, id === "outages-water" ? [f] : []);
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.mocked(getLayer).mockReset();
});

const call = (qs = "") => GET(new Request(`http://localhost/api/outages${qs}`));

test("GET /api/outages?days=7 → { days: [{ date, items }] } with 7 days and the layers route's cache header", async () => {
  const res = await call("?days=7");
  expect(res.status).toBe(200);
  const body = (await res.json()) as { days: { date: string; items: { id: string; type: string; status: string; bbox: number[] }[] }[] };
  expect(body.days).toHaveLength(7);
  expect(body.days[0].date).toBe("2026-10-17");
  expect(body.days[1].items).toHaveLength(1);
  expect(body.days[1].items[0]).toMatchObject({ type: "water", status: "live", bbox: [21.4, 42, 21.41, 42.005] });
  expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=900, stale-while-revalidate=9000"); // the power layer's 900 s is the shortest
});

test("days defaults to 7 and is clamped to 1..14; junk is the default", async () => {
  const n = async (qs: string) => ((await (await call(qs)).json()) as { days: unknown[] }).days.length;
  expect(await n("")).toBe(7);
  expect(await n("?days=abc")).toBe(7);
  expect(await n("?days=0")).toBe(1);
  expect(await n("?days=3")).toBe(3);
  expect(await n("?days=99")).toBe(14);
});
