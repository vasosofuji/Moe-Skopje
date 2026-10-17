// One-off: City Parking's zone list → data/static/parking-zones.geojson (spec §11.7). Run: npm run bake:parking
// Needs data/static/streets.geojson (npm run bake:osm streets) and the zone prices in data/seed/parking-zones.json.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildZones, matchEntries, matchStats, parseZonePage, type ZoneId } from "../lib/sources/parking-zones";

const PAGE = "https://www.gradskiparking.com.mk/zonsko-parking-zoni.nspx";
const OUT = join(process.cwd(), "data", "static", "parking-zones.geojson");
const MIN_ENTRIES = 20; // the page lists 36 sub-zones; far fewer means the markup changed

async function main() {
  const res = await fetch(PAGE, { headers: { "User-Agent": "moe-skopje-bake/1.0" }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`${PAGE}: HTTP ${res.status}`);
  const entries = parseZonePage(await res.text());
  if (entries.length < MIN_ENTRIES) throw new Error(`${PAGE}: parsed ${entries.length} zone entries, expected at least ${MIN_ENTRIES} (markup changed?)`);

  const seed = JSON.parse(await readFile(join(process.cwd(), "data", "seed", "parking-zones.json"), "utf8")) as { zones: { zone: ZoneId; pricePerHour: number }[] };
  const prices = Object.fromEntries(seed.zones.map((z) => [z.zone, z.pricePerHour])) as Partial<Record<ZoneId, number>>;

  const matches = matchEntries(entries);
  const stats = matchStats(matches);
  const zones = buildZones(matches, prices);
  if (zones.length === 0) throw new Error("no zone matched a single street");

  console.log(`entries ${stats.entries}, with a location ${stats.withLocation}, matched ${stats.matched} (${Math.round((100 * stats.matched) / stats.withLocation)}%), ${stats.streets} distinct OSM streets`);
  console.log("unmatched:", stats.unmatched);
  const body = `{"type":"FeatureCollection","features":[\n${zones.map((z) => JSON.stringify(z)).join(",\n")}\n]}\n`;
  await writeFile(OUT, body);
  for (const z of zones) console.log(`  ${z.properties.zone}: ${z.geometry.coordinates.length} polygons, price ${z.properties.price ?? "none"}`);
  console.log(`${zones.length} zones → data/static/parking-zones.geojson (${(body.length / 1024).toFixed(0)} KB)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
