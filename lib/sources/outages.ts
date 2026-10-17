// Outage layers (spec §5.3, §11.8): notice text → the affected streets (the baked OSM street index), one feature per street.
// When no street of a notice is known, the municipality polygon stands in, flagged detail.approx = 1. No lib/server imports (tsx).
import * as cheerio from "cheerio";
import { matchMunicipality, parseSkopjeTime, skopjeToday } from "./geo";
import { loadSeed } from "./seed";
import { municipalities, toLatin, type MunicipalityCollection } from "./static";
import { locateStreets, streetKey } from "./streets";
import type { Adapter, Feature } from "./types";

type OutageId = "outages-power" | "outages-water" | "outages-heating";
type Municipality = MunicipalityCollection["features"][number];
/** `text` is what the streets are looked up in; `streets` is the raw wording shown when none of them is known. */
type Outage = { name: string; startsAt: string; endsAt: string; streets: string[]; text: string; cause?: string };

const TYPE = { "outages-power": "power", "outages-water": "water", "outages-heating": "heating" } as const;

const TIMEOUT_MS = 8000;
const abort = (signal?: AbortSignal) => (signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS));
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; MoeSkopje/1.0)" };

/**
 * Outages of one municipality and interval merge into one group (their texts are searched together). A group becomes one
 * feature per street found in the street index (its geometry, `detail.streets` listing them all, `detail.outage` the group id),
 * or, when no street is known, the municipality polygon with `detail.approx = 1`.
 * An outage whose end is already past is dropped: a source keeps listing today's finished work until midnight.
 */
function toFeatures(id: OutageId, munis: MunicipalityCollection, outages: Outage[], now: number): Feature[] {
  const merged = new Map<string, Outage>();
  for (const o of outages) {
    if (Date.parse(o.endsAt) < now) continue;
    const key = `${o.name}|${o.startsAt}|${o.endsAt}`;
    const prev = merged.get(key);
    if (prev) {
      prev.streets.push(...o.streets.filter((s) => !prev.streets.includes(s)));
      prev.text += `, ${o.text}`;
    } else merged.set(key, { ...o, streets: [...o.streets] });
  }
  const out: Feature[] = [];
  for (const o of merged.values()) {
    const muni: Municipality | undefined = munis.features.find((m) => m.properties.name_mk === o.name);
    if (!muni) continue;
    const group = `${id}:${o.name}:${o.startsAt}:${o.endsAt}`;
    const base = { kind: "outage", severity: 2 as const, startsAt: o.startsAt, endsAt: o.endsAt };
    const detail = { municipality: o.name, type: TYPE[id], outage: group, ...(o.cause ? { cause: o.cause } : {}) };
    const found = locateStreets(o.text, o.name);
    if (found.length === 0) {
      out.push({
        type: "Feature",
        geometry: muni.geometry,
        properties: { id: group, title: { mk: muni.properties.name_mk, en: muni.properties.name_en }, ...base, detail: { ...detail, streets: o.streets.join("; "), approx: 1 } },
      });
      continue;
    }
    const streets = found.map((s) => s.properties.name_mk).join("; ");
    for (const s of found) {
      const { name_mk, name_en } = s.properties;
      out.push({
        type: "Feature",
        geometry: s.geometry,
        properties: { id: `${group}:${streetKey(name_mk)}`, title: { mk: name_mk, en: name_en ?? toLatin(name_mk) }, ...base, detail: { ...detail, streets } },
      });
    }
  }
  return out;
}

// --- Seeds ----------------------------------------------------------------------------------------------------------
// The seed files hold one fixed day's outages. Served as-is they would show last week's dates as "demo data", so they are
// shifted by whole days until the first outage starts today (Skopje time).

const LOCAL = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/;

