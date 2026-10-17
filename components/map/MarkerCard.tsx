"use client";

import { Clock, ExternalLink, X } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { motion } from "motion/react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { StatusBadge } from "@/components/glass/StatusBadge";
import { cx, focusRing } from "@/lib/cx";
import { pick, useT, type Dict, type Lang } from "@/lib/i18n";
import { formatWhen } from "@/lib/i18n/format";
import { LAYERS, type LayerId } from "@/lib/layers";
import type { Feature } from "@/lib/sources/types";
import { cachedLayers } from "@/lib/useLayer";
import { colorFor, metricOf } from "@/lib/aqi";
import { BusDepartures, tidyName } from "./BusDepartures";
import { featureCenter, SEVERITY_COLORS } from "./renderLayer";
import { spring } from "@/lib/motion";

const WIDTH = 320;
const GAP = 16; // between the card and the point it describes

/** The layer a feature came from, found in the layer cache. */
function layerOf(f: Feature) {
  return cachedLayers().find(({ data }) =>
    data.features.features.some((x) => x === f || x.properties?.id === f.properties.id),
  );
}

type Unit = { mk: string; en: string };
const u = (mk: string, en = mk): Unit => ({ mk, en });

/**
 * Detail keys worth showing, in display order, with a label and unit. Everything else in `detail` (OSM ids and tags,
 * flags, JSON blobs) stays out of the card; the pharmacy flags get a chip and a note instead.
 */
const FIELDS: [key: string, label: keyof Dict, unit?: Unit][] = [
  ["pm10", "detail.pm10", u("µg/m³")],
  ["pm25", "air.pm25", u("µg/m³")],
  ["no2", "detail.no2", u("µg/m³")],
  ["o3", "detail.o3", u("µg/m³")],
  ["noise", "detail.noise", u("dB")],
  ["temperature", "detail.temperature", u("°C")],
  ["apparent", "detail.apparent", u("°C")],
  ["precipitation", "detail.precipitation", u("мм", "mm")],
  ["wind", "detail.wind", u("км/ч", "km/h")],
  ["depthKm", "detail.depth", u("км", "km")],
  ["streets", "detail.streets"],
  ["cause", "detail.cause"],
  ["lines", "detail.lines"],
  ["municipality", "detail.municipality"],
  ["addr_street", "detail.address"],
  ["opening_hours", "detail.hours"],
  ["phone", "detail.phone"],
  ["website", "detail.website"],
  ["operator", "detail.operator"],
  ["capacity", "detail.capacity"],
  ["fee", "detail.fee"],
];

/** Units adapters write in Macedonian, in the reader's language. */
const UNITS: Record<string, Unit> = { "МКД/час": u("ден./час", "MKD/h") };

/** The card's accent: the air band, the parking zone's own colour, the outage type, otherwise severity or the layer colour. */
function accentOf(p: Feature["properties"], layerColor?: string): string {
  const d = p.detail ?? {};
  if (p.kind === "air-station" && typeof p.value === "number") return colorFor(metricOf(d), p.value);
  if (p.kind === "parking-zone" && typeof d.color === "string") return d.color;
  if (p.kind === "outage" && layerColor) return layerColor;
  return p.severity !== undefined ? SEVERITY_COLORS[p.severity] : (layerColor ?? "var(--system-blue)");
}

