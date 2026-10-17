import { NextResponse } from "next/server";
import { fetchPm10Trend } from "@/lib/sources/air";

/** GET /api/air-trend → { date: "YYYY-MM-DD", value }[]: daily city-wide PM10 averages over the last 7 days, oldest first. 502 with [] when pulse.eco is unreachable (the sparkline just hides). */
export async function GET() {
  try {
    return NextResponse.json(await fetchPm10Trend(), {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=6000" },
    });
  } catch {
    return NextResponse.json([], { status: 502, headers: { "Cache-Control": "public, s-maxage=60" } }); // retry soon, but not on every hit
  }
}
