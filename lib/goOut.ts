// PM10 (µg/m³) upper bound of each band and the points it costs, spec §6.4 bands.
const PM10_PENALTY: [max: number, points: number][] = [[20, 0], [40, 10], [50, 25], [100, 50], [150, 70]];

/** 0..100: how good the day is for being outside. Starts at 100; a null reading costs nothing. */
export function goOutScore(pm10: number | null, tempC: number | null, precipMm: number | null): number {
  let score = 100;
  if (pm10 !== null) score -= PM10_PENALTY.find(([max]) => pm10 <= max)?.[1] ?? 90;
  if (precipMm !== null && precipMm > 0.5) score -= 20;
  if (tempC !== null && (tempC < 0 || tempC > 35)) score -= 15;
  return Math.max(0, Math.min(100, score));
}
