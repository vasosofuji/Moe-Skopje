// Roadworks layer (R1): MVR "посебен режим на сообраќај" notices (live) plus roads under construction from OSM (baked by
// scripts/bake-osm.ts roadworks). Notice text → streets in the baked street index → one feature per notice. No lib/server imports.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as cheerio from "cheerio";
import { parseSkopjeTime } from "./geo";
import { toLatin } from "./static";
import { findStreets, streetKey, type StreetFeature } from "./streets";
import type { Adapter, Feature } from "./types";

type Kind = "closure" | "works" | "regime";
const TITLE: Record<Kind, { mk: string; en: string }> = {
  closure: { mk: "Затворена улица", en: "Road closure" },
  works: { mk: "Градежни работи", en: "Roadworks" },
  regime: { mk: "Посебен режим на сообраќај", en: "Special traffic regime" },
};
const SEVERITY: Record<Kind, 1 | 2 | 3> = { works: 1, regime: 2, closure: 3 };

// --- MVR notices ------------------------------------------------------------------------------------------------------------
// mvr.gov.mk robots.txt allows everything but /login. The news list is a Livewire page of 373 pages that mixes arrests and
// traffic, with no category filter that works over GET, so the candidates come from /sitemap.xml: every article with its lastmod
// (and a slug such as "utre-poseben-rezim-na-soobrakjaj-poradi-skopskiot-maraton"). Each article is a title, a DD/MM/YYYY date and
// a .blog-content body naming the day, the start time and the streets ("ул.„11-ти Октомври“", "бул.„Илинден“").
// ponytail: the sitemap is ~1.6 MB (7000 urls) and is fetched once per cache miss (ttl 30 min); switch to the news list if MVR splits it.

const MVR = "https://mvr.gov.mk";
const NEWS = `${MVR}/mk-MK/odnosi-so-javnost/novosti/`;
const SITEMAP = `${MVR}/sitemap.xml`;
const RECENT_MS = 21 * 86_400_000;
const TIMEOUT_MS = 8000;
const abort = (signal?: AbortSignal) => (signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS));
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; MoeSkopje/1.0)" };

async function get(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, { signal: abort(signal), headers: HEADERS });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return res.text();
}

/** News articles that look like a traffic regime or a closure and were touched in the last three weeks. */
export function noticeUrls(sitemap: string, now: number): string[] {
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)]
    .filter(([, loc, mod]) => loc.startsWith(NEWS) && /rezim|zatvoranje/.test(loc.slice(NEWS.length)) && now - Date.parse(mod) < RECENT_MS)
    .map(([, loc]) => loc);
}

// Places a notice can name without naming a street. Best-known coordinates from OSM; the layer flags them detail.approx = 1.
const SQUARE: [number, number] = [21.43179, 41.99569]; // Плоштад Македонија
const PLACES: { re: RegExp; at: [number, number] }[] = [
  { re: /тодор\s+проески|национална\s+арена|арената/iu, at: [21.42556, 42.00571] },
  { re: /плоштад\s+„?македонија|порта\s+македонија|централно\s+подрачје/iu, at: SQUARE },
];

const NEAR_M = 1500; // a street that exists in several municipalities counts when it passes this close to a street that is certain
const NEAR_CENTRE_M = 3000; // ...or, when no street is certain, this close to the city centre

const coordsOf = (f: StreetFeature) => f.geometry.coordinates.flat();
const COS = Math.cos((42 * Math.PI) / 180); // Skopje's latitude: metres per degree of longitude = COS x 111 320
const metres = (a: number[], b: number[]) => Math.hypot((a[0] - b[0]) * COS, a[1] - b[1]) * 111_320;

/**
 * Streets named in a notice. Only names that follow ул./бул./булевар and sit in quotes count, so a bare word such as "Илинден"
 * (a municipality, and a boulevard) is not taken for a street. Many names exist in several municipalities ("Мајка Тереза" has
 * five): of those, only the parts that touch the streets which are certain (named in one municipality only) are kept, so the
 * route stays one connected stretch of the city however long it is.
 */
