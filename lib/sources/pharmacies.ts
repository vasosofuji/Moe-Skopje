// Pharmacies: baked OSM base (data/static/pharmacies.geojson) plus FZO's on-duty roster. No lib/server imports (tsx).
import * as cheerio from "cheerio";
import readExcel from "read-excel-file/universal";
import { matchMunicipality, normalizeName, skopjeToday } from "./geo";
import { loadSeed } from "./seed";
import { centroid, municipalities, municipalityAt, staticAdapter, toLatin, type MunicipalityCollection } from "./static";
import type { Adapter, Feature } from "./types";

const base = staticAdapter("pharmacies", "pharmacies.geojson", "pharmacy");

// https://fzo.org.mk/dezurni-apteki links one XLSX per month ("Распоред на дежурни аптеки за 2026 месец Октомври").
// Columns: nr | "СКОПЈЕ-ЦЕНТАР" (city-municipality) | pharmacy | date(s) | phone | how the duty is done; one section per city.
// The date cell is a range string ("01.10-31.10.2026", "01.10.2026 ДО 31.10.2026"), a single day or an Excel date.
const PAGE = "https://fzo.org.mk/dezurni-apteki";
const MONTHS = ["јануари", "февруари", "март", "април", "мај", "јуни", "јули", "август", "септември", "октомври", "ноември", "декември"];
const TIMEOUT_MS = 8000;
const abort = (signal?: AbortSignal) => (signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS));

export type Cell = string | number | boolean | Date | null;
export type Duty = { name: string; municipality: string | null; phone?: string };

/** Absolute URL of the XLSX for the month of `today` (YYYY-MM-DD, Skopje), or null when the page lists none. */
export function rosterUrl(html: string, today: string): string | null {
  const [year, month] = today.split("-").map(Number);
  const wanted = `за ${year} месец ${MONTHS[month - 1]}`;
  const $ = cheerio.load(html);
  const href = $("a")
    .filter((_, el) => $(el).text().toLowerCase().replace(/\s+/g, " ").includes(wanted))
    .first()
    .attr("href");
  return href ? new URL(href, PAGE).href : null;
}

/** First sheet of the roster XLSX as rows. */
export async function readRosterXlsx(file: ArrayBuffer): Promise<Cell[][]> {
  const sheets = await readExcel(new Blob([file]));
  return (sheets[0]?.data ?? []) as Cell[][];
}

const ymd = (y: number, m: number, d: number) => y * 10000 + m * 100 + d;

