import { NextResponse } from "next/server";
import type { LayerId } from "@/lib/layers";
import { getLayer } from "@/lib/server/layer";
import { loadGtfs } from "@/lib/sources/gtfs";
import { registry } from "@/lib/sources/registry";

// Sequential on purpose (one source at a time, gentle on the upstreams), so give the whole run room.
export const maxDuration = 60; // Vercel Hobby cap; each layer is time-boxed and failures are per-layer

/** Layers with something to snapshot: everything except the baked datasets. */
const refreshable = () => (Object.keys(registry) as LayerId[]).filter((id) => !registry[id]?.static);

/**
 * GET /api/cron/snapshots (Vercel Cron, daily): warms the GTFS feed, then runs getLayer for each non-static layer, which
 * writes a fresh snapshot for the stale fallback. Needs `Authorization: Bearer ${CRON_SECRET}`; Vercel sends it by itself.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const results: { id: string; status: string; ms: number }[] = [];
  const run = async (id: string, work: () => Promise<string>) => {
    const t0 = Date.now();
    let status: string;
    try {
      status = await work();
    } catch (err) {
      console.warn(`[cron:snapshots] ${id} failed: ${err instanceof Error ? err.message : String(err)}`);
      status = "error";
    }
    results.push({ id, status, ms: Date.now() - t0 });
  };

  // First, so the buses layer below finds the parsed feed instead of racing getLayer's 8 s timeout.
  await run("gtfs", async () => (await loadGtfs(), "live"));
  for (const id of refreshable()) await run(id, async () => (await getLayer(id)).status);

  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
