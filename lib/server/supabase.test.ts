import { afterEach, expect, test, vi } from "vitest";
import { supabaseSnapshots } from "./supabase";

// A client whose every query fails, to prove the store swallows Supabase errors.
vi.mock("@supabase/supabase-js", () => {
  const down = new Error("db down");
  return {
    createClient: () => ({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: down }) }) }),
        upsert: async () => ({ error: down }),
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
