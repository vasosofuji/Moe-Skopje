// Citizen reports as a map layer. Not under lib/server: scripts/check-sources.ts runs adapters under tsx, where
// "server-only" throws. It reads with the anon key (RLS allows public select on `reports`), never the service role.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { translate } from "@/lib/i18n/core";
import { REPORT_CATEGORIES, type ReportCategory } from "@/lib/reports-schema";
import { loadSeed } from "./seed";
import type { Adapter, Feature } from "./types";

export const PHOTO_BUCKET = "report-photos";
export const NEWEST_REPORTS = 100;
/** Public columns only: `device_hash` is never selected. */
export const REPORT_COLUMNS = "id,category,description,lat,lng,photo_path,nickname,status,upvotes,created_at";

export type ReportRow = {
  id: string;
  category: string;
  description: string | null;
  lat: number;
  lng: number;
  photo_path: string | null;
  nickname: string | null;
  status: string;
  upvotes: number;
  created_at: string;
};

/** URL of a photo in the public `report-photos` bucket. */
export const photoUrl = (supabaseUrl: string, path: string) =>
  `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;

export const asCategory = (v: string): ReportCategory => ((REPORT_CATEGORIES as readonly string[]).includes(v) ? (v as ReportCategory) : "other");

export function toFeature(r: ReportRow, supabaseUrl: string): Feature {
  const category = asCategory(r.category);
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id,
      kind: "report",
      title: { mk: translate("mk", `report.category.${category}`), en: translate("en", `report.category.${category}`) },
      startsAt: new Date(r.created_at).toISOString(),
      detail: {
        category,
        status: r.status,
        upvotes: r.upvotes,
        ...(r.photo_path ? { photoUrl: photoUrl(supabaseUrl, r.photo_path) } : {}),
      },
    },
  };
}

let anon: SupabaseClient | undefined;

export const reportsAdapter: Adapter = {
  id: "reports",
  ttl: 30,
  source: { name: "Мое Скопје", url: "" },
  async fetch(signal) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");
    anon ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

    let q = anon.from("reports").select(REPORT_COLUMNS).order("created_at", { ascending: false }).limit(NEWEST_REPORTS);
    if (signal) q = q.abortSignal(signal);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data as unknown as ReportRow[]).map((r) => toFeature(r, url));
  },
  seed: () => loadSeed("reports"),
};
