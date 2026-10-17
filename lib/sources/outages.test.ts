import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import evn from "./__fixtures__/evn.synthetic.json";
import { matchMunicipality, normalizeName, parseSkopjeTime, skopjeToday } from "./geo";
import { outages, parseEvn, parseVodovod, rebaseOutages } from "./outages";
import { municipalities } from "./static";
import { setStreets, type StreetCollection, type StreetFeature } from "./streets";
import { FeatureSchema, type Feature } from "./types";

// A small street index for the logic tests; the tests marked "baked" use the real data/static/streets.geojson instead.
const st = (name_mk: string, municipality_mk: string, lng: number): StreetFeature => ({
  type: "Feature",
  geometry: { type: "MultiLineString", coordinates: [[[lng, 42.0], [lng + 0.002, 42.001]]] },
  properties: { name_mk, municipality_mk },
});
const STREETS: StreetCollection = {
  type: "FeatureCollection",
  features: [
    st("Народен Фронт", "Центар", 21.43),
    st("Никола Парапунов", "Карпош", 21.39),
    st("Борка Талески", "Карпош", 21.4),
    st("Партизанска", "Аеродром", 21.45),
    st("Ѓорче Петров", "Ѓорче Петров", 21.35),
  ],
};
beforeEach(() => setStreets(STREETS));
afterEach(() => {
  setStreets();
  vi.unstubAllGlobals();
});
const muniOf = (f: Feature) => f.properties.detail?.municipality;

// The EVN fixture's outages all start on 2026-10-17 or the day after, between 09:00 and 15:00 Skopje time.
const EVN_MORNING = Date.parse("2026-10-17T05:00:00Z"); // 07:00 in Skopje

test("matchMunicipality handles case, script and suffix numbers", () => {
  expect(matchMunicipality("КАРПОШ 4")).toBe("Карпош");
  expect(matchMunicipality("Karpoš")).toBe("Карпош");
  expect(matchMunicipality("ул. Партизанска, Аеродром,")).toBe("Аеродром");
  expect(matchMunicipality("Gjorce Petrov")).toBe("Ѓорче Петров");
  expect(matchMunicipality("Куманово")).toBeNull();
});

test("normalizeName lowercases, transliterates Latin to Cyrillic and drops trailing numbers and punctuation", () => {
  expect(normalizeName("KARPOŠ 4,")).toBe("карпош");
  expect(normalizeName("Kisela Voda")).toBe("кисела вода");
  expect(normalizeName("Shuto Orizari (2)")).toBe("шуто оризари");
});

test("parseSkopjeTime uses local offset (summer +02:00, winter +01:00)", () => {
  expect(parseSkopjeTime("17.10.2026", "09:00")).toBe("2026-10-17T09:00:00+02:00");
  expect(parseSkopjeTime("17.12.2026", "09:00")).toBe("2026-12-17T09:00:00+01:00");
});

test("parseSkopjeTime follows the DST switch (last Sunday of October)", () => {
  expect(parseSkopjeTime("25.10.2026", "01:30")).toBe("2026-10-25T01:30:00+02:00");
  expect(parseSkopjeTime("25.10.2026", "04:00")).toBe("2026-10-25T04:00:00+01:00");
});

test("EVN fixture: one feature per affected street with the street's geometry; rows with one interval share a group", async () => {
  const features = parseEvn(evn, await municipalities(), "outages-power", EVN_MORNING);
  // Куманово (other KEC) and Илинден (no municipality) are dropped; Народен Фронт is a Центар street filed under Карпош
  expect(features.map((f) => f.properties.title.mk).sort()).toEqual(["Борка Талески", "Народен Фронт", "Никола Парапунов", "Партизанска", "Ѓорче Петров"].sort());
  for (const f of features) {
    expect(FeatureSchema.safeParse(f).success).toBe(true);
    expect(f.properties).toMatchObject({ kind: "outage", severity: 2, detail: { type: "power" } });
    expect(f.properties.detail?.approx).toBeUndefined();
    expect(f.geometry.type).toBe("MultiLineString");
    expect(new Date(f.properties.startsAt!).getTime()).toBeLessThan(new Date(f.properties.endsAt!).getTime());
  }
  const karpos = features.filter((f) => muniOf(f) === "Карпош");
  expect(karpos).toHaveLength(3);
  expect(new Set(karpos.map((f) => f.properties.detail?.outage)).size).toBe(1);
  expect(new Set(karpos.map((f) => f.properties.id)).size).toBe(3);
  expect(karpos[0].properties.startsAt).toBe("2026-10-17T09:00:00+02:00");
  expect(karpos[0].properties.detail?.streets).toBe("Народен Фронт; Никола Парапунов; Борка Талески");
  expect(karpos[0].properties.detail?.cause).toBe("Планиран");
  expect(karpos.find((f) => f.properties.title.mk === "Борка Талески")!.geometry).toEqual(STREETS.features[2].geometry);
  expect(features.find((f) => f.properties.title.mk === "Партизанска")!.properties.detail).toMatchObject({ municipality: "Аеродром", type: "power" });
});

