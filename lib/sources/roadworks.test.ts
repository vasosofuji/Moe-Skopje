import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { noticeStreets, noticeUrls, osmWorks, parseNotice, roadworks, setBaked } from "./roadworks";
import { setStreets, type StreetCollection, type StreetFeature } from "./streets";
import { FeatureSchema } from "./types";

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
const MARATHON = fixture("mvr-marathon.html");
const NEWS = "https://mvr.gov.mk/mk-MK/odnosi-so-javnost/novosti/";

/** A minimal MVR article page: title, DD/MM/YYYY date and body. */
const page = (title: string, date: string, body: string) =>
  `<html><body><section><div><h1>${title}</h1><div>${date}</div><div class="blog-content"><p>${body}</p></div></div></section></body></html>`;

// A small street index for the logic tests; the marathon test uses the real data/static/streets.geojson.
const st = (name_mk: string, municipality_mk: string, lng: number, lat = 42.0): StreetFeature => ({
  type: "Feature",
  geometry: { type: "MultiLineString", coordinates: [[[lng, lat], [lng + 0.004, lat + 0.001]]] },
  properties: { name_mk, municipality_mk },
});
const STREETS: StreetCollection = {
  type: "FeatureCollection",
  features: [st("Илинден", "Центар", 21.42), st("Никола Парапунов", "Карпош", 21.4), st("Љубљанска", "Карпош", 21.39), st("Мајка Тереза", "Бутел", 21.5, 42.08), st("Мајка Тереза", "Центар", 21.43)],
};

afterEach(() => {
  setStreets();
  setBaked();
  vi.unstubAllGlobals();
});

const BEFORE = Date.parse("2026-10-03T12:00:00Z"); // the day the marathon notice came out
const AFTER = Date.parse("2026-10-17T08:00:00Z");

// --- which articles to read ----------------------------------------------------------------------------------------------

