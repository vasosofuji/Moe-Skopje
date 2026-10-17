"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { LayerBadge, StatusBadge, worstOf } from "@/components/glass/StatusBadge";
import { useMap } from "@/components/map/MapView";
import { cx, focusRing } from "@/lib/cx";
import { useT, type Lang } from "@/lib/i18n";
import { formatDate, formatWhen, skopjeTime, weekdayShort } from "@/lib/i18n/format";
import { LAYERS, type LayerId } from "@/lib/layers";
import type { OutageDay, OutageItem, OutageType } from "@/lib/server/outages";
import { activeNow } from "./activeNow";

const REFRESH_MS = 5 * 60_000;
const TYPES: OutageType[] = ["power", "water", "heating"];
const LAYER: Record<OutageType, LayerId> = { power: "outages-power", water: "outages-water", heating: "outages-heating" };

/** GET /api/outages?days=7, re-read every 5 minutes. `undefined` while loading, `null` when it failed. */
function useOutageDays(): OutageDay[] | null | undefined {
  const [days, setDays] = useState<OutageDay[] | null>();
  useEffect(() => {
    const ac = new AbortController();
    const load = () =>
      fetch("/api/outages?days=7", { signal: ac.signal })
        .then((r) => (r.ok ? (r.json() as Promise<{ days: OutageDay[] }>) : Promise.reject(new Error(String(r.status)))))
        .then((body) => setDays(Array.isArray(body.days) ? body.days : null))
        .catch(() => !ac.signal.aborted && setDays((d) => d ?? null));
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      ac.abort();
      clearInterval(id);
    };
  }, []);
  return days;
}

/** "14:00–23:00" for an outage inside one day, the full span otherwise. */
function span(item: OutageItem, lang: Lang): string {
  const [a, b] = [new Date(item.startsAt), new Date(item.endsAt)];
  return formatDate(a, lang) === formatDate(b, lang) ? `${skopjeTime(a)}–${skopjeTime(b)}` : (formatWhen(item.startsAt, item.endsAt, lang) ?? "");
}

const dayDate = (date: string) => new Date(`${date}T12:00:00Z`); // midday UTC is the same calendar day in Skopje

/**
 * "Outages" widget: planned water, power and heating outages for the next 7 days. A strip of day chips (each with the
 * count and a bar split by type) picks the day; tapping an outage flies to its streets and highlights them on the map.
 */
export function OutagesWidget() {
  const { t, lang } = useT();
  const days = useOutageDays();
  const [picked, setPicked] = useState(0);
  const { showArea, reveal, highlight, setHighlight } = useMap();
  const day = days?.[picked];
  // Today's list also holds outages that only start later today; "under way" counts just the ones whose window contains now.
  const active = activeNow(days?.[0]?.items ?? []).length;
  // Macedonian takes the singular after 1, 21, 31… (not 11); English only after 1.
  const one = (n: number) => (lang === "mk" ? n % 10 === 1 && n % 100 !== 11 : n === 1);
  const count = (n: number) => t(one(n) ? "outages.count.one" : "outages.count.other", { n });

  return (
    <section aria-busy={days === undefined} className="rounded-card border-[0.5px] border-(--glass-stroke) bg-(--tile) p-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <h3 className="t-headline">{t("outages.title")}</h3>
        {/* demo or stale items anywhere in the week taint the counts too, so the widget says so up front */}
        <LayerBadge data={worstOf(days?.flatMap((d) => d.items) ?? [])} />
      </div>
      {active > 0 && <p className="t-footnote px-1 text-label-2">{t("outages.activeNow", { n: active })}</p>}

      {days === undefined ? (
        <div className="mt-3 flex flex-col gap-2">
          <span className="skeleton h-14" />
          <span className="skeleton h-11" />
        </div>
      ) : days === null || days.length === 0 ? (
        <p className="t-subhead mt-1 px-1 text-label-2">{t("explore.noData")}</p>
      ) : (
        <>
          <div role="group" aria-label={t("outages.days")} className="mt-3 grid grid-cols-7 gap-0.5 rounded-[12px] bg-(--label)/6 p-0.5">
            {days.map((d, i) => {
              const on = i === picked;
              const n = d.items.length;
              const label = i === 0 ? t("outages.today") : weekdayShort(d.date, lang);
              return (
                <button
                  key={d.date}
                  type="button"
                  aria-pressed={on}
                  aria-label={`${formatDate(dayDate(d.date), lang, { weekday: true })}: ${count(n)}`}
                  onClick={() => setPicked(i)}
                  className={cx(
                    "flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[10px] transition-colors",
                    focusRing,
                    on && "bg-(--thumb) shadow-[0_3px_8px_rgb(0_0_0/.12),0_1px_1px_rgb(0_0_0/.06)]",
                  )}
                >
                  <span className={cx("max-w-full truncate text-[11px] leading-4 font-medium tracking-[-0.2px]", on ? "text-label" : "text-label-2")}>
                    {label}
                  </span>
                  <span className={cx("t-headline tabular-nums", !n && "text-label-2")}>{n || "–"}</span>
                  {/* the day's outages by type, as a split bar */}
                  <span aria-hidden className="flex h-1 w-6 overflow-hidden rounded-full">
                    {TYPES.map((type) => {
                      const k = d.items.filter((x) => x.type === type).length;
                      return k ? <span key={type} style={{ flexGrow: k, background: LAYERS[LAYER[type]].color }} /> : null;
                    })}
                  </span>
                </button>
              );
            })}
          </div>

          {day && day.items.length === 0 ? (
            <p className="t-subhead px-1 pt-3 pb-1 text-label-2">{t("outages.none")}</p>
          ) : (
            <ul className="mt-2 flex flex-col">
              {day?.items.map((item) => {
                const on = highlight?.id === item.id;
                return (
                  <li key={item.id} className="border-t-[0.5px] border-(--label)/10 first:border-t-0">
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        if (on) return setHighlight(null);
                        setHighlight({ id: item.id, layer: LAYER[item.type] });
                        showArea(item.bbox);
                        reveal();
                      }}
                      style={{ "--c": LAYERS[LAYER[item.type]].color } as CSSProperties}
                      className={cx(
                        "my-0.5 flex min-h-11 w-full items-start gap-2.5 rounded-[10px] px-1 py-2 text-left transition-colors",
                        focusRing,
                        on ? "bg-[color-mix(in_srgb,var(--c)_14%,transparent)]" : "hover:bg-(--label)/5",
                      )}
                    >
                      <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-(--c)" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-baseline gap-2">
                          <span className="t-subhead min-w-0 flex-1 truncate font-semibold">
                            {t(`outages.type.${item.type}`)} · {item.municipality}
                          </span>
                          <span className="t-footnote shrink-0 text-label-2 tabular-nums">{span(item, lang)}</span>
                        </span>
                        <span className="t-footnote line-clamp-2 text-label-2">{item.streets.join(", ")}</span>
                        {/* the item carries its layer's status but not its age, so a stale badge has none */}
                        {item.status !== "live" && (
                          <span className="mt-1 self-start">
                            <StatusBadge status={item.status} updatedAt="" />
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
