import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { translate } from "@/lib/i18n/core";
import { BusDepartures } from "./BusDepartures";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-07-15T04:00:00+02:00"));
});
afterEach(() => vi.useRealTimers());

const render = (lines: string[]) => renderToStaticMarkup(<BusDepartures stopId="bus-stop:x" lines={lines} />);

test("BusDepartures shows the next three departures with the approximate-timetable note", () => {
  const html = render(["5", "2"]);
  expect(html).toContain(translate("mk", "buses.next"));
  expect(html.match(/<li/g)).toHaveLength(3);
  expect([...html.matchAll(/tabular-nums">(\d\d:\d\d)</g)].map((m) => m[1])).toEqual(["05:00", "05:00", "05:08"]);
  expect(html).toContain(translate("mk", "buses.line", { line: "5" }));
  expect(html).toContain(translate("mk", "buses.approximate"));
});

test("BusDepartures says so when service is over, and when no line has a timetable", () => {
  vi.setSystemTime(new Date("2026-07-15T23:30:00+02:00"));
  expect(render(["2"])).toContain(translate("mk", "buses.none"));
  const html = render(["999"]);
  expect(html).toContain(translate("mk", "buses.noTimetable"));
  expect(html).not.toContain("<li");
});