const evnOne = (adresa: string, nasMesto = "Карпош") => [
  { tipPrekin: "Планиран", nasMesto, adresa, pocetok: "2026-10-17T09:00:00", kraj: "2026-10-17T14:00:00", kecId: 38 },
];

test("an outage none of whose streets is known falls back to the municipality polygon, flagged detail.approx = 1", async () => {
  const [f, ...rest] = parseEvn(evnOne("ул. Непозната бр. 5"), await municipalities(), "outages-power", EVN_MORNING);
  expect(rest).toEqual([]);
  expect(f.geometry.type).toBe("Polygon");
  expect(f.properties).toMatchObject({ kind: "outage", title: { mk: "Карпош", en: "Karposh" }, detail: { approx: 1, municipality: "Карпош", streets: "ул. Непозната бр. 5", type: "power" } });
  expect(FeatureSchema.safeParse(f).success).toBe(true);
});

test("an outage with at least one known street gets no polygon: only the street, and only the known street is listed", async () => {
  const out = parseEvn(evnOne("ул. Борка Талески, ул. Непозната"), await municipalities(), "outages-power", EVN_MORNING);
  expect(out).toHaveLength(1);
  expect(out[0].geometry.type).toBe("MultiLineString");
  expect(out[0].properties.detail).toMatchObject({ streets: "Борка Талески" });
  expect(out[0].properties.detail?.approx).toBeUndefined();
});

test("a street name that several other municipalities share is not guessed: the polygon stands in", async () => {
  setStreets({ type: "FeatureCollection", features: [st("Прва", "Аеродром", 21.45), st("Прва", "Чаир", 21.43)] });
  const [f] = parseEvn(evnOne("ул. Прва"), await municipalities(), "outages-power", EVN_MORNING);
  expect(f.geometry.type).toBe("Polygon");
  expect(f.properties.detail?.approx).toBe(1);
});

test("vodovod announcements (real excerpt, baked streets) become street-level outages from today on; unmatched and past ones are dropped", async () => {
  setStreets(); // the real index
  const html = readFileSync(new URL("./__fixtures__/vodovod.html", import.meta.url), "utf8");
  const munis = await municipalities();
  const f = parseVodovod(html, munis, Date.parse("2026-09-10T06:00:00Z"));
  // Аеродром is the gazetteer at work: "Бул.Јане Сандански" names no municipality, but Јане Сандански is a settlement there
  expect([...new Set(f.map(muniOf))].sort()).toEqual(["Аеродром", "Бутел", "Шуто Оризари"]);
  const aerodrom = f.filter((x) => muniOf(x) === "Аеродром");
  expect(aerodrom.map((x) => x.properties.title.mk)).toEqual(["Булевар Јане Сандански"]);
  expect(aerodrom[0].geometry.type).toBe("MultiLineString");
  expect(aerodrom[0].properties.detail).toMatchObject({ type: "water", municipality: "Аеродром" });
  const butel = f.filter((x) => muniOf(x) === "Бутел").map((x) => x.properties.title.mk);
  // Браќа Реџепагиќ is a Чаир street in the OSM index, named in a notice about Бутел: the only one, so it is taken.
  // "Дижонска" is skipped on purpose: it is also a neighbourhood, so it needs a ул. in front.
  expect(butel).toEqual(["Браќа Реџепагиќ"]);
  const sh = f.filter((x) => muniOf(x) === "Шуто Оризари");
  expect(sh.map((x) => x.properties.title.mk)).toEqual(["Јуриј Розентал"]);
  expect(sh[0].properties).toMatchObject({ kind: "outage", severity: 2, startsAt: "2026-09-10T08:45:00+02:00", endsAt: "2026-09-10T23:59:00+02:00" });
  expect(parseVodovod(html, munis, Date.parse("2026-10-17T06:00:00Z"))).toEqual([]);
  expect(() => parseVodovod("<div id='pills-tabContent'><p>нема</p></div>", munis)).toThrow(/no dated announcements/);
});

