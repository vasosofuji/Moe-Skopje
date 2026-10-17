import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import tasks from "@/data/seed/eservices.json";
import { translate } from "@/lib/i18n/core";
import { EServices } from "./EServices";

const html = renderToStaticMarkup(<EServices />);
const anchors = [...html.matchAll(/<a [^>]*>/g)].map((m) => m[0]);

test("eight tasks, each a bilingual title and one of the two official portals", () => {
  expect(tasks).toHaveLength(8);
  expect(new Set(tasks.map((x) => x.id)).size).toBe(8);
  for (const x of tasks) {
    expect(x.title.mk).not.toBe("");
    expect(x.title.en).not.toBe("");
    expect(["https://uslugi.gov.mk/", "https://mojtermin.mk/"]).toContain(x.url);
  }
  expect(tasks.find((x) => x.id === "doctor")!.url).toBe("https://mojtermin.mk/");
});

test("renders one external link per task, opening in a new tab without leaking the opener", () => {
  expect(anchors).toHaveLength(8);
  for (const a of anchors) {
    expect(a).toContain('target="_blank"');
    expect(a).toContain('rel="noopener noreferrer"');
    expect(a).toMatch(/href="https:\/\/(uslugi\.gov\.mk|mojtermin\.mk)\/"/);
  }
});

test("shows the Macedonian titles and the section copy by default, and tells screen readers about the new tab", () => {
  for (const x of tasks) expect(html).toContain(x.title.mk);
  expect(html).toContain(translate("mk", "eservices.title"));
  expect(html).toContain(translate("mk", "eservices.hint"));
  expect(html.split(translate("mk", "eservices.opensNew")).length - 1).toBe(8);
});
