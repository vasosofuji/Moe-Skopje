import { NextResponse } from "next/server";
import { tripPosition } from "@/lib/sources/bus-position";
import { loadGtfs } from "@/lib/sources/gtfs";

/**
 * GET /api/buses/trip/:tripId → { source: "live" | "estimated", lng, lat, bearing?, updatedAt, shape: LineString }.
 * Live GPS from Modeshift when MODESHIFT_API_KEY is set and the vehicle is listed, otherwise a position interpolated
 * along the GTFS shape from the timetable. Unknown trips are 404, an unreachable feed is 503.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  let g;
  try {
    g = await loadGtfs();
  } catch (err) {
    console.warn(`[api:buses/trip] timetable unavailable: ${err instanceof Error ? err.message : String(err)}`);
    return NextResponse.json({ error: "timetable unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const position = await tripPosition(g, tripId, Date.now(), { apiKey: process.env.MODESHIFT_API_KEY });
  if (!position) return NextResponse.json({ error: "unknown trip" }, { status: 404 });
  return NextResponse.json(position, { headers: { "Cache-Control": "public, s-maxage=5, stale-while-revalidate=15" } });
}