test("adapters: power and water have minFeatures 0 (a quiet day is a real answer), heating ttl 1800, seeds are street-level outages of real streets", async () => {
  expect(outages["outages-power"]).toMatchObject({ id: "outages-power", ttl: 900, minFeatures: 0 });
  expect(outages["outages-water"]).toMatchObject({ ttl: 1800, minFeatures: 0 });
  expect(outages["outages-heating"].ttl).toBe(1800);
  // a seed street must be one of the baked streets, with its exact geometry
  const baked = JSON.parse(readFileSync(new URL("../../data/static/streets.geojson", import.meta.url), "utf8")) as StreetCollection;
  const types = { "outages-power": "power", "outages-water": "water", "outages-heating": "heating" } as const;
  for (const [id, a] of Object.entries(outages)) {
    const seed = await a.seed();
    expect(seed.length, id).toBeGreaterThanOrEqual(3);
    expect(new Set(seed.map((f) => f.properties.detail?.outage)).size, id).toBeGreaterThanOrEqual(2); // several outages, on different days
    for (const f of seed) {
      expect(FeatureSchema.safeParse(f).success).toBe(true);
      expect(f.properties).toMatchObject({ kind: "outage", detail: { type: types[id as keyof typeof types] } });
      expect(f.properties.detail?.approx).toBeUndefined();
      const street = baked.features.find((s) => s.properties.name_mk === f.properties.title.mk && s.properties.municipality_mk === muniOf(f));
      expect(street, `${id}: ${f.properties.title.mk}`).toBeDefined();
      expect(f.geometry).toEqual(street!.geometry);
    }
  }
});

// --- I3: "rows exist but none mapped" must fail, not become an empty "Live" layer ------------------------------------------

const evnRow = (over: Record<string, unknown> = {}) => ({
  tipPrekin: "Планиран",
  nasMesto: "Скопје",
  adresa: "ул. Некоја",
  pocetok: "2099-01-01T09:00:00",
  kraj: "2099-01-01T14:00:00",
  kecId: 10,
  ...over,
});
const stubEvn = (rows: unknown) => vi.stubGlobal("fetch", vi.fn(async () => Response.json(rows)));

test("power.fetch throws when Skopje rows exist but none maps to a municipality (the format changed, not the grid)", async () => {
  stubEvn([evnRow({ nasMesto: "Скопје", adresa: "непозната адреса" }), evnRow({ kecId: 38, nasMesto: "?", adresa: "" })]);
  await expect(outages["outages-power"].fetch()).rejects.toThrow(/none map/);
});

test("power.fetch is an honest empty layer when there are no Skopje rows at all, or every mapped outage is over", async () => {
  stubEvn([]);
  expect(await outages["outages-power"].fetch()).toEqual([]);
  stubEvn([evnRow({ kecId: 16, nasMesto: "Куманово" })]); // another region only
  expect(await outages["outages-power"].fetch()).toEqual([]);
  stubEvn([evnRow({ adresa: "ул. Партизанска, Аеродром", pocetok: "2020-01-01T09:00:00", kraj: "2020-01-01T14:00:00" })]); // mapped, but long over
  expect(await outages["outages-power"].fetch()).toEqual([]);
});

test("power.fetch returns the mapped outages that are still ahead", async () => {
  stubEvn([evnRow({ adresa: "ул. Партизанска, Аеродром" }), evnRow({ adresa: "непозната" })]);
  const features = await outages["outages-power"].fetch();
  expect(features.map((f) => f.properties.title.mk)).toEqual(["Партизанска"]);
  expect(features[0].properties.detail).toMatchObject({ municipality: "Аеродром", type: "power" });
});

const announcement = (date: string, where: string) =>
  `<div id="pills-tabContent"><p>Ве известуваме дека на ден ${date} поради дефект ${where} од 09:00 часот до 12:00 часот.</p></div>`;

test("parseVodovod throws when announcements for today or later exist but none names a municipality", async () => {
  const munis = await municipalities();
  const now = Date.parse("2026-10-17T06:00:00Z");
  expect(() => parseVodovod(announcement("17.10.2026", "на ул. Непозната бр.5"), munis, now)).toThrow(/none names/);
  // a past announcement that names nothing is just old news
  expect(parseVodovod(announcement("10.10.2026", "на ул. Непозната бр.5"), munis, now)).toEqual([]);
  // an announcement that maps is fine; one that mapped but has ended is an honest empty day, not a failure
  expect(parseVodovod(announcement("17.10.2026", "во Карпош"), munis, now).map((f) => f.properties.title.mk)).toEqual(["Карпош"]);
  expect(parseVodovod(announcement("17.10.2026", "во Карпош"), munis, Date.parse("2026-10-17T12:00:00Z"))).toEqual([]);
});

