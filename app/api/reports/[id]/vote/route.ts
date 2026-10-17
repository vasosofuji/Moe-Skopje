import { castVote, deviceHashOf } from "@/lib/server/reports";
import { getSupabaseAdmin } from "@/lib/server/supabase";

/** POST /api/reports/:id/vote (header x-device-id) → 200 { upvotes } | 409 { code: "voted" } when this device already voted. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = getSupabaseAdmin();
  if (!db) return Response.json({ code: "disabled" }, { status: 503 });

  const hash = await deviceHashOf(req);
  if (!hash) return Response.json({ code: "device" }, { status: 400 });

  const { id } = await params;
  const { status, body } = await castVote(db, id, hash);
  return Response.json(body, { status });
}
