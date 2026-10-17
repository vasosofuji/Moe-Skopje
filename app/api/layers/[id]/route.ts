import { NextResponse } from "next/server";
import type { LayerId } from "@/lib/layers";
import { getLayer } from "@/lib/server/layer";
import { registry } from "@/lib/sources/registry";

// A cold GTFS load (buses) may use a 20 s fetch budget.
export const maxDuration = 30;

/** GET /api/layers/:id → LayerResponse. Unregistered ids are 404; a registered layer never errors (spec §5.2). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Object.hasOwn(registry, id)) return NextResponse.json({ error: "unknown layer" }, { status: 404 });
  const layerId = id as LayerId;

  const res = await getLayer(layerId);
  const ttl = registry[layerId]!.ttl;
  // Only live/static answers get the long CDN life; a fallback (stale/offline) must be re-asked within seconds.
  const full = res.status === "live" || res.status === "static";
  return NextResponse.json(res, {
    headers: { "Cache-Control": full ? `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 10}` : `public, s-maxage=${Math.min(ttl, 30)}` },
  });
}
