import { expect, test } from "vitest";
import { formatDate, formatDistance, formatWhen, skopjeTime, weekdayShort } from "./format";

const now = new Date("2026-10-17T10:00:00Z");

test("dates are spelled out in Macedonian and English on Skopje time", () => {
  // 22:30 UTC is already Sunday in Skopje (UTC+2 in October).
  const late = new Date("2026-10-17T22:30:00Z");
  expect(formatDate(late, "mk", { weekday: true, now })).toBe("недела, 18 октомври");
  expect(formatDate(late, "en", { weekday: true, now })).toBe("Sunday 18 October");
  expect(formatDate(new Date("2025-03-01T12:00:00Z"), "mk", { now })).toBe("1 март 2025");
});

test("a time range names the date once when it starts and ends the same day", () => {
  expect(formatWhen("2026-10-17T07:00:00Z", "2026-10-17T12:00:00Z", "mk", now)).toBe("17 октомври, 09:00 – 14:00");
  expect(formatWhen("2026-10-17T07:00:00Z", "2026-10-18T12:00:00Z", "en", now)).toBe("17 October, 09:00 – 18 October, 14:00");
  expect(formatWhen(undefined, "nonsense", "mk", now)).toBeNull();
});

test("distances use Cyrillic units and a decimal comma in Macedonian", () => {
  expect(formatDistance(347, "mk")).toBe("350 м");
  expect(formatDistance(1234, "mk")).toBe("1,2 км");
  expect(formatDistance(1234, "en")).toBe("1.2 km");
});

test("short weekdays and the Skopje clock for the outage strip", () => {
  expect(weekdayShort("2026-10-17", "mk")).toBe("Саб");
  expect(weekdayShort("2026-10-19", "en")).toBe("Mon");
  expect(skopjeTime(new Date("2026-10-17T22:30:00Z"))).toBe("00:30");
});
