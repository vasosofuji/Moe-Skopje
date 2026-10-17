import { expect, test } from "vitest";
import { GET } from "@/app/api/places/route";
import { MAX_PLACES, PlacesQuery, searchPlaces } from "./places";

test("Latin without diacritics and Cyrillic find the same place", async () => {
  const [lat, cyr] = await Promise.all([searchPlaces("karpos"), searchPlaces("Карпош")]);
  expect(lat[0]).toMatchObject({ name: "Карпош", kind: "municipality" });
  expect(cyr[0]).toEqual(lat[0]);
});

test("streets come back with a point inside the Skopje box, at most eight, and a municipality", async () => {
  const hits = await searchPlaces("bul partizanski");
  expect(hits.length).toBeGreaterThan(0);
  expect(hits.length).toBeLessThanOrEqual(MAX_PLACES);
  for (const h of hits) {
    expect(h.kind).toBe("street");
    expect(h.area).toBeTruthy();
    expect(h.lng).toBeGreaterThan(21.25);
    expect(h.lng).toBeLessThan(21.6);
    expect(h.lat).toBeGreaterThan(41.9);
    expect(h.lat).toBeLessThan(42.1);
  }
});

test("an exact name beats a longer one that starts with it; nonsense finds nothing", async () => {
  expect((await searchPlaces("центар"))[0]).toMatchObject({ name: "Центар", kind: "municipality" });
  expect(await searchPlaces("zzzzqqqq")).toEqual([]);
});

test("a number-only query still matches street names that start with a number", async () => {
  expect((await searchPlaces("23")).some((p) => p.name.startsWith("23"))).toBe(true);
});

test("q is 1 to 60 characters: the route answers 400 otherwise", async () => {
  expect(PlacesQuery.safeParse({ q: "a".repeat(61) }).success).toBe(false);
  expect((await GET(new Request("http://x/api/places"))).status).toBe(400);
  expect((await GET(new Request("http://x/api/places?q=%20%20"))).status).toBe(400);
  const ok = await GET(new Request("http://x/api/places?q=karpos"));
  expect(ok.status).toBe(200);
  expect(((await ok.json()) as unknown[]).length).toBeGreaterThan(0);
});
