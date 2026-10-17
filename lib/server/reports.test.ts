import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MAX_PHOTO_BYTES, ReportInputSchema, validatePhoto } from "@/lib/reports-schema";
import { castVote, createReport, deviceHash, listReports, type Result } from "./reports";
import { getLayer, resetLayerCache } from "./layer";
import { memorySnapshots } from "./supabase";
import { reportsAdapter, toFeature, type ReportRow } from "@/lib/sources/reports";
import { FeatureSchema } from "@/lib/sources/types";
import { GET as listRoute, POST as createRoute } from "@/app/api/reports/route";
import { POST as voteRoute } from "@/app/api/reports/[id]/vote/route";

// The routes ask lib/server/supabase for the service-role client; null stands for "env vars missing".
const h = vi.hoisted(() => ({ db: null as unknown, anon: null as unknown, read: { table: "", cols: "" } }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => h.anon })); // the adapter's anon client
vi.mock("@/lib/server/supabase", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/supabase")>()),
  getSupabaseAdmin: () => h.db,
}));

const idOf = (r: Result) => (r.body as { id: string }).id;
const ID = "3f2b8c1e-5d4a-4e7b-9a60-1c2d3e4f5a6b";
const DEVICE = "0b6f1c1e-7a52-4b43-8d0e-9f3a7c2b1d11";
const UA = "Mozilla/5.0 (test)";
const photo = (bytes: number, type = "image/jpeg") => new File([new Uint8Array(bytes)], "p.jpg", { type });

type Row = Record<string, unknown>;
type Opts = {
  count?: number;
  rows?: Row[];
  insertError?: { message: string };
  rpc?: { data: number | null; error: { code: string; message: string } | null };
};

