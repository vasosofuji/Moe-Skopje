import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import evn from "./__fixtures__/evn.synthetic.json";
import { matchMunicipality, normalizeName, parseSkopjeTime } from "./geo";
import { outages, parseEvn, parseVodovod } from "./outages";
import { municipalities } from "./static";
import { FeatureSchema } from "./types";

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
  const features = parseEvn(evn, await municipalities(), "outages-power");
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
  expect(f.map((x) => x.properties.title.mk).sort()).toEqual(["Бутел", "Шуто Оризари"]);
  const sh = f.find((x) => x.properties.title.mk === "Шуто Оризари")!;
  expect(sh.properties).toMatchObject({ kind: "outage", severity: 2, startsAt: "2026-09-10T08:45:00+02:00", endsAt: "2026-09-10T23:59:00+02:00" });
  expect(parseVodovod(html, munis, Date.parse("2026-10-17T06:00:00Z"))).toEqual([]);
  expect(() => parseVodovod("<div id='pills-tabContent'><p>нема</p></div>", munis)).toThrow(/no dated announcements/);
});

test("adapters: power ttl 900 minFeatures 0, water and heating ttl 1800, seeds are valid outage polygons", async () => {
  expect(outages["outages-power"]).toMatchObject({ id: "outages-power", ttl: 900, minFeatures: 0 });
  expect(outages["outages-water"].ttl).toBe(1800);
  expect(outages["outages-heating"].ttl).toBe(1800);
  for (const a of Object.values(outages)) {
    const seed = await a.seed();
    expect(seed.length).toBeGreaterThanOrEqual(2);
    expect(seed.length).toBeLessThanOrEqual(3);
    expect(seed.every((f) => FeatureSchema.safeParse(f).success && f.properties.kind === "outage")).toBe(true);
  }
});
