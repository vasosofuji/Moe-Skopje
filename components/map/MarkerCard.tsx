"use client";

import { Clock, ExternalLink, X } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { motion } from "motion/react";
import { useEffect, useState, type CSSProperties } from "react";
import { StatusBadge } from "@/components/glass/StatusBadge";
import { cx, focusRing } from "@/lib/cx";
import { pick, useT, type Lang } from "@/lib/i18n";
import { LAYERS, type LayerId } from "@/lib/layers";
import type { Feature } from "@/lib/sources/types";
import { cachedLayers } from "@/lib/useLayer";
import { featureCenter, SEVERITY_COLORS } from "./renderLayer";

const spring = { type: "spring", stiffness: 400, damping: 30 } as const;
const WIDTH = 320;
const GAP = 16; // between the card and the point it describes

/** The layer a feature came from, found in the layer cache. */
function layerOf(f: Feature) {
  return cachedLayers().find(({ data }) =>
    data.features.features.some((x) => x === f || x.properties?.id === f.properties.id),
  );
}

function when(f: Feature, lang: Lang): string | null {
  const { startsAt, endsAt } = f.properties;
  if (!startsAt && !endsAt) return null;
  const fmt = new Intl.DateTimeFormat(lang === "mk" ? "mk-MK" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  const valid = (s?: string) => (s && Number.isFinite(Date.parse(s)) ? new Date(s) : null);
  const [a, b] = [valid(startsAt), valid(endsAt)];
  if (a && b) return fmt.formatRange(a, b);
  return a ? fmt.format(a) : b ? `– ${fmt.format(b)}` : null;
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
  insetRight = 0,
  onClose,
}: {
  feature: Feature;
  map: MapLibreMap;
  docked: boolean;
  /** Screen space covered by side panels, which the card stays clear of. */
  insetLeft?: number;
  insetRight?: number;
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
  const accent = p.severity !== undefined ? SEVERITY_COLORS[p.severity] : (meta?.color ?? "var(--system-blue)");
  const Icon = meta?.icon;
  const time = when(feature, lang);

  // Placement: docked cards span the top of the screen; floating ones centre on the point, clamped to the free area.
  const box = map.getContainer().getBoundingClientRect();
  const half = WIDTH / 2;
  const x = Math.min(Math.max(point.x, insetLeft + GAP + half), box.width - insetRight - GAP - half);
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
        style={{ transformOrigin: origin }}
        className="glass glass-card flex max-h-[60dvh] flex-col gap-3 overflow-y-auto"
      >
        <header className="flex items-start gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: accent }}
          >
            {Icon && <Icon size={18} aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="t-headline">{pick(p.title, lang)}</h2>
            {meta && <p className="t-footnote text-label-2">{t(meta.titleKey)}</p>}
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
            {p.value}
            {p.unit && <span className="t-subhead ml-1 font-medium text-label-2">{p.unit}</span>}
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

        {p.detail && Object.keys(p.detail).length > 0 && (
          <dl className="t-subhead grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {Object.entries(p.detail).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-label-2">{k}</dt>
                <dd className="min-w-0 break-words text-right">{v}</dd>
              </div>
            ))}
          </dl>
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
