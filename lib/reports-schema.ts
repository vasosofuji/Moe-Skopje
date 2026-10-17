// Shared between the report API (lib/server/reports.ts) and the client report flow, so no "server-only" here.
import { z } from "zod";

export const REPORT_CATEGORIES = ["pothole", "dump", "streetlight", "dogs", "parking", "water-leak", "other"] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/** Skopje bbox (W,S,E,N), the same one the map is limited to. */
const [WEST, SOUTH, EAST, NORTH] = [21.25, 41.9, 21.6, 42.1];

export const MAX_DESCRIPTION = 500;
export const MAX_NICKNAME = 32;
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // Vercel's function body limit is 4.5 MB

export const ReportInputSchema = z.object({
  category: z.enum(REPORT_CATEGORIES),
  description: z.string().trim().max(MAX_DESCRIPTION).default(""),
  lat: z.number().min(SOUTH).max(NORTH), // z.number() also rejects NaN and Infinity
  lng: z.number().min(WEST).max(EAST),
  nickname: z.string().trim().max(MAX_NICKNAME).optional(),
});
export type ReportInput = z.infer<typeof ReportInputSchema>;

/** The photo is optional (null passes). The server runs this again; the client uses it for a friendly error first. */
export function validatePhoto(file: File | null): { ok: true } | { ok: false; code: "type" | "size" } {
  if (!file) return { ok: true };
  if (!file.type.startsWith("image/")) return { ok: false, code: "type" };
  if (file.size > MAX_PHOTO_BYTES) return { ok: false, code: "size" };
  return { ok: true };
}
