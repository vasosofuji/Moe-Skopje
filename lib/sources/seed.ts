import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Feature } from "./types";

/**
 * `data/seed/<id>.json` as a Feature[] (a FeatureCollection is accepted too), for `Adapter.seed`.
 * Never throws: a missing, unreadable or malformed file yields []. getLayer validates the shape.
 */
export async function loadSeed(id: string, dir = join(process.cwd(), "data", "seed")): Promise<Feature[]> {
  try {
    const text = (await readFile(join(dir, `${id}.json`), "utf8")).replace(/^﻿/, "");
    const json = JSON.parse(text);
    return Array.isArray(json) ? json : (json.features ?? []);
  } catch {
    return [];
  }
}
