import { expect, test } from "vitest";
import { aqiColor, pm10Severity, sparkPoints } from "./aqi";

test("pm10Severity thresholds", () => {
  expect([20, 40, 41, 50, 51, 100, 101, 151].map(pm10Severity)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
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
