// Air quality from pulse.eco. It already merges the official MOEPP stations (numeric sensorIds like "1000")
// with sensor.community sensors (`sensor_dev_*` and uuids), so it is the only air source we need.
import { z } from "zod";
import { pm10Severity } from "@/lib/aqi";
import { fetchJson } from "./fetch-json";
import { loadSeed } from "./seed";
import type { Adapter, Feature } from "./types";

const BASE = "https://skopje.pulse.eco/rest";
const MAX_AGE_MS = 3 * 3600_000; // a station that stopped reporting is not "live air"
const SENSORS_TTL_MS = 24 * 3600_000;

// pulse.eco sends numbers as strings and positions as "lat,lng".
const Reading = z.object({ sensorId: z.string(), stamp: z.string(), type: z.string(), position: z.string(), value: z.string() });
const Readings = z.array(Reading);
const Sensors = z.array(z.object({ sensorId: z.string(), description: z.string() }));
export type PulseReading = z.infer<typeof Reading>;

// pulse.eco type → detail key. pm10 and pm25 are always included.
const EXTRA = { no2: "no2", o3: "o3", noise_dba: "noise", temperature: "temperature" } as const;

const num = (s: string) => Number.parseFloat(s);

/** Same 0 to 3 scale as pm10Severity, from the PM2.5 bands: <=10 green, <=20 yellow-green, <=25 yellow, <=50 orange, <=75 red, above purple. */
const pm25Severity = (v: number): 0 | 1 | 2 | 3 => (v <= 20 ? 0 : v <= 25 ? 1 : v <= 50 ? 2 : 3);

/** Pure: latest reading per sensor and type (≤3 h old, numeric) → one air-station point per sensor with pm10 or pm25. */
export function parseAir(readings: PulseReading[], names: ReadonlyMap<string, string>, now = Date.now()): Feature[] {
  const bySensor = new Map<string, { position: string; latest: Map<string, { at: number; v: number }> }>();
  for (const r of readings) {
    const at = Date.parse(r.stamp);
    const v = num(r.value);
    if (!Number.isFinite(at) || !Number.isFinite(v) || now - at > MAX_AGE_MS) continue;
    const s = bySensor.get(r.sensorId) ?? { position: r.position, latest: new Map() };
    bySensor.set(r.sensorId, s);
    const prev = s.latest.get(r.type);
    if (!prev || at > prev.at) s.latest.set(r.type, { at, v });
  }

  const features: Feature[] = [];
  for (const [sensorId, { position, latest }] of bySensor) {
    const pm10 = latest.get("pm10")?.v;
    const pm25 = latest.get("pm25")?.v;
    const value = pm10 ?? pm25;
    const [lat, lng] = position.split(",").map(num);
    if (value === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const detail: Record<string, string | number> = {};
    if (pm10 !== undefined) detail.pm10 = pm10;
    if (pm25 !== undefined) detail.pm25 = pm25;
    // A station with only PM2.5 is rated on PM2.5 bands (PM10 limits would call 30 µg/m³ "good"); detail.metric says so.
    if (pm10 === undefined) detail.metric = "pm25";
    for (const [type, key] of Object.entries(EXTRA)) {
      const v = latest.get(type)?.v;
      if (v !== undefined) detail[key] = v;
    }
    // Feature detail cannot hold a boolean, so the flag is 1 for official stations and absent otherwise.
    if (/^\d+$/.test(sensorId)) detail.official = 1;

    const name = names.get(sensorId) ?? `Sensor ${sensorId}`;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: { id: `air-${sensorId}`, kind: "air-station", title: { mk: name, en: name }, severity: pm10 !== undefined ? pm10Severity(pm10) : pm25Severity(value), value, unit: "µg/m³", detail },
    });
  }
  return features;
}

// Sensor names change rarely, so /rest/sensor (≈40 KB) is read once a day per server instance.
let sensorNames: { at: number; map: Map<string, string> } | undefined;
export const resetAirCache = () => (sensorNames = undefined);

async function namesOf(signal?: AbortSignal): Promise<Map<string, string>> {
  if (!sensorNames || Date.now() - sensorNames.at > SENSORS_TTL_MS) {
    try {
      const list = Sensors.parse(await fetchJson(`${BASE}/sensor`, signal));
      sensorNames = { at: Date.now(), map: new Map(list.map((s) => [s.sensorId, s.description])) };
    } catch (err) {
      // ponytail: without the list a sensor is titled "Sensor <id>"; the readings themselves are what matters.
      console.warn(`[air] sensor list failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return sensorNames?.map ?? new Map();
}

export const air: Adapter = {
  id: "air",
  ttl: 600,
  minFeatures: 1,
  source: { name: "pulse.eco", url: "https://skopje.pulse.eco" },
  async fetch(signal) {
    const readings = Readings.parse(await fetchJson(`${BASE}/current`, signal));
    return parseAir(readings, await namesOf(signal));
  },
  seed: () => loadSeed("air"),
};

const pulseTime = (ms: number) => new Date(ms).toISOString().slice(0, 19) + "Z";

/**
 * Daily city-wide PM10 averages for the last 7 days, oldest first (sensorId -1 is pulse.eco's all-sensors average).
 * Used by the air detail sparkline through /api/air-trend: pulse.eco sends no CORS headers, so a browser cannot call it directly.
 */
export async function fetchPm10Trend(signal?: AbortSignal): Promise<number[]> {
  const now = Date.now();
  const url = `${BASE}/avgData/day?sensorId=-1&type=pm10&from=${pulseTime(now - 7 * 86_400_000)}&to=${pulseTime(now)}`;
  return Readings.parse(await fetchJson(url, signal))
    .map((r) => ({ at: Date.parse(r.stamp), v: num(r.value) }))
    .filter((p) => Number.isFinite(p.at) && Number.isFinite(p.v))
    .sort((a, b) => a.at - b.at)
    .map((p) => p.v);
}
