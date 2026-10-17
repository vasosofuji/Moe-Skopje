"use client";

import { ChevronLeft } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, type ReactNode } from "react";
import { LineBadge, tidyName, useDepartures } from "@/components/map/BusDepartures";
import { CENTER, useMap, type LngLat } from "@/components/map/MapView";
import { featureCenter } from "@/components/map/renderLayer";
import { LayerBadge, worstOf } from "@/components/glass/StatusBadge";
import { AQI_COLORS, aqiColor, aqiPosition, pm10Severity } from "@/lib/aqi";
import { cx, focusRing } from "@/lib/cx";
import { pick, useT, type Dict } from "@/lib/i18n";
import { formatDate, formatDistance } from "@/lib/i18n/format";
import { LAYERS, type LayerId } from "@/lib/layers";
import type { Feature, LayerResponse } from "@/lib/sources/types";
import { useLayer } from "@/lib/useLayer";
import { AirDetail, cityPm10, stationsOf } from "./AirDetail";
import { EServices } from "./EServices";
import { GoOutCard } from "./GoOutCard";
import { OutagesWidget } from "./OutagesWidget";

const featuresOf = (data?: LayerResponse) => (data?.features.features ?? []) as Feature[];

/** Metres between two points; an equirectangular approximation is plenty inside one city. */
function metres([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const rad = Math.PI / 180;
  const x = (lng2 - lng1) * rad * Math.cos(((lat1 + lat2) / 2) * rad);
  const y = (lat2 - lat1) * rad;
  return Math.hypot(x, y) * 6_371_000;
}

/** WMO weather code (Open-Meteo) → condition copy. */
export function condition(code: number): keyof Dict {
  if (code === 0) return "weather.clear";
  if (code <= 2) return "weather.partly";
  if (code === 3) return "weather.cloudy";
  if (code <= 48) return "weather.fog";
  if (code <= 57) return "weather.drizzle";
  if (code <= 67 || (code >= 80 && code <= 82)) return "weather.rain";
  if (code <= 77 || code === 85 || code === 86) return "weather.snow";
  return "weather.storm";
}

const spring = { type: "spring", stiffness: 400, damping: 30 } as const;

/** A "Today" tile. With `onOpen` a button stretched over the whole tile opens more; `data` is its layer, badged when not live. */
function Card({
  id,
  title,
  loading,
  data,
  onOpen,
  openLabel,
  children,
}: {
  id: LayerId;
  title: string;
  loading: boolean;
  data?: LayerResponse;
  onOpen?(): void;
  openLabel?: string;
  children: ReactNode;
}) {
  const { icon: Icon, color } = LAYERS[id];
  return (
    <section
      aria-busy={loading}
      className={cx(
        "relative flex min-h-[116px] min-w-0 flex-col rounded-card border-[0.5px] border-(--glass-stroke) bg-(--tile) p-3",
        onOpen && "transition-transform duration-200 has-[button:active]:scale-96 motion-reduce:has-[button:active]:scale-100",
      )}
    >
      {onOpen && (
        <button
          type="button"
          data-opens={id}
          onClick={onOpen}
          aria-label={openLabel}
          className={cx("absolute inset-0 rounded-card", focusRing)}
        />
      )}
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
          <>
            {children}
            <LayerBadge data={data} className="mt-1.5" />
          </>
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

/** The AQI scale as a bar with a dot at the reading: the legend of the heat map, which uses the same colours and spots. */
function AqiBar({ pm10 }: { pm10: number }) {
  const stops = AQI_COLORS.map((c, i) => `${c} ${(((i + 0.5) / 6) * 100).toFixed(1)}%`).join(", ");
  return (
    <span aria-hidden className="relative mt-2 block h-1.5 rounded-full" style={{ background: `linear-gradient(90deg, ${stops})` }}>
      <span
        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_1.5px_rgb(0_0_0/.35)]"
        style={{ left: `${aqiPosition("pm10", pm10) * 100}%` }}
      />
    </span>
  );
}

/** Same number as the air detail: the median over the PM10 stations. */
function AirCard({ onOpen }: { onOpen(): void }) {
  const { t } = useT();
  const { data, loading } = useLayer("air", true);
  const city = data ? cityPm10(stationsOf(data)) : null;
  return (
    <Card id="air" title={t("explore.airNow")} loading={loading} data={data} onOpen={onOpen} openLabel={t("air.details")}>
      {city !== null ? (
        <>
          <Big value={city} unit="µg/m³" />
          <p className="t-footnote flex min-w-0 items-center gap-1.5 font-medium">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: aqiColor(city) }} />
            <span className="truncate">{t(`air.level.${pm10Severity(city)}`)}</span>
          </p>
          <AqiBar pm10={city} />
        </>
      ) : (
        <Empty />
      )}
    </Card>
  );
}

function WeatherCard() {
  const { t } = useT();
  const { data, loading } = useLayer("weather", true);
  const now = featuresOf(data).find((f) => typeof f.properties.value === "number");
  const code = now?.properties.detail?.weatherCode;
  return (
    <Card id="weather" title={t("explore.weather")} loading={loading} data={data}>
      {now ? (
        <>
          <Big value={`${Math.round(now.properties.value!)}°`} />
          {typeof code === "number" && <Caption>{t(condition(code))}</Caption>}
        </>
      ) : (
        <Empty />
      )}
    </Card>
  );
}

