import { expect, test } from "vitest";
import { AQI_COLORS, aqiBand, aqiColor, aqiPosition, colorFor, metricOf, pm10Severity, pm25Severity, sparkPoints } from "./aqi";

test("pm10Severity thresholds", () => {
  expect([20, 40, 41, 50, 51, 100, 101, 151].map(pm10Severity)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
});

test("pm25Severity is the same scale on the halved bands", () => {
  expect([10, 20, 21, 25, 26, 50, 51, 76].map(pm25Severity)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
});

test("colorFor uses the PM2.5 bands for PM2.5 readings: 30 µg/m³ is good PM10 but orange PM2.5", () => {
  expect(colorFor("pm10", 30)).toBe(AQI_COLORS[1]);
  expect(colorFor("pm25", 30)).toBe(AQI_COLORS[3]);
  expect([10, 11, 20, 21, 25, 26, 50, 51, 75, 76].map((v) => aqiBand("pm25", v))).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
  expect(metricOf({ metric: "pm25" })).toBe("pm25");
  expect(metricOf({ pm10: 12 })).toBe("pm10");
  expect(metricOf(undefined)).toBe("pm10");
});

test("aqiPosition gives each band an equal sixth and clamps to 0..1", () => {
  expect(aqiPosition("pm10", 0)).toBe(0);
  expect(aqiPosition("pm10", 20)).toBeCloseTo(1 / 6);
  expect(aqiPosition("pm10", 30)).toBeCloseTo(1.5 / 6);
  expect(aqiPosition("pm10", 150)).toBeCloseTo(5 / 6);
  expect(aqiPosition("pm10", 900)).toBe(1);
  expect(aqiPosition("pm10", Number.NaN)).toBe(0);
  // the same band on either metric lands on the same spot
  expect(aqiPosition("pm25", 40)).toBeCloseTo(aqiPosition("pm10", 80));
});

test("aqiColor changes exactly at the spec §6.4 band edges", () => {
  const edges = [20, 40, 50, 100, 150];
  const bands = [0, ...edges.map((e) => e + 1)].map(aqiColor);
  expect(new Set(bands).size).toBe(6);
  for (const e of edges) expect(aqiColor(e)).not.toBe(aqiColor(e + 1));
  expect(aqiColor(0)).toBe(aqiColor(20));
  expect(aqiColor(151)).toBe(aqiColor(900));
});

test("sparkPoints scales to the box with y pointing down, and flat data draws a mid line", () => {
  expect(sparkPoints([0, 10], 100, 20, 0)).toBe("0,20 100,0");
  expect(sparkPoints([5, 5, 5], 100, 20, 0)).toBe("0,10 50,10 100,10");
  expect(sparkPoints([], 100, 20)).toBe("");
});
