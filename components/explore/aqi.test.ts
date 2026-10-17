import { expect, test } from "vitest";
import { aqi } from "./ExplorePanel";

test("PM10 bands follow spec §6.4 and the upper bound of each band is inclusive", () => {
  expect([20, 21, 40, 41, 50, 51, 100, 101, 150, 151].map((v) => aqi(v).color)).toEqual([
    "var(--system-green)",
    "color-mix(in srgb, var(--system-green), var(--system-yellow))",
    "color-mix(in srgb, var(--system-green), var(--system-yellow))",
    "var(--system-yellow)",
    "var(--system-yellow)",
    "var(--system-orange)",
    "var(--system-orange)",
    "var(--system-red)",
    "var(--system-red)",
    "var(--system-purple)",
  ]);
  expect([5, 45, 80, 200].map((v) => aqi(v).level)).toEqual([0, 1, 2, 3]);
});
