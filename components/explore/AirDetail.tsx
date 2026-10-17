"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/components/glass/GlassCard";
import { AQI_COLORS, aqiColor, aqiPosition, pm10Severity, sparkPoints } from "@/lib/aqi";
import { cx } from "@/lib/cx";
import { pick, useT } from "@/lib/i18n";
import type { Feature, LayerResponse } from "@/lib/sources/types";

type Station = { id: string; name: { mk: string; en: string }; value: number; official: boolean; pm25: boolean };

/** PM2.5 bands are the PM10 ones halved (10/20/25/50/75), so a PM2.5 reading doubled lands on the PM10 scale. */
const pm10Scale = (s: Station) => (s.pm25 ? s.value * 2 : s.value);

const median = (sorted: number[]) => {
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Every station with a reading, worst first. A station without PM10 reports PM2.5 in `value`: it is flagged and left out of the city PM10. */
export function stationsOf(data: LayerResponse): Station[] {
  return (data.features.features as Feature[])
    .filter((f) => f.properties.kind === "air-station" && Number.isFinite(f.properties.value))
    .map((f) => ({
      id: f.properties.id,
      name: f.properties.title,
      value: f.properties.value!,
      official: Boolean(f.properties.detail?.official),
      pm25: typeof f.properties.detail?.pm10 !== "number",
    }))
    .sort((a, b) => pm10Scale(b) - pm10Scale(a));
}

/** Median PM10 over the stations that measure PM10; the median ignores the odd glitching community sensor a mean would let skew the advice. */
export function cityPm10(stations: Station[]): number | null {
  const pm10 = stations.filter((s) => !s.pm25).map((s) => s.value);
  return pm10.length ? Math.round(median(pm10.sort((a, b) => a - b))) : null;
}

/** The AQI scale as a bar with a dot at the reading: the legend of the heat map, which uses the same colours and spots. */
export function AqiBar({ pm10, className }: { pm10: number; className?: string }) {
  const stops = AQI_COLORS.map((c, i) => `${c} ${(((i + 0.5) / 6) * 100).toFixed(1)}%`).join(", ");
  return (
    <span aria-hidden className={cx("relative block h-1.5 shrink-0 rounded-full", className)} style={{ background: `linear-gradient(90deg, ${stops})` }}>
      <span
        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_1.5px_rgb(0_0_0/.35)]"
        style={{ left: `${aqiPosition("pm10", pm10) * 100}%` }}
      />
    </span>
  );
}

/** Daily city PM10 averages for the sparkline; stays null (sparkline hidden) on any failure. */
function useTrend() {
  const [trend, setTrend] = useState<number[] | null>(null);
  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/air-trend", { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((v: unknown) => {
        // [{ date, value }]; the sparkline only needs the values
        const values = Array.isArray(v) ? v.map((p: { value?: unknown }) => p?.value) : [];
        if (values.length > 1 && values.every((n): n is number => typeof n === "number" && Number.isFinite(n))) setTrend(values);
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);
  return trend;
}

/** Air layer detail: city PM10 with health advice, 7-day trend, and every station, worst first. Standalone; the Explore panel mounts it. */
export function AirDetail({ data }: { data: LayerResponse }) {
  const { t, lang } = useT();
  const trend = useTrend();

  const stations = useMemo(() => stationsOf(data), [data]);
  const city = cityPm10(stations);
  const severity = city === null ? null : pm10Severity(city);

  return (
    <div className="flex flex-col gap-3">
      <GlassCard>
        <p className="t-footnote font-semibold text-label-2">{t("air.cityPm10")}</p>
        {city === null || severity === null ? (
          <p className="t-body mt-1">{t("explore.noData")}</p>
        ) : (
          <>
            <p className="t-large-title mt-1 tabular-nums">
              {city}
              <span className="t-subhead ml-0.5 font-semibold text-label-2">µg/m³</span>
            </p>
            <p className="t-headline">{t(`air.level.${severity}`)}</p>
            <AqiBar pm10={city} className="mt-3" />
            <p className="t-subhead mt-3 text-label-2">{t(`air.advice.${severity}`)}</p>
          </>
        )}
      </GlassCard>

      {trend && (
        <GlassCard>
          <p className="t-footnote font-semibold text-label-2">{t("air.trend")}</p>
          <svg viewBox="0 0 200 48" preserveAspectRatio="none" role="img" aria-label={t("air.trend")} className="mt-2 h-12 w-full">
            <polyline
              points={sparkPoints(trend, 200, 48, 3)}
              fill="none"
              stroke={aqiColor(trend[trend.length - 1])}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </GlassCard>
      )}

      <GlassCard>
        <h3 className="t-headline">{t("air.stations", { n: stations.length })}</h3>
        <ul className="mt-1">
          {stations.map((s) => (
            <li key={s.id} className="flex min-h-11 items-center gap-3 border-t-[0.5px] border-(--label)/10 first:border-t-0">
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: aqiColor(pm10Scale(s)) }} />
              <span className="t-body min-w-0 flex-1 truncate" title={pick(s.name, lang)}>
                {pick(s.name, lang)}
              </span>
              {s.official && <span className="t-caption shrink-0 text-label-2">{t("air.official")}</span>}
              {s.pm25 && <span className="t-caption shrink-0 text-label-2">{t("air.pm25")}</span>}
              <span className="min-w-8 text-right t-headline tabular-nums">{Math.round(s.value)}</span>
            </li>
          ))}
        </ul>
      </GlassCard>

      <p className="t-caption text-label-2 px-1">
        {t("common.source")}: {data.source.name}
      </p>
    </div>
  );
}
