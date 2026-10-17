import { expect, test } from "vitest";
import { en } from "./en";
import { mk } from "./mk";
import { pick, translate } from "./core";

test("translate fills {placeholders} and leaves unknown ones alone", () => {
  expect(translate("mk", "age.min", { n: 3 })).toBe("3 мин");
  expect(translate("en", "age.h", { n: 2 })).toBe("2 h");
  expect(translate("en", "age.d")).toBe("{n} d");
});

test("pick returns the requested language and falls back when it is empty", () => {
  expect(pick({ mk: "Центар", en: "Centar" }, "en")).toBe("Centar");
  expect(pick({ mk: "Центар", en: "" }, "en")).toBe("Центар");
});

test("mk and en use the same placeholders for every key", () => {
  const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
  for (const key of Object.keys(mk) as (keyof typeof mk)[]) {
    expect(holes(en[key]), key).toEqual(holes(mk[key]));
  }
});