/** `iso` moved by `days`, same wall-clock time, with the offset Skopje has on the new date. */
function shiftDays(iso: string, days: number): string {
  const m = LOCAL.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  const dd = `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
  return parseSkopjeTime(dd, `${m[4]}:${m[5]}`);
}

/** Seed outages with every startsAt/endsAt (and the times inside the id and group id) moved so the earliest start falls on today. */
export function rebaseOutages(features: Feature[], now = Date.now()): Feature[] {
  const firsts = features.map((f) => f.properties.startsAt).filter((s): s is string => LOCAL.test(s ?? ""));
  if (firsts.length === 0) return features;
  const first = firsts.reduce((a, b) => (Date.parse(b) < Date.parse(a) ? b : a));
  const [y, mo, d] = first.slice(0, 10).split("-").map(Number);
  const [ty, tmo, td] = skopjeToday(now).split("-").map(Number);
  const days = Math.round((Date.UTC(ty, tmo - 1, td) - Date.UTC(y, mo - 1, d)) / 86_400_000);
  if (days === 0) return features;
  return features.map((f) => {
    const { startsAt, endsAt, id, detail } = f.properties;
    const start = startsAt && shiftDays(startsAt, days);
    const end = endsAt && shiftDays(endsAt, days);
    // the times are part of the feature id and of the group id (detail.outage), which must stay unique per day;
    // one pass, so a moved time is never moved again
    const swap = new Map<string, string>();
    if (startsAt && start) swap.set(startsAt, start);
    if (endsAt && end) swap.set(endsAt, end);
    const pattern = new RegExp([...swap.keys()].map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") || "$^", "g");
    const moved = (text: string) => text.replace(pattern, (t) => swap.get(t) ?? t);
    return {
      ...f,
      properties: {
        ...f.properties,
        id: moved(id),
        ...(startsAt && start ? { startsAt: start } : {}),
        ...(endsAt && end ? { endsAt: end } : {}),
        ...(typeof detail?.outage === "string" ? { detail: { ...detail, outage: moved(detail.outage) } } : {}),
      },
    };
  });
}

const seedOf = async (id: OutageId) => rebaseOutages(await loadSeed(id));

// --- Power: EVN Elektrodistribucija -----------------------------------------------------------------------------------
// elektrodistribucija.mk/Grid/Planned-disconnections.aspx only links to /Grid/OutagesMap.aspx, whose inline script does
//   $.getJSON("https://portal-api.elektrodistribucija.mk/DSO/Prekini/ZemiPrekini")
// and renders rows { tipPrekin, nasMesto, adresa, pocetok, kraj, kecId }; Skopje is kecId 10, 38 and 39 (the map's
// Aerodrom, Vasil Glavinov and Gjorce Petrov regions). GisMap.aspx is only the PV-capacity ArcGIS map.
// note: on 2026-10-17 that API answered HTTP 404 for every path behind Cloudflare, so no real response could be saved;
// lib/sources/__fixtures__/evn.synthetic.json is hand-made in the row shape above (datetimes are ISO, Skopje local time).
// While it 404s the adapter throws and getLayer serves data/seed/outages-power.json. Re-check the endpoint when it is back.
const EVN_URL = "https://portal-api.elektrodistribucija.mk/DSO/Prekini/ZemiPrekini";
const SKOPJE_KEC = new Set([10, 38, 39]);

export type EvnRow = { tipPrekin?: string; nasMesto?: string; adresa?: string; pocetok: string; kraj: string; kecId?: number };

/** "2026-10-17T09:00:00" (local) or "17.10.2026 09.00" → ISO with the Skopje offset. Throws on anything else. */
function evnTime(s: string): string {
  const iso = /^(\d{4})-(\d\d)-(\d\d)[T ](\d\d):(\d\d)/.exec(s);
  if (iso) return parseSkopjeTime(`${iso[3]}.${iso[2]}.${iso[1]}`, `${iso[4]}:${iso[5]}`);
  const dmy = /^(\d\d?)\.(\d\d?)\.(\d{4})\s+(\d\d?)[:.](\d\d)/.exec(s);
  if (dmy) return parseSkopjeTime(`${dmy[1]}.${dmy[2]}.${dmy[3]}`, `${dmy[4]}:${dmy[5]}`);
  throw new Error(`unrecognised EVN time: ${s}`);
}

/** Rows about Skopje; a row without a kecId is kept, since nothing says it is elsewhere. */
const inSkopje = (r: EvnRow) => r.kecId === undefined || SKOPJE_KEC.has(r.kecId);

/** Skopje rows that name a municipality, as outages (the street lookup runs over the address). Rows outside the Skopje KECs or without a municipality in the text are dropped. */
function evnOutages(rows: EvnRow[]): Outage[] {
  const outages: Outage[] = [];
  for (const r of rows) {
    if (!inSkopje(r)) continue;
    const name = matchMunicipality(r.nasMesto ?? "") ?? matchMunicipality(r.adresa ?? "");
    if (!name) continue;
    const street = (r.adresa ?? "").trim().replace(/[\s,;]+$/, "") || (r.nasMesto ?? "").trim();
    outages.push({ name, startsAt: evnTime(r.pocetok), endsAt: evnTime(r.kraj), streets: street ? [street] : [], text: r.adresa ?? "", cause: r.tipPrekin });
  }
  return outages;
}

/** EVN rows → street-level outages (see toFeatures) for the outages that have not ended by `now`. */
export function parseEvn(rows: EvnRow[], munis: MunicipalityCollection, id: OutageId = "outages-power", now = Date.now()): Feature[] {
  return toFeatures(id, munis, evnOutages(rows), now);
}

const power: Adapter = {
  id: "outages-power",
  ttl: 900,
  minFeatures: 0,
  source: { name: "ЕВН Електродистрибуција", url: "https://elektrodistribucija.mk/Grid/OutagesMap.aspx" },
  async fetch(signal) {
    const res = await fetch(EVN_URL, { signal: abort(signal), headers: { ...HEADERS, Accept: "application/json" } });
    if (!res.ok) throw new Error(`EVN API HTTP ${res.status}`);
    const rows: unknown = await res.json();
    if (!Array.isArray(rows)) throw new Error("EVN API: expected an array of rows");
    const outages = evnOutages(rows as EvnRow[]);
    // Skopje rows that all fail to map mean the feed changed, not that the grid is fine: throw so getLayer falls back
    // instead of publishing an empty "Live" layer. (Outages that mapped but have ended are a genuinely quiet day.)
    if (outages.length === 0 && (rows as EvnRow[]).some(inSkopje)) throw new Error("EVN API: Skopje rows but none map to a municipality");
    return toFeatures("outages-power", await municipalities(), outages, Date.now());
  },
  seed: () => seedOf("outages-power"),
};

// --- Water: JP Vodovod i kanalizacija ---------------------------------------------------------------------------------
// The announcements are free text paragraphs ("Ве известуваме дека на ден 13.10.2026 поради ... од 09:55 часот до
// завршување"), newest first, mostly naming streets, not municipalities. Only announcements dated today or later that
// name a municipality can be placed; the rest are dropped. "Until completion" ends the same day at 23:59.
// Announcements dated today or later that all fail to map are a failed fetch (getLayer serves the seed, "Demo data");
// no announcement for today at all is a real, empty answer, so minFeatures stays 0.
// The municipality comes from a name in the text or from the settlement gazetteer (data/static/settlements.json); the streets from the street index.
const WATER_URL = "https://www.vodovod-skopje.com.mk/mk-MK/article/INFORMACIIIZAPREKINNAVODOSNABDUVANjEIDEFEKTI_1";

export function parseVodovod(html: string, munis: MunicipalityCollection, now = Date.now()): Feature[] {
  const $ = cheerio.load(html);
  const items: string[] = [];
  $("#pills-tabContent p").each((_, p) => {
    const text = $(p).text().replace(/\s+/g, " ").trim();
    if (/^(Ве известуваме|Ви најавуваме)/.test(text)) items.push(text);
    else if (text && items.length) items[items.length - 1] += ` ${text}`; // an announcement can be split over two paragraphs
  });
  const dated = items.flatMap((text) => {
    const d = /на ден\s+(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})/.exec(text);
    return d ? [{ text, date: `${d[1]}.${d[2]}.${d[3]}`, ymd: `${d[3]}-${d[2].padStart(2, "0")}-${d[1].padStart(2, "0")}` }] : [];
  });
  if (dated.length === 0) throw new Error("vodovod-skopje: no dated announcements found (markup changed?)");

  const today = skopjeToday(now);
  const upcoming = dated.filter((d) => d.ymd >= today);
  const outages: Outage[] = [];
  for (const { text, date } of upcoming) {
    const name = matchMunicipality(text);
    if (!name) continue;
    const from = /од\s+(\d{1,2})[:.](\d{2})\s*час/.exec(text);
    const to = /до\s+(\d{1,2})[:.](\d{2})\s*час/.exec(text);
    const who = /ќе (?:имаат|бидат)\s+(.+?)(?:\.\s*Водоснабдувањето|\s+од\s+\d{1,2}[:.]\d{2}\s*час|$)/.exec(text)?.[1];
    outages.push({
      name,
      startsAt: parseSkopjeTime(date, from ? `${from[1]}:${from[2]}` : "00:00"),
      endsAt: parseSkopjeTime(date, to ? `${to[1]}:${to[2]}` : "23:59"),
      streets: [(who ?? text).slice(0, 200)],
      text,
    });
  }
  if (upcoming.length > 0 && outages.length === 0) throw new Error("vodovod-skopje: announcements for today or later, but none names a municipality or settlement");
  return toFeatures("outages-water", munis, outages, now);
}

const water: Adapter = {
  id: "outages-water",
  ttl: 1800,
  minFeatures: 0, // parseVodovod throws when announcements exist but none maps; an empty day is honest
  source: { name: "ЈП Водовод и канализација", url: "https://www.vodovod-skopje.com.mk/" },
  async fetch(signal) {
    const res = await fetch(WATER_URL, { signal: abort(signal), headers: HEADERS });
    if (!res.ok) throw new Error(`vodovod-skopje HTTP ${res.status}`);
    return parseVodovod(await res.text(), await municipalities());
  },
  seed: () => seedOf("outages-water"),
};

// --- Heating: Balkan Energy Group -------------------------------------------------------------------------------------
// note: www.beg.com.mk did not resolve on 2026-10-17 (ENOTFOUND), so there is no outage list to parse. The adapter
// fetches the page and throws, which makes getLayer serve data/seed/outages-heating.json. Add a parser once the page exists.
const heating: Adapter = {
  id: "outages-heating",
  ttl: 1800,
  source: { name: "Балкан Енерџи Груп", url: "https://www.beg.com.mk/" },
  async fetch(signal) {
    const res = await fetch("https://www.beg.com.mk/", { signal: abort(signal), headers: HEADERS });
    if (!res.ok) throw new Error(`beg.com.mk HTTP ${res.status}`);
    throw new Error("beg.com.mk: no outage list parser yet");
  },
  seed: () => seedOf("outages-heating"),
};

export const outages: Record<OutageId, Adapter> = { "outages-power": power, "outages-water": water, "outages-heating": heating };
