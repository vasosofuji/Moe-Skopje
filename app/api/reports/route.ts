import { createReport, deviceHashOf, listReports, type Result } from "@/lib/server/reports";
import { getSupabaseAdmin } from "@/lib/server/supabase";

const send = ({ status, body }: Result) => Response.json(body, { status });
const disabled = () => send({ status: 503, body: { code: "disabled" } }); // no Supabase env vars: the UI shows its disabled state

/** GET /api/reports?near=lng,lat → the newest 100 reports (nearest first when `near` is given). */
export async function GET(req: Request) {
  const db = getSupabaseAdmin();
  if (!db) return disabled();

  const near = new URL(req.url).searchParams.get("near");
  let point: [number, number] | undefined;
  if (near !== null) {
    const [lng, lat, ...extra] = near.split(",").map((s) => (s.trim() === "" ? NaN : Number(s)));
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || extra.length) return send({ status: 400, body: { code: "near" } });
    point = [lng, lat];
  }
  return send(await listReports(db, point));
}

/** POST /api/reports (multipart: `data` JSON + optional `photo`; header x-device-id) → 201 { id } | 400 { code } | 429 { code: "rate" }. */
export async function POST(req: Request) {
  const db = getSupabaseAdmin();
  if (!db) return disabled();

  const hash = await deviceHashOf(req);
  if (!hash) return send({ status: 400, body: { code: "device" } });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return send({ status: 400, body: { code: "input" } });
  }
  return send(await createReport(db, form, hash));
}
