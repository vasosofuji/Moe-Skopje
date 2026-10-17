import { expect, test } from "vitest";
import emsc from "./__fixtures__/emsc.json";
import { parseQuakes, quakeSeverity } from "./earthquakes";
import { FeatureSchema } from "./types";

test("emsc fixture → features with mag and severity", () => {
  const features = parseQuakes(emsc);
  expect(features).toHaveLength(emsc.features.length);
  for (const f of features) {
    const p = FeatureSchema.parse(f).properties;
    expect(p.kind).toBe("earthquake");
    expect(p.unit).toBe("M");
    expect(Number.isFinite(p.value)).toBe(true);
    expect(p.severity).toBe(quakeSeverity(p.value!));
    expect(Number.isNaN(Date.parse(p.startsAt!))).toBe(false);
  }
  const first = features[0];
  expect(first.properties).toMatchObject({ id: "quake-20261017_0000107", value: 2.5, startsAt: "2026-10-17T08:15:36.3Z" });
  expect(first.geometry).toEqual({ type: "Point", coordinates: [21.227, 41.435] }); // depth dropped
});

test("mag 4.2 → severity 2", () => {
  expect([2.9, 3, 3.9, 4, 4.2, 4.9, 5, 6.4].map(quakeSeverity)).toEqual([0, 1, 1, 2, 2, 2, 3, 3]);
});

test("a malformed event is skipped, an empty result is fine, a wrong envelope throws", () => {
  const good = emsc.features[0];
  const bad = { type: "Feature", geometry: { type: "Point", coordinates: [1, 2] }, properties: { unid: "x", time: "t" } };
  expect(parseQuakes({ features: [bad, good] })).toHaveLength(1);
  expect(parseQuakes({ features: [] })).toEqual([]);
  expect(() => parseQuakes({ error: "x" })).toThrow();
});

test("region names are localised for the Macedonian UI", () => {
  const p = parseQuakes(emsc)[0].properties;
  expect(p.title).toEqual({ mk: "М 2.5 · Северна Македонија", en: "M 2.5 · North Macedonia" });
});
