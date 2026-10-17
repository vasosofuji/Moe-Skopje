// Events layer (tier 2): City of Skopje news and announcements, placed at the municipality (or settlement) they name,
// else at the city centre. Municipality-level precision, like the outages. No imports from lib/server/* (tsx).
import * as cheerio from "cheerio";
import seed from "../../data/seed/events.json";
import { matchMunicipality, parseSkopjeTime, skopjeToday } from "./geo";
import { centroid, municipalities, toLatin, type MunicipalityCollection } from "./static";
import type { Adapter, Feature } from "./types";

const NEWS_URL = "https://skopje.gov.mk/mk/vesti/";
const CENTRE: [number, number] = [21.4254, 41.9981];
const RECENT_DAYS = 7; // news whose last day is older than this is not an "event" any more
const MAX_EVENTS = 12;
const TIMEOUT_MS = 8000;
const abort = (signal?: AbortSignal) => (signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS));

// --- dates (all Europe/Skopje wall-clock, as YYYY-MM-DD strings) -------------------------------------------------------

const toYmd = (d: string, m: string, y: string) => `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
const toDmy = (ymd: string) => ymd.split("-").reverse().join("."); // 2026-10-17 → 17.10.2026, the form parseSkopjeTime takes
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// --- placement --------------------------------------------------------------------------------------------------------

type Spot = { at: [number, number]; venue: string };

/** Where `text` points: the centroid of the municipality it names (settlements resolve to their municipality), else the centre. */
function spotOf(munis: MunicipalityCollection, text: string): Spot {
  const name = matchMunicipality(text);
  const muni = name ? munis.features.find((m) => m.properties.name_mk === name) : undefined;
  return muni ? { at: centroid(muni.geometry), venue: muni.properties.name_mk } : { at: CENTRE, venue: "Скопје" };
}

/** Moves the 2nd, 3rd, ... event at one spot onto a small spiral around it so the markers do not hide each other. */
function spreader() {
  const seen = new Map<string, number>();
  return ({ at: [lng, lat], venue }: Spot): [number, number] => {
    const k = seen.get(venue) ?? 0;
    seen.set(venue, k + 1);
    const angle = k * 2.4;
    const r = 0.0025 * Math.sqrt(k); // ~280 m for the first neighbour
    return [lng + r * Math.cos(angle), lat + r * Math.sin(angle)];
  };
}

// --- live: skopje.gov.mk/mk/vesti/ ------------------------------------------------------------------------------------
// Each `.news-item` has `h5 a` (title, href) and `p span`s: the publication date (DD.MM.YYYY), then the text. Titles are
// often just "Соопштение", so those take the first sentence of the text instead. The event day is the first date the text
// names (else the publication date); a text that names two dates spans them. "во 10 часот" sets the start time.

const GENERIC_TITLE = /^(соопштение|известување|информација|вест)$/i;
const DATE = /(\d{1,2})\.(\d{1,2})\.(\d{4})/g;

function headline(title: string, text: string): string {
  if (title && !GENERIC_TITLE.test(title)) return title;
  const first = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return first.length > 110 ? `${first.slice(0, 107).trimEnd()}…` : first;
}

/** News items from the page as events. Throws when the page has no news items (markup changed). */
export function parseVesti(html: string, munis: MunicipalityCollection, now = Date.now()): Feature[] {
  const $ = cheerio.load(html);
  const items = $(".news-item").toArray();
  if (items.length === 0) throw new Error("skopje.gov.mk: no .news-item found (markup changed?)");

  const today = skopjeToday(now);
  const oldest = addDays(today, -RECENT_DAYS);
  const spread = spreader();
  const out: Feature[] = [];
  for (const el of items) {
    const link = $(el).find("h5 a").first();
    const href = link.attr("href");
    const spans = $(el).find("p span");
    const clean = (s: string) => s.replace(/\s+/g, " ").trim();
    const published = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(clean(spans.eq(0).text()));
    const text = clean(spans.eq(1).text());
    if (!href || !published || !text) continue;

    const named = [...text.matchAll(DATE)].map((m) => toYmd(m[1], m[2], m[3])).sort();
    const first = named[0] ?? toYmd(published[1], published[2], published[3]);
    const last = named.at(-1) ?? first;
    if (last < oldest) continue;

    const time = /(?:^|\s)во\s+(\d{1,2})(?:[:.](\d{2}))?\s*час/.exec(text); // no \b: it is ASCII-only, so it never matches before Cyrillic
    const title = headline(clean(link.text()), text);
    const spot = spotOf(munis, `${title} ${text}`);
    out.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: spread(spot) },
      properties: {
        id: `event:${href.split("/").filter(Boolean).at(-1)}`,
        kind: "event",
        title: { mk: title, en: toLatin(title) },
        startsAt: parseSkopjeTime(toDmy(first), time ? `${time[1]}:${time[2] ?? "00"}` : "00:00"),
        endsAt: parseSkopjeTime(toDmy(last), "23:59"), // ponytail: end of the last named day; the news rarely says when it ends
        detail: { venue: spot.venue, url: new URL(href, NEWS_URL).href },
      },
    });
    if (out.length === MAX_EVENTS) break;
  }
  // News exists but none of it is recent: the feed is stale or changed, so say "failed" and let getLayer serve the seed.
  if (out.length === 0) throw new Error(`skopje.gov.mk: no news from the last ${RECENT_DAYS} days`);
  return out;
}

// --- seed: data/seed/events.json --------------------------------------------------------------------------------------
// Illustrative Skopje programme (served as "Demo data"). `day` is days from today in Skopje, so it never looks stale.

type SeedEvent = { day: number; time: string; hours: number; mk: string; en: string; place: string; municipality: string };

/** The seed events with their dates counted from today (Skopje) and placed at their municipality. */
export async function seedFeatures(now = Date.now()): Promise<Feature[]> {
  const munis = await municipalities();
  const today = skopjeToday(now);
  const spread = spreader();
  return (seed as SeedEvent[]).map((e, i) => {
    const spot = spotOf(munis, e.municipality);
    const startsAt = parseSkopjeTime(toDmy(addDays(today, e.day)), e.time);
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: spread(spot) },
      properties: {
        id: `event:seed-${i}`,
        kind: "event",
        title: { mk: e.mk, en: e.en },
        startsAt,
        endsAt: new Date(Date.parse(startsAt) + e.hours * 3_600_000).toISOString(),
        detail: { place: e.place, venue: spot.venue },
      },
    } satisfies Feature;
  });
}

export const events: Adapter = {
  id: "events",
  ttl: 1800,
  minFeatures: 1, // a 200 whose markup changed parses to nothing; parseVesti throws, this is the second net
  source: { name: "Град Скопје", url: NEWS_URL },
  async fetch(signal) {
    const res = await fetch(NEWS_URL, { signal: abort(signal), headers: { "User-Agent": "Mozilla/5.0 (compatible; MoeSkopje/1.0)" } });
    if (!res.ok) throw new Error(`skopje.gov.mk HTTP ${res.status}`);
    return parseVesti(await res.text(), await municipalities());
  },
  seed: () => seedFeatures(),
};
