"use client";

import { ChevronLeft } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState, type ReactNode } from "react";
import { CENTER, useMap, type LngLat } from "@/components/map/MapView";
import { featureCenter } from "@/components/map/renderLayer";
import { cx, focusRing } from "@/lib/cx";
import { pick, useT } from "@/lib/i18n";
import { formatDate, formatDistance } from "@/lib/i18n/format";
import { LAYERS, type LayerId } from "@/lib/layers";
import type { Feature, LayerResponse } from "@/lib/sources/types";
import { useLayer } from "@/lib/useLayer";
import { AirDetail, cityPm10, stationsOf } from "./AirDetail";

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

const featuresOf = (data?: LayerResponse) => (data?.features.features ?? []) as Feature[];
const isActive = (f: Feature, now = Date.now()) => !f.properties.endsAt || Date.parse(f.properties.endsAt) > now;

/** Metres between two points; an equirectangular approximation is plenty inside one city. */
function metres([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const rad = Math.PI / 180;
  const x = (lng2 - lng1) * rad * Math.cos(((lat1 + lat2) / 2) * rad);
  const y = (lat2 - lat1) * rad;
  return Math.hypot(x, y) * 6_371_000;
}

const spring = { type: "spring", stiffness: 400, damping: 30 } as const;

/** A "Today" tile. With `onOpen` a button stretched over the whole tile opens the layer's detail. */
function Card({
  id,
  title,
  loading,
  onOpen,
  openLabel,
  children,
}: {
  id: LayerId;
  title: string;
  loading: boolean;
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

/** Same number as the air detail: the median over the PM10 stations. */
function AirCard({ onOpen }: { onOpen(): void }) {
  const { t } = useT();
  const { data, loading } = useLayer("air", true);
  const city = data ? cityPm10(stationsOf(data)) : null;
  const band = city === null ? null : aqi(city);
  return (
    <Card id="air" title={t("explore.airNow")} loading={loading} onOpen={onOpen} openLabel={t("air.details")}>
      {band ? (
        <>
          <Big value={city} unit="µg/m³" />
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
    <div className="flex flex-col gap-6">
      <header className="px-1">
        <p className="t-footnote font-semibold uppercase tracking-wide text-label-2">{formatDate(new Date(), lang, { weekday: true })}</p>
        <h2 className="t-large-title text-balance">{t("explore.today")}</h2>
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        <AirCard onOpen={onOpenAir} />
        <WeatherCard />
        <OutagesCard />
        <BusCard />
      </div>
    </div>
  );
}

/**
 * Explore tab: information only, the "Today in Skopje" widgets (layer switches live in Settings).
 * The air widget pushes the air detail; Back returns focus to it.
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
