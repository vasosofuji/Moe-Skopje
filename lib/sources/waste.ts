// Waste layer (tier 2): which municipalities have waste collection today, as municipality fills.
// note: ЈП Комунална хигиена publishes no machine-readable schedule (khigiena.com.mk answers 403 to bots and has no
// feed), so there is no live fetch: the adapter always throws and getLayer serves this seed as "Demo data". The weekly
// pattern in data/seed/waste.json is illustrative; replace it once the utility publishes real routes.
// No imports from lib/server/* (tsx).
import data from "../../data/seed/waste.json";
import { parseSkopjeTime, skopjeToday } from "./geo";
import { municipalities } from "./static";
import type { Adapter, Feature } from "./types";

type Label = { mk: string; en: string };
type Kind = keyof typeof data.types;
const KINDS = Object.keys(data.types) as Kind[];
const schedule = data.schedule as Record<string, Record<Kind, number[]>>;
const TYPES: Record<Kind, Label> = data.types;

const DAYS: Label[] = [
  { mk: "пон", en: "Mon" },
  { mk: "вто", en: "Tue" },
  { mk: "сре", en: "Wed" },
  { mk: "чет", en: "Thu" },
  { mk: "пет", en: "Fri" },
  { mk: "саб", en: "Sat" },
  { mk: "нед", en: "Sun" },
];

/** "A, B / A, B": MarkerCard prints detail values as they are, and a detail value cannot carry two languages any other way. */
const both = (labels: Label[]) => `${labels.map((l) => l.mk).join(", ")} / ${labels.map((l) => l.en).join(", ")}`;

/** 1 = Monday ... 7 = Sunday for a Skopje YYYY-MM-DD. */
function isoWeekday(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

/** One polygon per municipality that collects today (Skopje date), with what is collected and its weekly days. */
export async function seedFeatures(now = Date.now()): Promise<Feature[]> {
  const munis = await municipalities();
  const today = skopjeToday(now);
  const weekday = isoWeekday(today);
  const dmy = today.split("-").reverse().join(".");
  const [from, to] = data.window;

  const out: Feature[] = [];
  for (const muni of munis.features) {
    const days = schedule[muni.properties.name_mk];
    const todays = days && KINDS.filter((k) => days[k].includes(weekday));
    if (!todays?.length) continue;
    out.push({
      type: "Feature",
      geometry: muni.geometry,
      properties: {
        id: `waste:${muni.properties.name_en}`,
        kind: "waste",
        title: { mk: muni.properties.name_mk, en: muni.properties.name_en },
        startsAt: parseSkopjeTime(dmy, from),
        endsAt: parseSkopjeTime(dmy, to),
        detail: {
          today: both(todays.map((k) => TYPES[k])),
          ...Object.fromEntries(KINDS.map((k) => [k, both(days[k].map((d) => DAYS[d - 1]))])),
        },
      },
    });
  }
  return out;
}

export const waste: Adapter = {
  id: "waste",
  ttl: 3600, // "today" changes at midnight, so keep the cached answer short-lived
  source: { name: "ЈП Комунална хигиена", url: "http://www.khigiena.com.mk/" },
  async fetch() {
    throw new Error("waste: ЈП Комунална хигиена has no machine-readable schedule; serving the seed");
  },
  seed: () => seedFeatures(),
};
