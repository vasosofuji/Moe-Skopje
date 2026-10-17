"use client";

import { ChevronLeft, ExternalLink } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { LineBadge, tidyName, useDepartures } from "@/components/map/BusDepartures";
import { CENTER, useMap, type LngLat } from "@/components/map/MapView";
import { featureCenter } from "@/components/map/renderLayer";
import { LayerBadge, worstOf } from "@/components/glass/StatusBadge";
import { pm10Severity } from "@/lib/aqi";
import { cx, focusRing } from "@/lib/cx";
import { pick, useT, type Dict } from "@/lib/i18n";
import { formatDate, formatDistance } from "@/lib/i18n/format";
import { LAYERS } from "@/lib/layers";
import type { Feature, LayerResponse } from "@/lib/sources/types";
import { useLayer } from "@/lib/useLayer";
import { AirDetail, AqiBar, cityPm10, stationsOf } from "./AirDetail";
import { GoOutCard } from "./GoOutCard";
import { OutagesWidget } from "./OutagesWidget";
import { Empty, Line, Tile, Value } from "./Tile";
import { spring } from "@/lib/motion";

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


/** Same number as the air detail: the median over the PM10 stations. */
function AirCard({ onOpen }: { onOpen(): void }) {
  const { t } = useT();
  const { data, loading } = useLayer("air", true);
  const city = data ? cityPm10(stationsOf(data)) : null;
  return (
    <Tile
      icon={LAYERS.air.icon}
      title={t("explore.airNow")}
      loading={loading}
      source={data}
      onOpen={onOpen}
      openLabel={t("air.details")}
      opens="air"
    >
      {city !== null ? (
        <>
          <Value unit="µg/m³">{city}</Value>
          <Line>{t(`air.level.${pm10Severity(city)}`)}</Line>
          <AqiBar pm10={city} className="mt-auto" />
        </>
      ) : (
        <Empty />
      )}
    </Tile>
  );
}

function WeatherCard() {
  const { t } = useT();
  const { data, loading } = useLayer("weather", true);
  const now = featuresOf(data).find((f) => typeof f.properties.value === "number");
  const code = now?.properties.detail?.weatherCode;
  return (
    <Tile icon={LAYERS.weather.icon} title={t("explore.weather")} loading={loading} source={data}>
      {now ? (
        <>
          <Value>{`${Math.round(now.properties.value!)}°`}</Value>
          {typeof code === "number" && <Line>{t(condition(code))}</Line>}
        </>
      ) : (
        <Empty />
      )}
    </Tile>
  );
}

/** "Good to go out?" from the same city PM10 as the air tile and the current weather; badged with the worse of the two layers. */
function GoOut() {
  const { data: air, loading: airLoading } = useLayer("air", true);
  const { data: weatherData, loading: weatherLoading } = useLayer("weather", true);
  const weather = featuresOf(weatherData).find((f) => typeof f.properties.value === "number");
  const precip = weather?.properties.detail?.precipitation;
  return (
    <GoOutCard
      loading={airLoading || weatherLoading} // one score from both readings, not an interim one from the first to answer
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
  // One pass over every stop, redone only when the stops or the position change (not on each departures poll).
  const nearest = useMemo(() => {
    const from = location ?? CENTER;
    let best: { f: Feature; m: number } | undefined;
    for (const f of featuresOf(data)) {
      if (f.geometry.type !== "Point" || !f.properties.detail?.lines) continue;
      const m = metres(from, featureCenter(f.geometry));
      if (!best || m < best.m) best = { f, m };
    }
    return best;
  }, [data, location]);
  const stopId = nearest?.f.properties.detail?.stopId;
  const list = useDepartures(typeof stopId === "string" ? stopId : undefined);
  const where = location && nearest ? t("explore.distance", { d: formatDistance(nearest.m, lang) }) : t("explore.nearCentre");
  const name = nearest && tidyName(pick(nearest.f.properties.title, lang));
  const next = list?.[0];
  const line = next ? name : t(list === null ? "buses.unavailable" : "buses.none");

  return (
    <Tile
      icon={LAYERS.buses.icon}
      title={t("explore.nextBus")}
      loading={loading || (typeof stopId === "string" && list === undefined)}
      source={data}
      onOpen={
        nearest &&
        (() => {
          flyTo(featureCenter(nearest.f.geometry), 16);
          select(nearest.f);
          reveal();
        })
      }
      openLabel={name}
    >
      {nearest ? (
        <>
          {next ? (
            <div className="flex h-[41px] min-w-0 items-center gap-1.5">
              <LineBadge route={next.route} compact />
              {/* The tile is narrow: "4 мин" rather than "за 4 мин". */}
              {next.inMin <= 0 ? (
                <Value>{t("buses.now")}</Value>
              ) : next.inMin < 60 ? (
                <Value unit={t("unit.min")}>{next.inMin}</Value>
              ) : (
                <Value>{next.at}</Value>
              )}
            </div>
          ) : (
            <Value dim>—</Value>
          )}
          <Line title={line}>{line}</Line>
          <p className="t-footnote mt-auto truncate text-label-2">{where}</p>
        </>
      ) : (
        <Empty />
      )}
    </Tile>
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

      {/* The phone sheet's middle detent ends just under these tiles (data-detent, see BottomSheet). */}
      <div data-detent className="grid grid-cols-2 gap-2.5">
        <AirCard onOpen={onOpenAir} />
        <WeatherCard />
        <GoOut />
        <BusCard />
      </div>
      <OutagesWidget />
      <a
        href="https://uslugi.gov.mk/"
        target="_blank"
        rel="noopener noreferrer"
        className={cx(
          "flex min-h-12 items-center gap-3 rounded-card border-[0.5px] border-(--glass-stroke) bg-(--tile) px-4 active:scale-98",
          focusRing,
        )}
      >
        <span className="t-body min-w-0 flex-1 truncate">{t("eservices.title")}</span>
        <span className="t-subhead shrink-0 text-label-2">uslugi.gov.mk</span>
        <ExternalLink size={15} aria-hidden className="-ml-1 shrink-0 text-label-2" />
        <span className="sr-only">{t("eservices.opensNew")}</span>
      </a>
    </div>
  );
}

/**
 * Explore tab: information widgets only (layer switches live in Settings): Today tiles, the 7-day outage schedule and
 * a link out to the e-services portal. The air tile pushes the air detail; Back returns focus to it.
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
