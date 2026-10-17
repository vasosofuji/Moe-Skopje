"use client";

import { Bike, Car, ExternalLink, Footprints, LocateFixed, MapPin, TriangleAlert, X, type LucideIcon } from "lucide-react";
import type { MapMouseEvent, Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from "react";
import { GlassButton } from "@/components/glass/GlassButton";
import { Segmented } from "@/components/glass/Segmented";
import { useMap, type LngLat } from "@/components/map/MapView";
import { cx, focusRing } from "@/lib/cx";
import { pick, useT, type Dict } from "@/lib/i18n";
import { formatDistance } from "@/lib/i18n/format";
import type { Mode } from "@/lib/routing";
import { clearRoute, drawRoute, lineBounds } from "./routeLayer";

/** A start or end: what the field shows and where it is. */
type Pt = { label: string; at: LngLat };
type Place = { name: string; nameEn?: string; kind: string; area?: string; lng: number; lat: number };
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

const MODE_OPTIONS: { value: Mode; key: keyof Dict; icon: LucideIcon }[] = [
  { value: "auto", key: "route.mode.auto", icon: Car },
  { value: "bicycle", key: "route.mode.bicycle", icon: Bike },
  { value: "pedestrian", key: "route.mode.pedestrian", icon: Footprints },
];

/** POST /api/route error code → copy. */
const ERRORS: Record<string, keyof Dict> = {
  bbox: "route.error.bbox",
  noroute: "route.error.noroute",
  rate: "route.error.rate",
  router: "route.error.router",
  input: "route.error.same", // the body is validated here, so the only input error left is two points too close together
};

const linkButton = cx("glass glass-pill glass-button t-subhead h-11 w-full justify-center px-4 font-semibold select-none", focusRing);

function Row({ icon: Icon, title, sub, onClick }: { icon?: LucideIcon; title: string; sub?: string; onClick(): void }) {
  return (
    <button type="button" onClick={onClick} className={cx("flex min-h-11 w-full items-center gap-3 rounded-[10px] px-2.5 text-left hover:bg-(--label)/6", focusRing)}>
      {Icon && <Icon size={17} aria-hidden className="shrink-0 text-(--system-blue)" />}
      <span className="min-w-0 flex-1">
        <span className="t-subhead block truncate font-semibold">{title}</span>
        {sub && <span className="t-footnote block truncate text-label-2">{sub}</span>}
      </span>
    </button>
  );
}

/**
 * One end of the route: a text field that searches /api/places (debounced) and offers "My location" when it is empty,
 * plus a button that lets the next map click set the point.
 */
function PlaceField({
  label,
  value,
  onChange,
  picking,
  onPick,
  mine,
}: {
  label: string;
  value: Pt | null;
  onChange(p: Pt | null): void;
  picking: boolean;
  onPick(): void;
  /** The "My location" row, offered on the start field while it is empty. */
  mine?: { label: string; use(): void };
}) {
  const { t, lang } = useT();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [found, setFound] = useState<{ q: string; places: Place[] }>();
  const q = text.trim();

  useEffect(() => {
    if (!q || value) return;
    const ctl = new AbortController();
    const id = setTimeout(() => {
      fetch(`/api/places?q=${encodeURIComponent(q)}`, { signal: ctl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<Place[]>) : []))
        .then((places) => setFound({ q, places }))
        .catch(() => {}); // aborted by the next keystroke, or offline: the list just stays as it was
    }, 250);
    return () => {
      clearTimeout(id);
      ctl.abort();
    };
  }, [q, value]);

  const places = found?.q === q ? found.places : undefined; // never show the answer to an older query
  const open = focused && !value && (q ? true : !!mine);

  const choose = (p: Place) => {
    onChange({ label: lang === "en" && p.nameEn ? p.nameEn : p.name, at: [p.lng, p.lat] });
    setText("");
    setFocused(false);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <div
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <div className="flex h-11 items-center gap-2 rounded-full bg-(--label)/6 pr-1 pl-3.5 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-(--system-blue)">
        <span className="t-footnote w-6 shrink-0 font-semibold text-label-2">{label}</span>
        <input
          value={value ? value.label : text}
          onChange={(e) => {
            setText(e.target.value);
            if (value) onChange(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && open && places?.[0]) {
              e.preventDefault(); // choose the first match instead of submitting
              choose(places[0]);
            }
          }}
          placeholder={t("route.searchPlace")}
          aria-label={label}
          autoComplete="off"
          enterKeyHint="search"
          maxLength={60}
          className="t-body h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-label-2"
        />
        <button
          type="button"
          onClick={onPick}
          aria-pressed={picking}
          aria-label={`${t("route.pickOnMap")}: ${label}`}
          className={cx(
            "flex size-9 shrink-0 items-center justify-center rounded-full text-label-2",
            picking && "bg-(--system-blue)/15 text-(--system-blue)",
            focusRing,
          )}
        >
          <MapPin size={18} aria-hidden />
        </button>
      </div>

      {open && (
        // mousedown would blur the field and close the list before the click lands
        <ul onMouseDown={(e) => e.preventDefault()} className="mt-1 rounded-[14px] bg-(--label)/6 p-1">
          {!q && mine && (
            <li>
              <Row
                icon={LocateFixed}
                title={mine.label}
                onClick={() => {
                  mine.use();
                  setFocused(false);
                  (document.activeElement as HTMLElement | null)?.blur();
                }}
              />
            </li>
          )}
          {places?.map((p) => (
            <li key={`${p.kind}:${p.name}:${p.area ?? ""}`}>
              <Row title={lang === "en" && p.nameEn ? p.nameEn : p.name} sub={p.area ?? t("detail.municipality")} onClick={() => choose(p)} />
            </li>
          ))}
          {places?.length === 0 && <li className="t-subhead px-2.5 py-3 text-label-2">{t("shell.noResults")}</li>}
        </ul>
      )}
    </div>
  );
}

