import { expect, test } from "vitest";
import { FeatureSchema } from "./types";
import { seedFeatures, waste } from "./waste";

const SATURDAY = Date.parse("2026-10-17T10:00:00Z"); // 12:00 in Skopje
const names = (fs: Awaited<ReturnType<typeof seedFeatures>>) => fs.map((f) => f.properties.title.mk).sort();

test("the seed lists the municipalities that collect on today's weekday (Saturday)", async () => {
  const fs = await seedFeatures(SATURDAY);
  expect(names(fs)).toEqual(["Аеродром", "Гази Баба", "Центар", "Чаир", "Шуто Оризари", "Ѓорче Петров"].sort());
  for (const f of fs) {
    expect(FeatureSchema.safeParse(f).success).toBe(true);
    expect(f.geometry.type).toMatch(/Polygon/);
    expect(f.properties).toMatchObject({ kind: "waste", startsAt: "2026-10-17T06:00:00+02:00", endsAt: "2026-10-17T14:00:00+02:00" });
    expect(f.properties.severity).toBeUndefined(); // layer colour, not an alarm colour
  }
});

test("detail says what is collected today, in both languages", async () => {
  const fs = await seedFeatures(SATURDAY);
  const detail = (mk: string) => fs.find((f) => f.properties.title.mk === mk)!.properties.detail!;
  expect(detail("Чаир").today).toBe("Мешан комунален отпад / Mixed household waste");
  expect(detail("Шуто Оризари").today).toBe("Селектиран отпад (хартија, пластика, стакло) / Recyclables (paper, plastic, glass)");
  expect(detail("Чаир").mixed).toBe("пон, вто, сре, чет, пет, саб / Mon, Tue, Wed, Thu, Fri, Sat");
});

test("Sunday: only the centre, and the day is Skopje's, not UTC's", async () => {
  const sunday = await seedFeatures(Date.parse("2026-10-18T10:00:00Z"));
  expect(names(sunday)).toEqual(["Центар"]);
  const justAfterMidnight = await seedFeatures(Date.parse("2026-10-17T22:30:00Z")); // Sunday 00:30 in Skopje, still Saturday in UTC
  expect(justAfterMidnight[0].properties.startsAt).toBe("2026-10-18T06:00:00+02:00");
  expect(names(justAfterMidnight)).toEqual(["Центар"]);
});

test("every day of the week has at least one collection, with the winter offset after the clocks go back", async () => {
  for (let day = 0; day < 7; day++) {
    const fs = await seedFeatures(Date.parse("2026-12-14T10:00:00Z") + day * 86_400_000); // a Monday
    expect(fs.length).toBeGreaterThan(0);
    expect(fs[0].properties.startsAt).toMatch(/T06:00:00\+01:00$/);
  }
});

test("there is no live source: fetch throws so getLayer serves the seed as Demo data", async () => {
  await expect(waste.fetch()).rejects.toThrow(/no machine-readable/);
  expect(waste.id).toBe("waste");
  expect((await waste.seed()).length).toBeGreaterThan(0);
});
