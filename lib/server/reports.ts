import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ReportInputSchema, validatePhoto } from "@/lib/reports-schema";
import { NEWEST_REPORTS, PHOTO_BUCKET, REPORT_COLUMNS, asCategory, photoUrl, type ReportRow } from "@/lib/sources/reports";

export const REPORTS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

/** What a route handler sends back: HTTP status plus JSON body. */
export type Result = { status: number; body: unknown };
/** `{ code }` error result; a database/storage error is logged server-side and never sent to the client. */
const fail = (status: number, code: string, cause?: { message: string }): Result => {
  if (cause) console.warn(`[reports] ${code}: ${cause.message}`);
  return { status, body: { code } };
};

/** SHA-256 hex of `${deviceId}|${userAgent}` (spec §5.4). Only this hash is stored, never the device id. */
export async function deviceHash(deviceId: string, userAgent: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${deviceId}|${userAgent}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// getDeviceId() hands out crypto.randomUUID(); anything else in the header is not from our client.
const DEVICE_ID = /^[\w-]{8,64}$/;

/** Hash for the request's `x-device-id` + user agent, or null when the header is missing or malformed. */
export async function deviceHashOf(req: Request): Promise<string | null> {
  const id = req.headers.get("x-device-id");
  return id && DEVICE_ID.test(id) ? deviceHash(id, req.headers.get("user-agent") ?? "") : null;
}

/**
 * Validates the multipart body (`data` JSON, optional `photo`), enforces 5 reports per device per hour,
 * then uploads the photo and inserts the row.
 */
// ponytail: count-then-insert is not atomic, so a burst of parallel requests can overshoot the limit by a few. A DB function would close it.
export async function createReport(db: SupabaseClient, form: FormData, hash: string): Promise<Result> {
  let json: unknown;
  try {
    json = JSON.parse(String(form.get("data")));
  } catch {
    return fail(400, "input");
  }
  const input = ReportInputSchema.safeParse(json);
  if (!input.success) return fail(400, "input");

  const field = form.get("photo");
  if (field !== null && !(field instanceof File)) return fail(400, "type");
  const check = validatePhoto(field);
  if (!check.ok) return fail(400, check.code);

  const since = new Date(Date.now() - HOUR_MS).toISOString();
  const { count, error: countError } = await db
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("device_hash", hash)
    .gte("created_at", since);
  if (countError) return fail(500, "error", countError);
  if ((count ?? 0) >= REPORTS_PER_HOUR) return fail(429, "rate");

  const id = crypto.randomUUID();
  let photoPath: string | null = null;
  if (field) {
    const path = `${id}.jpg`;
    // validatePhoto allowlisted field.type (raster image/* only), so that is what the public bucket serves it as
    const { error } = await db.storage.from(PHOTO_BUCKET).upload(path, field, { contentType: field.type });
    if (error) return fail(500, "upload", error);
    photoPath = path;
  }

  const { description, nickname, ...rest } = input.data;
  const { error } = await db
    .from("reports")
    .insert({ id, ...rest, description: description || null, nickname: nickname || null, photo_path: photoPath, device_hash: hash });
  if (error) {
    if (photoPath) await db.storage.from(PHOTO_BUCKET).remove([photoPath]); // don't leave an orphan photo behind
    return fail(500, "error", error);
  }
  return { status: 201, body: { id } };
}

/**
 * One vote per device per report. `vote_report` (supabase/schema.sql) inserts into `report_votes` and bumps
 * `reports.upvotes` in one transaction: the primary key rejects a repeat (23505) and there is no read-modify-write race.
 */
export async function castVote(db: SupabaseClient, reportId: string, hash: string): Promise<Result> {
  if (!z.uuid().safeParse(reportId).success) return fail(404, "notfound");
  const { data, error } = await db.rpc("vote_report", { p_report_id: reportId, p_device_hash: hash });
  if (error) {
    if (error.code === "23505") return fail(409, "voted");
    if (error.code === "23503") return fail(404, "notfound"); // no such report
    return fail(500, "error", error);
  }
  return { status: 200, body: { upvotes: data as number } };
}

/** Newest 100 reports, public fields only. With `near` the same 100 come back nearest first. */
export async function listReports(db: SupabaseClient, near?: [lng: number, lat: number]): Promise<Result> {
  const { data, error } = await db.from("reports").select(REPORT_COLUMNS).order("created_at", { ascending: false }).limit(NEWEST_REPORTS);
  if (error) return fail(500, "error", error);

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const reports = (data as unknown as ReportRow[]).map((r) => ({
    id: r.id,
    category: asCategory(r.category),
    description: r.description,
    lat: r.lat,
    lng: r.lng,
    photoUrl: r.photo_path ? photoUrl(base, r.photo_path) : null,
    nickname: r.nickname,
    status: r.status,
    upvotes: r.upvotes,
    createdAt: new Date(r.created_at).toISOString(),
  }));

  if (near) {
    const [lng0, lat0] = near;
    const cos = Math.cos((lat0 * Math.PI) / 180); // a degree of longitude is shorter than one of latitude
    const dist = (r: { lat: number; lng: number }) => Math.hypot((r.lng - lng0) * cos, r.lat - lat0);
    reports.sort((a, b) => dist(a) - dist(b));
  }
  return { status: 200, body: reports };
}
