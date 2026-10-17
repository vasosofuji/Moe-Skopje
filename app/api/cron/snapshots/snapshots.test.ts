import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getLayer } from "@/lib/server/layer";
import { loadGtfs } from "@/lib/sources/gtfs";
import { registry } from "@/lib/sources/registry";
import { GET } from "./route";

vi.mock("@/lib/server/layer", () => ({ getLayer: vi.fn() }));
vi.mock("@/lib/sources/gtfs", async (orig) => ({ ...(await orig<typeof import("@/lib/sources/gtfs")>()), loadGtfs: vi.fn() }));

const call = (auth?: string) => GET(new Request("http://x/api/cron/snapshots", { headers: auth ? { authorization: auth } : {} }));
const refreshed = Object.entries(registry).filter(([, a]) => !a?.static).map(([id]) => id);

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "s3cret");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.mocked(getLayer).mockImplementation(async (id) => ({ id, status: "live" }) as Awaited<ReturnType<typeof getLayer>>);
  vi.mocked(loadGtfs).mockResolvedValue({} as Awaited<ReturnType<typeof loadGtfs>>);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("503 when CRON_SECRET is not configured, 401 without the right bearer token", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect((await call("Bearer ")).status).toBe(503);
  vi.stubEnv("CRON_SECRET", "s3cret");
  expect((await call()).status).toBe(401);
  expect((await call("Bearer wrong")).status).toBe(401);
  expect((await call("s3cret")).status).toBe(401);
  expect(getLayer).not.toHaveBeenCalled();
});

test("refreshes every non-static layer sequentially and reports id, status and ms", async () => {
  const res = await call("Bearer s3cret");
  expect(res.status).toBe(200);
  const { results } = await res.json();
  expect(results.map((r: { id: string }) => r.id)).toEqual(["gtfs", ...refreshed]);
  expect(refreshed).toContain("air");
  expect(refreshed).not.toContain("schools"); // baked dataset: nothing to snapshot
  for (const r of results) expect(r).toEqual({ id: r.id, status: expect.any(String), ms: expect.any(Number) });
  expect(results.find((r: { id: string }) => r.id === "air").status).toBe("live");
  expect(vi.mocked(getLayer).mock.calls.map(([id]) => id)).toEqual(refreshed);
});

test("one layer failing does not stop the rest", async () => {
  vi.mocked(getLayer).mockImplementation(async (id) => {
    if (id === "weather") throw new Error("boom");
    return { id, status: "stale" } as Awaited<ReturnType<typeof getLayer>>;
  });
  vi.mocked(loadGtfs).mockRejectedValue(new Error("down"));
  const { results } = await (await call("Bearer s3cret")).json();
  expect(results).toHaveLength(refreshed.length + 1);
  expect(results.find((r: { id: string }) => r.id === "weather").status).toBe("error");
  expect(results.find((r: { id: string }) => r.id === "gtfs").status).toBe("error");
  expect(results.find((r: { id: string }) => r.id === "air").status).toBe("stale");
});
