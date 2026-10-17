import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { loadSeed } from "./seed";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "moe-seed-"));
  await writeFile(join(dir, "array.json"), "﻿" + JSON.stringify([{ type: "Feature" }]));
  await writeFile(join(dir, "collection.json"), JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature" }] }));
  await writeFile(join(dir, "broken.json"), "{not json");
});
afterAll(() => rm(dir, { recursive: true, force: true }));

test("loadSeed reads an array or a FeatureCollection, tolerating a BOM", async () => {
  expect(await loadSeed("array", dir)).toHaveLength(1);
  expect(await loadSeed("collection", dir)).toHaveLength(1);
});

test("loadSeed returns [] for a missing or malformed file instead of throwing", async () => {
  expect(await loadSeed("missing", dir)).toEqual([]);
  expect(await loadSeed("broken", dir)).toEqual([]);
});
