import { beforeEach, expect, test, vi } from "vitest";
import type { LayerResponse } from "@/lib/sources/types";
import { GET } from "./[id]/route";

const { getLayer } = vi.hoisted(() => ({ getLayer: vi.fn() }));
vi.mock("@/lib/server/layer", () => ({ getLayer }));
vi.mock("@/lib/sources/registry", () => ({ registry: { air: { ttl: 600 } } }));

const respond = (status: LayerResponse["status"]) =>
  getLayer.mockResolvedValue({ id: "air", status, updatedAt: "", source: { name: "", url: "" }, features: { type: "FeatureCollection", features: [] } });
const cacheControl = async () => (await GET(new Request("http://x/"), { params: Promise.resolve({ id: "air" }) })).headers.get("Cache-Control");

beforeEach(() => getLayer.mockReset());

test("live and static answers keep the full CDN life with stale-while-revalidate", async () => {
  respond("live");
  expect(await cacheControl()).toBe("public, s-maxage=600, stale-while-revalidate=6000");
  respond("static");
  expect(await cacheControl()).toBe("public, s-maxage=600, stale-while-revalidate=6000");
});

test("stale and offline answers are cached for 30 s at most, with no stale-while-revalidate", async () => {
  for (const status of ["stale", "offline"] as const) {
    respond(status);
    expect(await cacheControl()).toBe("public, s-maxage=30");
  }
});

test("unregistered layers are 404", async () => {
  expect((await GET(new Request("http://x/"), { params: Promise.resolve({ id: "nope" }) })).status).toBe(404);
});