/** Minimal stand-in for the Supabase client: records writes, answers the queries lib/server/reports makes. */
function fakeDb(o: Opts = {}) {
  const calls = {
    insert: [] as Row[],
    upload: [] as { bucket: string; path: string; type?: string }[],
    remove: [] as string[][],
    rpc: [] as { fn: string; args: unknown }[],
  };
  const query = (result: unknown) => {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "order", "limit"]) q[m] = () => q;
    q.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => Promise.resolve(result).then(ok, bad);
    return q;
  };
  const db = {
    from: () => ({
      select: (_cols: string, opts?: { head?: boolean }) =>
        query(opts?.head ? { count: o.count ?? 0, error: null } : { data: o.rows ?? [], error: null }),
      insert: async (row: Row) => {
        calls.insert.push(row);
        return { error: o.insertError ?? null };
      },
    }),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, _file: File, opts?: { contentType?: string }) => {
          calls.upload.push({ bucket, path, type: opts?.contentType });
          return { error: null };
        },
        remove: async (paths: string[]) => {
          calls.remove.push(paths);
          return { error: null };
        },
      }),
    },
    rpc: async (fn: string, args: unknown) => {
      calls.rpc.push({ fn, args });
      return o.rpc ?? { data: 1, error: null };
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

const body = (over: Row = {}) => ({ category: "pothole", description: "Голема дупка", lat: 41.9981, lng: 21.4254, ...over });
const form = (data: unknown, file?: File) => {
  const f = new FormData();
  f.set("data", JSON.stringify(data));
  if (file) f.set("photo", file);
  return f;
};
const post = (f: FormData, headers: Record<string, string> = { "x-device-id": DEVICE }) =>
  new Request("http://localhost/api/reports", { method: "POST", body: f, headers: { "user-agent": UA, ...headers } });
const vote = (headers: Record<string, string> = { "x-device-id": DEVICE }) =>
  voteRoute(new Request(`http://localhost/api/reports/${ID}/vote`, { method: "POST", headers: { "user-agent": UA, ...headers } }), {
    params: Promise.resolve({ id: ID }),
  });

beforeEach(() => {
  h.db = null;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.test");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// --- validatePhoto -------------------------------------------------------------------------------

test("validatePhoto rejects non-images", () =>
  expect(validatePhoto(new File(["x"], "a.pdf", { type: "application/pdf" }))).toEqual({ ok: false, code: "type" }));

test("validatePhoto rejects > 4 MB", () =>
  expect(validatePhoto(photo(MAX_PHOTO_BYTES + 1))).toEqual({ ok: false, code: "size" }));

test("validatePhoto accepts HEIC under 4 MB, exactly 4 MB, and no photo", () => {
  expect(validatePhoto(photo(1000, "image/heic"))).toEqual({ ok: true });
  expect(validatePhoto(photo(MAX_PHOTO_BYTES))).toEqual({ ok: true });
  expect(validatePhoto(null)).toEqual({ ok: true });
});

// --- ReportInputSchema ---------------------------------------------------------------------------

test("ReportInputSchema rejects coordinates outside Skopje bbox", () => {
  expect(ReportInputSchema.safeParse(body()).success).toBe(true);
  expect(ReportInputSchema.safeParse(body({ lat: 52.52, lng: 13.4 })).success).toBe(false); // Berlin
  expect(ReportInputSchema.safeParse(body({ lat: 42.11 })).success).toBe(false);
  expect(ReportInputSchema.safeParse(body({ lng: 21.24 })).success).toBe(false);
  expect(ReportInputSchema.safeParse(body({ lat: Number.NaN })).success).toBe(false);
});

test("ReportInputSchema limits category, description and nickname", () => {
  expect(ReportInputSchema.safeParse(body({ category: "graffiti" })).success).toBe(false);
  expect(ReportInputSchema.safeParse(body({ description: "x".repeat(500) })).success).toBe(true);
  expect(ReportInputSchema.safeParse(body({ description: "x".repeat(501) })).success).toBe(false);
  expect(ReportInputSchema.safeParse(body({ nickname: "n".repeat(32) })).success).toBe(true);
  expect(ReportInputSchema.safeParse(body({ nickname: "n".repeat(33) })).success).toBe(false);
  expect(ReportInputSchema.parse({ category: "dump", lat: 42, lng: 21.4 }).description).toBe("");
});

// --- deviceHash ----------------------------------------------------------------------------------

test("deviceHash is the SHA-256 hex of `${deviceId}|${userAgent}`", async () => {
  const expected = createHash("sha256").update(`${DEVICE}|${UA}`).digest("hex");
  expect(await deviceHash(DEVICE, UA)).toBe(expected);
  expect(await deviceHash(DEVICE, "other agent")).not.toBe(expected);
});

// --- createReport --------------------------------------------------------------------------------

test("rate limit: 6th report within an hour → 429", async () => {
  const { db, calls } = fakeDb({ count: 5 });
  const res = await createReport(db, form(body(), photo(10)), "hash");
  expect(res).toEqual({ status: 429, body: { code: "rate" } });
  expect(calls.insert).toEqual([]);
  expect(calls.upload).toEqual([]);
});

test("5th report in the hour is still accepted and stores the device hash, not the device id", async () => {
  const { db, calls } = fakeDb({ count: 4 });
  const res = await createReport(db, form(body({ nickname: " Ана ", description: "" })), "hash");
  expect(res.status).toBe(201);
  expect(res.body).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/) });
  expect(calls.insert).toEqual([
    {
      id: idOf(res),
      category: "pothole",
      description: null,
      lat: 41.9981,
      lng: 21.4254,
      nickname: "Ана",
      photo_path: null,
      device_hash: "hash",
    },
  ]);
  expect(calls.upload).toEqual([]);
});

test("a photo is uploaded to report-photos/<id>.jpg with its own content type", async () => {
  const { db, calls } = fakeDb();
  const res = await createReport(db, form(body(), photo(1000, "image/heic")), "hash");
  expect(res.status).toBe(201);
  expect(calls.upload).toEqual([{ bucket: "report-photos", path: `${idOf(res)}.jpg`, type: "image/heic" }]);
  expect(calls.insert[0].photo_path).toBe(`${idOf(res)}.jpg`);
});

