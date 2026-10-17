import { expect, test } from "vitest";
import meteo from "./__fixtures__/open-meteo.json";
import { parseWeather } from "./weather";
import { FeatureSchema } from "./types";

test("weather fixture → one feature with temperature", () => {
  const features = parseWeather(meteo);
  expect(features).toHaveLength(1);
  const f = FeatureSchema.parse(features[0]);
  expect(f.geometry).toEqual({ type: "Point", coordinates: [21.4254, 41.9981] });
  expect(f.properties).toMatchObject({
    kind: "weather",
    value: 15,
    unit: "°C",
    detail: { temperature: 15, apparent: 12.6, precipitation: 0, weatherCode: 3, wind: 5.6 },
  });
});

test("weather detail.hourly is a JSON string of 24 hourly temperatures", () => {
  const detail = parseWeather(meteo)[0].properties.detail!;
  const hourly = JSON.parse(String(detail.hourly));
  expect(hourly).toHaveLength(24);
  expect(hourly[0]).toBe(5.9);
  expect(JSON.parse(String(detail.hourlyPrecip))).toHaveLength(24);
});

test("weather rejects a payload without the current block", () => {
  expect(() => parseWeather({ hourly: {} })).toThrow();
});
