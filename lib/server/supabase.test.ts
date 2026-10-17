import { afterEach, expect, test, vi } from "vitest";
import { supabaseSnapshots } from "./supabase";

// A client whose every query fails, to prove the store swallows Supabase errors. Every abortSignal() call is recorded.
const signals = vi.hoisted(() => [] as AbortSignal[]);
vi.mock("@supabase/supabase-js", () => {
  const down = new Error("db down");
  const abortSignal = (signal: AbortSignal) => (signals.push(signal), builder);
  const builder = { abortSignal, maybeSingle: async () => ({ data: null, error: down }), then: (ok: (v: unknown) => unknown) => Promise.resolve({ error: down }).then(ok) };
  return {
    createClient: () => ({
      from: () => ({
        select: () => ({ eq: () => ({ abortSignal, maybeSingle: builder.maybeSingle }) }),
        upsert: () => ({ abortSignal }),
      }),
    }),
  };
});

afterEach(() => vi.unstubAllEnvs());

test("snapshot store is a no-op without Supabase env vars, and says so once", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const store = supabaseSnapshots();

  await expect(store.put("air", [])).resolves.toBeUndefined();
  await expect(store.get("air")).resolves.toBeNull();

  expect(warn).toHaveBeenCalledTimes(1);
});

test("snapshot store swallows Supabase errors and logs once", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const store = supabaseSnapshots();

  await expect(store.get("air")).resolves.toBeNull();
  await expect(store.put("air", [])).resolves.toBeUndefined();

  expect(warn).toHaveBeenCalledTimes(1);
});

test("snapshot reads and writes carry a 2 s abort signal", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  signals.length = 0;
  const store = supabaseSnapshots();

  await store.get("air");
  await store.put("air", []);

  expect(signals).toHaveLength(2);
  expect(signals.every((s) => s instanceof AbortSignal && !s.aborted)).toBe(true);
});
