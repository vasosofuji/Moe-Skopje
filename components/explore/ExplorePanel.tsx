"use client";

import type { ReactNode } from "react";
import { CENTER, useMap, type LngLat } from "@/components/map/MapView";
import { featureCenter } from "@/components/map/renderLayer";
import { TIER1 } from "@/components/onboarding/LayerGrid";
import { pick, useT, type Lang } from "@/lib/i18n";
import { LAYERS, type LayerId } from "@/lib/layers";
import type { Feature, LayerResponse } from "@/lib/sources/types";
import { useLayer } from "@/lib/useLayer";
import { LayerRow } from "./LayerRow";

// PM10 (µg/m³) thresholds and colours, spec §6.4: ≤20 green, ≤40 yellow-green, ≤50 yellow, ≤100 orange, ≤150 red, >150 purple.
const AQI_MAX = [20, 40, 50, 100, 150];
const AQI_COLOR = [
  "var(--system-green)",
  "color-mix(in srgb, var(--system-green), var(--system-yellow))",
  "var(--system-yellow)",
  "var(--system-orange)",
  "var(--system-red)",
  "var(--system-purple)",
];
const AQI_LEVEL = [0, 0, 1, 2, 3, 3] as const; // which air.level.* copy each band uses

/** Colour band and copy level for a PM10 reading. */
export function aqi(pm10: number): { color: string; level: 0 | 1 | 2 | 3 } {
  const band = AQI_MAX.findIndex((max) => pm10 <= max);
  const i = band === -1 ? AQI_MAX.length : band;
  return { color: AQI_COLOR[i], level: AQI_LEVEL[i] };
}

const locale = (lang: Lang) => (lang === "mk" ? "mk-MK" : "en-GB");
const featuresOf = (data?: LayerResponse) => (data?.features.features ?? []) as Feature[];
const isActive = (f: Feature, now = Date.now()) => !f.properties.endsAt || Date.parse(f.properties.endsAt) > now;