test("noticeUrls picks recent regime and closure articles from the sitemap, not arrests or old ones", () => {
  const url = (slug: string, mod: string) => `<url><loc>${NEWS}${slug}</loc><lastmod>${mod}</lastmod><changefreq>daily</changefreq></url>`;
  const sitemap = `<urlset>${[
    url("utre-poseben-rezim-na-soobrakjaj-poradi-skopskiot-maraton", "2026-10-03T08:25:23+02:00"),
    url("privremeno-zatvoranje-na-ulica-x", "2026-10-15T08:25:23+02:00"),
    url("poseben-rezim-na-soobrakjaj-vo-skopje1", "2026-06-19T13:47:23+02:00"), // months old
    url("priveden-kriminalec-baran-so-poternica-za-zatvorska-kazna", "2026-10-16T08:00:00+02:00"),
    `<url><loc>https://mvr.gov.mk/mk-MK/ministerstvo/poseben-rezim</loc><lastmod>2026-10-16T08:00:00+02:00</lastmod></url>`,
  ].join("")}</urlset>`;
  expect(noticeUrls(sitemap, Date.parse("2026-10-17T10:00:00+02:00"))).toEqual([`${NEWS}utre-poseben-rezim-na-soobrakjaj-poradi-skopskiot-maraton`, `${NEWS}privremeno-zatvoranje-na-ulica-x`]);
});

// --- the real marathon notice, against the baked street index --------------------------------------------------------------

test("parseNotice reads the Skopje marathon notice: day, start, streets from the baked index, no far-away homonyms", () => {
  setStreets(); // the real data/static/streets.geojson, not the small index of the other tests
  const f = parseNotice(MARATHON, `${NEWS}utre-poseben-rezim-na-soobrakjaj-poradi-skopskiot-maraton`, BEFORE)!;
  expect(FeatureSchema.safeParse(f).success).toBe(true);
  const p = f.properties;
  expect(p).toMatchObject({
    id: "roadworks:mvr:utre-poseben-rezim-na-soobrakjaj-poradi-skopskiot-maraton",
    kind: "regime",
    severity: 2,
    title: { mk: "Посебен режим на сообраќај: Скопскиот маратон", en: "Special traffic regime" },
    startsAt: "2026-10-04T08:00:00+02:00",
    endsAt: "2026-10-04T12:00:00+02:00", // MVR gives no end: four hours are assumed
  });
  expect(p.detail).toMatchObject({ source: "МВР", published: "2026-10-03" });
  const streets = String(p.detail?.streets);
  for (const name of ["Крушевска Република", "Јане Сандански", "Димитрие Чуповски", "Васко Карангелевски"]) expect(streets).toContain(name);
  expect(p.detail?.approx).toBeUndefined();
  expect(f.geometry.type).toBe("MultiLineString");
  // every matched street lies in the city: nothing from Сарај or Шуто Оризари
  for (const [lng, lat] of (f.geometry as GeoJSON.MultiLineString).coordinates.flat()) {
    expect(Math.hypot((lng - 21.43) * 82, (lat - 41.997) * 111)).toBeLessThan(8); // km from the centre
  }
});

test("parseNotice drops a notice whose event is over", () => {
  expect(parseNotice(MARATHON, `${NEWS}x`, AFTER)).toBeNull();
});

// --- logic against a small index ---------------------------------------------------------------------------------------------

test("noticeStreets takes only quoted names after ул./бул., skips numbers, and keeps the homonym next to the others", () => {
  setStreets(STREETS);
  const text = "од бул.„Илинден“ лево по ул.„Никола Парапунов“, ул.„534“, ул.„9“ и ул. „Мајка Тереза“ па Љубљанска без префикс";
  const names = noticeStreets(text).map((s) => `${s.properties.name_mk} ${s.properties.municipality_mk}`);
  expect(names).toEqual(["Илинден Центар", "Никола Парапунов Карпош", "Мајка Тереза Центар"]); // not the Бутел one, 8 km away; not the bare "Љубљанска"
});

test("parseNotice reads a time range and puts the streets of the route on the map", () => {
  setStreets(STREETS);
  const f = parseNotice(
    page("Во недела поради улична трка посебен режим на сообраќај во Скопје", "08/05/2026", "На 10.05.2026 (недела) во периодот од 08:00 часот до 11:30 часот ќе се одржи трка по бул.„Илинден“ и ул.„Никола Парапунов“ во Скопје."),
    `${NEWS}vo-nedela-poradi-ulicna-trka`,
    Date.parse("2026-05-09T10:00:00Z"),
  )!;
  expect(f.properties).toMatchObject({ title: { mk: "Посебен режим на сообраќај: улична трка" }, startsAt: "2026-05-10T08:00:00+02:00", endsAt: "2026-05-10T11:30:00+02:00", detail: { streets: "Илинден; Никола Парапунов" } });
});

test("parseNotice: closure wording makes a closure, and an ongoing works notice has no end", () => {
  setStreets(STREETS);
  const closure = parseNotice(page("Затворање на ул. „Љубљанска“", "10/10/2026", "На 12.10.2026 од 22:00 до 05:00 часот ќе биде затворен сообраќајот на ул.„Љубљанска“ во Скопје."), `${NEWS}zatvoranje-na-ulica`, Date.parse("2026-10-11T10:00:00Z"))!;
  expect(closure.properties).toMatchObject({ kind: "closure", severity: 3, startsAt: "2026-10-12T22:00:00+02:00", endsAt: "2026-10-13T05:00:00+02:00" }); // overnight
  const works = parseNotice(
    page("Времен режим на сообраќај на ул. „Љубљанска“", "10/10/2026", "Од 10.10.2026 поради градежни работи, за времетраење на работите, на ул.„Љубљанска“ во Скопје е воведен времен режим на сообраќај."),
    `${NEWS}vremen-rezim-ljubljanska`,
    Date.parse("2026-10-17T10:00:00Z"),
  )!;
  expect(works.properties).toMatchObject({ kind: "works", severity: 1, startsAt: "2026-10-10T00:00:00+02:00" });
  expect(works.properties.endsAt).toBeUndefined();
});

test("parseNotice puts a notice that names only a venue at the venue, flagged approximate", () => {
  const football = parseNotice(
    page("Утре посебен режим на сообраќај во Скопје поради фудбалски натпревар на арената „Тодор Проески“", "02/10/2026", "На 03.10.2026 (сабота) со почеток од 20:45 часот ќе се одржи фудбалски натпревар на арената „Тодор Проески“ во Скопје. Единицата ќе преземе мерки за посебен режим на сообраќајот."),
    `${NEWS}utre-poseben-rezim-fudbal`,
    Date.parse("2026-10-03T10:00:00Z"),
  )!;
  expect(football.geometry).toEqual({ type: "Point", coordinates: [21.42556, 42.00571] });
  expect(football.properties.detail).toMatchObject({ approx: 1 });
  expect(football.properties).toMatchObject({ startsAt: "2026-10-03T20:45:00+02:00", endsAt: "2026-10-03T23:59:00+02:00" }); // start + 4 h would pass midnight

  const visit = parseNotice(
    page("Утре посебен режим на сообраќај во Скопје поради посета", "01/10/2026", "Утре (02.10.2026) во посета ќе присуствува претседателката. Ќе се преземат мерки за посебен режим на сообраќајот на поширокото централно подрачје на Град Скопје."),
    `${NEWS}utre-poseben-rezim-poseta`,
    Date.parse("2026-10-02T06:00:00Z"),
  )!;
  expect(visit.geometry).toEqual({ type: "Point", coordinates: [21.43179, 41.99569] });
  expect(visit.properties).toMatchObject({ startsAt: "2026-10-02T00:00:00+02:00", endsAt: "2026-10-02T23:59:00+02:00" });
});

test("parseNotice skips notices outside Skopje and notices with no place to show", () => {
  setStreets(STREETS);
  expect(parseNotice(page("Известување за времен режим на сообраќај на ГП „Делчево“", "11/09/2026", "Од 10.09.2026 поради градежни работи воведен е времен режим на сообраќај на граничниот премин."), `${NEWS}a`, AFTER)).toBeNull();
  expect(parseNotice(page("Посебен режим на сообраќај во Скопје во среда", "25/08/2026", "На 26.08.2026 во посета ќе престојува претседателот. СВР Скопје ќе преземе мерки за посебен режим на сообраќајот на подрачјето на град Скопје."), `${NEWS}b`, Date.parse("2026-08-25T10:00:00Z"))).toBeNull();
});

// --- OSM roads under construction ------------------------------------------------------------------------------------------------

const way = (osm_id: string, props: Record<string, string>, lng = 21.41): GeoJSON.Feature<GeoJSON.Geometry, Record<string, string | undefined>> => ({
  type: "Feature",
  geometry: { type: "LineString", coordinates: [[lng, 42.0], [lng + 0.001, 42.001]] },
  properties: { osm_id, highway: "construction", ...props },
});

test("osmWorks turns baked roads into works features, drops the ones already opened, and says how old the snapshot is", async () => {
  setBaked({
    type: "FeatureCollection",
    baked_at: "2026-10-17",
    features: [
      way("1", { name_mk: "Булевар 8-ми Септември", name_en: "Bulevar 8-mi Septemvri", construction: "secondary", check_date: "2024-10-06", access: "no" }),
      way("2", { construction: "primary", start_date: "2026-03-01", opening_date: "2027-01-31" }),
      way("3", { name_mk: "Стара улица", opening_date: "2025-05-01" }), // open since
      way("4", { name_mk: "Момин Поток" }),
    ],
  });
  const out = await osmWorks(Date.parse("2026-10-17T10:00:00Z"));
  expect(out.map((f) => f.properties.id)).toEqual(["roadworks:osm:1", "roadworks:osm:2", "roadworks:osm:4"]);
  expect(out.every((f) => FeatureSchema.safeParse(f).success)).toBe(true);
  expect(out[0].properties).toMatchObject({
    kind: "works",
    severity: 1,
    title: { mk: "Булевар 8-ми Септември", en: "Bulevar 8-mi Septemvri" },
    detail: { source: "OpenStreetMap", streets: "Булевар 8-ми Септември", construction: "secondary", access: "no", checked: "2024-10-06", asOf: "2026-10-17" },
  });
  expect(out[1].properties).toMatchObject({ title: { mk: "Пат во изградба", en: "Road under construction" }, startsAt: "2026-03-01", endsAt: "2027-01-31" });
  expect(out[2].properties.title).toEqual({ mk: "Момин Поток", en: "Momin Potok" });
});

test("the baked data/static/roadworks.geojson is valid and holds the roads OSM maps as under construction", async () => {
  setBaked(); // the real file, not the one-way fixture of the adapter tests
  const out = await osmWorks();
  expect(out.length).toBeGreaterThan(30);
  expect(out.every((f) => FeatureSchema.safeParse(f).success && f.properties.kind === "works")).toBe(true);
});

// --- the adapter -----------------------------------------------------------------------------------------------------------------

const sitemapOf = (slugs: string[]) =>
  `<urlset>${slugs.map((s) => `<url><loc>${NEWS}${s}</loc><lastmod>${new Date().toISOString()}</lastmod></url>`).join("")}</urlset>`;

/** Serves the sitemap and the given pages (url → html); anything else, and `fail` urls, answer 500. */
function serve(sitemap: string, pages: Record<string, string>, fail: string[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "https://mvr.gov.mk/sitemap.xml") return new Response(sitemap);
      return !fail.includes(url) && url in pages ? new Response(pages[url]) : new Response("no", { status: 500 });
    }),
  );
}

const TODAY = () => {
  const d = new Date(Date.now() + 86_400_000); // tomorrow, which Skopje agrees with from 02:00 UTC on
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
};

beforeEach(() => {
  setStreets(STREETS);
  setBaked({ type: "FeatureCollection", baked_at: "2026-10-17", features: [way("9", { name_mk: "Момин Поток" })] });
});

test("fetch merges today's MVR notices with the baked OSM works", async () => {
  const notice = page("Утре посебен режим на сообраќај во Скопје", "01/01/2026", `На ${TODAY()} ќе се одржи трка по бул.„Илинден“ во Скопје.`);
  serve(sitemapOf(["utre-poseben-rezim-a"]), { [`${NEWS}utre-poseben-rezim-a`]: notice });
  const out = await roadworks.fetch();
  expect(out.map((f) => f.properties.id)).toEqual(["roadworks:mvr:utre-poseben-rezim-a", "roadworks:osm:9"]);
  expect(out.every((f) => FeatureSchema.safeParse(f).success)).toBe(true);
});

test("fetch tolerates one unreadable notice, and a quiet week still returns the OSM works (an honest, empty-of-notices live answer)", async () => {
  const notice = page("Посебен режим на сообраќај во Скопје", "01/01/2026", `На ${TODAY()} ќе се одржи трка по бул.„Илинден“ во Скопје.`);
  serve(sitemapOf(["poseben-rezim-a", "poseben-rezim-b"]), { [`${NEWS}poseben-rezim-a`]: notice }); // b answers 500
  expect((await roadworks.fetch()).map((f) => f.properties.id)).toEqual(["roadworks:mvr:poseben-rezim-a", "roadworks:osm:9"]);

  serve(sitemapOf([]), {});
  expect((await roadworks.fetch()).map((f) => f.properties.id)).toEqual(["roadworks:osm:9"]);
  expect(roadworks.minFeatures).toBe(0);
});

test("fetch throws, so getLayer falls back to the snapshot or the seed, when MVR cannot be read", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
  await expect(roadworks.fetch()).rejects.toThrow(/503/);
  serve(sitemapOf(["poseben-rezim-a"]), {}); // the sitemap is fine but the only notice is not
  await expect(roadworks.fetch()).rejects.toThrow(/none of 1 notices/);
});

test("the seed is the baked OSM works", async () => {
  expect((await roadworks.seed()).map((f) => f.properties.id)).toEqual(["roadworks:osm:9"]);
});