test("bad input or photo is a 400 and nothing is written", async () => {
  const { db, calls } = fakeDb();
  const bad = async (f: FormData) => (await createReport(db, f, "hash")).body;
  expect(await bad(form(body({ lat: 0 })))).toEqual({ code: "input" });
  expect(await bad(new FormData())).toEqual({ code: "input" });
  const junk = new FormData();
  junk.set("data", "{not json");
  expect(await bad(junk)).toEqual({ code: "input" });
  expect(await bad(form(body(), new File(["x"], "a.pdf", { type: "application/pdf" })))).toEqual({ code: "type" });
  expect(await bad(form(body(), photo(MAX_PHOTO_BYTES + 1)))).toEqual({ code: "size" });
  const text = form(body());
  text.set("photo", "not a file");
  expect(await bad(text)).toEqual({ code: "type" });
  expect(calls.insert).toEqual([]);
  expect(calls.upload).toEqual([]);
});

test("a failed insert removes the uploaded photo and answers 500", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const { db, calls } = fakeDb({ insertError: { message: "boom" } });
  const res = await createReport(db, form(body(), photo(10)), "hash");
  expect(res).toEqual({ status: 500, body: { code: "error" } });
  expect(calls.remove).toEqual([[calls.upload[0].path]]);
});

// --- castVote ------------------------------------------------------------------------------------

test("castVote returns the new upvote count from the atomic RPC", async () => {
  const { db, calls } = fakeDb({ rpc: { data: 7, error: null } });
  expect(await castVote(db, ID, "hash")).toEqual({ status: 200, body: { upvotes: 7 } });
  expect(calls.rpc).toEqual([{ fn: "vote_report", args: { p_report_id: ID, p_device_hash: "hash" } }]);
});

test("a repeat vote (primary-key violation) is a 409; an unknown report is a 404", async () => {
  const dup = fakeDb({ rpc: { data: null, error: { code: "23505", message: "duplicate key" } } });
  expect(await castVote(dup.db, ID, "hash")).toEqual({ status: 409, body: { code: "voted" } });
  const gone = fakeDb({ rpc: { data: null, error: { code: "23503", message: "fk" } } });
  expect(await castVote(gone.db, ID, "hash")).toEqual({ status: 404, body: { code: "notfound" } });
  const junk = fakeDb();
  expect(await castVote(junk.db, "1; drop table reports", "hash")).toEqual({ status: 404, body: { code: "notfound" } });
  expect(junk.calls.rpc).toEqual([]);
});

// --- listReports ---------------------------------------------------------------------------------

const row = (over: Row = {}): Row => ({
  id: ID,
  category: "dump",
  description: "Ѓубре",
  lat: 41.99,
  lng: 21.43,
  photo_path: `${ID}.jpg`,
  nickname: null,
  status: "new",
  upvotes: 2,
  created_at: "2026-10-17T08:00:00+00:00",
  ...over,
});

test("listReports returns public fields only, with the photo URL built from the public bucket", async () => {
  const { db } = fakeDb({ rows: [{ ...row(), device_hash: "secret" }] });
  const res = await listReports(db);
  expect(res.status).toBe(200);
  expect(res.body).toEqual([
    {
      id: ID,
      category: "dump",
      description: "Ѓубре",
      lat: 41.99,
      lng: 21.43,
      photoUrl: `https://example.supabase.test/storage/v1/object/public/report-photos/${ID}.jpg`,
      nickname: null,
      status: "new",
      upvotes: 2,
      createdAt: "2026-10-17T08:00:00.000Z",
    },
  ]);
});

test("listReports with near= orders the newest rows by distance", async () => {
  const far = row({ id: "far", lat: 42.05, lng: 21.55 });
  const close = row({ id: "close", lat: 41.9981, lng: 21.4254 });
  const { db } = fakeDb({ rows: [far, close] });
  const ids = async (near?: [number, number]) => ((await listReports(db, near)).body as { id: string }[]).map((r) => r.id);
  expect(await ids()).toEqual(["far", "close"]);
  expect(await ids([21.4254, 41.9981])).toEqual(["close", "far"]);
});

// --- route handlers ------------------------------------------------------------------------------

test("without Supabase env vars every route answers 503 { code: 'disabled' }", async () => {
  h.db = null;
  const out = [
    await createRoute(post(form(body()))),
    await listRoute(new Request("http://localhost/api/reports")),
    await vote(),
  ];
  for (const res of out) {
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "disabled" });
  }
});

