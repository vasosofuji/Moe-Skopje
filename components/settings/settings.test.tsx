import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { translate } from "@/lib/i18n/core";
import { LAYER_IDS } from "@/lib/layers";
import { statusSummary } from "./DataHealth";
import { SettingsPanel, LAYER_GROUPS } from "./SettingsPanel";

const t = (lang: "mk" | "en") => (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate(lang, key, vars);

test("every layer except waste sits in exactly one settings category, in category order", () => {
  const listed = LAYER_GROUPS.flatMap((g) => g.ids);
  expect(new Set(listed).size).toBe(listed.length);
  expect([...listed].sort()).toEqual(LAYER_IDS.filter((id) => id !== "waste").sort());
  expect(LAYER_GROUPS.map((g) => g.key)).toEqual([
    "settings.group.environment",
    "settings.group.utilities",
    "settings.group.transport",
    "settings.group.services",
  ]);
  expect(LAYER_GROUPS[0].ids).toEqual(["air", "weather", "earthquakes"]);
});

test("statusSummary counts feeds freshest first and skips zero and static counts", () => {
  const statuses = ["offline", "live", "static", "live", "stale", "live"] as const;
  expect(statusSummary([...statuses], t("mk"))).toBe("3 во живо · 1 со доцнење · 1 демо");
  expect(statusSummary(["live", "offline", "offline"], t("en"))).toBe("1 live · 2 demo");
  expect(statusSummary(["static"], t("en"))).toBe("");
});

test("settings renders real switches and radio groups", () => {
  const html = renderToStaticMarkup(<SettingsPanel />);
  expect(html.match(/role="switch"/g)).toHaveLength(LAYER_GROUPS.flatMap((g) => g.ids).length);
  expect(html.match(/role="radiogroup"/g)).toHaveLength(2);
  expect(html).toContain('role="radio" aria-checked="true" tabindex="0"');
  expect(html).not.toContain(translate("mk", "layer.waste"));
});
