// The approximate seed timetable that BusDepartures.tsx still renders. Delete this file together with bus-timetable.ts and
// data/seed/jsp-timetables.json once the UI reads /api/buses/stop/[stopId] instead.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vitest";
import { nextDepartures, timetable } from "./bus-timetable";

test("nextDepartures respects headway and service hours", () => {
  // Pin the seed line the assertions below rely on.
  expect(timetable["2"]).toMatchObject({ headwayMin: 10, firstAt: "05:00", lastAt: "23:00" });
  const at = (iso: string, n?: number) => nextDepartures("bus-stop:x", new Date(iso), n, ["2"]).map((d) => d.at);

  // Winter (+01:00) and summer (+02:00) both land on Skopje wall-clock time, whatever the server's zone.
  expect(at("2026-01-15T22:55:00+01:00")).toEqual(["23:00"]); // last departure only, nothing wraps to tomorrow
  expect(at("2026-07-15T22:55:00+02:00")).toEqual(["23:00"]);
  expect(at("2026-07-15T20:55:00Z")).toEqual(["23:00"]); // 20:55 UTC is 22:55 Skopje
  expect(at("2026-07-15T21:55:00Z")).toEqual([]); // 21:55 UTC is 23:55 Skopje: service is over
  expect(at("2026-07-15T04:00:00+02:00")).toEqual(["05:00", "05:10", "05:20"]); // before service: first three
  expect(at("2026-07-15T12:01:00+02:00")).toEqual(["12:10", "12:20", "12:30"]);
  expect(at("2026-07-15T12:10:00+02:00", 1)).toEqual(["12:10"]); // a departure in this very minute still counts
  expect(at("2026-07-15T23:30:00+02:00")).toEqual([]);
});

test("nextDepartures merges lines by time, ignores unknown lines, and returns [] for an unregistered stop", () => {
  const now = new Date("2026-07-15T04:00:00+02:00");
  expect(nextDepartures("bus-stop:x", now, 3, ["5", "2", "999"])).toEqual([
    { line: "5", at: "05:00" },
    { line: "2", at: "05:00" },
    { line: "5", at: "05:08" },
  ]);
  expect(nextDepartures("bus-stop:never-registered", now)).toEqual([]);
});

test("the seed timetable has 10 well-formed approximate lines that exist in the baked routes", async () => {
  const entries = Object.entries(timetable);
  expect(entries).toHaveLength(10);
  const routes = JSON.parse(await readFile(join(process.cwd(), "data", "static", "bus-routes.geojson"), "utf8")) as GeoJSON.FeatureCollection;
  const refs = new Set(routes.features.map((f) => f.properties?.ref));
  for (const [line, t] of entries) {
    expect(refs.has(line), `line ${line} is in bus-routes.geojson`).toBe(true);
    expect(t.note).toBe("approximate");
    expect(t.headwayMin).toBeGreaterThan(0);
    expect(t.firstAt).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    expect(t.lastAt).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    expect(t.firstAt < t.lastAt).toBe(true);
  }
});
