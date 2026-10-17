import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { LayerBadge, worstOf } from "@/components/glass/StatusBadge";
import { translate } from "@/lib/i18n/core";
import { activeNow } from "./activeNow";
import { GoOutCard } from "./GoOutCard";

const NOW = Date.parse("2026-10-17T10:00:00Z");
const at = (h: number) => new Date(Date.parse("2026-10-17T00:00:00Z") + h * 3600_000).toISOString();

test("activeNow counts startsAt <= now < endsAt only: not upcoming, not over, the end instant is out", () => {
  const items = [
    { id: "now", startsAt: at(9), endsAt: at(12) },
    { id: "starts-now", startsAt: at(10), endsAt: at(11) },
    { id: "ends-now", startsAt: at(8), endsAt: at(10) },
    { id: "later", startsAt: at(14), endsAt: at(16) },
    { id: "over", startsAt: at(6), endsAt: at(9) },
  ];
  expect(activeNow(items, NOW).map((i) => i.id)).toEqual(["now", "starts-now"]);
});

test("LayerBadge says nothing for live or missing data, and names stale and demo data", () => {
  expect(renderToStaticMarkup(<LayerBadge />)).toBe("");
  expect(renderToStaticMarkup(<LayerBadge data={{ status: "live", updatedAt: at(1) }} />)).toBe("");
  const stale = renderToStaticMarkup(<LayerBadge data={{ status: "stale", updatedAt: new Date(Date.now() - 2 * 3600_000).toISOString() }} />);
  expect(stale).toContain(translate("mk", "status.stale"));
  expect(stale).toContain(translate("mk", "age.h", { n: 2 }));
  expect(renderToStaticMarkup(<LayerBadge data={{ status: "offline" }} />)).toContain(translate("mk", "status.offline"));
});

test("worstOf picks the least trustworthy response", () => {
  const live = { status: "live" as const, id: "a" };
  const stale = { status: "stale" as const, id: "b" };
  const offline = { status: "offline" as const, id: "c" };
  expect(worstOf([live, undefined, stale])).toBe(stale);
  expect(worstOf([stale, offline, live])).toBe(offline);
  expect(worstOf([undefined])).toBeUndefined();
});

test("the go-out tile is badged when its source is not live", () => {
  const html = (source?: { status: "live" | "offline"; updatedAt: string }) =>
    renderToStaticMarkup(<GoOutCard pm10={20} tempC={20} precipMm={0} source={source} />);
  expect(html({ status: "live", updatedAt: at(9) })).not.toContain(translate("mk", "status.live"));
  expect(html({ status: "offline", updatedAt: at(9) })).toContain(translate("mk", "status.offline"));
});
