"use client";

import { CornerUpRight, LocateFixed, LocateOff, WifiOff } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useDeferredValue, useEffect, useEffectEvent, useMemo, useState } from "react";
import { AskBar } from "@/components/assistant/AskBar";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import type { Citation } from "@/components/assistant/Citation";
import { ExplorePanel } from "@/components/explore/ExplorePanel";
import { GlassButton } from "@/components/glass/GlassButton";
import { BusTracker } from "@/components/map/BusTracker";
import { MapContext, MapView, type BBox, type Highlight, type LngLat, type MapApi, type Trip } from "@/components/map/MapView";
import { MarkerCard } from "@/components/map/MarkerCard";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { RoutePlanner } from "@/components/route/RoutePlanner";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { cx, focusRing } from "@/lib/cx";
import { useT, type Dict } from "@/lib/i18n";
import { HIDDEN_LAYERS, type LayerId } from "@/lib/layers";
import { spring } from "@/lib/motion";
import { usePrefs } from "@/lib/prefs";
import type { Feature } from "@/lib/sources/types";
import { getCachedLayer, refreshLayer } from "@/lib/useLayer";
import { useHydrated, useIsDesktop, useMedia } from "@/lib/useMedia";
import { BottomSheet, type Snap } from "./BottomSheet";
import { SearchPill } from "./SearchPill";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";

export type Tab = "explore" | "ask" | "settings";

const TOAST_MS = 6000;
/** Camera moves stay short and run even with reduced motion (they say where the content went). */
const CAMERA = { duration: 700, essential: true } as const;
/** The Today tiles read these whatever the map shows. */
const TODAY_LAYERS: LayerId[] = ["air", "weather", "buses"];

function Panel({ tab, onCitation }: { tab: Tab; onCitation(c: Citation): void }) {
  if (tab === "explore") return <ExplorePanel />;
  if (tab === "settings") return <SettingsPanel />;
  return <AssistantPanel onCitation={onCitation} />;
}

/** The directions entry on phones and tablets: a monochrome glyph next to the search field. */
function RouteButton({ open, floating, onClick }: { open: boolean; floating: boolean; onClick(): void }) {
  const { t } = useT();
  const glyph = <CornerUpRight size={20} aria-hidden />;
  return floating ? (
    <GlassButton shape="circle" aria-label={t("route.title")} aria-pressed={open} onClick={onClick} className={cx("shrink-0", open && "text-(--system-blue)")}>
      {glyph}
    </GlassButton>
  ) : (
    <button
      type="button"
      aria-label={t("route.title")}
      aria-pressed={open}
      onClick={onClick}
      className={cx("flex size-11 shrink-0 items-center justify-center rounded-full bg-(--label)/6", focusRing, open && "text-(--system-blue)")}
    >
      {glyph}
    </button>
  );
}

/**
 * The whole app: a full-bleed map with glass chrome floating over it, placed with the tokens in app/layout-tokens.css.
 * Phones (<768): search pill and directions glyph on top, vaul bottom sheet resting on a solid tab bar.
 * Tablets (768–1023): 360 px sidebar ending above the tab bar.
 * Desktop (≥1024): 380 px sidebar with Explore and Settings as a segmented control; Ask and directions are the
 * Spotlight bar over the map. Language lives in Settings only.
 * A selected feature's card sits at the top of the panel (sheet or sidebar); the map controls stack on the right above
 * the sheet's peek, the tab bar or the ask bar; the bus tracker and toasts sit at the top of the free map area.
 * Owns the tab, the selected feature and the camera, and shares them through MapContext (`useMap()`).
 */
