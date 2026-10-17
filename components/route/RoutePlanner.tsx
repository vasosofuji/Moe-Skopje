"use client";

import {
  ArrowUpDown,
  Bike,
  Car,
  ExternalLink,
  Footprints,
  House,
  LocateFixed,
  Map as MapGlyph,
  MapPin,
  MapPinPlus,
  Signpost,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import type { MapMouseEvent, Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useEffectEvent, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode, type SetStateAction } from "react";
import { useMap, type LngLat } from "@/components/map/MapView";
import { cx, focusRing } from "@/lib/cx";
import { pick, useT, type Dict, type Lang } from "@/lib/i18n";
import { translate } from "@/lib/i18n/core";
import { formatDistance } from "@/lib/i18n/format";
import type { Mode } from "@/lib/routing";
import { useKeepInView } from "@/lib/useKeepInView";
import { loadRecents, pushRecent } from "./recents";
import { clearRoute, drawRoute, lineBounds } from "./routeLayer";

export type PlaceKind = "poi" | "address" | "street" | "area";
/** One row of GET /api/places, as the planner shows it. */
export type Place = { id: string; name: string; kind: PlaceKind; sub?: string; lng: number; lat: number };

/** A start or end: the user's position (resolved when it is known) or a fixed point with what its field shows. */
type End = { mine: true } | { label: string; at: LngLat };
type Which = "from" | "to";
type Brief = { id: string; title: { mk: string; en: string } };
type Result = {
  geometry: GeoJSON.LineString;
  distanceM: number;
  durationS: number;
  detourM: number;
  avoided: Brief[];
  unavoidable: Brief[];
  googleMapsUrl: string;
  wazeUrl: string;
};
/** The route for one request key: either an answer or an error. */
type Outcome = { key: string; result?: Result; error?: keyof Dict };

const MODE_OPTIONS: { value: Mode; key: keyof Dict; icon: LucideIcon }[] = [
  { value: "auto", key: "route.mode.auto", icon: Car },
  { value: "bicycle", key: "route.mode.bicycle", icon: Bike },
  { value: "pedestrian", key: "route.mode.pedestrian", icon: Footprints },
];

const KIND_ICON: Record<PlaceKind, LucideIcon> = { poi: MapPin, address: House, street: Signpost, area: MapGlyph };

/** POST /api/route error code → copy. */
const ERRORS: Record<string, keyof Dict> = {
  bbox: "route.error.bbox",
  noroute: "route.error.noroute",
  rate: "route.error.rate",
  router: "route.error.router",
  input: "route.error.same", // the body is valid by construction, so the only input error left is two points too close together
};

const DEBOUNCE_MS = 200;
const MIN_QUERY = 2; // the endpoint answers 400 below this

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

/** One row of GET /api/places, checked (it comes off the network). The second line is the address, else the district. */
export function toPlace(raw: unknown, lang: Lang): Place | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.name !== "string" || !Number.isFinite(r.lng) || !Number.isFinite(r.lat)) return null;
  const kind: PlaceKind = r.kind === "poi" || r.kind === "address" || r.kind === "street" ? r.kind : "area";
  const name = (lang === "en" && str(r.nameEn)) || r.name;
  const lng = r.lng as number;
  const lat = r.lat as number;
  return { id: str(r.id) ?? `${kind}:${name}:${lng},${lat}`, name, kind, sub: str(r.address) ?? str(r.area) ?? str(r.category), lng, lat };
}

/** "41.99812, 21.42540": what a point set on the map is called until (or unless) the reverse lookup names it. */
export const coords = ([lng, lat]: LngLat) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

/** "12 мин" / "1 ч 5 мин": the trip time as the summary's big line. */
export function durationText(durationS: number, lang: Lang): string {
  const min = Math.max(1, Math.round(durationS / 60));
  if (min < 60) return translate(lang, "route.min", { min });
  const h = Math.floor(min / 60);
  return min % 60 ? translate(lang, "route.hourMin", { h, min: min % 60 }) : translate(lang, "route.hour", { h });
}

