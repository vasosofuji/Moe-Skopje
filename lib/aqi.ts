// Air quality bands, spec §6.4. PM10 (µg/m³): ≤20 green, ≤40 yellow-green, ≤50 yellow, ≤100 orange, ≤150 red, >150 purple.
// PM2.5 uses the same six bands at half the values: ≤10, ≤20, ≤25, ≤50, ≤75, above.

export type Metric = "pm10" | "pm25";

/** Upper bound of each band but the last, then where the scale ends for `aqiPosition`. */
const EDGES: Record<Metric, readonly number[]> = { pm10: [20, 40, 50, 100, 150, 250], pm25: [10, 20, 25, 50, 75, 125] };

/** The metric a feature's `value` is in: air stations without PM10 say `detail.metric = "pm25"`. */
export const metricOf = (detail?: Record<string, string | number>): Metric => (detail?.metric === "pm25" ? "pm25" : "pm10");

/** 0 good (≤40), 1 moderate (≤50), 2 unhealthy for sensitive groups (≤100), 3 unhealthy. Drives `t("air.advice.N")`. */
export const pm10Severity = (v: number): 0 | 1 | 2 | 3 => (v <= 40 ? 0 : v <= 50 ? 1 : v <= 100 ? 2 : 3);

/** Same 0 to 3 scale on the PM2.5 bands. */
export const pm25Severity = (v: number): 0 | 1 | 2 | 3 => (v <= 20 ? 0 : v <= 25 ? 1 : v <= 50 ? 2 : 3);

// Yellow-green has no iOS system colour, so it is a literal. The rest follow the theme through globals.css.
export const AQI_COLORS = [
  "var(--system-green)",
  "#a8d83f",
  "var(--system-yellow)",
  "var(--system-orange)",
  "var(--system-red)",
  "var(--system-purple)",
] as const;

/** Band index 0..5 of a reading; each band's upper bound is inclusive. */
export function aqiBand(metric: Metric, v: number): number {
  const i = EDGES[metric].slice(0, 5).findIndex((max) => v <= max);
  return i === -1 ? 5 : i;
}

/** CSS colour for a reading. Like LayerMeta.color it may hold var(); resolve it with getComputedStyle before handing it to MapLibre. */
export const colorFor = (metric: Metric, v: number): string => AQI_COLORS[aqiBand(metric, v)];

/** CSS colour for a PM10 reading. */
export const aqiColor = (v: number): string => colorFor("pm10", v);

/**
 * Where a reading sits on the colour scale, 0..1: every band takes an equal sixth, linear inside the band, and the top
 * band ends at 250 (PM10) / 125 (PM2.5). The heat-map weights and the legend bar share it, so they always agree.
 */
export function aqiPosition(metric: Metric, v: number): number {
  const edges = [0, ...EDGES[metric]];
  if (!(v > 0)) return 0;
  const i = edges.findIndex((e) => v <= e);
  if (i === -1) return 1;
  return (i - 1 + (v - edges[i - 1]) / (edges[i] - edges[i - 1])) / 6;
}

/** `points` for an SVG polyline: values spread over w × h, largest at the top. Flat data draws a mid line. */
export function sparkPoints(values: number[], w: number, h: number, pad = 2): string {
  const lo = Math.min(...values);
  const span = Math.max(...values) - lo;
  return values
    .map((v, i) => {
      const x = values.length > 1 ? pad + (i * (w - 2 * pad)) / (values.length - 1) : w / 2;
      const y = span ? h - pad - ((v - lo) * (h - 2 * pad)) / span : h / 2;
      return `${+x.toFixed(1)},${+y.toFixed(1)}`;
    })
    .join(" ");
}
