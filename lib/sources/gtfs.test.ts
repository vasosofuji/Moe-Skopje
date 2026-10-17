import { readdirSync, readFileSync } from "node:fs";
import { strToU8, zipSync } from "fflate";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { activeServices, departures, GTFS_URL, loadGtfs, parseGtfs, resetGtfs, skopjeClock, stopLines, unzipGtfs } from "./gtfs";

// lib/sources/__fixtures__/gtfs-mini is cut from JSP's real feed (2026-10-17): 5 trips around the centre stop 1513.
// The trips keep their real times; two of them are re-tagged (9.603900 → service 7, 9.603577 → service 8) so the
// calendar logic has something to switch between. Real calendar: 9 = Sat 17.10 only, 8 = Sun 18.10 + exceptions, 7 = weekdays 19-27.10.
const dir = new URL("./__fixtures__/gtfs-mini/", import.meta.url);
const files: Record<string, string> = Object.fromEntries(readdirSync(dir).map((f) => [f, readFileSync(new URL(f, dir), "utf8")]));
const g = parseGtfs(files);
const t = (iso: string) => Date.parse(iso);
const SAT_0930 = t("2026-10-17T07:30:00Z"); // Skopje is UTC+2 until 25.10.

test("parses the real-feed fixture into compact indexes", () => {
  expect(g.stops.size).toBe(27);
  expect(g.trips.size).toBe(5);
  expect(g.stops.get("1513")).toEqual({ id: "1513", code: "1", name: "ЦЕНТАР РЕКОРД-КОН ЗАПАД", lng: 21.430099, lat: 41.994781 });
  expect(g.stops.get("1561")?.name).toBe("ТРАНСПОРТЕН ЦЕНТАР Т(21,22)"); // quoted field with a comma inside
  const trip = g.trips.get("9.603621")!;
  expect(trip).toMatchObject({ id: "9.603621", route: "5", headsign: "ДЕКСИОН", service: "9", shape: "46364" });
  expect(trip.stops).toEqual(["1522", "1520", "1517", "1515", "1513", "1759", "1761", "1763", "1765"]);
  expect(trip.dep[4]).toBe(9 * 3600 + 40 * 60 + 51);
  expect(g.trips.get("9.603655")!.dep[2]).toBe(24 * 3600); // 24:00:00 stays 86400: the trip runs past midnight
  expect(g.shapes.get("46364")!.pts).toHaveLength(57 * 2);
  expect(g.shapes.get("46364")!.dist).toBeUndefined(); // JSP publishes no shape_dist_traveled
});

test("parsing needs stops and trips; a missing calendar file is fine", () => {
  expect(() => parseGtfs({})).toThrow(/stops/);
  expect(() => parseGtfs({ ...files, "trips.txt": "route_id,service_id,trip_id\n" })).toThrow(/trips/);
  expect(parseGtfs({ ...files, "calendar.txt": "", "calendar_dates.txt": "" }).trips.size).toBe(5);
});

test("active services follow calendar.txt and calendar_dates.txt (Europe/Skopje dates)", () => {
  const on = (date: string) => [...activeServices(g, date)].sort();
  expect(on("2026-10-16")).toEqual([]); // before every range
  expect(on("2026-10-17")).toEqual(["9"]); // Saturday: service 9, one day only
  expect(on("2026-10-18")).toEqual(["8"]); // Sunday: 8 by weekday flag and by an added date
  expect(on("2026-10-19")).toEqual(["7"]); // Monday: 7 added; 8 has the Monday flag in range but 19.10 is removed
  expect(on("2026-10-22")).toEqual(["7"]);
  expect(on("2026-10-23")).toEqual(["8"]); // Friday: 7 removed that day, 8 added
  expect(on("2026-10-24")).toEqual(["8"]);
  expect(on("2026-10-26")).toEqual(["7"]); // Monday after 8 ended on 25.10
  expect(on("2026-10-27")).toEqual([]); // Tuesday in 7's range, but removed
  expect(on("2026-10-28")).toEqual([]);
});

test("calendar_dates can add a service on a day its flags exclude, and a service may live only in calendar_dates", () => {
  const x = parseGtfs({
    ...files,
    "calendar.txt": "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nW,1,1,1,1,1,0,0,20261001,20261031\n",
    "calendar_dates.txt": "service_id,date,exception_type\nW,20261017,1\nX,20261017,1\nW,20261014,2\n",
  });
  expect([...activeServices(x, "2026-10-17")].sort()).toEqual(["W", "X"]);
  expect([...activeServices(x, "2026-10-14")]).toEqual([]);
  expect([...activeServices(x, "2026-10-13")]).toEqual(["W"]);
  expect([...activeServices(x, "2026-11-02")]).toEqual([]);
});

