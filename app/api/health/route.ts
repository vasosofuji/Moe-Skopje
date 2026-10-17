import { NextResponse } from "next/server";
import type { LayerId } from "@/lib/layers";
import { getLayer } from "@/lib/server/layer";
import { registry } from "@/lib/sources/registry";

/** GET /api/health → one row per registered layer, for the Data health panel. */
export async function GET() {
  const ids = Object.keys(registry) as LayerId[];
  const rows = await Promise.all(
    ids.map(async (id) => {
      const res = await getLayer(id);
      return { id, status: res.status, updatedAt: res.updatedAt, featureCount: res.features.features.length, source: res.source };
    }),
  );
  return NextResponse.json(rows, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" } });
}