const km = (m: number, comma: boolean) => {
  const s = String(Math.round(m / 100) / 10);
  return comma ? s.replace(".", ",") : s;
};

/**
 * Route planner: start and end (search or a tap on the map), a travel mode, and the result with the closed streets it
 * avoids and hand-offs to Google Maps and Waze. The route is drawn on the map while this is mounted and removed when it
 * unmounts. `floating` is the glass panel over the map (desktop); `inline` sits in the Explore sheet or sidebar.
 * `insetLeft` is the screen width the sidebar covers (0 on phones), used to frame the route in the visible map.
 */
export function RoutePlanner({
  variant,
  insetLeft = 0,
  onClose,
  onPicking,
}: {
  variant: "floating" | "inline";
  insetLeft?: number;
  onClose(): void;
  /** The map is being tapped for a point (true) or that ended (false); a phone sheet uses it to get out of the way. */
  onPicking?(on: boolean): void;
}) {
  const { t, lang } = useT();
  const { map, location, locate, select } = useMap();
  const [from, setFrom] = useState<Pt | null>(); // undefined: nothing chosen yet, so "My location" when it is known
  const [to, setTo] = useState<Pt | null>(null);
  const [mode, setMode] = useState<Mode>("auto");
  const [picking, setPicking] = useState<"from" | "to" | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<keyof Dict | null>(null);
  const [busy, setBusy] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const request = useRef<AbortController>(null);

  const here: Pt | null = location ? { label: t("map.myLocation"), at: location } : null;
  const start = from === undefined ? here : from;

  const askLocation = useEffectEvent(() => {
    if (!location) void locate(false);
  });
  useEffect(() => {
    askLocation();
    return () => request.current?.abort();
  }, []);

  const tellPicking = useEffectEvent((on: boolean) => onPicking?.(on));
  const stale = () => {
    setResult(null);
    setError(null);
  };
  const setPick = (next: "from" | "to" | null) => {
    setPicking(next);
    onPicking?.(next !== null);
  };

  // The next map click sets the point. Esc gives up.
  useEffect(() => {
    if (!map || !picking) return;
    const container = map.getCanvasContainer();
    container.style.cursor = "crosshair"; // the canvas inherits it; MapView's own cursor tweaks only touch the canvas
    const onClick = (e: MapMouseEvent) => {
      const pt: Pt = { label: t("route.pinOnMap"), at: [e.lngLat.lng, e.lngLat.lat] };
      if (picking === "from") setFrom(pt);
      else setTo(pt);
      stale();
      select(null); // MapView's own click handler just opened a card for whatever was under the finger
      setPicking(null);
      tellPicking(false);
    };
    const onKey = (e: KeyboardEvent) => {
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
  }, [map, picking, select, t]);

  // Draw the result and frame it; a theme switch reloads the style and drops the layers, so draw again then.
  const fit = useEffectEvent((m: MapLibreMap, line: GeoJSON.LineString) => {
    const phone = insetLeft === 0;
    const bottom =
      variant === "floating" ? Math.min((panel.current?.offsetHeight ?? 0) + 140, innerHeight * 0.6) : phone ? Math.round(innerHeight * 0.45) : 64;
    m.fitBounds(lineBounds(line), { padding: { left: insetLeft + 48, right: 48, top: phone ? 120 : 64, bottom }, maxZoom: 16 });
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!start || !to) return setError("route.needBoth");
    request.current?.abort();
    const mine = (request.current = new AbortController());
    setBusy(true);
    stale();
    try {
      const res = await fetch("/api/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: start.at, to: to.at, mode }),
        signal: mine.signal,
      });
      if (res.ok) setResult((await res.json()) as Result);
      else {
        const body = (await res.json().catch(() => null)) as { code?: string } | null;
        setError(ERRORS[body?.code ?? ""] ?? "common.error");
      }
    } catch {
      if (!mine.signal.aborted) setError("route.error.network");
    } finally {
      if (!mine.signal.aborted) setBusy(false);
    }
  };

  const floating = variant === "floating";
  return (
    <section
      ref={panel}
      aria-label={t("route.title")}
      className={cx(
        "flex flex-col gap-3",
        floating
          ? "glass glass-strong glass-card max-h-[calc(100dvh-200px)] w-[380px] max-w-[calc(100vw-32px)] overflow-y-auto overscroll-contain"
          : "mb-4 border-b-[0.5px] border-(--label)/10 pb-4",
      )}
    >
      <header className="flex items-center justify-between">
        <h2 className="t-headline">{t("route.title")}</h2>
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

      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <PlaceField
            label={t("route.from")}
            value={start}
            onChange={(p) => {
              setFrom(p);
              stale();
            }}
            picking={picking === "from"}
            onPick={() => setPick(picking === "from" ? null : "from")}
            mine={{
              label: t("map.myLocation"),
              use: () => {
                setFrom(undefined);
                stale();
                if (!location) void locate(false);
              },
            }}
          />
          <PlaceField
            label={t("route.to")}
            value={to}
            onChange={(p) => {
              setTo(p);
              stale();
            }}
            picking={picking === "to"}
            onPick={() => setPick(picking === "to" ? null : "to")}
          />
        </div>
        {picking && (
          <p role="status" className="t-footnote text-(--system-blue)">
            {t("route.pickHint")}
          </p>
        )}

        <Segmented
          id="route-mode"
          label={t("route.modeLabel")}
          options={MODE_OPTIONS.map(({ value, key, icon }) => ({ value, label: t(key), icon }))}
          value={mode}
          onChange={(m) => {
            setMode(m);
            stale();
          }}
        />

        <GlassButton type="submit" size="sm" disabled={busy} className="w-full bg-(--system-blue) text-white">
          {busy ? t("route.finding") : t("route.go")}
        </GlassButton>
      </form>

      {error && (
        <p role="alert" className="t-subhead flex items-start gap-2 text-(--system-orange)">
          <TriangleAlert size={17} aria-hidden className="mt-0.5 shrink-0" />
          <span>{t(error)}</span>
        </p>
      )}

      {result && (
        <div aria-live="polite" className="flex flex-col gap-3 border-t-[0.5px] border-(--label)/10 pt-3">
          <p className="t-title2 tabular-nums">
            {t("route.summary", { km: km(result.distanceM, lang === "mk"), min: Math.max(1, Math.round(result.durationS / 60)) })}
          </p>

          {result.avoided.length > 0 ? (
            <div>
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
            result.unavoidable.length === 0 && <p className="t-subhead text-label-2">{t("route.noneAvoided")}</p>
          )}

          {result.unavoidable.length > 0 && (
            <p className="t-subhead flex items-start gap-2 text-(--system-orange)">
              <TriangleAlert size={17} aria-hidden className="mt-0.5 shrink-0" />
              <span>{t("route.stillCrossed", { titles: result.unavoidable.map((c) => pick(c.title, lang)).join(", ") })}</span>
            </p>
          )}

          <div className="flex flex-col gap-2">
            <a href={result.googleMapsUrl} target="_blank" rel="noopener noreferrer" className={cx(linkButton, "bg-(--system-blue) text-white")}>
              {t("route.openGoogle")}
              <ExternalLink size={14} aria-hidden />
            </a>
            <a href={result.wazeUrl} target="_blank" rel="noopener noreferrer" className={linkButton}>
              {t("route.openWaze")}
              <ExternalLink size={14} aria-hidden />
            </a>
          </div>
          <p className="t-footnote text-label-2">{t("route.wazeNote")}</p>
          <p className="t-footnote text-label-2">
            {t("route.attribution")} ·{" "}
            <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer" className={cx("text-(--system-blue)", focusRing)}>
              {t("route.fixTheMap")}
            </a>
          </p>
        </div>
      )}
    </section>
  );
}
