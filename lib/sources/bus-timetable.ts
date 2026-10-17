// Departures from the seed timetable. Client-safe on purpose (BusDepartures imports it): no fs, no server-only;
// the JSON is bundled as a module.
import raw from "../../data/seed/jsp-timetables.json";

export type LineTimetable = { headwayMin: number; firstAt: string; lastAt: string; note?: string };
export const timetable: Record<string, LineTimetable> = raw;

// ponytail: one fixed schedule for every stop on a line; real per-stop offsets need JSP data.
const skopje = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Skopje", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const toHhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// stopId → lines, filled on the server by the buses adapter. The browser passes `lines` explicitly instead.
let stopLinesById = new Map<string, string[]>();
export const setStopLines = (lines: Map<string, string[]>) => void (stopLinesById = lines);

/**
 * The next `n` departures at a stop, soonest first, in Skopje wall-clock time ("HH:MM"). A line runs every `headwayMin`
 * from `firstAt` to `lastAt`; before service starts you get its first ones, after it ends you get none (no wrap to tomorrow).
 * `lines` defaults to the ones the buses adapter snapped to `stopId`; lines without a timetable are skipped.
 */
export function nextDepartures(stopId: string, now: Date, n = 3, lines: string[] = stopLinesById.get(stopId) ?? []): Array<{ line: string; at: string }> {
  const parts = skopje.formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const nowMin = part("hour") * 60 + part("minute");

  const out: Array<{ line: string; at: string }> = [];
  for (const line of lines) {
    const t = timetable[line];
    if (!t) continue;
    const first = toMinutes(t.firstAt);
    const last = toMinutes(t.lastAt);
    const skip = Math.max(0, Math.ceil((nowMin - first) / t.headwayMin));
    for (let i = 0, m = first + skip * t.headwayMin; i < n && m <= last; i++, m += t.headwayMin) out.push({ line, at: toHhmm(m) });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at)).slice(0, n); // stable: same-minute ties keep the stop's line order
}
