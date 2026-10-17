import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Feature } from "./types";

// The read site spells the path out (process.cwd(), "data", "seed", ...): Next traces the whole project for a directory held
// in a variable. Tests redirect reads by swapping the whole reader (setSeedReader), never by passing a directory in.
type Reader = (id: string) => Promise<string>;
const readBaked: Reader = (id) => readFile(join(process.cwd(), "data", "seed", `${id}.json`), "utf8");
let read: Reader = readBaked;
/** Test hook: serve the data/seed files from somewhere else. Call without an argument to restore data/seed. */
export const setSeedReader = (reader: Reader = readBaked) => void (read = reader);

/**
 * `data/seed/<id>.json` as a Feature[] (a FeatureCollection is accepted too), for `Adapter.seed`.
 * Never throws: a missing, unreadable or malformed file yields []. getLayer validates the shape.
 */
export async function loadSeed(id: string): Promise<Feature[]> {
  try {
    const text = (await read(id)).replace(/^﻿/, "");
    const json = JSON.parse(text);
    return Array.isArray(json) ? json : (json.features ?? []);
  } catch {
    return [];
  }
}
