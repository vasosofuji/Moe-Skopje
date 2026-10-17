"use client";

import { X } from "lucide-react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useEffectEvent, useRef, useState, type CSSProperties } from "react";
import { cx, focusRing } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import { LineBadge, tidyName } from "./BusDepartures";
import { cssColor, useMap, type LngLat, type Trip } from "./MapView";
import { removeOverlay, setOverlay, TRIP_LAYERS } from "./renderLayer";
import { spring } from "@/lib/motion";

/** GET /api/buses/trip/[tripId]. */
type Fix = { source: "live" | "estimated"; lng: number; lat: number; bearing?: number; updatedAt: string; shape?: GeoJSON.LineString };

const POLL_MS = 10_000;
const JUMP_DEG = 0.02; // about 2 km: further than a bus goes between two fixes, so move there without gliding

/**
 * Follows one trip on the map: its route drawn faintly, a glass bus marker with the line number gliding between the 10 s
 * fixes, and a small panel saying whether the position is live GPS or estimated from the timetable. Remount per trip (key).
 * The parent places the panel (AppShell: under the search row on phones, top of the free map area on wider screens).
 */
export function BusTracker({
  trip,
  map,
  onClose,
}: {
  trip: Trip;
  map: MapLibreMap;
  onClose(): void;
}) {
  const { t } = useT();
  const { flyTo } = useMap();
  const reduceMotion = useReducedMotion();
  const [fix, setFix] = useState<Fix | null>(null);
  const [shape, setShape] = useState<GeoJSON.LineString | null>(null);
  const marker = useRef<Marker | null>(null);
  const ended = useEffectEvent(onClose);
  const follow = useEffectEvent((at: LngLat) => flyTo(at, 15));

  // A fix every 10 s. A trip the feed no longer knows (404) has ended; a failed request keeps the last position.
  useEffect(() => {
    const ac = new AbortController();
    let first = true;
    const tick = () =>
      fetch(`/api/buses/trip/${encodeURIComponent(trip.tripId)}`, { signal: ac.signal })
        .then(async (r) => {
          if (r.status === 404) return ended();
          if (!r.ok) return;
          const f = (await r.json()) as Fix;
          if (!Number.isFinite(f.lng) || !Number.isFinite(f.lat)) return;
          setFix(f);
          if (f.shape?.type === "LineString") setShape((s) => s ?? f.shape!);
          if (first) follow([f.lng, f.lat]);
          first = false;
        })
        .catch(() => {});
    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      ac.abort();
      clearInterval(id);
    };
  }, [trip.tripId]);

  // The route, faint, under everything else; drawn again after a theme switch reloads the style.
  useEffect(() => {
    if (!shape) return;
    const draw = () => {
      try {
        const feature: GeoJSON.Feature = { type: "Feature", geometry: shape, properties: { color: cssColor("var(--c-bus)") } };
        setOverlay(map, "src-trip", { type: "FeatureCollection", features: [feature] }, TRIP_LAYERS);
      } catch {
        // style still loading; its style.load calls draw again
      }
    };
    draw();
    map.on("style.load", draw);
    return () => {
      map.off("style.load", draw);
      try {
        removeOverlay(map, "src-trip", TRIP_LAYERS);
      } catch {
        // the map is already gone
      }
    };
  }, [map, shape]);

  // The bus marker: created on the first fix, then glides to each new fix over the polling interval.
  const label = t("buses.line", { line: trip.route });
  useEffect(() => {
    if (!fix) return;
    const to: LngLat = [fix.lng, fix.lat];
    const m = marker.current;
    if (!m) {
      let cancelled = false;
      void import("maplibre-gl").then(({ Marker }) => {
        if (cancelled || marker.current) return;
        const el = document.createElement("div");
        el.className = "bus-marker";
        el.textContent = trip.route;
        el.setAttribute("role", "img");
        el.setAttribute("aria-label", label);
        marker.current = new Marker({ element: el }).setLngLat(to).addTo(map);
      });
      return () => {
        cancelled = true;
      };
    }
    const from = m.getLngLat();
    if (reduceMotion || Math.hypot(to[0] - from.lng, to[1] - from.lat) > JUMP_DEG) {
      m.setLngLat(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / POLL_MS);
      m.setLngLat([from.lng + (to[0] - from.lng) * k, from.lat + (to[1] - from.lat) * k]);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [map, fix, trip.route, label, reduceMotion]);

  useEffect(
    () => () => {
      marker.current?.remove();
      marker.current = null;
    },
    [],
  );

  const live = fix?.source === "live";

  return (
    <motion.section
      aria-label={t("buses.tracking")}
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={spring}
      className="glass pointer-events-auto flex w-full max-w-(--float-w) shrink-0 items-center gap-1 rounded-card p-1.5 pl-2.5"
    >
      <button
        type="button"
        onClick={() => fix && flyTo([fix.lng, fix.lat], 15)}
        className={cx("flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-[10px] text-left", focusRing)}
      >
        <LineBadge route={trip.route} />
        <span className="flex min-w-0 flex-col items-start">
          <span className="t-subhead w-full truncate font-semibold">{t("buses.toward", { headsign: tidyName(trip.headsign) })}</span>
          {fix ? (
            <span
              className="t-caption mt-0.5 inline-flex h-5 max-w-full items-center gap-1.5 rounded-full bg-(--badge)/15 px-2"
              style={{ "--badge": live ? "var(--system-green)" : "var(--system-gray)" } as CSSProperties}
            >
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-(--badge)" />
              <span className="truncate">{t(live ? "buses.live" : "buses.estimated")}</span>
            </span>
          ) : (
            <span className="t-caption text-label-2">{t("buses.locating")}</span>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("buses.stopTracking")}
        className={cx("flex size-11 shrink-0 items-center justify-center rounded-full", focusRing)}
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-(--label)/8 text-label-2">
          <X size={15} strokeWidth={2.5} aria-hidden />
        </span>
      </button>
    </motion.section>
  );
}
