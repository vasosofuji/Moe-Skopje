import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import nextConfig from "../../next.config";

// Next's file tracer follows `readFile(join(<variable>, ...))` by tracing the whole project ("Dynamic filesystem access").
// So every server-side read of data/ must be spelled join(process.cwd(), "data", "static" | "seed", ...) at the read site.
const READERS = ["static.ts", "seed.ts", "parking.ts"];

test.each(READERS)("%s only builds data paths as join(process.cwd(), 'data', 'static' | 'seed', ...)", (file) => {
  const src = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
  const joins = [...src.matchAll(/(?<!\.)\bjoin\(/g)]; // path.join, not Array#join
  expect(joins.length).toBeGreaterThan(0);
  expect(src.match(/(?<!\.)\bjoin\((?!process\.cwd\(\), "data", "(static|seed)", )/g)).toBeNull();
  expect(src).not.toMatch(/\bdataDir\b|opts\.dir|\bdir\?:/);
});

test("next.config traces data/ into every API route", () => {
  expect(nextConfig.outputFileTracingIncludes?.["/api/**"]).toContain("./data/**");
});