/** "Good to go out?" from the same city PM10 as the air tile and the current weather; badged with the worse of the two layers. */
function GoOut() {
  const air = useLayer("air", true).data;
  const weatherData = useLayer("weather", true).data;
  const weather = featuresOf(weatherData).find((f) => typeof f.properties.value === "number");
  const precip = weather?.properties.detail?.precipitation;
  return (
    <GoOutCard
      source={worstOf([air, weatherData])}
      pm10={air ? cityPm10(stationsOf(air)) : null}
      tempC={weather?.properties.value ?? null}
      precipMm={typeof precip === "number" ? precip : null}
    />
  );
}

/** The next departure at the nearest stop with a timetable; tapping it opens that stop on the map. */
function BusCard() {
  const { t, lang } = useT();
  const { location, flyTo, select, reveal } = useMap();
  const { data, loading } = useLayer("buses", true);
  const from = location ?? CENTER;
  const nearest = featuresOf(data)
    .filter((f) => f.geometry.type === "Point" && f.properties.detail?.lines)
    .map((f) => ({ f, m: metres(from, featureCenter(f.geometry)) }))
    .sort((a, b) => a.m - b.m)[0];
  const stopId = nearest?.f.properties.detail?.stopId;
  const list = useDepartures(typeof stopId === "string" ? stopId : undefined);
  // The tile is narrow: "4 мин" rather than "за 4 мин".
  const when = (d: { inMin: number; at: string }) => (d.inMin <= 0 ? t("buses.now") : d.inMin < 60 ? t("age.min", { n: d.inMin }) : d.at);
  const where = location && nearest ? t("explore.distance", { d: formatDistance(nearest.m, lang) }) : t("explore.nearCentre");
  const next = list?.[0];

  return (
    <Card
      id="buses"
      title={t("explore.nextBus")}
      loading={loading || (typeof stopId === "string" && list === undefined)}
      data={data}
      onOpen={
        nearest &&
        (() => {
          flyTo(featureCenter(nearest.f.geometry), 16);
          select(nearest.f);
          reveal();
        })
      }
      openLabel={nearest && tidyName(pick(nearest.f.properties.title, lang))}
    >
      {nearest ? (
        <>
          {next ? (
            <p className="flex min-w-0 items-center gap-2">
              <LineBadge route={next.route} className="t-footnote h-6 min-w-7" />
              <span className="t-title2 truncate tabular-nums">{when(next)}</span>
            </p>
          ) : (
            <p className="t-subhead text-label-2">{t(list === null ? "buses.unavailable" : "buses.none")}</p>
          )}
          <Caption>{tidyName(pick(nearest.f.properties.title, lang))}</Caption>
          <Caption>{where}</Caption>
        </>
      ) : (
        <Empty />
      )}
    </Card>
  );
}

/** Air layer detail pushed over the Explore list, iOS style, with a back button. */
function AirView({ onBack }: { onBack(): void }) {
  const { t } = useT();
  const { data, loading } = useLayer("air", true);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        autoFocus
        onClick={onBack}
        className={cx("t-body -ml-2 flex min-h-11 items-center self-start pr-2 text-(--system-blue)", focusRing)}
      >
        <ChevronLeft size={26} strokeWidth={2.25} aria-hidden />
        {t("common.back")}
      </button>
      <h2 className="t-large-title px-1">{t("layer.air")}</h2>
      <LayerBadge data={data} className="px-1" />
      {data ? (
        <AirDetail data={data} />
      ) : loading ? (
        <span className="skeleton h-28 w-full" />
      ) : (
        <p className="t-body px-1 text-label-2">{t("explore.noData")}</p>
      )}
    </div>
  );
}

function ExploreList({ onOpenAir }: { onOpenAir(): void }) {
  const { t, lang } = useT();
  return (
    <div className="flex flex-col gap-3">
      <header className="mb-3 px-1">
        <p className="t-footnote font-semibold uppercase tracking-wide text-label-2">{formatDate(new Date(), lang, { weekday: true })}</p>
        <h2 className="t-large-title text-balance">{t("explore.today")}</h2>
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        <AirCard onOpen={onOpenAir} />
        <WeatherCard />
        <GoOut />
        <BusCard />
      </div>
      <OutagesWidget />
      <EServices />
    </div>
  );
}

/**
 * Explore tab: information widgets only (layer switches live in Settings): Today tiles, the 7-day outage schedule and
 * the e-services. The air tile pushes the air detail; Back returns focus to it.
 */
export function ExplorePanel() {
  const [view, setView] = useState<"list" | "air">("list");
  const top = useRef<HTMLDivElement>(null);
  const returning = useRef(false);

  const show = (next: "list" | "air") => {
    returning.current = next === "list";
    setView(next);
    top.current?.scrollIntoView({ block: "nearest" }); // a scrolled panel shows the new view from its top
  };

  return (
    <div ref={top}>
      <AnimatePresence mode="popLayout" initial={false}>
        {view === "air" ? (
          <motion.div key="air" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={spring}>
            <AirView onBack={() => show("list")} />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={spring}
            onAnimationComplete={() => {
              if (returning.current) top.current?.querySelector<HTMLElement>("[data-opens='air']")?.focus();
              returning.current = false;
            }}
          >
            <ExploreList onOpenAir={() => show("air")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
