// Name and time helpers for outage text (spec §5.3). Pure; no I/O.

/** The 10 Skopje municipalities as named in data/static/municipalities.geojson (`name_mk`). */
export const MUNICIPALITIES = ["Центар", "Карпош", "Аеродром", "Кисела Вода", "Гази Баба", "Чаир", "Бутел", "Шуто Оризари", "Ѓорче Петров", "Сарај"] as const;

// Digraphs before single letters; "sh/ch/zh" cover English-style spellings (OSM name:en says "Shuto Orizari").
const DIGRAPHS: [string, string][] = [["dž", "џ"], ["lj", "љ"], ["nj", "њ"], ["gj", "ѓ"], ["kj", "ќ"], ["dz", "ѕ"], ["sh", "ш"], ["ch", "ч"], ["zh", "ж"]];
const LATIN: Record<string, string> = {
  š: "ш", č: "ч", ž: "ж", ǵ: "ѓ", đ: "ѓ", ć: "ќ", ḱ: "ќ",
  a: "а", b: "б", c: "ц", d: "д", e: "е", f: "ф", g: "г", h: "х", i: "и", j: "ј", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п",
  q: "к", r: "р", s: "с", t: "т", u: "у", v: "в", w: "в", x: "кс", y: "ј", z: "з",
};

/**
 * Lowercases, transliterates Latin to Macedonian Cyrillic (diacritics decide š/č/ž first, other accents are stripped),
 * and drops trailing numbers and punctuation: "KARPOŠ 4," → "карпош".
 */
export function normalizeName(s: string): string {
  let t = s.normalize("NFC").toLowerCase();
  for (const [lat, cyr] of DIGRAPHS) t = t.replaceAll(lat, cyr);
  t = [...t].map((ch) => LATIN[ch] ?? LATIN[ch.normalize("NFD")[0]] ?? ch).join("");
  return t.replace(/\s+/g, " ").replace(/[\s\d\p{P}\p{S}]+$/u, "").trim();
}

// Lossy fold so "Cair", "Čair" and "Чаир" meet, and "Gjorce" meets "Ѓорче". Safe: only 10 names to tell apart.
export const fold =(s: string) => s.replace(/ч/g, "ц").replace(/ш/g, "с").replace(/ж/g, "з").replace(/ѓ/g, "г").replace(/ќ/g, "к").replace(/ѕ/g, "з");
const words = (s: string) => ` ${fold(normalizeName(s)).split(/[^\p{L}]+/u).filter(Boolean).join(" ")} `;
const KEYS = MUNICIPALITIES.map((name) => ({ name, key: words(name) }));

/** `name_mk` of the municipality named first in `text`, or null. Matches whole words in any script or case. */
export function matchMunicipality(text: string): string | null {
  const hay = words(text);
  let best: { name: string; at: number } | null = null;
  for (const { name, key } of KEYS) {
    const at = hay.indexOf(key);
    if (at >= 0 && (!best || at < best.at)) best = { name, at };
  }
  return best?.name ?? null;
}

const skopjeOffset = new Intl.DateTimeFormat("en", { timeZone: "Europe/Skopje", timeZoneName: "longOffset" });
/** UTC offset of Europe/Skopje at an instant, in minutes (+60 or +120). */
function offsetMinutes(instant: number): number {
  const label = skopjeOffset.formatToParts(instant).find((p) => p.type === "timeZoneName")?.value ?? "";
  const m = /GMT([+-])(\d\d):?(\d\d)?/.exec(label);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
}

/** Today in Skopje as YYYY-MM-DD (the server clock is UTC). */
export const skopjeToday = (now: number) => new Date(now).toLocaleDateString("en-CA", { timeZone: "Europe/Skopje" });

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Wall-clock Skopje time ("17.10.2026", "09:00") → ISO with the offset Europe/Skopje has on that date.
 * Never parse these with `new Date(...)`: Vercel runs in UTC.
 */
export function parseSkopjeTime(date: string, time: string): string {
  const [d, mo, y] = date.split(".").map(Number);
  const [h, mi] = time.split(/[:.]/).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // the offset is the candidate that Skopje itself reports at that instant; the repeated hour in autumn resolves to +02:00
  const off = [120, 60].find((o) => offsetMinutes(wall - o * 60_000) === o) ?? offsetMinutes(wall - 3_600_000); // spring gap: use the pre-switch offset
  const sign = off < 0 ? "-" : "+";
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}:00${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}
