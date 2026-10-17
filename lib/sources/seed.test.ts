import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { loadSeed, setSeedReader } from "./seed";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "moe-seed-"));
  await writeFile(join(dir, "array.json"), "﻿" + JSON.stringify([{ type: "Feature" }]));
  await writeFile(join(dir, "collection.json"), JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature" }] }));
  await writeFile(join(dir, "broken.json"), "{not json");
  // The production read site is a fixed path (see the I4 guard in build-paths.test.ts); tests swap the whole reader instead.
  setSeedReader((id) => readFile(join(dir, `${id}.json`), "utf8"));
});
afterAll(async () => {
  setSeedReader();
  await rm(dir, { recursive: true, force: true });
});

test("loadSeed reads an array or a FeatureCollection, tolerating a BOM", async () => {
  expect(await loadSeed("array")).toHaveLength(1);
  expect(await loadSeed("collection")).toHaveLength(1);
});

test("loadSeed returns [] for a missing or malformed file instead of throwing", async () => {
  expect(await loadSeed("missing")).toEqual([]);
  expect(await loadSeed("broken")).toEqual([]);
});

test("without a reader override loadSeed reads data/seed/<id>.json", async () => {
  setSeedReader();
  expect((await loadSeed("outages-power")).length).toBeGreaterThanOrEqual(2);
  expect(await loadSeed("no-such-seed")).toEqual([]);
});
