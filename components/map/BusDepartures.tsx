"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { cx, focusRing } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import { useMap } from "./MapView";

/** One row of GET /api/buses/stop/[stopId]. */
export type Departure = { tripId: string; route: string; headsign: string; at: string; inMin: number };

const POLL_MS = 30_000;
const SHOWN = 6;
// Small words stay lower case inside a name ("Дом на печат"), in Cyrillic and in the Latin transliteration.
const SMALL = new Set(["на", "кон", "и", "во", "од", "до", "за", "na", "kon", "i", "vo", "od", "do", "za"]);

/** GTFS names are all caps ("ДОМ НА ПЕЧАТ"); this gives "Дом на Печат". Names that are not all caps are left alone. */
export function tidyName(s: string): string {
  if (s !== s.toUpperCase()) return s;
  let first = true;
  return s.toLowerCase().replace(/\p{L}+/gu, (w) => {
    const keep = !first && SMALL.has(w);
    first = false;
    return keep ? w : w[0].toUpperCase() + w.slice(1);
  });
}

/**
 * Next departures at a GTFS stop, re-read every 30 s while the tab is visible. `undefined` while loading,
 * `null` when the timetable is unavailable; an unknown stop (a stale id after the daily feed refresh) is an empty list.
 */
export function useDepartures(stopId: string | undefined): Departure[] | null | undefined {
  const [state, setState] = useState<{ stopId?: string; list: Departure[] | null }>();
  useEffect(() => {
    if (!stopId) return;
    const ac = new AbortController();
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/buses/stop/${encodeURIComponent(stopId)}`, { signal: ac.signal })
        .then(async (r) => (r.ok ? ((await r.json()) as Departure[]) : r.status === 404 ? [] : null))
        .then((list) => setState({ stopId, list: Array.isArray(list) ? list : null }))
        .catch(() => !ac.signal.aborted && setState((s) => (s && s.stopId === stopId ? s : { stopId, list: null })));
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      ac.abort();
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [stopId]);
  return state && state.stopId === stopId ? state.list : undefined;
}

/** "за 3 мин" / "сега" for a departure within the hour, else its clock time. */
export function useWhen() {
  const { t } = useT();
  return (d: Departure) => (d.inMin <= 0 ? t("buses.now") : d.inMin < 60 ? t("buses.inMin", { n: d.inMin }) : d.at);
}

/** The line number on an indigo capsule, as on the stop signs. */
export function LineBadge({ route, className }: { route: string; className?: string }) {
  const { t } = useT();
  return (
    <span
      role="img"
      aria-label={t("buses.line", { line: route })}
      className={cx(
        "t-subhead flex h-7 min-w-9 shrink-0 items-center justify-center rounded-[8px] bg-(--c-bus) px-1.5 font-semibold whitespace-nowrap text-white tabular-nums",
        className,
      )}
    >
      {route}
    </span>
  );
}

/**
 * Next departures at a bus stop from the GTFS timetable; tapping one follows that bus on the map.
 * The MarkerCard mounts it for `kind: "bus-stop"`. A stop without a GTFS id (the OSM fallback layer) shows nothing.
 */
export function BusDepartures({ stopId }: { stopId?: string }) {
  const { t } = useT();
  const { track, select } = useMap();
  const list = useDepartures(stopId);
  const when = useWhen();
  if (!stopId) return null;

  return (
    <section aria-busy={list === undefined} className="flex flex-col gap-1">
      <h3 className="t-footnote font-semibold text-label-2">{t("buses.next")}</h3>
      {list === undefined ? (
        <div className="flex flex-col gap-2 py-1">
          <span className="skeleton h-9" />
          <span className="skeleton h-9" />
        </div>
      ) : list === null ? (
        <p className="t-subhead text-label-2">{t("buses.unavailable")}</p>
      ) : list.length === 0 ? (
        <p className="t-subhead text-label-2">{t("buses.none")}</p>
      ) : (
        <>
          <ul className="-mx-2 flex flex-col">
            {list.slice(0, SHOWN).map((d) => (
              <li key={d.tripId}>
                <button
                  type="button"
                  onClick={() => {
                    track({ tripId: d.tripId, route: d.route, headsign: d.headsign });
                    select(null);
                  }}
                  className={cx(
                    "flex min-h-11 w-full items-center gap-3 rounded-[10px] px-2 text-left transition-colors hover:bg-(--label)/5 active:bg-(--label)/8",
                    focusRing,
                  )}
                >
                  <LineBadge route={d.route} />
                  <span className="t-subhead min-w-0 flex-1 truncate">{t("buses.toward", { headsign: tidyName(d.headsign) })}</span>
                  <span className="t-subhead shrink-0 font-semibold tabular-nums">{when(d)}</span>
                  <ChevronRight size={16} aria-hidden className="-mr-1 shrink-0 text-label-2" />
                </button>
              </li>
            ))}
          </ul>
          <p className="t-caption text-label-2">{t("buses.tapDeparture")}</p>
        </>
      )}
    </section>
  );
}
