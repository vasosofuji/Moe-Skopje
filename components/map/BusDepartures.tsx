"use client";

import { cx, focusRing } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import { useFetched } from "@/lib/useFetched";
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

async function readDepartures(r: Response): Promise<Departure[]> {
  if (r.status === 404) return []; // an unknown stop: a stale id after the daily feed refresh
  const list: unknown = r.ok ? await r.json() : null;
  if (!Array.isArray(list)) throw new Error(String(r.status));
  return list as Departure[];
}

/**
 * Next departures at a GTFS stop, re-read every 30 s while the tab is visible and cached, so a reopened card or tile shows
 * the last list at once. `undefined` while loading, `null` when the timetable is unavailable, `[]` for an unknown stop.
 */
export function useDepartures(stopId: string | undefined): Departure[] | null | undefined {
  return useFetched(stopId && `/api/buses/stop/${encodeURIComponent(stopId)}`, readDepartures, POLL_MS);
}

/** "3 мин" / "сега" for a departure within the hour, else its clock time. */
export function useWhen() {
  const { t } = useT();
  return (d: Departure) => (d.inMin <= 0 ? t("buses.now") : d.inMin < 60 ? t("age.min", { n: d.inMin }) : d.at);
}

/** The line number on an indigo capsule, as on the stop signs; `compact` for the narrow Today tile. */
export function LineBadge({ route, compact, className }: { route: string; compact?: boolean; className?: string }) {
  const { t } = useT();
  return (
    <span
      role="img"
      aria-label={t("buses.line", { line: route })}
      className={cx(
        "flex shrink-0 items-center justify-center bg-(--c-bus) px-1.5 font-semibold whitespace-nowrap text-white tabular-nums",
        compact ? "t-footnote h-6 min-w-7 rounded-[7px]" : "t-subhead h-7 min-w-9 rounded-[8px]",
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
        // as many rows as a full list, so the card does not grow when the timetable answers
        <div className="flex flex-col">
          {Array.from({ length: SHOWN }, (_, i) => (
            <span key={i} className="flex h-11 items-center">
              <span className="skeleton h-7 w-full" />
            </span>
          ))}
        </div>
      ) : list === null ? (
        <p className="t-subhead text-label-2">{t("buses.unavailable")}</p>
      ) : list.length === 0 ? (
        <p className="t-subhead text-label-2">{t("buses.none")}</p>
      ) : (
        <>
          <ul className="-mx-2 flex flex-col">
            {list.slice(0, SHOWN).map((d) => {
              const headsign = tidyName(d.headsign);
              return (
                <li key={d.tripId} className="[contain-intrinsic-size:auto_44px] [content-visibility:auto]">
                  <button
                    type="button"
                    onClick={() => {
                      track({ tripId: d.tripId, route: d.route, headsign: d.headsign });
                      select(null);
                    }}
                    aria-label={`${t("buses.line", { line: d.route })}, ${t("buses.toward", { headsign })}, ${when(d)}`}
                    className={cx(
                      "flex min-h-11 w-full items-center gap-3 rounded-[10px] px-2 text-left hover:bg-(--label)/5 active:scale-98",
                      focusRing,
                    )}
                  >
                    {/* a fixed slot, so the headsigns line up */}
                    <span className="flex min-w-12 shrink-0">
                      <LineBadge route={d.route} />
                    </span>
                    <span className="t-subhead min-w-0 flex-1 truncate" title={headsign}>
                      {headsign}
                    </span>
                    <span className="t-subhead min-w-12 shrink-0 text-right font-semibold tabular-nums">{when(d)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="t-caption text-label-2">{t("buses.tapDeparture")}</p>
        </>
      )}
    </section>
  );
}
