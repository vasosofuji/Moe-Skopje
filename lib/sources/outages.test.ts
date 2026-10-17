import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import evn from "./__fixtures__/evn.synthetic.json";
import { matchMunicipality, normalizeName, parseSkopjeTime, skopjeToday } from "./geo";
import { outages, parseEvn, parseVodovod, rebaseOutages } from "./outages";
import { municipalities } from "./static";
import { FeatureSchema, type Feature } from "./types";

afterEach(() => vi.unstubAllGlobals());

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

test("EVN fixture parses into municipality polygons with start/end", async () => {
  const features = parseEvn(evn, await municipalities(), "outages-power", EVN_MORNING);
  // Карпош rows with the same interval merge; Куманово (other KEC) and Илинден (no municipality) are dropped
  expect(features.map((f) => f.properties.title.mk).sort()).toEqual(["Аеродром", "Карпош", "Ѓорче Петров"].sort());
  for (const f of features) {
    expect(FeatureSchema.safeParse(f).success).toBe(true);
    expect(f.properties).toMatchObject({ kind: "outage", severity: 2 });
    expect(f.geometry.type).toMatch(/Polygon/);
    expect(new Date(f.properties.startsAt!).getTime()).toBeLessThan(new Date(f.properties.endsAt!).getTime());
  }
  const karpos = features.find((f) => f.properties.title.mk === "Карпош")!;
  expect(karpos.properties.startsAt).toBe("2026-10-17T09:00:00+02:00");
  expect(karpos.properties.detail?.streets).toContain("Борка Талески");
  expect(karpos.properties.detail?.streets).toContain("Народен Фронт");
});

test("vodovod announcements (real excerpt) become municipality outages from today on; unmatched and past ones are dropped", async () => {
  const html = readFileSync(new URL("./__fixtures__/vodovod.html", import.meta.url), "utf8");
  const munis = await municipalities();
  const f = parseVodovod(html, munis, Date.parse("2026-09-10T06:00:00Z"));
  // Аеродром is the gazetteer at work: "Бул.Јане Сандански" names no municipality, but Јане Сандански is a settlement there
  expect(f.map((x) => x.properties.title.mk).sort()).toEqual(["Аеродром", "Бутел", "Шуто Оризари"]);
  const sh = f.find((x) => x.properties.title.mk === "Шуто Оризари")!;
  expect(sh.properties).toMatchObject({ kind: "outage", severity: 2, startsAt: "2026-09-10T08:45:00+02:00", endsAt: "2026-09-10T23:59:00+02:00" });
  expect(parseVodovod(html, munis, Date.parse("2026-10-17T06:00:00Z"))).toEqual([]);
  expect(() => parseVodovod("<div id='pills-tabContent'><p>нема</p></div>", munis)).toThrow(/no dated announcements/);
});

test("adapters: power and water have minFeatures 0 (a quiet day is a real answer), heating ttl 1800, seeds are valid outage polygons", async () => {
  expect(outages["outages-power"]).toMatchObject({ id: "outages-power", ttl: 900, minFeatures: 0 });
  expect(outages["outages-water"]).toMatchObject({ ttl: 1800, minFeatures: 0 });
  expect(outages["outages-heating"].ttl).toBe(1800);
  for (const a of Object.values(outages)) {
    const seed = await a.seed();
    expect(seed.length).toBeGreaterThanOrEqual(2);
    expect(seed.length).toBeLessThanOrEqual(3);
    expect(seed.every((f) => FeatureSchema.safeParse(f).success && f.properties.kind === "outage")).toBe(true);
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
  expect(features.map((f) => f.properties.title.mk)).toEqual(["Аеродром"]);
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
  const names = (now: number) =>
    parseEvn(evn, munis, "outages-power", now)
      .map((f) => f.properties.title.mk)
      .sort();
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
