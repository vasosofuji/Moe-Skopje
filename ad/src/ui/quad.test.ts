import { test } from "node:test";
import assert from "node:assert/strict";
import { quadToMatrix3d, type Pt } from "./quad.ts";

const nums = (m: string) => m.slice("matrix3d(".length, -1).split(",").map(Number);
const close = (got: number[], want: number[]) =>
  want.forEach((w, i) => assert.ok(Math.abs(got[i] - w) < 1e-9, `index ${i}: ${got[i]} != ${w}`));

const W = 390, H = 844;

test("identity quad gives identity matrix", () => {
  const q: [Pt, Pt, Pt, Pt] = [[0, 0], [W, 0], [W, H], [0, H]];
  close(nums(quadToMatrix3d(W, H, q)), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
});

test("shifted quad gives translation", () => {
  const q: [Pt, Pt, Pt, Pt] = [[100, 50], [W + 100, 50], [W + 100, H + 50], [100, H + 50]];
  close(nums(quadToMatrix3d(W, H, q)), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 100, 50, 0, 1]);
});

test("doubled quad gives scale 2", () => {
  const q: [Pt, Pt, Pt, Pt] = [[0, 0], [2 * W, 0], [2 * W, 2 * H], [0, 2 * H]];
  close(nums(quadToMatrix3d(W, H, q)), [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
});

test("perspective quad maps corners exactly", () => {
  const q: [Pt, Pt, Pt, Pt] = [[812, 210], [1105, 236], [1090, 870], [790, 850]];
  const [a, d, , g, b, e, , h, , , , , c, f] = nums(quadToMatrix3d(W, H, q));
  const src: Pt[] = [[0, 0], [W, 0], [W, H], [0, H]];
  src.forEach(([x, y], i) => {
    const z = g * x + h * y + 1;
    assert.ok(Math.abs((a * x + b * y + c) / z - q[i][0]) < 1e-6);
    assert.ok(Math.abs((d * x + e * y + f) / z - q[i][1]) < 1e-6);
  });
});
