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
import { formatDistance } from "@/lib/i18n/format";
import type { Mode } from "@/lib/routing";
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

const km = (m: number, comma: boolean) => {
  const s = String(Math.round(m / 100) / 10);
  return comma ? s.replace(".", ",") : s;
};

const linkButton = cx("glass glass-pill glass-button t-subhead h-11 min-w-0 flex-1 justify-center gap-1.5 px-3 font-semibold select-none", focusRing);

type Option = { key: string; icon: LucideIcon; tint?: string; title: string; sub?: string; run(): void };

/**
 * Route planner, Apple Maps style: start and end stacked in one grouped card with a swap button, travel modes as icon
 * chips, and the route (found as soon as both ends are set) with the closed streets it avoids and hand-offs to Google
 * Maps and Waze. A focused field lists "My location" and "Set on map", or real places (GET /api/places, 200 ms debounce,
 * arrow keys and Enter). The route is drawn while this is mounted and removed when it unmounts.
 * `bar`: above the desktop chat bar; `panel`: in the phone sheet or the tablet sidebar. `insetLeft` is the screen width
 * the sidebar covers, used with the planner's own height to frame the route in the free part of the map.
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
  const busy = key !== "" && outcome.key !== key;
  const result = outcome.key === key ? outcome.result : undefined;
  const error = outcome.key === key ? outcome.error : undefined;

  const askLocation = useEffectEvent(() => {
    if (!location) void locate(false);
  });
  useEffect(() => askLocation(), []);

  // ── place search for the field being typed in
  const q = editing ? text.trim() : "";
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
        .catch(() => {}); // aborted by the next keystroke, or offline: the last answer stays up
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(id);
      ctl.abort();
    };
  }, [q, lang]);

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
  const choose = (end: End) => {
    if (editing) setEnd(editing, end);
    stopEditing();
    blur();
  };
  const setPick = (next: Which | null) => {
    setPicking(next);
    onPicking?.(next !== null);
  };

  const options: Option[] =
    q.length >= MIN_QUERY
      ? found.places.map((p) => ({
          key: p.id,
          icon: KIND_ICON[p.kind],
          title: p.name,
          sub: p.sub,
          run: () => choose({ label: p.name, at: [p.lng, p.lat] }),
        }))
      : q
        ? []
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
          ];
  const settled = found.q === q; // the answer on screen is for what is typed now

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = options.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (n) setActive((i) => (i + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
    } else if (e.key === "Enter") {
      e.preventDefault(); // never submit an enclosing form
      options[Math.min(active, n - 1)]?.run();
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
      </label>
    );
  };

  return (
    <section ref={root} aria-label={t("route.title")} data-detent className="flex flex-col gap-3">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 px-1">
          <h2 className="t-title2">{t("route.title")}</h2>
          {picking && (
            <p role="status" className="t-footnote text-(--system-blue)">
              {t("route.pickHint")}
            </p>
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

      {/* From and To in one grouped card, swap on the right */}
      <div className="relative rounded-card bg-(--label)/6">
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

      {editing && (options.length > 0 || q.length >= MIN_QUERY) ? (
        // mousedown would blur the field and end the session before the click lands
        <ul id={listId} role="listbox" aria-label={t(editing === "from" ? "route.from" : "route.to")} onMouseDown={(e) => e.preventDefault()} className="flex flex-col rounded-card bg-(--label)/6 p-1">
          {options.map((o, i) => (
            <li
              key={o.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onClick={o.run}
              onPointerEnter={() => setActive(i)}
              className={cx("flex min-h-12 cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-1.5", i === active && "bg-(--label)/8")}
            >
              <o.icon size={18} aria-hidden className={cx("shrink-0", o.tint ?? "text-label-2")} />
              <span className="min-w-0 flex-1">
                <span className="t-subhead block truncate font-semibold">{o.title}</span>
                {o.sub && <span className="t-footnote block truncate text-label-2">{o.sub}</span>}
              </span>
            </li>
          ))}
          {q.length >= MIN_QUERY && settled && options.length === 0 && (
            <li role="presentation" className="t-subhead px-2.5 py-3 text-label-2">
              {t("shell.noResults")}
            </li>
          )}
          {q.length >= MIN_QUERY && !settled && options.length === 0 && <li role="presentation" aria-hidden className="skeleton m-1.5 h-9" />}
        </ul>
      ) : editing ? null : (
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

          {busy && (
            <div aria-busy className="flex flex-col gap-2 py-1">
              <span className="skeleton h-7 w-36" />
              <span className="skeleton h-4 w-52" />
            </div>
          )}

          {error && (
            <div role="alert" className="flex items-start gap-2">
              <TriangleAlert size={17} aria-hidden className="mt-0.5 shrink-0 text-(--system-orange)" />
              <p className="t-subhead min-w-0 flex-1 text-(--system-orange)">{t(error)}</p>
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className={cx("t-subhead -my-2.5 min-h-11 shrink-0 rounded-full px-2 font-semibold text-(--system-blue)", focusRing)}>
                {t("common.retry")}
              </button>
            </div>
          )}

          {result && (
            <div aria-live="polite" className="flex flex-col gap-3 border-t-[0.5px] border-(--label)/10 pt-3">
              <p className="t-title2 px-1 tabular-nums">
                {t("route.summary", { km: km(result.distanceM, lang === "mk"), min: Math.max(1, Math.round(result.durationS / 60)) })}
              </p>

              {result.avoided.length > 0 ? (
                <div className="px-1">
                  <p className="t-subhead font-semibold">{t("route.avoided", { n: result.avoided.length })}</p>
                  <ul className="t-footnote mt-1 list-disc pl-5 text-label-2">
                    {result.avoided.map((c) => (
                      <li key={c.id}>{pick(c.title, lang)}</li>
                    ))}
                  </ul>
                  {result.detourM > 0 && (
                    <p className="t-footnote mt-1 text-label-2">{t("route.detour", { distance: formatDistance(result.detourM, lang) })}</p>
                  )}
                </div>
              ) : (
                result.unavoidable.length === 0 && <p className="t-subhead px-1 text-label-2">{t("route.noneAvoided")}</p>
              )}

              {result.unavoidable.length > 0 && (
                <p className="t-subhead flex items-start gap-2 px-1 text-(--system-orange)">
                  <TriangleAlert size={17} aria-hidden className="mt-0.5 shrink-0" />
                  <span>{t("route.stillCrossed", { titles: result.unavoidable.map((c) => pick(c.title, lang)).join(", ") })}</span>
                </p>
              )}

              <div className="flex gap-2">
                <a href={result.googleMapsUrl} target="_blank" rel="noopener noreferrer" aria-label={t("route.openGoogle")} className={cx(linkButton, "bg-(--system-blue) text-white")}>
                  <span className="truncate">Google Maps</span>
                  <ExternalLink size={14} aria-hidden className="shrink-0" />
                </a>
                <a href={result.wazeUrl} target="_blank" rel="noopener noreferrer" aria-label={t("route.openWaze")} className={linkButton}>
                  <span className="truncate">Waze</span>
                  <ExternalLink size={14} aria-hidden className="shrink-0" />
                </a>
              </div>
              <p className="t-footnote px-1 text-label-2">
                {t("route.wazeNote")} {t("route.attribution")} ·{" "}
                <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer" className={cx("text-(--system-blue)", focusRing)}>
                  {t("route.fixTheMap")}
                </a>
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
