import { expect, test, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/server/layer", () => ({
  getLayer: async (id: string) => ({ id, status: "live", updatedAt: "", source: { name: "", url: "" }, features: { type: "FeatureCollection", features: [] } }),
}));
vi.mock("@/lib/sources/registry", () => ({ registry: { air: {}, waste: {}, buses: {} } }));

test("health lists the registered layers except the hidden ones (waste)", async () => {
  const rows = (await (await GET()).json()) as { id: string }[];
  expect(rows.map((r) => r.id)).toEqual(["air", "buses"]);
});
