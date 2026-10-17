import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { translate } from "@/lib/i18n/core";
import { GoOutCard } from "./GoOutCard";

const render = (pm10: number | null, tempC: number | null, precipMm: number | null) =>
  renderToStaticMarkup(<GoOutCard pm10={pm10} tempC={tempC} precipMm={precipMm} />);

test("clean air, mild and dry: meter is full, score 100, good verdict, no reasons", () => {
  const html = render(15, 20, 0);
  expect(html).toContain(`aria-label="${translate("mk", "goOut.score", { score: 100 })}"`);
  expect(html).toContain(">100<");
  expect(html).toContain(translate("mk", "goOut.verdict.good"));
  expect(html).toMatch(/aria-valuenow="100"/);
  expect(html).toContain("width:100%");
  expect(html).not.toContain(translate("mk", "goOut.reason.air"));
});

test("polluted and rainy: low score, poor verdict, names what pulls it down", () => {
  const html = render(120, 20, 1);
  expect(html).toContain(">10<");
  expect(html).toContain(translate("mk", "goOut.verdict.poor"));
  expect(html).toContain(translate("mk", "goOut.reason.air"));
  expect(html).toContain(translate("mk", "goOut.reason.rain"));
  expect(html).not.toContain(translate("mk", "goOut.reason.temp"));
});

test("a middling score is the fair verdict; extreme temperature is named", () => {
  expect(render(null, 38, 0)).toContain(translate("mk", "goOut.reason.temp"));
  expect(render(60, 20, 0)).toContain(translate("mk", "goOut.verdict.fair")); // 100 - 50 = 50
  expect(render(60, 38, 0)).toContain(translate("mk", "goOut.verdict.poor")); // 100 - 50 - 15 = 35
});

test("half the score fills half the meter", () => {
  const html = render(60, 20, 0); // score 50
  expect(html).toContain('aria-valuenow="50"');
  expect(html).toContain("width:50%");
});

test("with no readings at all it says there is no data instead of a misleading 100", () => {
  const html = render(null, null, null);
  expect(html).toContain(translate("mk", "explore.noData"));
  expect(html).not.toContain('role="meter"'); // no meter
});