/** Metres between two points; an equirectangular approximation is plenty inside one city. */
function metres([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const rad = Math.PI / 180;
  const x = (lng2 - lng1) * rad * Math.cos(((lat1 + lat2) / 2) * rad);
  const y = (lat2 - lat1) * rad;
  return Math.hypot(x, y) * 6_371_000;
}

function formatDistance(m: number, lang: Lang): string {
  const km = m >= 1000;
  return new Intl.NumberFormat(locale(lang), {
    style: "unit",
    unit: km ? "kilometer" : "meter",
    maximumFractionDigits: km ? 1 : 0,
  }).format(km ? m / 1000 : Math.round(m / 10) * 10);
}

function Card({ id, title, loading, children }: { id: LayerId; title: string; loading: boolean; children: ReactNode }) {
  const { icon: Icon, color } = LAYERS[id];
  return (
    <section
      aria-busy={loading}
      className="flex min-h-[116px] min-w-0 flex-col rounded-card border-[0.5px] border-(--glass-stroke) bg-(--tile) p-3"
    >
      <h3 className="t-footnote flex min-w-0 items-center gap-1.5 font-semibold text-label-2">
        <Icon size={15} aria-hidden className="shrink-0" style={{ color }} />
        <span className="truncate">{title}</span>
      </h3>
      <div className="mt-auto flex min-w-0 flex-col gap-0.5 pt-3">
        {loading ? (
          <>
            <span className="skeleton h-7 w-16" />
            <span className="skeleton mt-1 h-3.5 w-24" />
          </>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function Big({ value, unit }: { value: ReactNode; unit?: string }) {
  return (
    <p className="t-title2 truncate tabular-nums">
      {value}
      {unit && <span className="t-subhead ml-1 font-medium text-label-2">{unit}</span>}
    </p>
  );
}

const Caption = ({ children }: { children: ReactNode }) => <p className="t-footnote truncate text-label-2">{children}</p>;

function Empty() {
  const { t } = useT();
  return (
    <>
      <Big value={<span className="text-label-2">—</span>} />
      <Caption>{t("explore.noData")}</Caption>
    </>
  );
}

function AirCard() {
  const { t } = useT();
  const { data, loading } = useLayer("air", true);
  const values = featuresOf(data).flatMap((f) => (typeof f.properties.value === "number" ? [f.properties.value] : []));
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const band = values.length ? aqi(avg) : null;
  const unit = featuresOf(data).find((f) => f.properties.unit)?.properties.unit ?? "µg/m³";
  return (
    <Card id="air" title={t("explore.airNow")} loading={loading}>
      {band ? (
        <>
          <Big value={Math.round(avg)} unit={unit} />
          <p className="t-footnote flex min-w-0 items-center gap-1.5 font-medium">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: band.color }} />
            <span className="truncate">{t(`air.level.${band.level}`)}</span>
          </p>
        </>
      ) : (
        <Empty />
      )}
    </Card>
  );
}

function WeatherCard() {
  const { t, lang } = useT();
  const { data, loading } = useLayer("weather", true);
  const now = featuresOf(data).find((f) => typeof f.properties.value === "number");
  return (
    <Card id="weather" title={t("explore.weather")} loading={loading}>
      {now ? (
        <>
          <Big value={Math.round(now.properties.value!)} unit={now.properties.unit} />
          <Caption>{pick(now.properties.title, lang)}</Caption>
        </>
      ) : (
        <Empty />
      )}
    </Card>
  );
}

function OutagesCard() {
  const { t, lang } = useT();
  const { data, loading } = useLayer("outages-power", true);
  const active = featuresOf(data).filter((f) => isActive(f));
  // Demo data with nothing in it says nothing about the grid, so only a real response may claim "all clear".
  const known = data && (active.length > 0 || data.status !== "offline");
  return (
    <Card id="outages-power" title={t("explore.outages")} loading={loading}>
      {known ? (
        <>
          <Big value={active.length} />
          <Caption>{active.length ? pick(active[0].properties.title, lang) : t("explore.allClear")}</Caption>
        </>
      ) : (
        <Empty />
      )}
    </Card>
  );
}

function BusCard() {
  const { t, lang } = useT();
  const { location } = useMap();
  const { data, loading } = useLayer("buses", true);
  const from = location ?? CENTER;
  const nearest = featuresOf(data)
    .map((f) => ({ f, m: metres(from, featureCenter(f.geometry)) }))
    .sort((a, b) => a.m - b.m)[0];
  const where = location && nearest ? t("explore.distance", { d: formatDistance(nearest.m, lang) }) : t("explore.nearCentre");
  const p = nearest?.f.properties;
  return (
    <Card id="buses" title={t("explore.nextBus")} loading={loading}>
      {p ? (
        typeof p.value === "number" ? (
          <>
            <Big value={p.value} unit={p.unit} />
            <Caption>{pick(p.title, lang)}</Caption>
          </>
        ) : (
          <>
            <p className="t-headline truncate">{pick(p.title, lang)}</p>
            <Caption>{where}</Caption>
          </>
        )
      ) : (
        <Empty />
      )}
    </Card>
  );
}

const today = (lang: Lang) =>
  new Intl.DateTimeFormat(locale(lang), { weekday: "long", day: "numeric", month: "long" }).format(new Date());

/** Explore tab: "Today in Skopje" cards, then a switch per Tier 1 layer. */
export function ExplorePanel() {
  const { t, lang } = useT();
  return (
    <div className="flex flex-col gap-6">
      <header className="px-1">
        <p className="t-footnote font-semibold uppercase tracking-wide text-label-2">{today(lang)}</p>
        <h2 className="t-large-title text-balance">{t("explore.today")}</h2>
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        <AirCard />
        <WeatherCard />
        <OutagesCard />
        <BusCard />
      </div>

      <section aria-labelledby="explore-layers" className="flex flex-col gap-2">
        <h3 id="explore-layers" className="t-headline px-1">
          {t("explore.layers")}
        </h3>
        <ul className="divide-y-[0.5px] divide-(--label)/10 rounded-card border-[0.5px] border-(--glass-stroke) bg-(--tile)">
          {TIER1.map((id) => (
            <li key={id}>
              <LayerRow id={id} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