test("skopjeClock gives the Skopje date and seconds into the day, in summer and winter time", () => {
  expect(skopjeClock(t("2026-10-17T07:30:00Z"))).toEqual({ date: "2026-10-17", sec: 9.5 * 3600 });
  expect(skopjeClock(t("2026-10-17T22:30:00Z"))).toEqual({ date: "2026-10-18", sec: 30 * 60 }); // UTC+2: already tomorrow
  expect(skopjeClock(t("2026-10-26T22:30:15Z"))).toEqual({ date: "2026-10-26", sec: 23 * 3600 + 30 * 60 + 15 }); // UTC+1 after 25.10
  expect(skopjeClock(t("2026-12-31T23:00:00Z")).date).toBe("2027-01-01");
});

test("next departures at a stop: today's services only, soonest first, in Skopje time", () => {
  expect(departures(g, "1513", SAT_0930)).toEqual([
    { tripId: "9.603621", route: "5", headsign: "ДЕКСИОН", at: "09:40", inMin: 10 },
    { tripId: "9.603622", route: "5", headsign: "ДЕКСИОН", at: "10:12", inMin: 42 },
  ]); // 9.603900 (service 7) and 9.603577 (service 8) do not run on Saturday
  expect(departures(g, "1513", t("2026-10-19T07:30:00Z"))).toEqual([{ tripId: "9.603900", route: "7", headsign: "КАРПОШ 3", at: "10:01", inMin: 31 }]);
  expect(departures(g, "1513", t("2026-10-18T07:30:00Z")).map((d) => [d.route, d.at])).toEqual([["25", "10:45"]]);
  expect(departures(g, "1513", SAT_0930, 1)).toHaveLength(1);
  expect(departures(g, "1513", t("2026-10-16T07:30:00Z"))).toEqual([]); // no service that day
  expect(departures(g, "nope", SAT_0930)).toEqual([]);
});

test("a departure in the current minute still counts; one a minute ago does not", () => {
  expect(departures(g, "1513", t("2026-10-17T07:40:30Z")).map((d) => [d.at, d.inMin])).toEqual([["09:40", 0], ["10:12", 32]]); // 09:40:51 leaves in 21 s
  expect(departures(g, "1513", t("2026-10-17T07:41:00Z")).map((d) => d.at)).toEqual(["10:12"]);
  expect(departures(g, "1513", t("2026-10-17T08:13:00Z"))).toEqual([]); // 10:13: the last one left at 10:12
});

test("a trip's last stop has no departures (the bus only arrives there)", () => {
  expect(departures(g, "1765", SAT_0930)).toEqual([]);
  expect(departures(g, "1522", SAT_0930)[0]).toMatchObject({ tripId: "9.603621", at: "09:32" }); // its first stop does
});

test("times past 24:00 belong to the service day that started them", () => {
  // Trip 9.603655 (service 9, Saturday) reaches stop 1817 at 24:00:00 and 1821 at 24:04:26.
  expect(departures(g, "1817", t("2026-10-17T21:50:00Z"))).toEqual([{ tripId: "9.603655", route: "5", headsign: "ДЕКСИОН", at: "00:00", inMin: 10 }]); // 23:50 Saturday
  // Just after midnight it is Sunday: service 9 is yesterday's, but its 24:xx times still land today.
  expect(departures(g, "1821", t("2026-10-17T22:03:10Z"))).toEqual([{ tripId: "9.603655", route: "5", headsign: "ДЕКСИОН", at: "00:04", inMin: 1 }]); // 00:03:10 Sunday
  expect(departures(g, "1819", t("2026-10-17T22:03:10Z"))).toEqual([]); // 24:02:31 has already gone
  // Yesterday's evening times (23:55 at stop 1781) are not repeated today.
  expect(departures(g, "1781", t("2026-10-17T22:03:10Z"))).toEqual([]);
});

test("stopLines: route short names serving each stop today, once, in natural order", () => {
  expect(stopLines(g, SAT_0930).get("1513")).toEqual(["5"]);
  expect(stopLines(g, t("2026-10-19T07:30:00Z")).get("1520")).toEqual(["7"]); // Monday: line 7 only
  expect(stopLines(g, SAT_0930).has("1765")).toBe(false); // terminus: nothing boards there
  const x = parseGtfs({
    "stops.txt": "stop_id,stop_name,stop_lat,stop_lon\nA,A,42,21.4\nB,B,42,21.5\n",
    "routes.txt": "route_id,route_short_name\nr1,15\nr2,2А\nr3,2\n",
    "trips.txt": "route_id,service_id,trip_id,trip_headsign\nr1,S,t1,x\nr2,S,t2,x\nr3,S,t3,x\nr1,S,t4,x\n",
    "stop_times.txt": ["trip_id,arrival_time,departure_time,stop_id,stop_sequence", ...["t1", "t2", "t3", "t4"].flatMap((id) => [`${id},10:00:00,10:00:00,A,1`, `${id},10:05:00,10:05:00,B,2`])].join("\n"),
    "calendar_dates.txt": "service_id,date,exception_type\nS,20261017,1\n",
  });
  expect(stopLines(x, SAT_0930).get("A")).toEqual(["2", "2А", "15"]);
});

