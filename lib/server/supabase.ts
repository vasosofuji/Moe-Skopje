import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Feature } from "@/lib/sources/types";

export interface SnapshotStore {
  get(id: string): Promise<{ payload: Feature[]; fetchedAt: string } | null>;
  put(id: string, payload: Feature[]): Promise<void>;
}

let client: SupabaseClient | undefined;
let warnedDisabled = false;

/**
 * Service-role client for route handlers and lib/server code, or null when the env vars are missing
 * (logged once). Callers treat null as "feature disabled" instead of crashing.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (!warnedDisabled) {
      warnedDisabled = true;
      console.warn("[supabase] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing: snapshots are disabled.");
    }
    return null;
  }
  return (client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
}

const IO_TIMEOUT_MS = 2000; // a hung Supabase must not hold up a layer response
let warnedFailure = false;
function swallow(action: string, err: unknown): void {
  if (warnedFailure) return;
  warnedFailure = true;
  console.warn(`[supabase] snapshot ${action} failed (further failures are not logged):`, err instanceof Error ? err.message : err);
}

/** `source_snapshots` in Supabase. No-op without env vars; Supabase errors are swallowed so a snapshot problem never fails a response. */
export function supabaseSnapshots(): SnapshotStore {
  return {
    async get(id) {
      const db = getSupabaseAdmin();
      if (!db) return null;
      try {
        const { data, error } = await db.from("source_snapshots").select("payload, fetched_at").eq("source_id", id).abortSignal(AbortSignal.timeout(IO_TIMEOUT_MS)).maybeSingle();
        if (error) throw error;
        return data ? { payload: data.payload as Feature[], fetchedAt: new Date(data.fetched_at).toISOString() } : null;
      } catch (err) {
        swallow("read", err);
        return null;
      }
    },
    async put(id, payload) {
      const db = getSupabaseAdmin();
      if (!db) return;
      try {
        const { error } = await db.from("source_snapshots").upsert({ source_id: id, payload, fetched_at: new Date().toISOString() }).abortSignal(AbortSignal.timeout(IO_TIMEOUT_MS));
        if (error) throw error;
      } catch (err) {
        swallow("write", err);
      }
    },
  };
}

/** In-memory store for tests; `initial` pre-loads snapshots with a chosen fetchedAt. */
export function memorySnapshots(initial: Record<string, { payload: Feature[]; fetchedAt: string }> = {}): SnapshotStore {
  const rows = new Map(Object.entries(initial));
  return {
    async get(id) {
      return rows.get(id) ?? null;
    },
    async put(id, payload) {
      rows.set(id, { payload, fetchedAt: new Date().toISOString() });
    },
  };
}