// --- M8: outages must not outlive their end time ------------------------------------------------------------------------

test("parseEvn drops outages whose endsAt is already past", async () => {
  const munis = await municipalities();
  const names = (now: number) => [...new Set(parseEvn(evn, munis, "outages-power", now).map(muniOf))].sort();
  expect(names(Date.parse("2026-10-17T05:00:00Z"))).toEqual(["Аеродром", "Карпош", "Ѓорче Петров"].sort());
  expect(names(Date.parse("2026-10-17T12:30:00Z"))).toEqual(["Аеродром"]); // 14:30 in Skopje: Karpos (to 14:00) and Gjorce Petrov are over
  expect(names(Date.parse("2026-10-18T14:00:00Z"))).toEqual([]);
});

const seedOutage = (name: string, startsAt: string, endsAt: string): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [21.4, 42] },
  properties: { id: `outages-power:Карпош:${startsAt}`, kind: "outage", title: { mk: name, en: name }, startsAt, endsAt },
});

test("rebaseOutages moves the seed so its first startsAt is today in Skopje, keeping wall-clock times, gaps and durations", () => {
  const seed = [
    seedOutage("later", "2026-10-18T10:00:00+02:00", "2026-10-18T15:00:00+02:00"),
    seedOutage("first", "2026-10-17T09:00:00+02:00", "2026-10-17T14:00:00+02:00"),
  ];
  const now = Date.parse("2026-11-20T21:30:00Z"); // 22:30 on the 20th in Skopje (+01:00 by then)
  const [later, first] = rebaseOutages(seed, now);
  expect(first.properties.startsAt).toBe("2026-11-20T09:00:00+01:00");
  expect(first.properties.endsAt).toBe("2026-11-20T14:00:00+01:00");
  expect(later.properties.startsAt).toBe("2026-11-21T10:00:00+01:00");
  expect(later.properties.endsAt).toBe("2026-11-21T15:00:00+01:00");
  expect(first.properties.id).toBe("outages-power:Карпош:2026-11-20T09:00:00+01:00");
  const hours = (f: Feature) => (Date.parse(f.properties.endsAt!) - Date.parse(f.properties.startsAt!)) / 3_600_000;
  expect([hours(first), hours(later)]).toEqual([5, 5]);
  expect(seed[1].properties.startsAt).toBe("2026-10-17T09:00:00+02:00"); // the input is not mutated
});

test("rebaseOutages also moves the times inside the group id (detail.outage) and the feature id, so they stay unique per day", () => {
  const group = "outages-water:Карпош:2026-10-17T09:00:00+02:00:2026-10-17T14:00:00+02:00";
  const seed: Feature[] = [
    {
      ...seedOutage("Борка Талески", "2026-10-17T09:00:00+02:00", "2026-10-17T14:00:00+02:00"),
      properties: {
        id: `${group}:борка талески`,
        kind: "outage",
        title: { mk: "Борка Талески", en: "Borka Taleski" },
        startsAt: "2026-10-17T09:00:00+02:00",
        endsAt: "2026-10-17T14:00:00+02:00",
        detail: { municipality: "Карпош", type: "water", outage: group },
      },
    },
  ];
  const [f] = rebaseOutages(seed, Date.parse("2026-11-20T10:00:00Z"));
  const moved = "outages-water:Карпош:2026-11-20T09:00:00+01:00:2026-11-20T14:00:00+01:00";
  expect(f.properties.detail?.outage).toBe(moved);
  expect(f.properties.id).toBe(`${moved}:борка талески`);
  expect(f.properties.detail).toMatchObject({ municipality: "Карпош", type: "water" });
});

test("rebaseOutages leaves a seed that is already on today, and an empty seed, alone", () => {
  const seed = [seedOutage("a", "2026-10-17T09:00:00+02:00", "2026-10-17T14:00:00+02:00")];
  expect(rebaseOutages(seed, Date.parse("2026-10-17T10:00:00Z"))).toEqual(seed);
  expect(rebaseOutages([], Date.now())).toEqual([]);
});

test("every outage seed starts today in Skopje time when loaded", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.parse("2026-12-05T08:00:00Z"));
  try {
    for (const a of Object.values(outages)) {
      const seed = await a.seed();
      const firstStart = Math.min(...seed.map((f) => Date.parse(f.properties.startsAt!)));
      expect(skopjeToday(firstStart)).toBe("2026-12-05");
      expect(seed.every((f) => FeatureSchema.safeParse(f).success && Date.parse(f.properties.endsAt!) > Date.parse(f.properties.startsAt!))).toBe(true);
    }
  } finally {
    vi.useRealTimers();
  }
});
