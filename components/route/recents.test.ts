import { expect, test } from "vitest";
import { loadRecents, pushRecent } from "./recents";
import type { Place } from "./RoutePlanner";

const memory = (): Storage => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) } as Storage;
};
const place = (n: number): Place => ({ id: `p${n}`, name: `Место ${n}`, kind: "poi", lng: 21.4, lat: 42 });

test("recents keep the newest first, once each, and at most four", () => {
  const s = memory();
  for (const n of [1, 2, 3, 4, 5]) pushRecent(place(n), s);
  expect(loadRecents(s).map((p) => p.id)).toEqual(["p5", "p4", "p3", "p2"]);
  expect(pushRecent(place(3), s).map((p) => p.id)).toEqual(["p3", "p5", "p4", "p2"]);
});

test("recents shrug off junk in storage", () => {
  const s = memory();
  s.setItem("moe-skopje:recent-places", "not json");
  expect(loadRecents(s)).toEqual([]);
  s.setItem("moe-skopje:recent-places", JSON.stringify([{ id: "x", name: 1 }]));
  expect(loadRecents(s)).toEqual([]);
  expect(loadRecents()).toEqual([]); // no localStorage in this environment
});
