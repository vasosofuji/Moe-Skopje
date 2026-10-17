import { expect, test } from "vitest";
import { markOnDuty, pharmacies } from "./pharmacies";
import { FeatureSchema, type Feature } from "./types";

const pharmacy = (mk: string, opening_hours?: string): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [21.43, 42] },
  properties: { id: `pharmacy:${mk}`, kind: "pharmacy", title: { mk, en: mk }, ...(opening_hours ? { detail: { opening_hours } } : {}) },
});

test("markOnDuty matches a roster by normalised name (script and case independent)", () => {
  const [a, b] = markOnDuty([pharmacy("Билна Аптека"), pharmacy("Zegin")], ["БИЛНА АПТЕКА 2", "зегин"]);
  expect(a.properties.detail?.onDuty).toBe(1);
  expect(b.properties.detail?.onDuty).toBe(1);
  expect(markOnDuty([pharmacy("Друга")], ["Билна Аптека"])[0].properties.detail?.onDuty).toBe(0);
});

test("markOnDuty without a roster falls back to OSM opening_hours containing 24/7", () => {
  const [open247, regular, unknown] = markOnDuty([pharmacy("A", "24/7"), pharmacy("B", "Mo-Fr 08:00-20:00"), pharmacy("C")]);
  expect([open247, regular, unknown].map((f) => f.properties.detail?.onDuty)).toEqual([1, 0, 0]);
  expect(open247.properties.detail?.opening_hours).toBe("24/7"); // existing detail is kept
});

test("pharmacies adapter: ttl 3600, live fetch throws while the FZO roster is unparsed, seed is the OSM 24/7 data", async () => {
  expect(pharmacies).toMatchObject({ id: "pharmacies", ttl: 3600 });
  expect(pharmacies.static).toBeFalsy();
  await expect(pharmacies.fetch()).rejects.toThrow(/FZO/);
  const seed = await pharmacies.seed();
  expect(seed.length).toBeGreaterThan(100);
  expect(seed.every((f) => FeatureSchema.safeParse(f).success && f.properties.kind === "pharmacy")).toBe(true);
  expect(seed.some((f) => f.properties.detail?.onDuty === 1)).toBe(true);
  expect(seed.every((f) => f.properties.detail?.onDuty === (String(f.properties.detail?.opening_hours ?? "").includes("24/7") ? 1 : 0))).toBe(true);
});