const httpUrl = (v: string) => {
  try {
    const url = new URL(v);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
};

const linkClass = cx("text-(--system-blue)", focusRing);

/** One detail value in the reader's language: decimal comma in Macedonian, yes/no translated, links where they help. */
function detailValue(key: string, v: string | number, d: Record<string, string | number>, t: (k: keyof Dict) => string, lang: Lang, unit?: Unit): ReactNode {
  if (typeof v === "number") return `${lang === "mk" ? String(v).replace(".", ",") : v}${unit ? ` ${unit[lang]}` : ""}`;
  if (key === "fee") return v === "no" ? t("detail.no") : t("detail.yes");
  if (key === "lines") return v.split(",").join(", ");
  if (key === "addr_street") return d.addr_housenumber ? `${v} ${d.addr_housenumber}` : v;
  if (key === "phone") return <a href={`tel:${v.replace(/[^\d+]/g, "")}`} className={linkClass}>{v}</a>;
  const url = key === "website" ? httpUrl(v) : null;
  if (url) return <a href={url.href} target="_blank" rel="noreferrer" className={linkClass}>{url.hostname.replace(/^www\./, "")}</a>;
  return v;
}

/**
 * Details of the selected feature. On desktop it floats above (or below) the feature and follows it as the map moves;
 * on phones it docks under the search pill. Either way it scales in from the feature's point.
 * Remount it per feature (key) so it measures the new point.
 */
export function MarkerCard({
  feature,
  map,
  docked,
  insetLeft = 0,
  onClose,
}: {
  feature: Feature;
  map: MapLibreMap;
  docked: boolean;
  /** Screen width covered by the sidebar, which the card stays clear of. */
  insetLeft?: number;
  onClose(): void;
}) {
  const { t, lang } = useT();
  const [lng, lat] = featureCenter(feature.geometry);
  const [point, setPoint] = useState(() => map.project([lng, lat]));

  useEffect(() => {
    const follow = () => setPoint(map.project([lng, lat]));
    map.on("move", follow);
    return () => {
      map.off("move", follow);
    };
  }, [map, lng, lat]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const layer = layerOf(feature);
  const meta = layer && LAYERS[layer.id as LayerId];
  const p = feature.properties;
  const accent = accentOf(p, meta?.color);
  const whiteAccent = accent.toUpperCase() === "#FFFFFF"; // parking zone D
  const title = p.kind === "bus-stop" ? tidyName(pick(p.title, lang)) : pick(p.title, lang);
  const unit = p.unit && (UNITS[p.unit]?.[lang] ?? p.unit);
  const Icon = meta?.icon;
  const d = p.detail ?? {};
  const time = formatWhen(p.startsAt, p.endsAt, lang);
  const rows = FIELDS.filter(([k]) => d[k] !== undefined && d[k] !== "");

  // Placement: docked cards span the top of the screen; floating ones centre on the point, clamped to the free area.
  const box = map.getContainer().getBoundingClientRect();
  const half = WIDTH / 2;
  const x = Math.min(Math.max(point.x, insetLeft + GAP + half), box.width - GAP - half);
  const below = point.y < 280; // not enough room above the point
  const style: CSSProperties = docked
    ? {}
    : {
        left: x,
        top: point.y,
        width: WIDTH,
        transform: `translate(-50%, ${below ? `${GAP}px` : `calc(-100% - ${GAP}px)`})`,
      };
  const origin = docked ? `${point.x - 12}px 0px` : `${point.x - x + half}px ${below ? "0%" : "100%"}`;
  // A floating card never runs off the screen: it gets the room between the point and the edge, and scrolls inside.
  const room = Math.round((below ? box.height - point.y : point.y) - GAP - 16);
  const maxHeight = docked ? undefined : `min(60dvh, ${Math.max(160, room)}px)`;

  return (
    <div
      style={style}
      className={cx(
        "fixed z-30",
        docked && "inset-x-3 top-[calc(env(safe-area-inset-top)+68px)] mx-auto max-w-[420px]",
      )}
    >
      <motion.article
        aria-label={pick(p.title, lang)}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.6 }}
        transition={spring}
        style={{ transformOrigin: origin, maxHeight }}
        className="glass glass-card flex max-h-[60dvh] flex-col gap-3 overflow-y-auto"
      >
        <header className="flex items-start gap-3">
          <span
            className={cx(
              "flex size-9 shrink-0 items-center justify-center rounded-full",
              whiteAccent ? "text-black/70 ring-[0.5px] ring-black/20" : "text-white",
            )}
            style={{ background: accent }}
          >
            {Icon && <Icon size={18} aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="t-headline">{title}</h2>
            {meta && <p className="t-footnote text-label-2">{t(meta.titleKey)}</p>}
            {d.onDuty === 1 && (
              <span className="t-caption mt-1 inline-flex h-6 items-center rounded-full bg-(--system-green)/15 px-2 text-(--system-green)">
                {t("marker.onDuty")}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className={cx("-m-1.5 flex size-11 shrink-0 items-center justify-center rounded-full", focusRing)}
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-(--label)/8 text-label-2">
              <X size={15} strokeWidth={2.5} aria-hidden />
            </span>
          </button>
        </header>

        {p.value !== undefined && (
          <p className="t-title2 tabular-nums">
            {lang === "mk" ? String(p.value).replace(".", ",") : p.value}
            {unit && <span className="t-subhead ml-1 font-medium text-label-2">{unit}</span>}
          </p>
        )}

        {time && (
          <p className="t-subhead flex items-center gap-2">
            <Clock size={15} aria-hidden className="shrink-0 text-label-2" />
            <span>
              <span className="sr-only">{t("marker.when")}: </span>
              {time}
            </span>
          </p>
        )}

        {rows.length > 0 && (
          <dl className="t-subhead grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {rows.map(([k, label, unit]) => (
              <div key={k} className="contents">
                <dt className="text-label-2">{t(label)}</dt>
                <dd className="min-w-0 break-words text-right">{detailValue(k, d[k], d, t, lang, unit)}</dd>
              </div>
            ))}
          </dl>
        )}

        {d.approx === 1 && <p className="t-footnote text-label-2">{t("marker.approx")}</p>}

        {p.kind === "bus-stop" && (
          <BusDepartures stopId={typeof d.stopId === "string" ? d.stopId : undefined} />
        )}

        {layer && (
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t-[0.5px] border-(--label)/10 pt-3">
            <StatusBadge status={layer.data.status} updatedAt={layer.data.updatedAt} />
            {layer.data.source.url ? (
              <a
                href={layer.data.source.url}
                target="_blank"
                rel="noreferrer"
                className={cx("t-footnote flex min-h-11 items-center gap-1 text-(--system-blue)", focusRing)}
              >
                {t("common.source")}: {layer.data.source.name}
                <ExternalLink size={13} aria-hidden />
              </a>
            ) : (
              <span className="t-footnote text-label-2">
                {t("common.source")}: {layer.data.source.name}
              </span>
            )}
          </footer>
        )}
      </motion.article>
    </div>
  );
}
