// PM10 (µg/m³) bands, spec §6.4: ≤20 green, ≤40 yellow-green, ≤50 yellow, ≤100 orange, ≤150 red, >150 purple.

/** 0 good (≤40), 1 moderate (≤50), 2 unhealthy for sensitive groups (≤100), 3 unhealthy. Drives `t("air.advice.N")`. */
export const pm10Severity = (v: number): 0 | 1 | 2 | 3 => (v <= 40 ? 0 : v <= 50 ? 1 : v <= 100 ? 2 : 3);

// Yellow-green has no iOS system colour, so it is a literal. The rest follow the theme through globals.css.
const BANDS: readonly (readonly [max: number, color: string])[] = [
  [20, "var(--system-green)"],
  [40, "#a8d83f"],
  [50, "var(--system-yellow)"],
  [100, "var(--system-orange)"],
  [150, "var(--system-red)"],
  [Infinity, "var(--system-purple)"],
];

/** CSS colour for a PM10 reading. Like LayerMeta.color it may hold var(); resolve it with getComputedStyle before handing it to MapLibre. */
export const aqiColor = (v: number): string => BANDS.find(([max]) => v <= max)![1];

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
