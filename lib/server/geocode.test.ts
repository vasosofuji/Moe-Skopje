import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { geocode, mapNominatim, mapPhoton, resetGeocodeGate, reverseGeocode } from "./geocode";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const feature = (properties: Record<string, unknown>, [lng, lat] = [21.4, 42.0]) => ({ type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties });
const collection = (...features: unknown[]) => ({ type: "FeatureCollection", features });

// Real Photon answers, trimmed (photon.komoot.io, 2026-10-17).
const RAMSTORE = feature(
  { osm_type: "N", osm_id: 13664947142, osm_key: "shop", osm_value: "supermarket", type: "house", name: "Ramstore", street: "Козле", locality: "Трнодол", district: "Карпош 4", city: "Општина Карпош" },
  [21.3954218, 41.9945639],
);
const HOUSE = feature(
  { osm_type: "N", osm_id: 12149504823, osm_key: "place", osm_value: "house", type: "house", housenumber: "49", street: "Булевар Илинден", locality: "Дебар Маало", district: "Центар" },
  [21.425678, 42.0009587],
);
const STREET = feature({ osm_type: "W", osm_id: 7, osm_key: "highway", osm_value: "tertiary", type: "street", name: "Илинден", district: "Центар" }, [21.425961, 42.0009591]);
const DISTRICT = feature({ osm_type: "R", osm_id: 9, osm_key: "place", osm_value: "suburb", type: "district", name: "Карпош 4", city: "Општина Карпош" }, [21.39, 42.0]);

// Nominatim jsonv2 with addressdetails=1, trimmed.
const NOM_SHOP = {
  osm_type: "node", osm_id: 13664947142, lat: "41.9945639", lon: "21.3954218", category: "shop", type: "supermarket", addresstype: "shop", name: "Ramstore",
  display_name: "Ramstore, Козле, Трнодол, Карпош, Скопје, Северна Македонија",
  address: { shop: "Ramstore", road: "Козле", suburb: "Трнодол", city_district: "Карпош", city: "Скопје" },
};
const NOM_HOUSE = {
  osm_type: "node", osm_id: 12149504823, lat: "42.0009587", lon: "21.425678", category: "place", type: "house", addresstype: "place", name: "",
  display_name: "49, Булевар Илинден, Дебар Маало, Центар, Скопје",
  address: { house_number: "49", road: "Булевар Илинден", suburb: "Дебар Маало", city: "Скопје" },
};
const NOM_ROAD = {
  osm_type: "way", osm_id: 7, lat: "42.0009591", lon: "21.425961", category: "highway", type: "tertiary", addresstype: "road", name: "Илинден",
  display_name: "Илинден, Дебар Маало, Центар, Скопје", address: { road: "Илинден", suburb: "Дебар Маало", city: "Скопје" },
};

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;
const mockFetch = (handler: Handler) => vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handler(new URL(String(input)), init ?? {})) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
const urls = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map((c) => new URL(String(c[0])));