// ---- loadGtfs: download, 6 h cache, refresh rules ----
const zipOf = (f: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, strToU8(v)])));
const zip = zipOf(files);
type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
const feed = (bytes = zip) => vi.fn<Fetch>(async () => new Response(bytes as BodyInit));
const H = 3600_000;

beforeEach(() => {
  resetGtfs();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("unzipGtfs reads a zipped feed", () => {
  expect(unzipGtfs(zip).stops.size).toBe(27);
  expect(() => unzipGtfs(new Uint8Array([1, 2, 3]))).toThrow();
});

test("loadGtfs downloads the zip once (20 s timeout), keeps it 6 h, then refreshes", async () => {
  const f = feed();
  vi.stubGlobal("fetch", f);
  const a = await loadGtfs(SAT_0930);
  expect(f).toHaveBeenCalledTimes(1);
  expect(f.mock.calls[0][0]).toBe(GTFS_URL);
  expect(f.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  expect(a.stops.size).toBe(27);
  expect(await loadGtfs(SAT_0930 + 5 * H)).toBe(a);
  expect(f).toHaveBeenCalledTimes(1);
  const b = await loadGtfs(SAT_0930 + 6 * H);
  expect(f).toHaveBeenCalledTimes(2);
  expect(b).not.toBe(a);
});

test("concurrent loads share one download", async () => {
  const f = feed();
  vi.stubGlobal("fetch", f);
  const [a, b] = await Promise.all([loadGtfs(SAT_0930), loadGtfs(SAT_0930)]);
  expect(a).toBe(b);
  expect(f).toHaveBeenCalledTimes(1);
});

test("a failed refresh keeps serving the old index and retries after 5 minutes", async () => {
  const f = feed();
  vi.stubGlobal("fetch", f);
  const a = await loadGtfs(SAT_0930);
  f.mockImplementation(async () => new Response("down", { status: 503 }));
  const later = SAT_0930 + 6 * H;
  expect(await loadGtfs(later)).toBe(a); // stale beats nothing
  expect(f).toHaveBeenCalledTimes(2);
  expect(await loadGtfs(later + 60_000)).toBe(a);
  expect(f).toHaveBeenCalledTimes(2); // no hammering
  f.mockImplementation(async () => new Response(zip as BodyInit));
  const c = await loadGtfs(later + 5 * 60_000);
  expect(f).toHaveBeenCalledTimes(3);
  expect(c).not.toBe(a);
});

test("with nothing cached, a failed download or a bad zip throws", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
  await expect(loadGtfs(SAT_0930)).rejects.toThrow(/503/);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([1, 2, 3, 4]) as BodyInit)));
  await expect(loadGtfs(SAT_0930)).rejects.toThrow();
  vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("offline"))));
  await expect(loadGtfs(SAT_0930)).rejects.toThrow(/offline/);
});

test("a feed with no trips for today is re-downloaded after 5 minutes, not after 6 hours", async () => {
  // This feed is only good for Saturday 17.10: it is generated daily and runs service 9 on that one date.
  const saturdayOnly = zipOf({ ...files, "calendar.txt": "", "calendar_dates.txt": "service_id,date,exception_type\n9,20261017,1\n" });
  const f = feed(saturdayOnly);
  vi.stubGlobal("fetch", f);
  const midnight = t("2026-10-17T22:00:00Z"); // 00:00 Sunday
  const first = await loadGtfs(midnight); // loaded just after midnight: no trips today, only Saturday's tail
  expect(await loadGtfs(midnight + 3 * 60_000)).toBe(first);
  expect(f).toHaveBeenCalledTimes(1); // asked 3 minutes ago: too soon to ask again
  f.mockImplementation(async () => new Response(zip as BodyInit)); // the producer has switched to Sunday's feed
  const second = await loadGtfs(midnight + 6 * 60_000);
  expect(f).toHaveBeenCalledTimes(2);
  expect(second).not.toBe(first);
  expect(departures(second, "1513", midnight + 6 * 60_000)).toEqual([{ tripId: "9.603577", route: "25", headsign: "СРЕДНО ВОДНО", at: "10:45", inMin: 639 }]);
  expect(await loadGtfs(midnight + 12 * 60_000)).toBe(second);
  expect(f).toHaveBeenCalledTimes(2); // Sunday has trips now: back to the 6 h rule
});
