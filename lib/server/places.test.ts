import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GET } from "@/app/api/places/route";
import { GET as REVERSE } from "@/app/api/places/reverse/route";
import { MAX_PLACES, PlacesQuery, allowPlaces, handlePlaces, handleReverse, resetPlacesState, searchLocal, searchPlaces } from "./places";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
let osmId = 1;
const poi = (name: string, lng = 21.4, lat = 42.0, extra: Record<string, unknown> = {}) => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lng, lat] },
  properties: { osm_type: "N", osm_id: osmId++, osm_key: "shop", osm_value: "supermarket", type: "house", name, district: "Карпош 4", ...extra },
});
const collection = (...features: unknown[]) => ({ type: "FeatureCollection", features });
const photon = (...features: unknown[]) => vi.fn(async () => json(collection(...features))) as unknown as typeof globalThis.fetch & ReturnType<typeof vi.fn>;
const req = (qs: string, headers: Record<string, string> = {}) => new Request(`http://x/api/places?${qs}`, { headers });
const rev = (qs: string) => new Request(`http://x/api/places/reverse?${qs}`);

beforeEach(() => {
  resetPlacesState();
  osmId = 1;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// --- The local index (streets, settlements, municipalities) ----------------------------------------------------------------

test("Latin without diacritics and Cyrillic find the same place", async () => {
  const [lat, cyr] = await Promise.all([searchLocal("karpos"), searchLocal("Карпош")]);
  expect(lat[0]).toMatchObject({ name: "Карпош", kind: "area" });
  expect(cyr[0]).toEqual(lat[0]);
});

test("streets come back with an id, a point inside the Skopje box, at most eight, and a municipality", async () => {
  const hits = await searchLocal("bul partizanski");
  expect(hits.length).toBeGreaterThan(0);
  expect(hits.length).toBeLessThanOrEqual(MAX_PLACES);
  for (const h of hits) {
    expect(h.kind).toBe("street");
    expect(h.id).toMatch(/^local:\d+$/);
    expect(h.area).toBeTruthy();
    expect(h.address).toBe(h.area);
    expect(h.lng).toBeGreaterThan(21.25);
    expect(h.lng).toBeLessThan(21.6);
    expect(h.lat).toBeGreaterThan(41.9);
    expect(h.lat).toBeLessThan(42.1);
  }
});

test("an exact name beats a longer one that starts with it; nonsense finds nothing", async () => {
  expect((await searchLocal("центар"))[0]).toMatchObject({ name: "Центар", kind: "area" });
  expect(await searchLocal("zzzzqqqq")).toEqual([]);
});

test("a number-only query still matches street names that start with a number", async () => {
  expect((await searchLocal("23")).some((p) => p.name.startsWith("23"))).toBe(true);
});

// --- Merging the geocoder with the local index -----------------------------------------------------------------------------

test("ranking: exact and prefix matches first, then the rest of the geocoder, then the rest of the local index", async () => {
  const fetch = photon(poi("Аптека Карпош", 21.39, 42.01, { osm_value: "pharmacy", osm_key: "amenity" }), poi("Карпош Хотел", 21.38, 42.02, { osm_value: "hotel", osm_key: "tourism" }));
  const { places, live } = await searchPlaces("karpos", { lang: "mk" }, { fetch });
  const names = places.map((p) => p.name);
  expect(live).toBe(true);
  expect(names.slice(0, 4)).toEqual(["Карпош", "Карпош Хотел", "Карпошово востание", "Аптека Карпош"]); // exact local, prefix geo, prefix local, other geo
  expect(names.slice(4).every((n) => n.includes("Карпош"))).toBe(true); // the remaining local hits
  expect(places[1]).toMatchObject({ kind: "poi", category: "hotel", address: "Карпош 4" });
});

test("a bus stop only shows after the real places that match as well", async () => {
  const fetch = photon(poi("Клинички Центар Т9", 21.4185, 41.9887, { osm_key: "highway", osm_value: "bus_stop" }), poi("Клинички центар Мајка Тереза", 21.422, 41.9888, { osm_key: "amenity", osm_value: "hospital" }));
  const { places } = await searchPlaces("клинички центар", { lang: "mk" }, { fetch });
  expect(places.map((p) => p.name)).toEqual(["Клинички центар Мајка Тереза", "Клинички Центар Т9"]);
});

test("dedupe: the same name within 80 m is one place (the geocoder's, keeping the local English name); further apart stays two", async () => {
  const local = (await searchLocal("partizanski")).find((p) => p.name === "Булевар Партизански одреди" && p.area === "Карпош")!;
  const street = { osm_key: "highway", osm_value: "tertiary", type: "street" };
  const near = poi("Булевар Партизански одреди", local.lng + 0.0004, local.lat, street); // ~33 m from the local one
  const far = poi("Булевар Партизански одреди", local.lng - 0.03, local.lat + 0.02, street); // ~2.5 km
  const { places } = await searchPlaces("partizanski", { lang: "mk" }, { fetch: photon(near, far) });
  const blvds = places.filter((p) => p.name === "Булевар Партизански одреди");
  expect(blvds.filter((p) => p.id.startsWith("osm:"))).toHaveLength(2);
  expect(blvds.filter((p) => p.id.startsWith("local:"))).toHaveLength(2); // the other two municipalities' boulevards; Карпош's gave way to the geocoder's
  expect(blvds.some((p) => p.id === local.id)).toBe(false);
  expect(blvds.find((p) => p.id === "osm:N1")?.nameEn).toBe(local.nameEn);
});

test("at most eight places come back", async () => {
  const many = Array.from({ length: 8 }, (_, i) => poi(`Карпош ${i}`, 21.38 + i * 0.01, 42.0));
  const { places } = await searchPlaces("karpos", { lang: "mk" }, { fetch: photon(...many) });
  expect(places).toHaveLength(MAX_PLACES);
});

test("when both geocoders are down the local index still answers, and the answer is not cached", async () => {
  const fetch = vi.fn(async () => json({}, 500)) as unknown as typeof globalThis.fetch & ReturnType<typeof vi.fn>;
  const deps = { fetch, sleep: async () => {} };
  const first = await handlePlaces(req("q=karpos"), deps);
  expect(first.status).toBe(200);
  expect(first.headers.get("Cache-Control")).toBe("no-store");
  expect(((await first.json()) as { name: string }[])[0].name).toBe("Карпош");
  const calls = fetch.mock.calls.length;
  await handlePlaces(req("q=karpos"), deps);
  expect(fetch.mock.calls.length).toBeGreaterThan(calls); // asked again, not served from the cache
});

// --- GET /api/places ---------------------------------------------------------------------------------------------------------

test("validation: q is 2 to 80 characters, lang is mk or en, near is a point inside the Skopje box", async () => {
  const fetch = photon();
  const bad = ["", "q=", "q=a", "q=%20a%20", `q=${"a".repeat(81)}`, "q=karpos&lang=de", "q=karpos&near=21.0,41.0", "q=karpos&near=abc", "q=karpos&near=21.4", "q=karpos&near=21.4,42.0,1", "q=karpos&near=,"];
  for (const qs of bad) {
    const res = await handlePlaces(req(qs), { fetch });
    expect([qs, res.status]).toEqual([qs, 400]);
    expect(await res.json()).toEqual({ code: "input" });
  }
  expect(fetch).not.toHaveBeenCalled();
  expect(PlacesQuery.safeParse({ q: "a".repeat(80) }).success).toBe(true);
  expect(PlacesQuery.parse({ q: "karpos" }).lang).toBe("mk");

  const ok = await handlePlaces(req("q=Ramstore&lang=en&near=21.4321,41.9987"), { fetch });
  expect(ok.status).toBe(200);
  const u = new URL(String(fetch.mock.calls[0][0]));
  expect([u.searchParams.get("lang"), u.searchParams.get("lon"), u.searchParams.get("lat")]).toEqual(["en", "21.43", "42"]); // near is rounded to 2 decimals
});

test("the response is an array of places and is cacheable for five minutes", async () => {
  const res = await handlePlaces(req("q=Ramstore"), { fetch: photon(poi("Ramstore", 21.3954, 41.9945, { street: "Козле" })) });
  expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=300");
  const body = (await res.json()) as Record<string, unknown>[];
  expect(body[0]).toEqual({ id: "osm:N1", name: "Ramstore", kind: "poi", category: "supermarket", address: "Козле, Карпош 4", area: "Карпош 4", lng: 21.3954, lat: 41.9945 });
});

test("cache: the same question (any case or spacing) is answered without asking again; another language is another question; entries expire after 10 minutes", async () => {
  let t = 1_000_000;
  const fetch = photon(poi("Ramstore"));
  const deps = { fetch, now: () => t };
  await handlePlaces(req("q=Ramstore"), deps);
  await handlePlaces(req("q=%20ramSTORE%20"), deps);
  await handlePlaces(req("q=Ramstore&near=21.4301,41.99"), deps); // a different spot
  expect(fetch).toHaveBeenCalledTimes(2);
  await handlePlaces(req("q=Ramstore&near=21.4349,41.9899"), deps); // the same spot once rounded to 2 decimals
  expect(fetch).toHaveBeenCalledTimes(2);
  await handlePlaces(req("q=Ramstore&lang=en"), deps);
  expect(fetch).toHaveBeenCalledTimes(3);
  t += 10 * 60_000 + 1;
  await handlePlaces(req("q=Ramstore"), deps);
  expect(fetch).toHaveBeenCalledTimes(4);
});

test("cache: at most 500 entries, the least recently used goes first", async () => {
  let t = 1_000_000;
  const fetch = photon(poi("Ramstore"));
  const deps = { fetch, now: () => t };
  const ask = async (q: string, i: number) => {
    t += 1000;
    await handlePlaces(req(`q=${q}`, { "x-real-ip": `10.0.0.${i % 200}` }), deps);
  };
  await ask("first", 0);
  for (let i = 0; i < 499; i++) await ask(`query${i}`, i + 1); // 500 entries now
  await ask("first", 0); // touch it: now the most recently used
  await ask("overflow", 1); // 501st distinct → evicts query0, not "first"
  const calls = fetch.mock.calls.length;
  await ask("first", 0);
  expect(fetch.mock.calls.length).toBe(calls);
  await ask("query0", 2);
  expect(fetch.mock.calls.length).toBe(calls + 1);
});

test("rate limit: 60 requests a minute per IP and 300 across the instance, then 429; the window slides", async () => {
  const t0 = 5_000_000;
  for (let i = 0; i < 60; i++) expect(allowPlaces("1.1.1.1", t0 + i)).toBe(true);
  expect(allowPlaces("1.1.1.1", t0 + 100)).toBe(false);
  expect(allowPlaces("2.2.2.2", t0 + 100)).toBe(true);
  expect(allowPlaces("1.1.1.1", t0 + 60_100)).toBe(true);

  resetPlacesState();
  for (let ip = 0; ip < 5; ip++) for (let i = 0; i < 60; i++) expect(allowPlaces(`9.9.9.${ip}`, t0 + i)).toBe(true); // 300 in the minute
  expect(allowPlaces("8.8.8.8", t0 + 100)).toBe(false);

  resetPlacesState();
  const fetch = photon(poi("Ramstore"));
  for (let i = 0; i < 60; i++) expect((await handlePlaces(req("q=Ramstore", { "x-forwarded-for": "3.3.3.3, 10.0.0.1" }), { fetch, now: () => t0 })).status).toBe(200);
  const refused = await handlePlaces(req("q=Ramstore", { "x-forwarded-for": "3.3.3.3" }), { fetch, now: () => t0 });
  expect(refused.status).toBe(429);
  expect(await refused.json()).toEqual({ code: "rate" });
});

test("the route answers 400 for a bad q and 200 for a good one (Photon mocked)", async () => {
  const fetch = photon(poi("Ramstore"));
  vi.stubGlobal("fetch", fetch);
  expect((await GET(req(""))).status).toBe(400);
  const ok = await GET(req("q=karpos"));
  expect(ok.status).toBe(200);
  expect(((await ok.json()) as unknown[]).length).toBeGreaterThan(0);
  expect(fetch).toHaveBeenCalled();
});

// --- GET /api/places/reverse -------------------------------------------------------------------------------------------------

test("reverse: { name, address } of the nearest place; cached by the point rounded to 4 decimals", async () => {
  const fetch = photon(poi("Ramstore", 21.3922, 42.0048, { street: "Козле" }));
  const res = await handleReverse(rev("lng=21.39221&lat=42.00481"), { fetch });
  expect(res.status).toBe(200);
  expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=300");
  expect(await res.json()).toEqual({ name: "Ramstore", address: "Козле, Карпош 4" });
  await handleReverse(rev("lng=21.39222&lat=42.00479"), { fetch }); // the same spot to 4 decimals
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(new URL(String(fetch.mock.calls[0][0])).pathname).toBe("/reverse");
});

test("reverse: 400 for a missing, malformed or out-of-box point; 404 when nothing is near; 502 when Photon is down", async () => {
  const fetch = photon();
  for (const qs of ["", "lng=21.4", "lat=42", "lng=a&lat=b", "lng=0&lat=0", "lng=21.4&lat=43"]) {
    const res = await handleReverse(rev(qs), { fetch });
    expect([qs, res.status]).toEqual([qs, 400]);
    expect(await res.json()).toEqual({ code: "input" });
  }
  expect(fetch).not.toHaveBeenCalled();

  const none = await handleReverse(rev("lng=21.55&lat=42.09"), { fetch });
  expect(none.status).toBe(404);
  expect(await none.json()).toEqual({ code: "none" });

  const down = await handleReverse(rev("lng=21.45&lat=42.0"), { fetch: vi.fn(async () => json({}, 500)) as unknown as typeof globalThis.fetch });
  expect(down.status).toBe(502);
  expect(await down.json()).toEqual({ code: "geocoder" });
  expect(down.headers.get("Cache-Control")).toBeNull();
});

test("the reverse route is wired to the handler", async () => {
  vi.stubGlobal("fetch", photon(poi("Ramstore", 21.3922, 42.0048)));
  expect((await REVERSE(rev("lng=21.3922&lat=42.0048"))).status).toBe(200);
  expect((await REVERSE(rev("lng=1&lat=1"))).status).toBe(400);
});
