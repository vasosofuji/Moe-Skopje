import { expect, test } from "vitest";
import { age } from "./StatusBadge";

const NOW = Date.parse("2026-10-17T12:00:00Z");
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

test("age switches unit at 60 min and at 1440 min", () => {
  expect(age(minutesAgo(59), NOW)).toEqual({ n: 59, unit: "min" });
  expect(age(minutesAgo(60), NOW)).toEqual({ n: 1, unit: "h" });
  expect(age(minutesAgo(1439), NOW)).toEqual({ n: 23, unit: "h" });
  expect(age(minutesAgo(1440), NOW)).toEqual({ n: 1, unit: "d" });
});

test("age never reports less than 1 min", () => {
  expect(age(minutesAgo(0), NOW)).toEqual({ n: 1, unit: "min" });
});

test("age is null when the timestamp does not parse", () => {
  expect(age("NaN", NOW)).toBeNull();
  expect(age("", NOW)).toBeNull();
});
