import { expect, test } from "vitest";
import { goOutScore } from "./goOut";

test("goOutScore: clean air and mild dry weather scores 100", () => {
  expect(goOutScore(15, 20, 0)).toBe(100);
});

test("goOutScore: PM10 band penalty plus rain", () => {
  expect(goOutScore(120, 20, 1)).toBe(10); // 100 - 70 (PM10 <= 150) - 20 (rain over 0.5 mm)
});

test("goOutScore: clamps at 0", () => {
  expect(goOutScore(200, 40, 2)).toBe(0); // 100 - 90 - 20 - 15 = -25
});

test("goOutScore: null inputs add no penalty", () => {
  expect(goOutScore(null, null, null)).toBe(100);
});

test("goOutScore: every PM10 band edge", () => {
  const at = (pm10: number) => goOutScore(pm10, 20, 0);
  expect([20, 21, 40, 41, 50, 51, 100, 101, 150, 151].map(at)).toEqual([100, 90, 90, 75, 75, 50, 50, 30, 30, 10]);
});

test("goOutScore: rain needs more than 0.5 mm, temperature must be outside 0..35", () => {
  expect(goOutScore(null, 20, 0.5)).toBe(100);
  expect(goOutScore(null, 20, 0.6)).toBe(80);
  expect(goOutScore(null, 0, null)).toBe(100);
  expect(goOutScore(null, -1, null)).toBe(85);
  expect(goOutScore(null, 35, null)).toBe(100);
  expect(goOutScore(null, 36, null)).toBe(85);
});
