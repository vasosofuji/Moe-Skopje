import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { events, parseVesti, seedFeatures } from "./events";
import { centroid, municipalities, municipalityAt } from "./static";
import { FeatureSchema, type Feature } from "./types";

const html = readFileSync(new URL("./__fixtures__/skopje-vesti.html", import.meta.url), "utf8");
const CENTRE = [21.4254, 41.9981];
const at = (f: Feature) => (f.geometry as GeoJSON.Point).coordinates;
const byId = (fs: Feature[], id: string) => fs.find((f) => f.properties.id === id)!;

beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("parseVesti keeps the recent news, drops the old, and takes the time from 'во 10 часот'", async () => {
  const fs = parseVesti(html, await municipalities(), Date.parse("2026-10-14T08:00:00Z")); // oldest kept day: 2026-10-07
  expect(fs.map((f) => f.properties.id)).toEqual(["event:13-10-26-treta-forumska-sesija", "event:09-10-26-soopstenie-treta-forumska-sesija"]);
  for (const f of fs) expect(FeatureSchema.safeParse(f).success).toBe(true);

  const announced = byId(fs, "event:09-10-26-soopstenie-treta-forumska-sesija").properties;
  expect(announced.kind).toBe("event");
  expect(announced.startsAt).toBe("2026-10-13T10:00:00+02:00");
  expect(announced.endsAt).toBe("2026-10-13T23:59:00+02:00");
  expect(announced.detail?.url).toBe("https://skopje.gov.mk/mk/vesti/2019/09-10-26-soopstenie-treta-forumska-sesija/");
});

test("parseVesti: a generic 'Соопштение' title becomes the first sentence of the text, a real title is kept", async () => {
  const munis = await municipalities();
  const [first] = parseVesti(html, munis, Date.parse("2026-10-14T08:00:00Z"));
  expect(first.properties.title.mk.startsWith("Третата форумска сесија")).toBe(true);
  expect(first.properties.title.mk.length).toBeLessThanOrEqual(110);
  expect(first.properties.title.mk.endsWith("…")).toBe(true);
  expect(first.properties.title.en).toMatch(/^Tretata forumska sesija/);

  const oct2 = parseVesti(html, munis, Date.parse("2026-10-05T08:00:00Z")); // the 02.10 decision is still within a week
  expect(byId(oct2, "event:02-10-26-odluka-prodolzuvanje-rabotno-vreme").properties.title.mk).toMatch(/^Одлука за продолжување на работното време/);
});

test("parseVesti: dates the text names set the day; two dates span them", async () => {
  const fs = parseVesti(html, await municipalities(), Date.parse("2026-09-20T08:00:00Z"));
  const weekend = byId(fs, "event:18-09-26-avionska-dezinskecija-komarci").properties;
  expect([weekend.startsAt, weekend.endsAt]).toEqual(["2026-09-19T00:00:00+02:00", "2026-09-20T23:59:00+02:00"]);
  const run = byId(fs, "event:16-09-26-terestricna-dezinsekcija").properties;
  expect([run.startsAt, run.endsAt]).toEqual(["2026-09-16T00:00:00+02:00", "2026-09-19T23:59:00+02:00"]);
});

test("parseVesti: news that names no municipality sits at the centre, fanned out so markers do not stack", async () => {
  const [a, b] = parseVesti(html, await municipalities(), Date.parse("2026-10-14T08:00:00Z"));
  expect(at(a)).toEqual(CENTRE);
  expect(a.properties.detail?.venue).toBe("Скопје");
  expect(at(b)).not.toEqual(CENTRE);
  expect(Math.hypot(at(b)[0] - CENTRE[0], at(b)[1] - CENTRE[1])).toBeLessThan(0.01);
});

test("parseVesti: a named municipality (any script) places the event at its centroid", async () => {
  const munis = await municipalities();
  const page = (text: string) =>
    `<div class="news-item"><div class="desc"><h5><a href="/mk/vesti/2019/x-1/">Саем</a></h5><p><span>16.10.2026</span> <span>${text}</span></p></div></div>`;
  const [f] = parseVesti(page("На 18.10.2026 во Karpoš ќе се одржи саем"), munis, Date.parse("2026-10-16T08:00:00Z"));
  const karpos = munis.features.find((m) => m.properties.name_mk === "Карпош")!;
  expect(at(f)).toEqual(centroid(karpos.geometry));
  expect(f.properties.detail?.venue).toBe("Карпош");
});

test("parseVesti throws on changed markup and when nothing is recent", async () => {
  const munis = await municipalities();
  expect(() => parseVesti("<html><body>maintenance</body></html>", munis)).toThrow(/markup changed/);
  expect(() => parseVesti(html, munis, Date.parse("2026-12-01T08:00:00Z"))).toThrow(/no news from the last 7 days/);
});

test("the adapter fetches the news page and parses it; a bad status throws so getLayer serves the seed", async () => {
  vi.setSystemTime(new Date("2026-10-14T08:00:00Z"));
  const fetchMock = vi.fn().mockResolvedValue(new Response(html, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  expect(await events.fetch()).toHaveLength(2);
  expect(fetchMock.mock.calls[0][0]).toBe("https://skopje.gov.mk/mk/vesti/");
  expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);

  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
  await expect(events.fetch()).rejects.toThrow(/503/);
});

test("seed events are dated from today in Skopje, so they never go stale", async () => {
  const summer = await seedFeatures(Date.parse("2026-10-17T10:00:00Z"));
  expect(summer.length).toBeGreaterThanOrEqual(6);
  for (const f of summer) expect(FeatureSchema.safeParse(f).success).toBe(true);
  expect(summer[0].properties.startsAt).toBe("2026-10-17T09:00:00+02:00"); // day 0
  expect(summer.every((f) => f.properties.startsAt!.slice(0, 10) >= "2026-10-17")).toBe(true);

  const winter = await seedFeatures(Date.parse("2026-12-20T10:00:00Z"));
  expect(winter[0].properties.startsAt).toBe("2026-12-20T09:00:00+01:00");
  expect(winter.every((f) => Date.parse(f.properties.endsAt!) > Date.parse(f.properties.startsAt!))).toBe(true);
});

test("seed events sit in the municipality they name and inside the city bbox", async () => {
  const munis = await municipalities();
  const fs = await seedFeatures(Date.parse("2026-10-17T10:00:00Z"));
  for (const f of fs) {
    const [lng, lat] = at(f);
    expect(lng).toBeGreaterThan(21.25);
    expect(lng).toBeLessThan(21.6);
    expect(lat).toBeGreaterThan(41.9);
    expect(lat).toBeLessThan(42.1);
  }
  const firstPerVenue = fs.filter((f, i) => fs.findIndex((g) => g.properties.detail?.venue === f.properties.detail?.venue) === i);
  for (const f of firstPerVenue) expect(municipalityAt(munis, at(f)[0], at(f)[1])).toBe(f.properties.detail?.venue);
});
