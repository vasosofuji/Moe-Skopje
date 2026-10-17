// Outage layers (spec §5.3): text → municipality polygon, municipality-level precision.
// ponytail: no per-street geocoding; add Nominatim post-hackathon. No lib/server imports (tsx).
import * as cheerio from "cheerio";
import { matchMunicipality, parseSkopjeTime, skopjeToday } from "./geo";
import { loadSeed } from "./seed";
import { municipalities, type MunicipalityCollection } from "./static";
import type { Adapter, Feature } from "./types";

type OutageId = "outages-power" | "outages-water" | "outages-heating";
type Municipality = MunicipalityCollection["features"][number];
type Outage = { name: string; startsAt: string; endsAt: string; streets: string[]; type?: string };

const TIMEOUT_MS = 8000;
const abort = (signal?: AbortSignal) => (signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS));
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; MoeSkopje/1.0)" };

/** One municipality polygon per distinct (municipality, start, end); streets of equal intervals are merged. */
function toFeatures(id: OutageId, munis: MunicipalityCollection, outages: Outage[]): Feature[] {
  const merged = new Map<string, Outage>();
  for (const o of outages) {
    const key = `${o.name}|${o.startsAt}|${o.endsAt}`;
    const prev = merged.get(key);
    if (prev) prev.streets.push(...o.streets.filter((s) => !prev.streets.includes(s)));
    else merged.set(key, { ...o, streets: [...o.streets] });
  }
  const out: Feature[] = [];
  for (const o of merged.values()) {
    const muni: Municipality | undefined = munis.features.find((m) => m.properties.name_mk === o.name);
    if (!muni) continue;
    out.push({
      type: "Feature",
      geometry: muni.geometry,
      properties: {
        id: `${id}:${o.name}:${o.startsAt}`,
        kind: "outage",
        title: { mk: muni.properties.name_mk, en: muni.properties.name_en },
        severity: 2,
        startsAt: o.startsAt,
        endsAt: o.endsAt,
        detail: { streets: o.streets.join("; "), ...(o.type ? { type: o.type } : {}) },
      },
    });
  }
  return out;
}

// --- Power: EVN Elektrodistribucija -----------------------------------------------------------------------------------
// elektrodistribucija.mk/Grid/Planned-disconnections.aspx only links to /Grid/OutagesMap.aspx, whose inline script does
//   $.getJSON("https://portal-api.elektrodistribucija.mk/DSO/Prekini/ZemiPrekini")
// and renders rows { tipPrekin, nasMesto, adresa, pocetok, kraj, kecId }; Skopje is kecId 10, 38 and 39 (the map's
// Aerodrom, Vasil Glavinov and Gjorce Petrov regions). GisMap.aspx is only the PV-capacity ArcGIS map.
// ponytail: on 2026-10-17 that API answered HTTP 404 for every path behind Cloudflare, so no real response could be saved;
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

/** EVN rows → municipality polygons. Rows outside the Skopje KECs or without a municipality in the text are dropped. */
export function parseEvn(rows: EvnRow[], munis: MunicipalityCollection, id: OutageId = "outages-power"): Feature[] {
  const outages: Outage[] = [];
  for (const r of rows) {
    if (r.kecId !== undefined && !SKOPJE_KEC.has(r.kecId)) continue;
    const name = matchMunicipality(r.nasMesto ?? "") ?? matchMunicipality(r.adresa ?? "");
    if (!name) continue;
    const street = (r.adresa ?? "").trim().replace(/[\s,;]+$/, "") || (r.nasMesto ?? "").trim();
    outages.push({ name, startsAt: evnTime(r.pocetok), endsAt: evnTime(r.kraj), streets: street ? [street] : [], type: r.tipPrekin });
  }
  return toFeatures(id, munis, outages);
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
    return parseEvn(rows as EvnRow[], await municipalities());
  },
  seed: () => loadSeed("outages-power"),
};

// --- Water: JP Vodovod i kanalizacija ---------------------------------------------------------------------------------
// The announcements are free text paragraphs ("Ве известуваме дека на ден 13.10.2026 поради ... од 09:55 часот до
// завршување"), newest first, mostly naming streets, not municipalities. Only announcements dated today or later that
// name a municipality can be placed; the rest are dropped. "Until completion" ends the same day at 23:59.
// With minFeatures 1, a page where nothing maps counts as failed and getLayer serves the seed ("Demo data").
// ponytail: a street/settlement → municipality gazetteer would place far more of them.
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
  const outages: Outage[] = [];
  for (const { text, date, ymd } of dated) {
    const name = ymd >= today ? matchMunicipality(text) : null;
    if (!name) continue;
    const from = /од\s+(\d{1,2})[:.](\d{2})\s*час/.exec(text);
    const to = /до\s+(\d{1,2})[:.](\d{2})\s*час/.exec(text);
    const who = /ќе (?:имаат|бидат)\s+(.+?)(?:\.\s*Водоснабдувањето|\s+од\s+\d{1,2}[:.]\d{2}\s*час|$)/.exec(text)?.[1];
    outages.push({
      name,
      startsAt: parseSkopjeTime(date, from ? `${from[1]}:${from[2]}` : "00:00"),
      endsAt: parseSkopjeTime(date, to ? `${to[1]}:${to[2]}` : "23:59"),
      streets: [(who ?? text).slice(0, 200)],
    });
  }
  return toFeatures("outages-water", munis, outages);
}

const water: Adapter = {
  id: "outages-water",
  ttl: 1800,
  minFeatures: 1, // nothing mappable is a failed fetch: getLayer serves the seed ("Demo data") instead of an empty live layer
  source: { name: "ЈП Водовод и канализација", url: "https://www.vodovod-skopje.com.mk/" },
  async fetch(signal) {
    const res = await fetch(WATER_URL, { signal: abort(signal), headers: HEADERS });
    if (!res.ok) throw new Error(`vodovod-skopje HTTP ${res.status}`);
    return parseVodovod(await res.text(), await municipalities());
  },
  seed: () => loadSeed("outages-water"),
};

// --- Heating: Balkan Energy Group -------------------------------------------------------------------------------------
// ponytail: www.beg.com.mk did not resolve on 2026-10-17 (ENOTFOUND), so there is no outage list to parse. The adapter
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
  seed: () => loadSeed("outages-heating"),
};

export const outages: Record<OutageId, Adapter> = { "outages-power": power, "outages-water": water, "outages-heating": heating };