export function noticeStreets(text: string): StreetFeature[] {
  const names = [...text.matchAll(/(?:ул(?:ица(?:та)?)?|бул(?:евар(?:от)?)?)\.?\s*[„"«]([^„“"»]{2,60})[“"»]/giu)]
    .map((m) => m[1].replace(/(\d)\s*-\s*(?:ти|ви|ри|та|то|ма|ра|мо|ми)(?![\p{L}])/giu, "$1").trim())
    .filter((n) => !/^\d+$/.test(n)); // "ул.„534“" in the suburbs is not a street the index could tell apart
  if (!names.length) return [];
  const found = findStreets(names.map((n) => `ул. ${n}`).join(", "));
  const byKey = new Map<string, StreetFeature[]>();
  for (const f of found) byKey.set(streetKey(f.properties.name_mk), [...(byKey.get(streetKey(f.properties.name_mk)) ?? []), f]);
  const certain = [...byKey.values()].filter((g) => g.length === 1).flatMap((g) => coordsOf(g[0]));
  const [anchors, reach] = certain.length ? [certain, NEAR_M] : [[SQUARE], NEAR_CENTRE_M];
  return found.filter((f) => byKey.get(streetKey(f.properties.name_mk))!.length === 1 || coordsOf(f).some((p) => anchors.some((a) => metres(p, a) <= reach)));
}

const pad = (n: number | string) => String(n).padStart(2, "0");
const nextDay = (dmy: string) => {
  const [d, m, y] = dmy.split(".").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return `${pad(t.getUTCDate())}.${pad(t.getUTCMonth() + 1)}.${t.getUTCFullYear()}`;
};

/**
 * The window a notice announces, in Skopje time. "На 04.10.2026 … со почеток во 08:00 часот" has a start only (assumed to run
 * four hours), "во периодот од 08:00 часот до 11:30 часот" a range, "Утре (02.10.2026)" a day. Without a time the whole day.
 * ponytail: the four-hour default is a guess; MVR rarely says when an event ends.
 */
function windowOf(text: string, published?: string): { startsAt: string; endsAt?: string } | undefined {
  const day = /(?<![\d.])(\d{1,2})\.(\d{1,2})\.(\d{4})(?![\d])/.exec(text);
  let date = day && `${day[1]}.${day[2]}.${day[3]}`;
  if (!date && /утре/iu.test(text) && published) {
    const [y, m, d] = published.split("-");
    date = nextDay(`${d}.${m}.${y}`);
  }
  if (!date) return undefined;
  // work that goes on "for the duration of the works" has no end
  if (/за\s+времетраење\s+на|до\s+завршување\s+на/iu.test(text) && /работи|активности/iu.test(text)) return { startsAt: parseSkopjeTime(date, "00:00") };
  const range = /(?<![\d.:])(\d{1,2})[:.](\d{2})\s*(?:часот?\s*)?до\s*(\d{1,2})[:.](\d{2})(?![\d])/u.exec(text);
  if (range) {
    const startsAt = parseSkopjeTime(date, `${range[1]}:${range[2]}`);
    const overnight = Number(range[3]) * 60 + Number(range[4]) <= Number(range[1]) * 60 + Number(range[2]);
    return { startsAt, endsAt: parseSkopjeTime(overnight ? nextDay(date) : date, `${range[3]}:${range[4]}`) };
  }
  const start = /почеток\s+(?:во|од)\s+(\d{1,2})[:.](\d{2})/iu.exec(text) ?? /(?<![\d.])(\d{1,2}):(\d{2})\s*час/u.exec(text);
  if (start) {
    const h = Number(start[1]) + 4;
    return { startsAt: parseSkopjeTime(date, `${start[1]}:${start[2]}`), endsAt: parseSkopjeTime(date, h >= 24 ? "23:59" : `${h}:${start[2]}`) };
  }
  return { startsAt: parseSkopjeTime(date, "00:00"), endsAt: parseSkopjeTime(date, "23:59") };
}

/** One MVR article → a roadworks feature, or null when it is not about Skopje, has ended, or names no place we can put on the map. */
export function parseNotice(html: string, url: string, now = Date.now()): Feature | null {
  const $ = cheerio.load(html);
  const h1 = $("h1").first();
  const title = h1.text().replace(/\s+/g, " ").trim();
  const body = $(".blog-content").text().replace(/\s+/g, " ").trim();
  if (!title || !body) return null;
  const text = `${title}. ${body}`;
  if (!/Скопј/u.test(text) || !/сообраќај|сообраќајот/iu.test(text)) return null;
  const pub = /(\d{2})\/(\d{2})\/(\d{4})/.exec(h1.parent().text());
  const published = pub ? `${pub[3]}-${pub[2]}-${pub[1]}` : undefined;
  const when = windowOf(text, published);
  if (!when || (when.endsAt && Date.parse(when.endsAt) < now)) return null;

  const works = /градежн|реконструкц|санациј|асфалт/iu.test(text) && !when.endsAt;
  const kind: Kind = /затвор(?:ање|ен|ена|ени|ено)(?![\p{L}])/iu.test(text) ? "closure" : works ? "works" : "regime";
  const streets = noticeStreets(body);
  const place = streets.length ? undefined : PLACES.find((p) => p.re.test(text))?.at;
  if (!streets.length && !place) return null;

  const names = [...new Set(streets.map((s) => s.properties.name_mk))].join("; ");
  // "Утре посебен режим на сообраќај поради Скопскиот маратон" → "Посебен режим на сообраќај: Скопскиот маратон"
  const reason = /поради\s+(.+?)(?:\s+посебен\s+режим.*)?$/iu.exec(title)?.[1];
  const mk = reason ? `${TITLE[kind].mk}: ${reason}` : title.replace(/^(?:утре|во\s+\p{L}+)\s+/iu, "").replace(/^./u, (c) => c.toUpperCase());
  return {
    type: "Feature",
    geometry: streets.length ? { type: "MultiLineString", coordinates: streets.flatMap((s) => s.geometry.coordinates) } : { type: "Point", coordinates: place! },
    properties: {
      id: `roadworks:mvr:${url.slice(url.lastIndexOf("/") + 1)}`,
      kind,
      severity: SEVERITY[kind],
      title: { mk, en: TITLE[kind].en },
      ...when,
      detail: { source: "МВР", url, ...(published ? { published } : {}), ...(reason ? { reason } : {}), ...(names ? { streets: names } : { approx: 1 }) },
    },
  };
}

// --- OSM: roads under construction (baked) ------------------------------------------------------------------------------------

type Baked = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, string | undefined>> & { baked_at?: string };

// The read site spells the path out (process.cwd(), "data", "static", ...): Next traces the whole project for a directory held
// in a variable (see build-paths.test.ts). Tests swap the data with setBaked, never the path.
let baked: Baked | undefined;
/** Test hook: serve this collection instead of data/static/roadworks.geojson. Call without an argument to read the baked file again. */
export const setBaked = (fc?: Baked) => void (baked = fc);

const day = (s?: string) => (s && /^\d{4}-\d\d-\d\d$/.test(s) ? s : undefined);

/** Roads OSM maps as under construction, minus the ones whose opening date has passed. Never throws: a missing file is []. */
export async function osmWorks(now = Date.now()): Promise<Feature[]> {
  try {
    baked ??= JSON.parse(await readFile(join(process.cwd(), "data", "static", "roadworks.geojson"), "utf8")) as Baked;
  } catch {
    return [];
  }
  return baked.features.flatMap((f): Feature[] => {
    const p = f.properties;
    const opens = day(p.opening_date);
    if (opens && Date.parse(opens) < now) return [];
    const startsAt = day(p.start_date);
    return [
      {
        type: "Feature",
        geometry: f.geometry,
        properties: {
          id: `roadworks:osm:${p.osm_id}`,
          kind: "works",
          severity: SEVERITY.works,
          title: { mk: p.name_mk ?? "Пат во изградба", en: p.name_en ?? (p.name_mk ? toLatin(p.name_mk) : "Road under construction") },
          ...(startsAt ? { startsAt } : {}),
          ...(opens ? { endsAt: opens } : {}),
          detail: {
            source: "OpenStreetMap",
            ...(p.name_mk ? { streets: p.name_mk } : {}),
            ...(p.construction ? { construction: p.construction } : {}),
            ...(p.access ? { access: p.access } : {}),
            ...(p.note || p.description ? { note: (p.note ?? p.description)! } : {}),
            ...(p.check_date ? { checked: p.check_date } : {}),
            ...(baked?.baked_at ? { asOf: baked.baked_at } : {}),
          },
        },
      },
    ];
  });
}

// --- Adapter ----------------------------------------------------------------------------------------------------------------

export const roadworks: Adapter = {
  id: "roadworks",
  ttl: 1800,
  minFeatures: 0, // a quiet week is a real answer; an unreachable MVR throws, and getLayer then serves the snapshot or the OSM seed
  source: { name: "МВР, OpenStreetMap", url: "https://mvr.gov.mk/mk-MK/odnosi-so-javnost/novosti" },
  async fetch(signal) {
    const now = Date.now();
    const urls = noticeUrls(await get(SITEMAP, signal), now);
    const pages = (await Promise.allSettled(urls.map(async (u) => ({ u, html: await get(u, signal) })))).flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (urls.length > 0 && pages.length === 0) throw new Error(`mvr.gov.mk: none of ${urls.length} notices could be fetched`);
    return [...pages.flatMap(({ u, html }) => parseNotice(html, u, now) ?? []), ...(await osmWorks(now))];
  },
  seed: () => osmWorks(),
};