/** Duty cell → [first, last] day as yyyymmdd, or null. Excel dates arrive as UTC midnight. */
function dutyDays(cell: Cell): [number, number] | null {
  if (cell instanceof Date) {
    const day = ymd(cell.getUTCFullYear(), cell.getUTCMonth() + 1, cell.getUTCDate());
    return [day, day];
  }
  if (typeof cell !== "string") return null;
  const dates = [...cell.matchAll(/(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?/g)];
  const year = Number(dates.findLast((m) => m[3])?.[3]); // "01.10-31.10.2026": only the last date carries the year
  if (!dates.length || !year) return null;
  const day = (m: RegExpMatchArray) => ymd(Number(m[3] ?? year), Number(m[2]), Number(m[1]));
  return [day(dates[0]), day(dates[dates.length - 1])];
}

/** Skopje rows whose duty covers `today` (YYYY-MM-DD). Other cities are ignored. */
export function parseRoster(rows: Cell[][], today: string): Duty[] {
  const day = Number(today.replaceAll("-", ""));
  const duty: Duty[] = [];
  for (const r of rows) {
    if (typeof r[0] !== "number" || !String(r[1] ?? "").startsWith("СКОПЈЕ") || !r[2]) continue;
    const days = dutyDays(r[3]);
    if (!days || day < days[0] || day > days[1]) continue;
    duty.push({ name: String(r[2]).trim(), municipality: matchMunicipality(String(r[1])), ...(r[4] ? { phone: String(r[4]) } : {}) });
  }
  return duty;
}

const GENERIC = new Set(["аптека", "пзу"]);
// numbers stay: "Виола 7" and "Виола 2" are different branches (normalizeName alone drops a trailing number)
const words = (s: string) =>
  s
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((t) => (/^\d+$/.test(t) ? t : normalizeName(t)))
    .filter((w) => w && !GENERIC.has(w));
const nice = (s: string) => s.toLowerCase().replace(/(^|[\s(-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());

/**
 * Sets `detail.onDuty` (1 or 0; detail values cannot be boolean) from the roster.
 * A roster entry matches the OSM pharmacy inside its municipality whose name words are all in the roster name, the most
 * specific one first ("ЕуроФарм Тафталиџе" beats the bare brand "Еурофарм"). If that is not exactly one pharmacy (OSM often
 * has only the brand, 20+ times) nothing is flagged, so a brand never lights up every branch; the entry is added as its own
 * point at the municipality centroid with `detail.approx = 1`. An entry without a known municipality is skipped (counted).
 * ponytail: name-word matching only; add address matching if the roster ever carries addresses for Skopje.
 */
export function matchRoster(osm: Feature[], duty: Duty[], munis: MunicipalityCollection) {
  const named = osm.flatMap((f, i) => {
    if (f.geometry.type !== "Point") return [];
    const w = words(f.properties.title.mk);
    const at = municipalityAt(munis, f.geometry.coordinates[0], f.geometry.coordinates[1]);
    return w.length && at ? [{ i, w, at }] : [];
  });
  const flagged = new Set<number>();
  const extras: Feature[] = [];
  const stacked = new Map<string, number>();
  let matched = 0;
  let placed = 0;
  let skipped = 0;

  for (const d of duty) {
    const muni = munis.features.find((m) => m.properties.name_mk === d.municipality);
    if (!muni) {
      skipped++;
      continue;
    }
    const dw = new Set(words(d.name));
    const fit = named.filter((n) => n.at === d.municipality && n.w.every((w) => dw.has(w)));
    const best = Math.max(0, ...fit.map((n) => n.w.length));
    const top = fit.filter((n) => n.w.length === best);
    if (top.length === 1) {
      flagged.add(top[0].i);
      matched++;
      continue;
    }
    const k = stacked.get(muni.properties.name_mk) ?? 0; // ~100 m apart so several entries don't hide each other
    stacked.set(muni.properties.name_mk, k + 1);
    const [lng, lat] = centroid(muni.geometry);
    const title = nice(d.name);
    extras.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [Math.round((lng + k * 0.0012) * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] },
      properties: {
        id: `pharmacy:duty:${normalizeName(d.name)}`,
        kind: "pharmacy",
        title: { mk: title, en: toLatin(title) },
        detail: { onDuty: 1, approx: 1, municipality: muni.properties.name_mk, ...(d.phone ? { phone: d.phone } : {}) },
      },
    });
    placed++;
  }
  if (skipped) console.warn(`[pharmacies] ${skipped} rostered pharmacies have no known municipality and were skipped`);

  const features = osm.map((f, i): Feature => ({ ...f, properties: { ...f.properties, detail: { ...f.properties.detail, onDuty: flagged.has(i) ? 1 : 0 } } }));
  return { features: [...features, ...extras], matched, placed, skipped };
}

/**
 * Without a roster (the seed): on duty when OSM `opening_hours` contains "24/7". With a plain name list: normalised-name match.
 */
export function markOnDuty(features: Feature[], roster?: string[]): Feature[] {
  const names = roster && new Set(roster.map(normalizeName));
  return features.map((f) => {
    const on = names ? names.has(normalizeName(f.properties.title.mk)) : String(f.properties.detail?.opening_hours ?? "").includes("24/7");
    return { ...f, properties: { ...f.properties, detail: { ...f.properties.detail, onDuty: on ? 1 : 0 } } };
  });
}

async function get(url: string, what: string, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(url, { signal: abort(signal), headers: { "User-Agent": "Mozilla/5.0 (compatible; MoeSkopje/1.0)" } });
  if (!res.ok) throw new Error(`FZO roster ${what} HTTP ${res.status}`);
  return res;
}

export const pharmacies: Adapter = {
  ...base,
  ttl: 3600,
  static: false,
  source: { name: "ФЗО, OpenStreetMap", url: PAGE },
  async fetch(signal) {
    const today = skopjeToday(Date.now());
    const url = rosterUrl(await (await get(PAGE, "page", signal)).text(), today);
    if (!url) throw new Error(`FZO roster: no file for ${today.slice(0, 7)}`);
    const duty = parseRoster(await readRosterXlsx(await (await get(url, "file", signal)).arrayBuffer()), today);
    const { features, matched, placed } = matchRoster(await base.fetch(), duty, await municipalities());
    // live only when something is actually on duty; otherwise getLayer serves the 24/7 seed
    if (matched + placed === 0) throw new Error(`FZO roster: nobody on duty in Skopje on ${today}`);
    return features;
  },
  seed: () => loadSeed("pharmacies"),
};
