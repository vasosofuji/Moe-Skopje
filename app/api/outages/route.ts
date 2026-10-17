import { NextResponse } from "next/server";
import { OUTAGE_LAYERS, getOutageDays } from "@/lib/server/outages";
import { registry } from "@/lib/sources/registry";

const DEFAULT_DAYS = 7;
const MAX_DAYS = 14;

/**
 * GET /api/outages?days=7 → `{ days: [{ date: "YYYY-MM-DD", items: [{ id, type, status, startsAt, endsAt, municipality, streets, bbox }] }] }`.
 * Water, power and heating merged, one entry per Europe/Skopje day from today (see lib/server/outages.ts). `days` is 1 to 14, default 7.
 * Like the layers route it never errors: a failing source is stale or demo data, flagged per item in `status`.
 */
export async function GET(req: Request) {
  const asked = Number.parseInt(new URL(req.url).searchParams.get("days") ?? "", 10);
  const days = Number.isFinite(asked) ? Math.min(MAX_DAYS, Math.max(1, asked)) : DEFAULT_DAYS;

  const body = { days: await getOutageDays(days) };
  const ttl = Math.min(...OUTAGE_LAYERS.map((id) => registry[id]!.ttl)); // the freshest layer sets the pace
  return NextResponse.json(body, {
    headers: { "Cache-Control": `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 10}` },
  });
}