/** The summary's second line after the distance: how many closures the route steers around. */
export function avoidsText(avoided: number, lang: Lang): string {
  return avoided === 0 ? translate(lang, "route.noClosures") : avoided === 1 ? translate(lang, "route.avoidsOne") : translate(lang, "route.avoidsMany", { n: avoided });
}

/** Errors worth a second try; the others would only repeat themselves. */
const RETRYABLE: ReadonlySet<keyof Dict> = new Set(["route.error.router", "route.error.rate", "route.error.network", "common.error"]);

const SLOW_MS = 300; // a spinner is only worth showing for a wait the user would notice

const linkButton = cx("t-subhead flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-full px-4 font-semibold select-none", focusRing);

/** True once `on` has held for `ms`; false again the moment it ends. */
function useAfter(on: boolean, ms: number) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!on) return;
    const id = setTimeout(() => setLate(true), ms);
    return () => {
      clearTimeout(id);
      setLate(false);
    };
  }, [on, ms]);
  return on && late;
}

function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cx("block size-4 shrink-0 rounded-full border-2 border-(--label)/15 border-t-(--label-2) motion-safe:animate-spin", className)} />;
}

type Option = { key: string; icon: LucideIcon; tint?: string; title: string; sub?: string; run(): void };

/**
 * Route planner, Apple Maps style: start and end stacked in one grouped card with a swap button, travel modes as equal
 * chips, and the route (found as soon as both ends are set) with a summary card: trip time, distance, the closed streets
 * it avoids and hand-offs to Google Maps and Waze. A focused field lists "My location", "Set on map" and the places last
 * picked at once, or real places once two letters are typed (GET /api/places, 200 ms debounce, arrow keys and Enter) in a
 * list of fixed height, so nothing moves while results arrive. The route is drawn while this is mounted and removed when
 * it unmounts. `bar`: above the desktop chat bar; `panel`: in the phone sheet or the tablet sidebar. `insetLeft` is the
 * screen width the sidebar covers, used with the planner's own height to frame the route in the free part of the map.
 */
