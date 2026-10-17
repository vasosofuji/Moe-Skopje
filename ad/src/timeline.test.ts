import { test } from "node:test";
import assert from "node:assert/strict";
import { SHOTS, CAPTIONS, TOTAL } from "./timeline.ts";

test("shots tile 0..TOTAL with no gaps or overlaps", () => {
  assert.equal(SHOTS[0].from, 0);
  assert.equal(SHOTS.at(-1)!.to, TOTAL);
  for (let i = 1; i < SHOTS.length; i++) assert.equal(SHOTS[i].from, SHOTS[i - 1].to, SHOTS[i].id);
});

test("every clip covers its slot", () => {
  for (const s of SHOTS)
    if (s.src.kind === "clip") assert.ok(s.src.trimIn + (s.to - s.from) <= s.src.clipFrames, s.id);
});

test("captions are ordered, non-overlapping, inside TOTAL", () => {
  for (let i = 0; i < CAPTIONS.length; i++) {
    const c = CAPTIONS[i];
    assert.ok(c.in < c.out && c.out <= TOTAL, c.text);
    if (i) assert.ok(c.in >= CAPTIONS[i - 1].out, c.text);
  }
});

test("copy matches spec", () => {
  assert.equal(CAPTIONS.length, 11);
  assert.equal(CAPTIONS[0].text, "You check the weather every morning.");
  assert.equal(CAPTIONS[10].text, "We'll show you what might affect it.");
});
