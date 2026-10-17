import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { translate } from "@/lib/i18n/core";
import { BusDepartures, tidyName } from "./BusDepartures";

test("tidyName turns all-caps GTFS names into names, keeping small words lower case", () => {
  expect(tidyName("ДОМ НА ПЕЧАТ")).toBe("Дом на Печат");
  expect(tidyName("ЦЕНТАР РЕКОРД-КОН ЗАПАД")).toBe("Центар Рекорд-кон Запад");
  expect(tidyName("КАРПОШ 4")).toBe("Карпош 4");
  expect(tidyName("NA ZAPAD")).toBe("Na Zapad"); // a small word that starts the name is capitalised
  expect(tidyName("Ѓорче Петров")).toBe("Ѓорче Петров"); // mixed case is left alone
});

test("BusDepartures waits for the timetable, and shows nothing for a stop without a GTFS id", () => {
  const html = renderToStaticMarkup(<BusDepartures stopId="1513" />);
  expect(html).toContain(translate("mk", "buses.next"));
  expect(html).toContain('aria-busy="true"');
  expect(renderToStaticMarkup(<BusDepartures />)).toBe("");
});
