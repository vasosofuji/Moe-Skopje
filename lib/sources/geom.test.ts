import { expect, test } from "vitest";
import { bboxOf, simplifyLine } from "./geom";

// 0.00001° of latitude is about 1.11 m, so 0.00009° is about 10 m.
const lat = (m: number) => m / 111_320;

test("simplifyLine keeps the endpoints and drops points within the tolerance of the chord", () => {
  const line = [[21.4, 42.0], [21.4001, 42.0 + lat(1)], [21.4002, 42.0 - lat(2)], [21.4003, 42.0]];
  expect(simplifyLine(line, 5)).toEqual([[21.4, 42.0], [21.4003, 42.0]]);
});

test("simplifyLine keeps a vertex that sticks out further than the tolerance", () => {
  const line = [[21.4, 42.0], [21.4001, 42.0 + lat(12)], [21.4002, 42.0]];
  expect(simplifyLine(line, 5)).toEqual(line);
  expect(simplifyLine(line, 20)).toEqual([[21.4, 42.0], [21.4002, 42.0]]);
});

test("simplifyLine keeps every corner of an L-shaped street and leaves short lines alone", () => {
  const ell = [[21.4, 42.0], [21.4005, 42.0], [21.4005, 42.0 + lat(100)]];
  expect(simplifyLine(ell, 5)).toEqual(ell);
  expect(simplifyLine([[21.4, 42.0], [21.5, 42.1]], 5)).toEqual([[21.4, 42.0], [21.5, 42.1]]);
  expect(simplifyLine([[21.4, 42.0]], 5)).toEqual([[21.4, 42.0]]);
});

test("simplifyLine measures the tolerance in metres: a degree of longitude is shorter than one of latitude at 42°N", () => {
  // 0.00005° of longitude at 42°N is about 4.1 m (a naive degree-based distance would say 5.6 m)
  const northSouth = [[21.4, 42.0], [21.4 + 0.00005, 42.0005], [21.4, 42.001]];
  expect(simplifyLine(northSouth, 5)).toHaveLength(2);
  expect(simplifyLine(northSouth, 3)).toHaveLength(3);
});

test("simplifyLine handles a very long line (no recursion, no stack overflow)", () => {
  const n = 50_000;
  const jittery = Array.from({ length: n }, (_, i) => [21.4 + i * 1e-6, 42.0 + (i % 2) * lat(0.1)]);
  expect(simplifyLine(jittery, 5)).toEqual([jittery[0], jittery[n - 1]]);
});

test("bboxOf returns [w, s, e, n] over every position of any geometry", () => {
  expect(bboxOf({ type: "LineString", coordinates: [[21.4, 42.0], [21.5, 41.9]] })).toEqual([21.4, 41.9, 21.5, 42.0]);
  expect(
    bboxOf({ type: "MultiLineString", coordinates: [[[21.4, 42.0]], [[21.6, 41.95], [21.45, 42.05]]] }),
  ).toEqual([21.4, 41.95, 21.6, 42.05]);
  expect(bboxOf({ type: "Polygon", coordinates: [[[1, 2], [3, 2], [3, 4], [1, 2]]] })).toEqual([1, 2, 3, 4]);
  expect(bboxOf({ type: "Point", coordinates: [21.4, 42] })).toEqual([21.4, 42, 21.4, 42]);
});
