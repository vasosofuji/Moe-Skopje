import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { translate } from "@/lib/i18n/core";
import current from "@/lib/sources/__fixtures__/pulse-current.json";
import sensors from "@/lib/sources/__fixtures__/pulse-sensor.json";
import { parseAir } from "@/lib/sources/air";
import type { LayerResponse } from "@/lib/sources/types";
import { AirDetail } from "./AirDetail";

const layer = (features: LayerResponse["features"]["features"]): LayerResponse => ({
  id: "air",
  status: "live",
  updatedAt: "2026-10-17T11:00:00Z",
  source: { name: "pulse.eco", url: "https://skopje.pulse.eco" },
  features: { type: "FeatureCollection", features },
});

test("AirDetail lists stations worst first and shows the advice for the city level", () => {
  const names = new Map(sensors.map((s) => [s.sensorId, s.description]));
  const features = parseAir(current, names, Date.parse("2026-10-17T11:00:00Z"));
  const html = renderToStaticMarkup(<AirDetail data={layer(features)} />);

  const values = [...html.matchAll(/t-headline tabular-nums">(\d+)</g)].map((m) => Number(m[1]));
  expect(values).toHaveLength(features.length);
  expect(values).toEqual([...values].sort((a, b) => b - a));
  expect(html).toContain("MOEPP Centar");
  expect(html).toContain(translate("mk", "air.advice.0")); // median of the fixture is well under 40
  expect(html).not.toContain("<svg"); // the sparkline only appears after /api/air-trend answers
});

test("AirDetail with no stations says so instead of inventing a level", () => {
  const html = renderToStaticMarkup(<AirDetail data={layer([])} />);
  expect(html).toContain(translate("mk", "explore.noData"));
  for (const n of [0, 1, 2, 3] as const) expect(html).not.toContain(translate("mk", `air.advice.${n}`));
});