test("a missing or malformed x-device-id is a 400 { code: 'device' }", async () => {
  h.db = fakeDb().db;
  for (const headers of [{}, { "x-device-id": "" }, { "x-device-id": "../../etc; drop" }] as Record<string, string>[]) {
    const res = await createRoute(post(form(body()), headers));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "device" });
  }
  expect((await vote({})).status).toBe(400);
});

test("POST /api/reports → 201 { id }, then 429 once the device has 5 reports this hour", async () => {
  const ok = fakeDb({ count: 0 });
  h.db = ok.db;
  const created = await createRoute(post(form(body(), photo(10))));
  expect(created.status).toBe(201);
  expect(await created.json()).toEqual({ id: ok.calls.insert[0].id });
  expect(ok.calls.insert[0].device_hash).toBe(await deviceHash(DEVICE, UA));

  h.db = fakeDb({ count: 5 }).db;
  const limited = await createRoute(post(form(body())));
  expect(limited.status).toBe(429);
  expect(await limited.json()).toEqual({ code: "rate" });
});

test("a non-multipart POST is a 400", async () => {
  h.db = fakeDb().db;
  const res = await createRoute(
    new Request("http://localhost/api/reports", { method: "POST", body: "{}", headers: { "x-device-id": DEVICE } }),
  );
  expect(res.status).toBe(400);
});

test("GET /api/reports?near= validates the coordinates", async () => {
  h.db = fakeDb({ rows: [row()] }).db;
  expect((await listRoute(new Request("http://localhost/api/reports?near=21.43,41.99"))).status).toBe(200);
  expect((await listRoute(new Request("http://localhost/api/reports?near=abc"))).status).toBe(400);
});

test("POST /api/reports/[id]/vote → 200 { upvotes }, repeat → 409", async () => {
  h.db = fakeDb({ rpc: { data: 3, error: null } }).db;
  const res = await vote();
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ upvotes: 3 });

  h.db = fakeDb({ rpc: { data: null, error: { code: "23505", message: "dup" } } }).db;
  expect((await vote()).status).toBe(409);
});

// --- reports adapter -----------------------------------------------------------------------------

test("toFeature emits a report point that passes FeatureSchema, with the photo URL only when there is a photo", () => {
  const f = toFeature(row() as ReportRow, "https://example.supabase.test/");
  expect(FeatureSchema.safeParse(f).success).toBe(true);
  expect(f.geometry).toEqual({ type: "Point", coordinates: [21.43, 41.99] });
  expect(f.properties).toMatchObject({
    id: ID,
    kind: "report",
    title: { mk: "Дива депонија", en: "Illegal dump" },
    detail: {
      category: "dump",
      status: "new",
      upvotes: 2,
      photoUrl: `https://example.supabase.test/storage/v1/object/public/report-photos/${ID}.jpg`,
    },
  });
  const bare = toFeature(row({ photo_path: null, category: "graffiti" }) as ReportRow, "https://example.supabase.test");
  expect(bare.properties.detail).toEqual({ category: "other", status: "new", upvotes: 2 });
});

test("the adapter reads with the anon key and selects exactly the anon-granted columns, never * or device_hash", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-test-key");
  const q: Record<string, unknown> = {};
  for (const m of ["order", "limit", "abortSignal"]) q[m] = () => q;
  q.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: [row()], error: null }).then(ok);
  h.anon = {
    from: (table: string) => ({
      select: (cols: string) => {
        h.read = { table, cols };
        return q;
      },
    }),
  };

  const features = await reportsAdapter.fetch(new AbortController().signal);
  expect(features).toHaveLength(1);
  expect(h.read.table).toBe("reports");
  expect(h.read.cols.split(",")).toEqual([
    "id", "category", "description", "lat", "lng", "photo_path", "nickname", "status", "upvotes", "created_at",
  ]);
});

test("without the anon env vars the adapter throws and the layer is served offline and empty", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await expect(reportsAdapter.fetch()).rejects.toThrow(/missing/);

  resetLayerCache();
  const res = await getLayer("reports", { snapshots: memorySnapshots() });
  expect(res.status).toBe("offline");
  expect(res.features.features).toEqual([]);
});
