import { NextResponse } from "next/server";
import { departures, loadGtfs } from "@/lib/sources/gtfs";

/**
 * GET /api/buses/stop/:stopId → the next departures today in Europe/Skopje, at most 8:
 * [{ tripId, route, headsign, at: "HH:MM", inMin }]. `stopId` is the GTFS stop_id (`detail.stopId` of a bus-stop
 * feature; the layer's `bus-stop:<id>` feature id is accepted too). Unknown stops are 404, an unreachable feed is 503.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ stopId: string }> }) {
  const { stopId } = await params;
  let g;
  try {
    g = await loadGtfs();
  } catch (err) {
    console.warn(`[api:buses/stop] timetable unavailable: ${err instanceof Error ? err.message : String(err)}`);
    return NextResponse.json({ error: "timetable unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const id = stopId.replace(/^bus-stop:/, "");
  if (!g.stops.has(id)) return NextResponse.json({ error: "unknown stop" }, { status: 404 });
  return NextResponse.json(departures(g, id, Date.now()), { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" } });
}
