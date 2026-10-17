// Run: npm run check:sources. Calls every registered adapter's fetch() once, directly (no cache, no snapshot, no seed),
// and prints what each source does right now. No imports from lib/server/*: server-only throws under tsx.
import { registry } from "../lib/sources/registry";

const TIMEOUT_MS = 8000; // same as getLayer

type Row = { id: string; ok: boolean; ms: number; features: number; error: string };

async function check(id: string, adapter: NonNullable<(typeof registry)[keyof typeof registry]>): Promise<Row> {
  const started = performance.now();
  const row = (features: number, error = ""): Row => ({ id, ok: !error, ms: Math.round(performance.now() - started), features, error });
  try {
    const features = await adapter.fetch(AbortSignal.timeout(TIMEOUT_MS));
    const min = adapter.minFeatures ?? 0;
    return features.length < min ? row(features.length, `got ${features.length} features, expected at least ${min}`) : row(features.length);
  } catch (err) {
    return row(0, (err instanceof Error ? err.message : String(err)).replace(/\s+/g, " ").slice(0, 120));
  }
}

async function main() {
  const rows = await Promise.all(Object.entries(registry).map(([id, adapter]) => check(id, adapter)));
  const header = ["id", "ok", "ms", "features", "error"];
  const cells = [header, ...rows.map((r) => [r.id, String(r.ok), String(r.ms), String(r.features), r.error])];
  const widths = header.map((_, i) => Math.max(...cells.map((c) => c[i].length)));
  for (const c of cells) console.log(c.map((cell, i) => cell.padEnd(widths[i])).join(" | ").trimEnd());
}

void main();
