import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { MUNICIPALITIES, matchMunicipality } from "./geo";
import { municipalities } from "./static";

type Settlement = { name_mk: string; name_en?: string; municipality_mk: string };
const settlements = JSON.parse(readFileSync(new URL("../../data/static/settlements.json", import.meta.url), "utf8")) as Settlement[];

// --- M1: "центар" is also a common noun --------------------------------------------------------------------------------

test("a municipality other than Центар wins over the common noun 'центар', in either order", () => {
  expect(matchMunicipality("Трговски центар, Аеродром")).toBe("Аеродром");
  expect(matchMunicipality("Аеродром, Трговски центар")).toBe("Аеродром");
  expect(matchMunicipality("Центар, Карпош")).toBe("Карпош");
  expect(matchMunicipality("Shopping center Centar, Kisela Voda")).toBe("Кисела Вода");
});

test("Центар is returned when it is the only hit", () => {
  expect(matchMunicipality("ул. Македонија, Центар")).toBe("Центар");
  expect(matchMunicipality("СКОПЈЕ-ЦЕНТАР")).toBe("Центар");
  expect(matchMunicipality("Centar")).toBe("Центар");
});

test("other municipalities still resolve to the first one named", () => {
  expect(matchMunicipality("Чаир и Бутел")).toBe("Чаир");
  expect(matchMunicipality("Бутел и Чаир")).toBe("Бутел");
});

// --- M2: settlement gazetteer, baked from OSM place nodes (scripts/bake-osm.ts) -----------------------------------------

test("the baked gazetteer is { name_mk, name_en?, municipality_mk } rows over the 10 municipalities, one municipality per name", async () => {
  const names = new Set((await municipalities()).features.map((m) => m.properties.name_mk));
  expect(settlements.length).toBeGreaterThan(50);
  for (const s of settlements) {
    expect(typeof s.name_mk).toBe("string");
    expect(s.name_en === undefined || typeof s.name_en === "string").toBe(true);
    expect(names.has(s.municipality_mk)).toBe(true);
    expect([...names].every((n) => n !== s.name_mk)).toBe(true); // a municipality's own name is not a settlement
  }
  const byName = new Map<string, string>();
  for (const s of settlements) {
    expect(byName.get(s.name_mk) ?? s.municipality_mk).toBe(s.municipality_mk);
    byName.set(s.name_mk, s.municipality_mk);
  }
});

test("rows that exist in the baked file resolve to their municipality (point-in-polygon at bake time)", () => {
  const rows = [
    { name_mk: "Визбегово", municipality_mk: "Бутел" },
    { name_mk: "Горно Лисиче", municipality_mk: "Аеродром" },
    { name_mk: "Кондово", municipality_mk: "Сарај" },
  ];
  for (const r of rows) {
    expect(settlements).toContainEqual(expect.objectContaining(r)); // the pick really is in the file
    expect(matchMunicipality(r.name_mk)).toBe(r.municipality_mk);
    expect(matchMunicipality(`ул. Прва во ${r.name_mk}, од 09:00`)).toBe(r.municipality_mk);
  }
});

test("every baked settlement maps back to its own municipality", () => {
  for (const s of settlements) expect(matchMunicipality(s.name_mk), s.name_mk).toBe(s.municipality_mk);
});

test("settlement names are matched in Latin input too (and with or without diacritics)", () => {
  expect(matchMunicipality("Vizbegovo")).toBe("Бутел");
  expect(matchMunicipality("GORNO LISICE, ul. Prva")).toBe("Аеродром");
  expect(matchMunicipality("Gorno Lisiče")).toBe("Аеродром");
});

test("a municipality named in the text beats a settlement; a settlement beats the common noun 'центар'", () => {
  expect(matchMunicipality("Визбегово, Карпош")).toBe("Карпош");
  expect(matchMunicipality("Трговски центар, Визбегово")).toBe("Бутел");
  expect(matchMunicipality("Центар")).toBe("Центар");
});

test("settlement names match whole words only, and unknown places stay unmatched", () => {
  expect(matchMunicipality("Визбеговски пат")).toBeNull();
  expect(matchMunicipality("Куманово")).toBeNull();
  expect(MUNICIPALITIES).toHaveLength(10);
});

test("neighbourhoods named like a month do not turn dates into places", () => {
  expect(matchMunicipality("на ден 13 ноември 2026")).toBeNull();
  expect(matchMunicipality("на 11 октомври")).toBeNull();
});
