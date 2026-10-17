// Dates and distances in Skopje time. Chromium ships a trimmed ICU without Macedonian, so Intl("mk-MK") silently
// formats in English there; the names are spelled out here instead and Intl only supplies the Europe/Skopje clock.
import type { Lang } from "./core";

const NAMES = {
  mk: {
    days: ["недела", "понеделник", "вторник", "среда", "четврток", "петок", "сабота"],
    months: ["јануари", "февруари", "март", "април", "мај", "јуни", "јули", "август", "септември", "октомври", "ноември", "декември"],
  },
  en: {
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  },
};

const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Skopje",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Calendar parts of `d` on a Skopje wall clock. */
function skopje(d: Date) {
  const p = Object.fromEntries(clock.formatToParts(d).map((x) => [x.type, x.value]));
  const [y, m, day] = [Number(p.year), Number(p.month), Number(p.day)];
  return { y, m, day, weekday: new Date(Date.UTC(y, m - 1, day)).getUTCDay(), time: `${p.hour}:${p.minute}` };
}

/** "сабота, 17 октомври" / "Saturday 17 October"; the year only when it is not this year. */
export function formatDate(d: Date, lang: Lang, { weekday = false, now = new Date() } = {}): string {
  const s = skopje(d);
  const { days, months } = NAMES[lang];
  const date = `${s.day} ${months[s.m - 1]}${s.y !== skopje(now).y ? ` ${s.y}` : ""}`;
  return weekday ? `${days[s.weekday]}${lang === "mk" ? "," : ""} ${date}` : date;
}

/** When something starts and ends: "17 октомври, 09:00 – 14:00", spelling out the second date only when it differs. */
export function formatWhen(startsAt: string | undefined, endsAt: string | undefined, lang: Lang, now = new Date()): string | null {
  const valid = (s?: string) => (s && Number.isFinite(Date.parse(s)) ? new Date(s) : null);
  const [a, b] = [valid(startsAt), valid(endsAt)];
  const stamp = (d: Date) => `${formatDate(d, lang, { now })}, ${skopje(d).time}`;
  if (a && b) return formatDate(a, lang, { now }) === formatDate(b, lang, { now }) ? `${stamp(a)} – ${skopje(b).time}` : `${stamp(a)} – ${stamp(b)}`;
  return a ? stamp(a) : b ? `– ${stamp(b)}` : null;
}

/** "14:05" on the Skopje clock. */
export const skopjeTime = (d: Date): string => skopje(d).time;

/** "Пон" / "Mon" for a calendar date "YYYY-MM-DD". */
export function weekdayShort(date: string, lang: Lang): string {
  const name = NAMES[lang].days[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return name[0].toUpperCase() + name.slice(1, 3);
}

/** "350 м" / "1,2 км" in Macedonian, "350 m" / "1.2 km" in English; metres round to 10. */
export function formatDistance(m: number, lang: Lang): string {
  const km = m >= 1000;
  const n = km ? (Math.round(m / 100) / 10).toFixed(1) : String(Math.round(m / 10) * 10);
  return lang === "mk" ? `${n.replace(".", ",")} ${km ? "км" : "м"}` : `${n} ${km ? "km" : "m"}`;
}