export function RoutePlanner({
  variant,
  insetLeft = 0,
  onClose,
  onPicking,
  onEditing,
}: {
  variant: "bar" | "panel";
  insetLeft?: number;
  onClose(): void;
  /** The map is being tapped for a point (true) or that ended (false); a phone sheet drops out of the way. */
  onPicking?(on: boolean): void;
  /** A field is being typed in (true) or that ended; a phone sheet rises so the suggestions fit. */
  onEditing?(on: boolean): void;
}) {
  const { t, lang } = useT();
  const { map, location, locate, select } = useMap();
  const [from, setFrom] = useState<End | null>({ mine: true });
  const [to, setTo] = useState<End | null>(null);
  const [mode, setMode] = useState<Mode>("auto");
  const [editing, setEditing] = useState<Which | null>(null);
  const [text, setText] = useState("");
  const [found, setFound] = useState<{ q: string; places: Place[] }>({ q: "", places: [] });
  const [recents, setRecents] = useState(loadRecents);
  const [active, setActive] = useState(0);
  const [picking, setPicking] = useState<Which | null>(null);
  const [outcome, setOutcome] = useState<Outcome>({ key: "" });
  const [attempt, setAttempt] = useState(0);
  const root = useRef<HTMLElement>(null);
  const listId = useId();

  const myLocation = t("map.myLocation");
  const labelOf = (e: End | null) => (!e ? "" : "mine" in e ? myLocation : e.label);
  const resolve = (e: End | null): LngLat | null => (!e ? null : "mine" in e ? (location ?? null) : e.at);
  const a = resolve(from);
  const b = resolve(to);
  const key = a && b ? `${a.join()}|${b.join()}|${mode}|${attempt}` : "";
  // The last answer stays on screen (dimmed) while the next one is on its way, so a mode change or a swap moves nothing.
  const busy = key !== "" && outcome.key !== key;
  const result = key ? outcome.result : undefined;
  const error = outcome.key === key ? outcome.error : undefined;

  const askLocation = useEffectEvent(() => {
    if (!location) void locate(false);
  });
  useEffect(() => askLocation(), []);

  // ── place search for the field being typed in
  const q = editing ? text.trim() : "";
  const typed = q.length >= MIN_QUERY;
  const settled = found.q === q; // the answer on screen is for what is typed now
  const slowSearch = useAfter(typed && !settled, SLOW_MS);
  const slowRoute = useAfter(busy, SLOW_MS);
  const near = useEffectEvent(() => {
    const inside = location && map?.getMaxBounds()?.contains(location);
    const at = inside ? location : map?.getCenter().toArray();
    return at ? `${at[0].toFixed(4)},${at[1].toFixed(4)}` : undefined;
  });
  useEffect(() => {
    if (q.length < MIN_QUERY) return;
    const ctl = new AbortController();
    const id = setTimeout(() => {
      const params = new URLSearchParams({ q, lang });
      const at = near();
      if (at) params.set("near", at);
      fetch(`/api/places?${params}`, { signal: ctl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<unknown>) : []))
        .then((rows) => {
          const places = Array.isArray(rows) ? rows.flatMap((x) => toPlace(x, lang) ?? []) : [];
          setFound({ q, places });
          setActive(0);
        })
        .catch(() => {
          if (!ctl.signal.aborted) setFound({ q, places: [] }); // offline: say so rather than spin
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(id);
      ctl.abort();
    };
  }, [q, lang]);

  // A phone keyboard (or the sheet rising for it) must not cover the field being typed in.
  useKeepInView(editing);

  const startEditing = (which: Which) => {
    setEditing(which);
    setText("");
    setActive(0);
    onEditing?.(true);
  };
  const stopEditing = () => {
    setEditing(null);
    setText("");
    setFound({ q: "", places: [] });
    onEditing?.(false);
  };
  const blur = () => (document.activeElement as HTMLElement | null)?.blur();
  const setEnd = (which: Which, end: SetStateAction<End | null>) => (which === "from" ? setFrom : setTo)(end);
  const choose = (end: End, place?: Place) => {
    if (editing) setEnd(editing, end);
    if (place) setRecents(pushRecent(place));
    stopEditing();
    blur();
  };
  const setPick = (next: Which | null) => {
    setPicking(next);
    onPicking?.(next !== null);
  };

  const place = (p: Place, id = p.id): Option => ({
    key: id,
    icon: KIND_ICON[p.kind],
    title: p.name,
    sub: p.sub,
    run: () => choose({ label: p.name, at: [p.lng, p.lat] }, p),
  });
  const options: Option[] = typed
    ? found.places.map((p) => place(p))
    : [
        {
          key: "mine",
          icon: LocateFixed,
          tint: "text-(--system-blue)",
          title: myLocation,
          run: () => {
            choose({ mine: true });
            if (!location) void locate(false);
          },
        },
        {
          key: "pick",
          icon: MapPinPlus,
          title: t("route.pickOnMap"),
          run: () => {
            const which = editing;
            stopEditing();
            blur();
            setPick(which);
          },
        },
        ...recents.map((p) => place(p, `recent:${p.id}`)),
      ];

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = options.length;
    const current = Math.min(active, n - 1);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (n) {
        const next = (current + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
        setActive(next);
        document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: "nearest" });
      }
    } else if (e.key === "Enter") {
      e.preventDefault(); // never submit an enclosing form
      options[current]?.run();
    } else if (e.key === "Escape") {
      e.stopPropagation(); // the field's Esc, not the chat bar's or the marker card's
      stopEditing();
      blur();
    }
  };
  // Moving between the two fields keeps the session (no sheet bounce); anywhere else ends it.
  const onBlur = (e: FocusEvent<HTMLInputElement>) => {
    if ((e.relatedTarget as HTMLElement | null)?.getAttribute("role") !== "combobox") stopEditing();
  };

  // ── set on map: the next map click sets the point; Esc gives up
  const tellPicking = useEffectEvent((on: boolean) => onPicking?.(on));
  // Names a point set on the map when the reverse lookup knows the spot; it keeps its coordinates otherwise.
  const nameIt = useEffectEvent((which: Which, at: LngLat) => {
    fetch(`/api/places/reverse?lng=${at[0]}&lat=${at[1]}&lang=${lang}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ name?: unknown; address?: unknown }>) : null))
      .then((p) => {
        const name = str(p?.name) ?? str(p?.address);
        if (name) setEnd(which, (end) => (end && "at" in end && end.at === at ? { label: name, at } : end));
      })
      .catch(() => {});
  });
  useEffect(() => {
    if (!map || !picking) return;
    const container = map.getCanvasContainer();
    container.style.cursor = "crosshair"; // the canvas inherits it; MapView's own cursor tweaks only touch the canvas
    const which = picking;
    const onClick = (e: MapMouseEvent) => {
      const at: LngLat = [e.lngLat.lng, e.lngLat.lat];
      (which === "from" ? setFrom : setTo)({ label: coords(at), at });
      select(null); // MapView's own click handler just opened a card for whatever was under the finger
      setPicking(null);
      tellPicking(false);
      nameIt(which, at);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPicking(null);
      tellPicking(false);
    };
    map.on("click", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      map.off("click", onClick);
      window.removeEventListener("keydown", onKey);
      container.style.cursor = "";
    };
  }, [map, picking, select]);

  // ── the route: requested as soon as both ends are known, again on a mode change or a retry
  const body = useEffectEvent(() => JSON.stringify({ from: a, to: b, mode }));
  useEffect(() => {
    if (!key) return;
    const ctl = new AbortController();
    fetch("/api/route", { method: "POST", headers: { "Content-Type": "application/json" }, body: body(), signal: ctl.signal })
      .then(async (res) => {
        if (res.ok) return setOutcome({ key, result: (await res.json()) as Result });
        const err = (await res.json().catch(() => null)) as { code?: string } | null;
        setOutcome({ key, error: ERRORS[err?.code ?? ""] ?? "common.error" });
      })
      .catch(() => !ctl.signal.aborted && setOutcome({ key, error: "route.error.network" }));
    return () => ctl.abort();
  }, [key]);

  // Draw the result and frame it; a theme switch reloads the style and drops the layers, so draw again then.
  const fit = useEffectEvent((m: MapLibreMap, line: GeoJSON.LineString) => {
    const h = root.current?.offsetHeight ?? 0;
    const sidebar = variant === "panel" && insetLeft > 0;
    // Bar: the planner floats over the bottom of the map; phone sheet: it covers the bottom; sidebar: the left.
    const bottom = sidebar ? 64 : Math.min(h + (variant === "bar" ? 170 : 130), innerHeight * 0.7);
    m.fitBounds(lineBounds(line), {
      padding: { left: insetLeft + 48, right: 48, top: insetLeft > 0 ? 64 : 120, bottom },
      maxZoom: 16,
      duration: 700,
      essential: true,
    });
  });
  useEffect(() => {
    if (!map || !result) return;
    const draw = () => {
      try {
        drawRoute(map, result.geometry);
      } catch {
        // Mid style reload; its style.load calls this again.
      }
    };
    draw();
    map.on("style.load", draw);
    fit(map, result.geometry);
    return () => {
      map.off("style.load", draw);
      clearRoute(map);
    };
  }, [map, result]);

  const listed = editing !== null && (options.length > 0 || (typed && settled)); // the suggestions hang from the fields

  const field = (which: Which, end: End | null, glyph: ReactNode, autoFocus?: boolean) => {
    const on = editing === which;
    return (
      <label className="flex h-12 items-center gap-3 rounded-card pr-12 pl-3.5 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:-outline-offset-2 has-[input:focus-visible]:outline-(--system-blue)">
        <span aria-hidden className="flex w-5 shrink-0 justify-center">
          {glyph}
        </span>
        <input
          role="combobox"
          aria-label={t(which === "from" ? "route.from" : "route.to")}
          aria-expanded={on && options.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={on && options[active] ? `${listId}-${active}` : undefined}
          autoFocus={autoFocus}
          value={on ? text : labelOf(end)}
          placeholder={on && end ? labelOf(end) : t("route.searchPlace")}
          onFocus={() => startEditing(which)}
          onBlur={onBlur}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          enterKeyHint="search"
          maxLength={80}
          className={cx(
            "t-body h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-label-2",
            !on && end && "mine" in end && "text-(--system-blue)",
          )}
        />
        {on && slowSearch && <Spinner />}
      </label>
    );
  };

  return (
    <section ref={root} aria-label={t("route.title")} data-detent className="flex flex-col gap-3">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 px-1">
          {picking ? (
            <p role="status" className="t-title2 text-(--system-blue)">
              {t("route.pickHint")}
            </p>
          ) : (
            <h2 className="t-title2">{t("route.title")}</h2>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={result ? t("route.clear") : t("common.close")}
          className={cx("-m-1.5 flex size-11 shrink-0 items-center justify-center rounded-full", focusRing)}
        >
          <span className="flex size-7 items-center justify-center rounded-full bg-(--label)/8 text-label-2">
            <X size={15} strokeWidth={2.5} aria-hidden />
          </span>
        </button>
      </header>

      {/* From and To in one grouped card, swap on the right. The suggestions hang from its bottom edge: one surface, one radius. */}
      <div className="flex flex-col">
        <div className={cx("relative bg-(--label)/6", listed ? "rounded-t-card" : "rounded-card")}>
          {field("from", from, <span className="size-3 rounded-full border-[3px] border-(--system-blue)" />)}
          <div aria-hidden className="mr-12 ml-[46px] h-[0.5px] bg-(--label)/15" />
          {field("to", to, <MapPin size={18} className="text-(--system-red)" />, variant === "bar" && !to)}
          <button
            type="button"
            onClick={() => {
              setFrom(to);
              setTo(from);
            }}
            aria-label={t("route.swap")}
            className={cx("absolute top-1/2 right-1.5 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-label-2", focusRing)}
          >
            <ArrowUpDown size={18} aria-hidden />
          </button>
        </div>

        {editing && (
          // A fixed height, so nothing moves as results come and go. mousedown would blur the field and end the session before the click lands.
          <div className="h-[min(248px,36dvh)]">
            {listed && (
              <div onMouseDown={(e) => e.preventDefault()} className="max-h-full overflow-y-auto overscroll-contain rounded-b-card border-t-[0.5px] border-(--label)/15 bg-(--label)/6">
                <ul id={listId} role="listbox" aria-label={t(editing === "from" ? "route.from" : "route.to")} className="flex flex-col p-1">
                  {options.map((o, i) => (
                    <li
                      key={o.key}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === active}
                      onClick={o.run}
                      onPointerEnter={() => setActive(i)}
                      className={cx("flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-1.5 active:scale-100", i === active && "bg-(--label)/8")}
                    >
                      <o.icon size={18} aria-hidden className={cx("shrink-0", o.tint ?? "text-label-2")} />
                      <span className="min-w-0 flex-1">
                        <span className="t-subhead block truncate font-semibold">{o.title}</span>
                        {o.sub && <span className="t-footnote block truncate text-label-2">{o.sub}</span>}
                      </span>
                    </li>
                  ))}
                  {options.length === 0 && (
                    <li role="presentation" className="t-subhead px-2.5 py-3 text-label-2">
                      {t("shell.noResults")}
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {!editing && (
        <>
          <div role="group" aria-label={t("route.modeLabel")} className="grid grid-cols-3 gap-2">
            {MODE_OPTIONS.map(({ value, key: label, icon: Icon }) => {
              const on = value === mode;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setMode(value)}
                  className={cx(
                    "t-caption flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-[12px] px-1",
                    focusRing,
                    on ? "bg-(--system-blue) text-white" : "bg-(--label)/6 text-label",
                  )}
                >
                  <Icon size={19} aria-hidden />
                  <span className="max-w-full truncate">{t(label)}</span>
                </button>
              );
            })}
          </div>

          {error && (
            <div role="alert" className="flex items-center gap-2 px-1">
              <TriangleAlert size={17} aria-hidden className="shrink-0 text-(--system-orange)" />
              <p className="t-subhead min-w-0 flex-1 text-(--system-orange)">{t(error)}</p>
              {RETRYABLE.has(error) && (
                <button type="button" onClick={() => setAttempt((n) => n + 1)} className={cx("t-subhead -my-2.5 min-h-11 shrink-0 rounded-full px-2 font-semibold text-(--system-blue)", focusRing)}>
                  {t("common.retry")}
                </button>
              )}
            </div>
          )}

          {key && !error && (
            // Takes its place the moment both ends are set and is as tall as the shortest summary, so the answer fills it in without a jump.
            <>
              <div aria-live="polite" aria-busy={busy} className={cx("flex min-h-[228px] flex-col gap-3 rounded-card bg-(--label)/6 p-4 transition-opacity duration-150", busy && "pointer-events-none opacity-60")}>
                {result ? (
                  <>
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="t-large-title tabular-nums">{durationText(result.durationS, lang)}</p>
                        {busy && slowRoute && <Spinner />}
                      </div>
                      <p className="t-subhead text-label-2 tabular-nums">
                        {formatDistance(result.distanceM, lang)}
                        {(result.avoided.length > 0 || result.unavoidable.length === 0) && ` · ${avoidsText(result.avoided.length, lang)}`}
                      </p>
                    </div>

                    {result.avoided.length > 0 && (
                      <p className="t-footnote line-clamp-2 text-label-2">
                        {result.avoided.map((c) => pick(c.title, lang)).join(" · ")}
                        {result.detourM > 0 && ` · ${t("route.detour", { distance: formatDistance(result.detourM, lang) })}`}
                      </p>
                    )}

                    {result.unavoidable.length > 0 && (
                      <p className="t-subhead flex items-start gap-2 text-(--system-orange)">
                        <TriangleAlert size={17} aria-hidden className="mt-0.5 shrink-0" />
                        <span>{t("route.stillCrossed", { titles: result.unavoidable.map((c) => pick(c.title, lang)).join(", ") })}</span>
                      </p>
                    )}

                    <div className="mt-auto flex flex-col gap-2">
                      <a href={result.googleMapsUrl} target="_blank" rel="noopener noreferrer" aria-label={t("route.openGoogle")} className={cx(linkButton, "bg-(--system-blue) text-white")}>
                        <span className="truncate">Google Maps</span>
                        <ExternalLink size={14} aria-hidden className="shrink-0" />
                      </a>
                      <a href={result.wazeUrl} target="_blank" rel="noopener noreferrer" aria-label={t("route.openWaze")} className={cx(linkButton, "bg-(--label)/8 text-label")}>
                        <span className="truncate">Waze</span>
                        <ExternalLink size={14} aria-hidden className="shrink-0" />
                      </a>
                      <p className="t-footnote px-1 text-label-2">{t("route.wazeNote")}</p>
                    </div>
                  </>
                ) : (
                  slowRoute && <Spinner className="m-auto" />
                )}
              </div>
              {result && (
                <p className="t-caption px-1 text-label-2">
                  {t("route.attribution")} ·{" "}
                  <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer" className={cx("text-(--system-blue)", focusRing)}>
                    {t("route.fixTheMap")}
                  </a>
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
