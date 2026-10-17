// City Parking zones (spec §11.7): the zone page → entries → streets of the baked OSM index → buffered, unioned polygons per zone.
// scripts/bake-parking.ts runs this once and writes data/static/parking-zones.geojson; the app only reads that file.
// No lib/server imports (tsx).
import * as cheerio from "cheerio";
import polygonClipping, { type Geom, type MultiPolygon, type Polygon } from "polygon-clipping";
import { simplifyLine } from "./geom";
import { locateStreets, type StreetCollection, type StreetFeature } from "./streets";

export type ZoneId = "A0" | "A" | "B" | "C" | "D";

/** City Parking colours (orange A0, red A, yellow B, green C, white D) and the municipality each zone lies in, to pick between same-named streets. */
export const ZONES: Record<ZoneId, { color: string; title: { mk: string; en: string }; municipality: string }> = {
  A0: { color: "#FF9500", title: { mk: "Портокалова зона (А0)", en: "Orange zone (A0)" }, municipality: "Центар" },
  A: { color: "#FF3B30", title: { mk: "Црвена зона (А)", en: "Red zone (A)" }, municipality: "Центар" },
  B: { color: "#FFCC00", title: { mk: "Жолта зона (В)", en: "Yellow zone (B)" }, municipality: "Центар" },
  C: { color: "#34C759", title: { mk: "Зелена зона (C)", en: "Green zone (C)" }, municipality: "Центар" },
  D: { color: "#FFFFFF", title: { mk: "Бела зона (D)", en: "White zone (D)" }, municipality: "Аеродром" },
};

// "ЗОНА А0- ПОРТОКАЛОВА ЗОНА": the colour word is the reliable part, the letter is Cyrillic or Latin depending on the line.
const SECTIONS: [RegExp, ZoneId][] = [[/ПОРТОКАЛ/, "A0"], [/ЦРВЕН/, "A"], [/ЖОЛТ/, "B"], [/ЗЕЛЕН/, "C"], [/БЕЛ/, "D"]];

export type ZoneEntry = {
  zone: ZoneId;
  /** "А3", "Ц46", ... as written on the page (Cyrillic letters). */
  code: string;
  name: string;
  /** The "Локација" text; "" when the entry has none. */
  location: string;
  spots?: number;
};

const clean = (s: string) => s.replace(/[ ﻿]/g, " ").replace(/\s+/g, " ").trim();

/**
 * The parking sub-zones of zonsko-parking-zoni.nspx. The page is a run of `<ul><li><strong>ЗОНА … ЗОНА</strong>` section
 * headers, each followed by `<p>N. Зона CODE- name</p>` and a `<ul>` with the "Локација …" and "Број на паркинг места N" items.
 * Entries before the first section header are ignored; a page without sections gives [].
 */
export function parseZonePage(html: string): ZoneEntry[] {
  const $ = cheerio.load(html);
  const entries: ZoneEntry[] = [];
  let zone: ZoneId | undefined;
  let cur: ZoneEntry | undefined;
  $(".article-holder")
    .children()
    .each((_, el) => {
      if (el.type !== "tag") return;
      if (el.name === "p") {
        const m = /^\d+\s*\.\s*Зона\s+([^\s–-]+)\s*[-–]?\s*(.*)$/.exec(clean($(el).text()));
        if (!m || !zone) return;
        // "Д62 Тениски клуб АБЦ, Локација Булевар Илинден": the location can sit in the heading
        const [name, ...rest] = m[2].split(/,?\s*Локација\s*[-–:]?\s*/i);
        cur = { zone, code: m[1], name: name.trim(), location: rest.join(" ").trim() };
        entries.push(cur);
      } else if (el.name === "ul") {
        $(el)
          .children("li")
          .each((_, li) => {
            const section = $(li).children("strong").first().text().toUpperCase();
            if (/^\s*ЗОНА\s/.test(section)) {
              zone = SECTIONS.find(([re]) => re.test(section))?.[1];
              cur = undefined;
              return;
            }
            const text = clean($(li).text());
            if (!cur || !text) return;
            const spots = /^Број на паркинг\s*места\s+(\d+)/i.exec(text);
            if (spots) cur.spots = Number(spots[1]);
            else cur.location = [cur.location, text.replace(/^локација\s*[-–:]?\s*/i, "")].filter(Boolean).join("; ");
          });
      }
    });
  return entries;
}

// --- Streets ----------------------------------------------------------------------------------------------------------

export type ZoneMatch = { entry: ZoneEntry; streets: StreetFeature[]; /** What was searched for streets. */ text: string };

// A name is only searched when it itself says "ул."/"бул.": "Бристол" or "Даме Груев 1" names a lot, not a street.
const STREET_WORD = /(^|[^\p{L}])(ул|бул|булевар|улица)(?![\p{L}])/iu;

/** Looks each entry's location up in the street index, preferring the zone's own municipality (see locateStreets). */
export function matchEntries(entries: ZoneEntry[], fc?: StreetCollection): ZoneMatch[] {
  return entries.map((entry) => {
    const text = STREET_WORD.test(entry.name) ? `${entry.name}; ${entry.location}` : entry.location;
    return { entry, text, streets: text ? locateStreets(text, ZONES[entry.zone].municipality, fc) : [] };
  });
}