export function AppShell() {
  const { t } = useT();
  const [prefs, setPrefs] = usePrefs();
  const hydrated = useHydrated();
  const isDesktop = useIsDesktop();
  const isWide = useMedia("(min-width: 768px)");
  const systemDark = useMedia("(prefers-color-scheme: dark)");
  const dark = prefs.theme === "dark" || (prefs.theme === "system" && systemDark);

  const [tab, setTab] = useState<Tab>("explore");
  const [snap, setSnap] = useState<Snap>(0);
  const [selected, select] = useState<Feature | null>(null);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [trip, track] = useState<Trip | null>(null);
  const [map, setMap] = useState<MapLibreMap>();
  const [location, setLocation] = useState<LngLat>();
  const [toast, setToast] = useState<keyof Dict | null>(null);
  const [routeOpen, setRouteOpen] = useState(false); // phones and tablets; desktop's planner lives in AskBar

  // A switch or theme tap paints first; the map's heavier redraw follows in a lower-priority render.
  const mapLayers = useDeferredValue(prefs.layers);
  const mapDark = useDeferredValue(dark);

  const panelTab = isDesktop && tab === "ask" ? "explore" : tab; // desktop asks through the bar, not a tab
  const sheetFull = !isWide && snap === 2; // the map is covered: hide what floats over it
  const overMap = isWide || snap === 0; // a raised phone sheet would cover the controls and the tracker: they step aside
  const insetLeft = isDesktop ? 420 : isWide ? 392 : 0; // --map-l: the sidebar, its margin and a gutter
  const planner = routeOpen && !isDesktop;

  // The part of the map that is not under a panel.
  const padding = useCallback(
    (extra = 0) =>
      isWide
        ? { left: insetLeft + extra, right: extra, top: extra, bottom: (isDesktop ? 104 : 0) + extra } // desktop: above the chat bar
        : { left: extra, right: extra, top: 120 + extra, bottom: Math.round(innerHeight * 0.35) + extra },
    [isWide, isDesktop, insetLeft],
  );

  const flyTo = useCallback(
    (center: LngLat, zoom?: number) => {
      map?.flyTo({ center, zoom: zoom ?? Math.max(map.getZoom(), 14), padding: padding(), ...CAMERA });
    },
    [map, padding],
  );

  const showArea = useCallback(
    ([w, s, e, n]: BBox) => {
      map?.fitBounds([[w, s], [e, n]], { padding: padding(40), maxZoom: 16, ...CAMERA });
    },
    [map, padding],
  );

  const reveal = useCallback(() => {
    if (!isWide) setSnap(0);
  }, [isWide]);

  const locate = useCallback(
    (fly = true) =>
      new Promise<boolean>((resolve) => {
        if (!("geolocation" in navigator)) return resolve(false);
        navigator.geolocation.getCurrentPosition(
          ({ coords }) => {
            const at: LngLat = [coords.longitude, coords.latitude];
            setLocation(at);
            if (fly) flyTo(at, 15);
            resolve(true);
          },
          () => {
            if (fly) setToast("map.locationUnavailable");
            resolve(false);
          },
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
        );
      }),
    [flyTo],
  );

  // Location is never stored; if the user already allowed it, ask the browser again (no prompt) for "Next bus near you".
  const restoreLocation = useEffectEvent(() => void locate(false));
  useEffect(() => {
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((p) => p.state === "granted" && restoreLocation())
      .catch(() => {});
  }, []);

  // Right after hydration (saved prefs are known by then), start the enabled layers and the Today tiles' layers, so they
  // load alongside the basemap instead of after it. refreshLayer shares any request a component starts as well.
  const prefetch = useEffectEvent(() => {
    for (const id of new Set([...TODAY_LAYERS, ...prefs.layers])) if (!HIDDEN_LAYERS.includes(id)) void refreshLayer(id);
  });
  useEffect(() => {
    if (hydrated) prefetch();
  }, [hydrated]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const go = (next: Tab) => {
    setTab(next);
    setRouteOpen(false);
    if (isWide) return;
    if (next === "ask") setSnap(2); // the chat's input sits in the panel
    else if (snap === 0) setSnap(1);
  };
  const toggleRoute = () => {
    setRouteOpen(!routeOpen);
    if (!isWide && !routeOpen) setSnap(1);
  };

  // A citation chip flies to the feature and opens its card. A cited layer that is off is switched on first,
  // so the chip never lands on an empty spot; a feature not loaded yet is selected once its layer arrives.
  const onCitation = (c: Citation) => {
    flyTo([c.lng, c.lat], 15);
    if (!isWide) setSnap(0); // lower the chat to its peek so the map and the card show; drag up to go on
    if (HIDDEN_LAYERS.includes(c.layer)) return select(null);
    if (!prefs.layers.includes(c.layer)) setPrefs({ layers: [...prefs.layers, c.layer] });
    const find = () => getCachedLayer(c.layer)?.features.features.find((f) => f.properties?.id === c.featureId) as Feature | undefined;
    const hit = find();
    select(hit ?? null);
    if (!hit) void refreshLayer(c.layer).then(() => select((prev) => prev ?? find() ?? null));
  };
  // A tapped feature's card opens at the top of the panel; on phones the sheet rises to its middle detent to show it,
  // and closing the card lowers it back to the map.
  const choose = useCallback(
    (f: Feature | null) => {
      select(f);
      if (f && !isWide) setSnap(1);
    },
    [isWide],
  );
  const closeCard = useCallback(() => {
    select(null);
    if (!isWide) setSnap(0);
  }, [isWide]);
  const closeRoute = useCallback(() => setRouteOpen(false), []);
  const stopTracking = useCallback(() => track(null), []);
  // Following a bus is about the map: a phone sheet drops to its peek, so the tracker and the bus show.
  const follow = useCallback(
    (next: Trip | null) => {
      track(next);
      if (next && !isWide) setSnap(0);
    },
    [isWide],
  );
  const api = useMemo<MapApi>(
    () => ({ map, flyTo, showArea, reveal, select: choose, location, locate, highlight, setHighlight, trip, track: follow }),
    [map, flyTo, showArea, reveal, choose, location, locate, highlight, trip, follow],
  );

  // Phones and tablets: the planner takes the panel's place while it is open (the sheet sits at its middle detent).
  // A phone sheet drops to its peek while a point is tapped on the map, and rises while a field is typed in.
  const content = planner ? (
    <RoutePlanner
      variant="panel"
      insetLeft={insetLeft}
      onClose={closeRoute}
      onPicking={(on) => !isWide && setSnap(on ? 0 : 1)}
      onEditing={(on) => !isWide && setSnap(on ? 2 : 1)}
    />
  ) : (
    <Panel tab={isWide ? panelTab : tab} onCitation={onCitation} />
  );

  const card = (
    <AnimatePresence>
      {map && selected && <MarkerCard key={selected.properties.id} feature={selected} map={map} docked onClose={closeCard} />}
    </AnimatePresence>
  );

  const onboarding = hydrated && !prefs.onboarded;

  return (
    <MapContext value={api}>
      <MotionConfig reducedMotion="user">
        <main data-raised={!overMap || undefined} className="shell fixed inset-0 overflow-hidden">
          <div inert={onboarding} className="contents">
            <MapView
              layers={mapLayers.filter((id) => !HIDDEN_LAYERS.includes(id))}
              dark={mapDark}
              onReady={setMap}
              onTileError={() => setToast("map.tilesUnavailable")}
            />

            {/* Layout depends on the viewport and saved prefs, which only the client knows. */}
            {hydrated && (
              <>
                {isWide ? (
                  <Sidebar
                    header={
                      <>
                        <div className="flex gap-2">
                          <SearchPill className="min-w-0 flex-1" />
                          {!isDesktop && <RouteButton open={routeOpen} floating={false} onClick={toggleRoute} />}
                        </div>
                        {isDesktop && <TabBar variant="segmented" tab={panelTab} onChange={go} />}
                      </>
                    }
                  >
                    {card}
                    {content}
                  </Sidebar>
                ) : (
                  <>
                    <div
                      inert={sheetFull}
                      // Typing a search lowers the sheet, so the results unfold over open map.
                      onFocus={(e) => e.target instanceof HTMLInputElement && setSnap(0)}
                      className={cx(
                        "fixed top-(--search-t) right-(--map-r) left-(--map-l) z-(--z-bar) flex items-start gap-2 transition-opacity duration-150",
                        sheetFull && "opacity-0",
                      )}
                    >
                      <SearchPill floating className="min-w-0 flex-1" />
                      <RouteButton open={routeOpen} floating onClick={toggleRoute} />
                    </div>
                    <BottomSheet snap={snap} onSnap={setSnap} title={planner ? t("route.title") : t(`tab.${tab}`)}>
                      {card}
                      {content}
                    </BottomSheet>
                  </>
                )}

                {!isDesktop && <TabBar variant="bar" tab={tab} onChange={go} />}
                {isDesktop && <AskBar left={insetLeft} onCitation={onCitation} />}

                {/* Map controls: one stack on the right (8 px gaps), above the sheet's peek, the tab bar or the ask bar. */}
                <div
                  inert={!overMap}
                  className={cx(
                    "fixed right-(--map-r) bottom-(--controls-b) z-(--z-chrome) flex flex-col gap-2 transition-opacity duration-150",
                    !overMap && "opacity-0",
                  )}
                >
                  <GlassButton shape="circle" aria-label={t("map.myLocation")} onClick={() => void locate(true)}>
                    <LocateFixed size={20} aria-hidden className={location ? "text-(--system-blue)" : undefined} />
                  </GlassButton>
                </div>

                {/* Top of the free map area (under the search row on phones): a slot for the toast, then the bus tracker. */}
                <div
                  inert={!overMap}
                  className={cx(
                    "pointer-events-none fixed top-(--map-t) right-(--map-r) left-(--map-l) z-(--z-cards) flex flex-col items-center gap-2 transition-opacity duration-150",
                    !overMap && "opacity-0",
                  )}
                >
                  {toast && <div aria-hidden className="h-11 shrink-0" />}
                  <AnimatePresence>
                    {map && trip && <BusTracker key={trip.tripId} trip={trip} map={map} onClose={stopTracking} />}
                  </AnimatePresence>
                </div>

                <div className="pointer-events-none fixed top-(--map-t) right-(--map-r) left-(--map-l) z-(--z-toast) flex justify-center">
                  <AnimatePresence>
                    {toast && (
                      <motion.div
                        key={toast}
                        role="status"
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={spring}
                        className={cx("glass glass-pill h-11 max-w-full font-medium whitespace-nowrap", isWide ? "t-subhead" : "t-footnote px-3.5")}
                      >
                        {toast === "map.tilesUnavailable" ? (
                          <WifiOff size={16} aria-hidden className="shrink-0 text-(--system-orange)" />
                        ) : (
                          <LocateOff size={16} aria-hidden className="shrink-0 text-(--system-orange)" />
                        )}
                        <span className="min-w-0 truncate">{t(toast)}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>

          <AnimatePresence>{onboarding && <Onboarding key="onboarding" />}</AnimatePresence>
        </main>
      </MotionConfig>
    </MapContext>
  );
}
