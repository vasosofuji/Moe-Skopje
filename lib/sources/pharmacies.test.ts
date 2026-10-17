import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import { markOnDuty, matchRoster, parseRoster, pharmacies, readRosterXlsx, rosterUrl, type Cell } from "./pharmacies";
import { municipalities, staticAdapter } from "./static";
import { FeatureSchema, type Feature } from "./types";

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url));
const xlsx = () => {
  const b = fixture("fzo-dezurni-apteki.xlsx");
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const page = () => fixture("fzo-dezurni-apteki.html").toString("utf8");

const pharmacy = (mk: string, opening_hours?: string): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [21.43, 42] },
  properties: { id: `pharmacy:${mk}`, kind: "pharmacy", title: { mk, en: mk }, ...(opening_hours ? { detail: { opening_hours } } : {}) },
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("markOnDuty marks by normalised name, or by opening_hours 24/7 without a roster", () => {
  const [a, b] = markOnDuty([pharmacy("Билна Аптека"), pharmacy("Zegin")], ["БИЛНА АПТЕКА 2", "зегин"]);
  expect([a, b].map((f) => f.properties.detail?.onDuty)).toEqual([1, 1]);
  const [open247, regular, unknown] = markOnDuty([pharmacy("A", "24/7"), pharmacy("B", "Mo-Fr 08:00-20:00"), pharmacy("C")]);
  expect([open247, regular, unknown].map((f) => f.properties.detail?.onDuty)).toEqual([1, 0, 0]);
  expect(open247.properties.detail?.opening_hours).toBe("24/7");
});

test("rosterUrl picks the current month's file by date, not the first or newest link", () => {
  expect(rosterUrl(page(), "2026-10-17")).toBe("https://fzo.org.mk/sites/default/files/fzo/apteki/dezurni/261007-raspored-dezurni-apteki-10.2026.xlsx");
  expect(rosterUrl(page(), "2026-03-02")).toBe("https://fzo.org.mk/sites/default/files/fzo/apteki/dezurni/260306-raspored-dezurni-apteki-03.2026.xlsx");
  expect(rosterUrl(page(), "2027-01-05")).toBeNull();
});

test("parseRoster reads today's Skopje rows from the real October 2026 XLSX", async () => {
  const rows = await readRosterXlsx(xlsx());
  const duty = parseRoster(rows, "2026-10-17");
  expect(duty).toHaveLength(5); // Skopje only; Bitola, Veles and the rest are ignored
  expect(duty.map((d) => d.name)).toContain("ЗЕГИН ГРАДСКА БОЛНИЦА");
  expect(duty.find((d) => d.name === "ВИОЛА 7 ТОБАКО")).toMatchObject({ municipality: "Аеродром", phone: "02/2 466-103" });
  expect(duty.find((d) => d.name === "ЗЕГИН - БУЊАКОВЕЦ")?.municipality).toBe("Центар");
  expect(parseRoster(rows, "2026-11-02")).toEqual([]); // outside the month
});

test("parseRoster handles date ranges, single dates and Excel dates", () => {
  const row = (date: Cell): Cell[] => [1, "СКОПЈЕ-КАРПОШ", "Тест", date, "02/1", "дежурство"];
  const rows = [row("01.10.2026 ДО 31.10.2026"), row("17.10.2026"), row(new Date("2026-10-17T00:00:00Z")), row("16.10.2026"), row("20.10-25.10.2026"), row(null)];
  expect(parseRoster(rows, "2026-10-17")).toHaveLength(3);
  expect(parseRoster(rows, "2026-10-22")).toHaveLength(2); // the October range and 20.10-25.10
});

test("matchRoster flags specific matches, keeps ambiguous brands unflagged and places them at the municipality centroid", async () => {
  const osm = await staticAdapter("pharmacies", "pharmacies.geojson", "pharmacy").fetch();
  const duty = parseRoster(await readRosterXlsx(xlsx()), "2026-10-17");
  const res = matchRoster(osm, duty, await municipalities());
  const on = (f: Feature) => f.properties.detail?.onDuty === 1;
  expect(res).toMatchObject({ matched: 2, placed: 3, skipped: 0 });
  // specific names match their OSM pharmacy ...
  expect(res.features.filter((f) => on(f) && f.properties.detail?.approx !== 1).map((f) => f.properties.title.mk).sort()).toEqual(
    ["ЕуроФарм Тафталиџе", "Зегин (градска болница)"].sort(),
  );
  // ... a bare brand (21 Зегин, 12 Еурофарм in OSM) never lights up every branch; "Виола 7" is not "Виола - Тобако 2"
  const placed = res.features.filter((f) => f.properties.detail?.approx === 1);
  expect(placed.map((f) => f.properties.title.mk).sort()).toEqual(["Виола 7 Тобако", "Еурофарм Разловечко Востание", "Зегин - Буњаковец"].sort());
  expect(placed.every((f) => on(f) && f.geometry.type === "Point" && f.properties.detail?.municipality)).toBe(true);
  expect(new Set(placed.map((f) => JSON.stringify(f.geometry))).size).toBe(placed.length); // none stacked on another
  expect(res.features.every((f) => FeatureSchema.safeParse(f).success)).toBe(true);
  expect(res.features).toHaveLength(osm.length + res.placed);
});

function stubFzo() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      String(url).endsWith(".xlsx") ? new Response(xlsx()) : new Response(page()),
    ),
  );
}

test("pharmacies.fetch is live when today's roster matches, using the current month's file", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }).setSystemTime(Date.parse("2026-10-17T10:00:00Z"));
  stubFzo();
  const features = await pharmacies.fetch();
  expect(features.filter((f) => f.properties.detail?.onDuty === 1).length).toBeGreaterThanOrEqual(5);
  expect(features.every((f) => FeatureSchema.safeParse(f).success)).toBe(true);
  expect(vi.mocked(fetch).mock.calls.map((c) => String(c[0]))).toEqual([
    "https://fzo.org.mk/dezurni-apteki",
    "https://fzo.org.mk/sites/default/files/fzo/apteki/dezurni/261007-raspored-dezurni-apteki-10.2026.xlsx",
  ]);
});

test("pharmacies.fetch throws (so getLayer serves the seed) when there is no file for the month or nobody on duty", async () => {
  stubFzo();
  vi.useFakeTimers({ toFake: ["Date"] }).setSystemTime(Date.parse("2027-01-05T10:00:00Z"));
  await expect(pharmacies.fetch()).rejects.toThrow(/roster/);
  vi.setSystemTime(Date.parse("2026-10-17T10:00:00Z"));
  vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
  await expect(pharmacies.fetch()).rejects.toThrow(/HTTP 503/);
});

test("pharmacies adapter: ttl 3600, not static, seed is the OSM 24/7 data", async () => {
  expect(pharmacies).toMatchObject({ id: "pharmacies", ttl: 3600 });
  expect(pharmacies.static).toBeFalsy();
  const seed = await pharmacies.seed();
  expect(seed.length).toBeGreaterThan(100);
  expect(seed.every((f) => FeatureSchema.safeParse(f).success && f.properties.kind === "pharmacy")).toBe(true);
  expect(seed.every((f) => f.properties.detail?.onDuty === (String(f.properties.detail?.opening_hours ?? "").includes("24/7") ? 1 : 0))).toBe(true);
});
