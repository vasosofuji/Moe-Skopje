import { z } from "zod";
import { fetchJson } from "./fetch-json";
import { loadSeed } from "./seed";
import type { Adapter, Feature } from "./types";

// maxradius is in degrees (≈220 km): the whole region that can shake Skopje.
const URL_ = "https://www.seismicportal.eu/fdsnws/event/1/query?format=json&lat=41.9981&lon=21.4254&maxradius=2&limit=20&orderby=time";

const Envelope = z.object({ features: z.array(z.unknown()) });
const Event = z.object({
  geometry: z.object({ coordinates: z.array(z.number()).min(2) }),
  properties: z.object({
    unid: z.string(),
    time: z.string().refine((t) => !Number.isNaN(Date.parse(t))),
    mag: z.number(),
    depth: z.number().optional(),
    flynn_region: z.string().optional(),
    magtype: z.string().optional(),
  }),
});

/** Spec: mag <3 → 0, <4 → 1, <5 → 2, otherwise 3. */
export const quakeSeverity = (mag: number): 0 | 1 | 2 | 3 => (mag < 3 ? 0 : mag < 4 ? 1 : mag < 5 ? 2 : 3);

// Flynn-Engdahl region names arrive in English capitals. Most specific first; anything else is title-cased English.
const REGIONS: readonly (readonly [match: string, mk: string, en: string])[] = [
  ["NORTH MACEDONIA", "Северна Македонија", "North Macedonia"],
  ["ALBANIA", "Албанија", "Albania"],
  ["KOSOVO", "Косово", "Kosovo"],
  ["SERBIA", "Србија", "Serbia"],
  ["BULGARIA", "Бугарија", "Bulgaria"],
  ["GREECE", "Грција", "Greece"],
  ["MONTENEGRO", "Црна Гора", "Montenegro"],
];
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());

function region(raw = ""): { mk: string; en: string } {
  const hit = REGIONS.find(([m]) => raw.toUpperCase().includes(m));
  const fallback = titleCase(raw);
  return { mk: hit?.[1] ?? fallback, en: hit?.[2] ?? fallback };
}

/** Pure: EMSC FDSN GeoJSON → earthquake points. A malformed event is skipped; a wrong envelope throws. */
export function parseQuakes(json: unknown): Feature[] {
  const out: Feature[] = [];
  for (const raw of Envelope.parse(json).features) {
    const parsed = Event.safeParse(raw);
    if (!parsed.success) continue;
    const { geometry, properties: p } = parsed.data;
    const where = region(p.flynn_region);
    const mag = p.mag.toFixed(1);
    out.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [geometry.coordinates[0], geometry.coordinates[1]] }, // drops the depth altitude
      properties: {
        id: `quake-${p.unid}`,
        kind: "earthquake",
        title: { mk: `М ${mag} · ${where.mk}`, en: `M ${mag} · ${where.en}` },
        severity: quakeSeverity(p.mag),
        value: p.mag,
        unit: "M",
        startsAt: p.time,
        detail: { ...(p.depth !== undefined && { depthKm: p.depth }), ...(p.magtype && { magType: p.magtype }) },
      },
    });
  }
  return out;
}

export const earthquakes: Adapter = {
  id: "earthquakes",
  ttl: 600,
  minFeatures: 0, // no quakes is a normal answer
  source: { name: "EMSC", url: "https://www.seismicportal.eu" },
  async fetch(signal) {
    return parseQuakes(await fetchJson(URL_, signal));
  },
  seed: () => loadSeed("earthquakes"),
};