/** Match rate: entries that name something to look up, how many of them found a street, and the texts that found none. */
export function matchStats(matches: ZoneMatch[]) {
  const searched = matches.filter((m) => m.text);
  const matched = searched.filter((m) => m.streets.length > 0);
  return {
    entries: matches.length,
    withLocation: searched.length,
    matched: matched.length,
    streets: new Set(matched.flatMap((m) => m.streets)).size,
    unmatched: searched.filter((m) => m.streets.length === 0).map((m) => m.text),
  };
}

// --- Buffering --------------------------------------------------------------------------------------------------------

const M_PER_DEG = 111_320;
const ROUND = 12; // corners of the round cap at each vertex
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

/** Union of many polygons: in chunks, so no single call has to sweep thousands of overlapping shapes. */
function unionAll(items: Geom[]): MultiPolygon {
  let level = items;
  while (level.length > 1) {
    const next: Geom[] = [];
    for (let i = 0; i < level.length; i += 40) {
      const [first, ...rest] = level.slice(i, i + 40);
      next.push(polygonClipping.union(first, ...rest));
    }
    level = next;
  }
  return level.length ? polygonClipping.union(level[0]) : [];
}

/**
 * Each line thickened by `radiusM` metres on both sides, round at corners and ends, all merged: a rectangle per segment plus a
 * round cap per vertex, in a local metre plane, unioned with polygon-clipping. Returns MultiPolygon coordinates, 5 decimals
 * (about 1 m), rings simplified to 1.5 m. Lines of fewer than two points are not streets and are skipped.
 */
export function bufferLines(lines: number[][][], radiusM = 25): MultiPolygon {
  const real = lines.filter((l) => l.length >= 2);
  if (!real.length) return [];
  // One local metre plane for everything, rounded to a centimetre: polygon-clipping's sweep line chokes on points that differ
  // by 1e-14 (it did on raw lng/lat), and a centimetre grid cannot produce them.
  const [lng0, lat0] = real[0][0];
  const kx = M_PER_DEG * Math.cos((lat0 * Math.PI) / 180);
  const cm = (n: number) => Math.round(n * 100) / 100;
  const shapes: Polygon[] = [];
  for (const line of real) {
    const m = line.map(([lng, lat]) => [(lng - lng0) * kx, (lat - lat0) * M_PER_DEG]);
    const ring = (pts: number[][]): [number, number][] => [...pts, pts[0]].map(([x, y]) => [cm(x), cm(y)]);
    for (const [x, y] of m) {
      shapes.push([ring(Array.from({ length: ROUND }, (_, i) => [x + radiusM * Math.cos((2 * Math.PI * i) / ROUND), y + radiusM * Math.sin((2 * Math.PI * i) / ROUND)]))]);
    }
    for (let i = 0; i + 1 < m.length; i++) {
      const [ax, ay] = m[i];
      const [bx, by] = m[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      if (len === 0) continue;
      const nx = (-(by - ay) / len) * radiusM;
      const ny = ((bx - ax) / len) * radiusM;
      shapes.push([ring([[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]])]);
    }
  }
  return unionAll(shapes).flatMap((poly) => {
    const rings = poly
      .map((r) => simplifyMetres(r, 1.5).map(([x, y]): [number, number] => [round5(lng0 + x / kx), round5(lat0 + y / M_PER_DEG)]))
      .filter((r) => r.length >= 4);
    return rings.length ? [rings] : [];
  });
}

/** Douglas-Peucker on a ring given in local metres (simplifyLine measures in degrees of longitude and latitude). */
const simplifyMetres = (ring: [number, number][], toleranceM: number) =>
  simplifyLine(ring.map(([x, y]) => [x / M_PER_DEG, y / M_PER_DEG]), toleranceM).map(([x, y]): [number, number] => [x * M_PER_DEG, y * M_PER_DEG]);

export type ZoneFeature = GeoJSON.Feature<GeoJSON.MultiPolygon, { zone: ZoneId; color: string; title: { mk: string; en: string }; price?: number }>;

/** One MultiPolygon feature per zone that matched at least one street, in A0, A, B, C, D order. `prices` is MKD per hour. */
export function buildZones(matches: ZoneMatch[], prices: Partial<Record<ZoneId, number>>, radiusM = 25): ZoneFeature[] {
  return (Object.keys(ZONES) as ZoneId[]).flatMap((zone) => {
    const streets = new Set(matches.filter((m) => m.entry.zone === zone).flatMap((m) => m.streets));
    const coordinates = bufferLines([...streets].flatMap((s) => s.geometry.coordinates), radiusM);
    if (!coordinates.length) return [];
    const { color, title } = ZONES[zone];
    const price = prices[zone];
    return [{ type: "Feature" as const, geometry: { type: "MultiPolygon" as const, coordinates }, properties: { zone, color, title, ...(price === undefined ? {} : { price }) } }];
  });
}
