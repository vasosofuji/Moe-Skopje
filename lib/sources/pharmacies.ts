// Pharmacies: baked OSM base (data/static/pharmacies.geojson) plus an on-duty flag. No lib/server imports (tsx).
import { normalizeName } from "./geo";
import { loadSeed } from "./seed";
import { staticAdapter } from "./static";
import type { Adapter, Feature } from "./types";

const base = staticAdapter("pharmacies", "pharmacies.geojson", "pharmacy");

/**
 * Names of today's on-duty pharmacies from FZO.
 * ponytail: https://fzo.org.mk/dezurni-apteki links the roster only as one XLSX per month (October 2026:
 * /sites/default/files/fzo/apteki/dezurni/261007-raspored-dezurni-apteki-10.2026.xlsx, 66 KB), no HTML list or API.
 * Reading it needs a download plus a zip/XML reader, which was not done: it was not cleared with the user. Until then this
 * throws, getLayer serves data/seed/pharmacies.json (the 24/7 rule below) as "offline" and the badge says demo data.
 */
async function fetchDutyNames(): Promise<string[]> {
  throw new Error("FZO on-duty roster is a monthly XLSX, not parsed yet");
}

/**
 * Sets `detail.onDuty` to 1 or 0 (detail values are string | number, so no boolean). With a roster, a pharmacy is on duty when
 * its normalised name is in it; without one, when OSM `opening_hours` contains "24/7".
 * ponytail: exact normalised-name match; real rosters may need address matching too.
 */
export function markOnDuty(features: Feature[], roster?: string[]): Feature[] {
  const names = roster && new Set(roster.map(normalizeName));
  return features.map((f) => {
    const on = names ? names.has(normalizeName(f.properties.title.mk)) : String(f.properties.detail?.opening_hours ?? "").includes("24/7");
    return { ...f, properties: { ...f.properties, detail: { ...f.properties.detail, onDuty: on ? 1 : 0 } } };
  });
}

export const pharmacies: Adapter = {
  ...base,
  ttl: 3600,
  static: false,
  source: { name: "ФЗО, OpenStreetMap", url: "https://fzo.org.mk/dezurni-apteki" },
  async fetch() {
    const [roster, features] = await Promise.all([fetchDutyNames(), base.fetch()]);
    return markOnDuty(features, roster);
  },
  seed: () => loadSeed("pharmacies"),
};