beforeEach(() => {
  resetGeocodeGate();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

test("Photon: a shop is a poi with its category and a 'street, district' address", () => {
  expect(mapPhoton(RAMSTORE)).toEqual({
    id: "osm:N13664947142", name: "Ramstore", kind: "poi", category: "supermarket", address: "Козле, Карпош 4", area: "Карпош 4", lng: 21.3954218, lat: 41.9945639,
  });
});

test("Photon: a nameless house is an address named 'street number'; a street and a district are a street and an area", () => {
  expect(mapPhoton(HOUSE)).toEqual({
    id: "osm:N12149504823", name: "Булевар Илинден 49", kind: "address", address: "Булевар Илинден 49, Центар", area: "Центар", lng: 21.425678, lat: 42.0009587,
  });
  expect(mapPhoton(STREET)).toMatchObject({ name: "Илинден", kind: "street", address: "Центар" });
  expect(mapPhoton(STREET)).not.toHaveProperty("category");
  expect(mapPhoton(DISTRICT)).toMatchObject({ name: "Карпош 4", kind: "area", address: "Општина Карпош" });
});

test("Photon: a feature with no name and no house number, or no point, is dropped", () => {
  expect(mapPhoton(feature({ osm_type: "N", osm_id: 1, type: "house", street: "Козле" }))).toBeNull();
  expect(mapPhoton({ geometry: { coordinates: [] }, properties: { name: "x" } })).toBeNull();
  expect(mapPhoton("nope")).toBeNull();
});

test("Nominatim: shop, house and road rows map to the same shapes", () => {
  expect(mapNominatim(NOM_SHOP)).toEqual({
    id: "osm:N13664947142", name: "Ramstore", kind: "poi", category: "supermarket", address: "Козле, Трнодол", area: "Трнодол", lng: 21.3954218, lat: 41.9945639,
  });
  expect(mapNominatim(NOM_HOUSE)).toMatchObject({ name: "Булевар Илинден 49", kind: "address", address: "Булевар Илинден 49, Дебар Маало" });
  expect(mapNominatim(NOM_ROAD)).toMatchObject({ name: "Илинден", kind: "street", address: "Дебар Маало" });
  expect(mapNominatim({ ...NOM_SHOP, lat: "x" })).toBeNull();
});

test("geocode asks Photon for the Skopje box with a descriptive User-Agent; lang only for en; near as lat/lon", async () => {
  vi.stubEnv("ROUTER_CONTACT", "mailto:team@example.mk");
  const fetch = mockFetch(() => json(collection(RAMSTORE, HOUSE, STREET)));
  const mk = await geocode("Ramstore", { lang: "mk" }, { fetch });
  expect(mk.map((p) => p.kind)).toEqual(["poi", "address", "street"]);
  const [u] = urls(fetch);
  expect(u.origin + u.pathname).toBe("https://photon.komoot.io/api/");
  expect(u.searchParams.get("q")).toBe("Ramstore");
  expect(u.searchParams.get("bbox")).toBe("21.25,41.9,21.6,42.1");
  expect(u.searchParams.get("limit")).toBe("8");
  expect(u.searchParams.has("lang")).toBe(false);
  expect(u.searchParams.has("lat")).toBe(false);
  const headers = fetch.mock.calls[0][1].headers as Record<string, string>;
  expect(headers["User-Agent"]).toContain("MoeSkopje");
  expect(headers["User-Agent"]).toContain("mailto:team@example.mk");

  await geocode("Ramstore", { lang: "en", near: [21.43, 42.0] }, { fetch });
  const en = urls(fetch)[1];
  expect(en.searchParams.get("lang")).toBe("en");
  expect(en.searchParams.get("lon")).toBe("21.43");
  expect(en.searchParams.get("lat")).toBe("42");
});

test("when Photon fails (network error, error status, or an HTML page) Nominatim answers", async () => {
  vi.stubEnv("ROUTER_CONTACT", "mailto:team@example.mk");
  const photonFailures: Handler[] = [
    () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    },
    () => json({ message: "busy" }, 503),
    () => new Response("<html><h1>429 Too Many Requests</h1></html>", { status: 200, headers: { "Content-Type": "text/html" } }),
  ];
  for (const failure of photonFailures) {
    resetGeocodeGate();
    const fetch = mockFetch((u) => (u.host === "photon.komoot.io" ? failure(u, {}) : json([NOM_SHOP, NOM_HOUSE, NOM_ROAD])));
    const places = await geocode("Рамстор", { lang: "mk" }, { fetch, sleep: async () => {} });
    expect(places.map((p) => [p.kind, p.name])).toEqual([["poi", "Ramstore"], ["address", "Булевар Илинден 49"], ["street", "Илинден"]]);
    const nominatim = urls(fetch).find((u) => u.host === "nominatim.openstreetmap.org")!;
    expect(nominatim.pathname).toBe("/search");
    expect(nominatim.searchParams.get("format")).toBe("jsonv2");
    expect(nominatim.searchParams.get("q")).toBe("Рамстор");
    expect(nominatim.searchParams.get("viewbox")).toBe("21.25,42.1,21.6,41.9");
    expect(nominatim.searchParams.get("bounded")).toBe("1");
    expect(nominatim.searchParams.get("limit")).toBe("8");
    expect(nominatim.searchParams.get("accept-language")).toBe("mk");
    const sent = fetch.mock.calls.find((c) => new URL(String(c[0])).host === "nominatim.openstreetmap.org")![1].headers as Record<string, string>;
    expect(sent["User-Agent"]).toContain("mailto:team@example.mk");
  }
});

test("Photon answering with no result is an answer: Nominatim is not asked", async () => {
  const fetch = mockFetch(() => json(collection()));
  expect(await geocode("zzzz", { lang: "mk" }, { fetch })).toEqual([]);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("both geocoders down: geocode throws, so the caller can fall back to the local index", async () => {
  const fetch = mockFetch(() => json({}, 500));
  await expect(geocode("Ramstore", { lang: "mk" }, { fetch, sleep: async () => {} })).rejects.toThrow();
});

test("Nominatim calls start at least a second apart, whatever the callers do", async () => {
  let t = 1_000_000;
  const sleeps: number[] = [];
  const fetch = mockFetch((u) => (u.host === "photon.komoot.io" ? json({}, 500) : json([NOM_SHOP])));
  const deps = { fetch, now: () => t, sleep: async (ms: number) => void (sleeps.push(ms), (t += ms)) };
  await geocode("a1", { lang: "mk" }, deps);
  await geocode("b2", { lang: "mk" }, deps);
  expect(sleeps).toHaveLength(1);
  expect(sleeps[0]).toBeGreaterThanOrEqual(1000);
});

test("reverse: the nearest house or street within 300 m of the point, as a place; nothing near is null; a failing Photon throws", async () => {
  const fetch = mockFetch(() => json(collection(RAMSTORE)));
  expect(await reverseGeocode(21.3922, 42.0048, { fetch })).toMatchObject({ name: "Ramstore", address: "Козле, Карпош 4" });
  const u = urls(fetch)[0];
  expect(u.pathname).toBe("/reverse");
  expect(u.searchParams.get("lon")).toBe("21.3922");
  expect(u.searchParams.get("lat")).toBe("42.0048");
  expect(u.searchParams.get("limit")).toBe("1");
  expect(u.searchParams.get("radius")).toBe("0.3");
  expect(u.searchParams.getAll("layer")).toEqual(["house", "street"]);

  expect(await reverseGeocode(21.55, 42.09, { fetch: mockFetch(() => json(collection())) })).toBeNull();
  await expect(reverseGeocode(21.4, 42.0, { fetch: mockFetch(() => json({}, 502)) })).rejects.toThrow();
});
