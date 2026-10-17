"use client";

import { LocateFixed, LocateOff, WifiOff } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import { AskBar } from "@/components/assistant/AskBar";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import type { Citation } from "@/components/assistant/Citation";
import { ExplorePanel } from "@/components/explore/ExplorePanel";
import { GlassButton } from "@/components/glass/GlassButton";
import { BusTracker } from "@/components/map/BusTracker";
import { MapContext, MapView, type BBox, type Highlight, type LngLat, type MapApi, type Trip } from "@/components/map/MapView";
import { MarkerCard } from "@/components/map/MarkerCard";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { cx } from "@/lib/cx";
import { useT, type Dict } from "@/lib/i18n";
import { HIDDEN_LAYERS } from "@/lib/layers";
import { usePrefs } from "@/lib/prefs";
import type { Feature } from "@/lib/sources/types";
import { getCachedLayer, refreshLayer } from "@/lib/useLayer";
import { useHydrated, useIsDesktop, useMedia } from "@/lib/useMedia";
import { BottomSheet, SNAPS, type Snap } from "./BottomSheet";
import { SearchPill } from "./SearchPill";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";

export type Tab = "explore" | "ask" | "settings";

const spring = { type: "spring", stiffness: 400, damping: 30 } as const;
const TOAST_MS = 6000;

function Panel({ tab, onCitation }: { tab: Tab; onCitation(c: Citation): void }) {
  if (tab === "explore") return <ExplorePanel />;
  if (tab === "settings") return <SettingsPanel />;
  return <AssistantPanel onCitation={onCitation} />;
}

/**
 * The whole app: a full-bleed map with glass chrome floating over it.
 * Phones (<768): search pill on top, vaul bottom sheet, floating tab bar.
 * Tablets (768–1023): 360 px sidebar ending above the tab bar.
 * Desktop (≥1024): 380 px sidebar with Explore and Settings as a segmented control; Ask is the chat bar over the map.
 * Owns the tab, the selected feature and the camera, and shares them through MapContext (`useMap()`).
 */
export function AppShell() {
  const { t, lang, setLang } = useT();
  const [prefs, setPrefs] = usePrefs();
  const hydrated = useHydrated();
  const isDesktop = useIsDesktop();
  const isWide = useMedia("(min-width: 768px)");
  const systemDark = useMedia("(prefers-color-scheme: dark)");
  const dark = prefs.theme === "dark" || (prefs.theme === "system" && systemDark);

  const [tab, setTab] = useState<Tab>("explore");
  const [snap, setSnap] = useState<Snap>(SNAPS[0]);
  const [selected, select] = useState<Feature | null>(null);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [trip, track] = useState<Trip | null>(null);
  const [map, setMap] = useState<MapLibreMap>();
  const [location, setLocation] = useState<LngLat>();
  const [toast, setToast] = useState<keyof Dict | null>(null);

  const panelTab = isDesktop && tab === "ask" ? "explore" : tab; // desktop asks through the bar, not a tab
  const sheetFull = !isWide && snap === SNAPS[SNAPS.length - 1]; // the map is covered: hide what floats over it
  const insetLeft = isDesktop ? 412 : isWide ? 392 : 0; // sidebar width plus its 16 px margins

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
      map?.flyTo({ center, zoom: zoom ?? Math.max(map.getZoom(), 14), padding: padding() });
    },
    [map, padding],
  );

  const showArea = useCallback(
    ([w, s, e, n]: BBox) => {
      map?.fitBounds([[w, s], [e, n]], { padding: padding(40), maxZoom: 16 });
    },
    [map, padding],
  );

  const reveal = useCallback(() => {
    if (!isWide) setSnap(SNAPS[0]);
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

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  const go = (next: Tab) => {
    setTab(next);
    if (isWide) return;
    if (next === "ask") setSnap(SNAPS[SNAPS.length - 1]); // the chat's input sits at the bottom of the panel
    else if (snap === SNAPS[0]) setSnap(SNAPS[1]);
  };

  // A citation chip flies to the feature and opens its card. A cited layer that is off is switched on first,
  // so the chip never lands on an empty spot; a feature not loaded yet is selected once its layer arrives.
  const onCitation = (c: Citation) => {
    flyTo([c.lng, c.lat], 15);
    if (!isWide) setSnap(SNAPS[0]); // lower the chat to its peek so the map and the card show; drag up to go on
    if (HIDDEN_LAYERS.includes(c.layer)) return select(null);
    if (!prefs.layers.includes(c.layer)) setPrefs({ layers: [...prefs.layers, c.layer] });
    const find = () => getCachedLayer(c.layer)?.features.features.find((f) => f.properties?.id === c.featureId) as Feature | undefined;
    const hit = find();
    select(hit ?? null);
    if (!hit) void refreshLayer(c.layer).then(() => select((prev) => prev ?? find() ?? null));
  };
  const closeCard = useCallback(() => select(null), []);
  const stopTracking = useCallback(() => track(null), []);
  const api = useMemo<MapApi>(
    () => ({ map, flyTo, showArea, reveal, select, location, locate, highlight, setHighlight, trip, track }),
    [map, flyTo, showArea, reveal, location, locate, highlight, trip],
  );

  const onboarding = hydrated && !prefs.onboarded;
  const other = lang === "mk" ? "en" : "mk";

  return (
    <MapContext value={api}>
      <MotionConfig reducedMotion="user">
        <main className="shell fixed inset-0 overflow-hidden">
          <div inert={onboarding} className="contents">
            <MapView layers={prefs.layers.filter((id) => !HIDDEN_LAYERS.includes(id))} dark={dark} onReady={setMap} onTileError={() => setToast("map.tilesUnavailable")} />

            {/* Layout depends on the viewport and saved prefs, which only the client knows. */}
            {hydrated && (
              <>
                {isWide ? (
                  <Sidebar
                    desktop={isDesktop}
                    header={
                      <>
                        <SearchPill />
                        {isDesktop && <TabBar variant="segmented" tab={panelTab} onChange={go} />}
                      </>
                    }
                  >
                    <Panel tab={panelTab} onCitation={onCitation} />
                  </Sidebar>
                ) : (
                  <>
                    <div
                      inert={sheetFull}
                      className={cx(
                        "fixed inset-x-3 top-[calc(env(safe-area-inset-top)+12px)] z-20 flex gap-2 transition-opacity duration-300",
                        sheetFull && "opacity-0",
                      )}
                    >
                      <SearchPill floating className="min-w-0 flex-1" />
                      <GlassButton shape="circle" aria-label={t(`lang.${other}`)} onClick={() => setLang(other)}>
                        <span lang={other} className="t-subhead font-semibold">
                          {t(`lang.${other}.short`)}
                        </span>
                      </GlassButton>
                    </div>
                    <BottomSheet snap={snap} onSnap={setSnap} title={t(`tab.${tab}`)}>
                      <Panel tab={tab} onCitation={onCitation} />
                    </BottomSheet>
                  </>
                )}

                {!isDesktop && <TabBar variant="floating" tab={tab} onChange={go} />}
                {isDesktop && <AskBar left={insetLeft} onCitation={onCitation} />}

                {!sheetFull && (
                  <GlassButton
                    shape="circle"
                    aria-label={t("map.myLocation")}
                    onClick={() => void locate(true)}
                    className={cx(
                      "fixed z-10",
                      isWide ? "right-4 bottom-12" : "top-[calc(env(safe-area-inset-top)+68px)] right-3",
                    )}
                  >
                    <LocateFixed size={20} aria-hidden className={location ? "text-(--system-blue)" : undefined} />
                  </GlassButton>
                )}

                <AnimatePresence>
                  {map && trip && !sheetFull && (
                    <BusTracker key={trip.tripId} trip={trip} map={map} floating={isWide} insetLeft={insetLeft} onClose={stopTracking} />
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {map && selected && !sheetFull && (
                    <MarkerCard
                      key={selected.properties.id}
                      feature={selected}
                      map={map}
                      docked={!isDesktop}
                      insetLeft={insetLeft}
                      onClose={closeCard}
                    />
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {toast && (
                    <motion.div
                      key={toast}
                      role="status"
                      initial={{ opacity: 0, y: -12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={spring}
                      style={{ left: `calc(${insetLeft}px + (100vw - ${insetLeft}px) / 2)`, maxWidth: `calc((100vw - ${insetLeft}px) * 0.9)` }}
                      className={cx(
                        "glass glass-pill fixed z-30 w-max -translate-x-1/2 font-medium whitespace-nowrap",
                        isWide ? "t-subhead top-4" : "t-footnote top-[calc(env(safe-area-inset-top)+68px)] px-3.5",
                      )}
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
              </>
            )}
          </div>

          <AnimatePresence>{onboarding && <Onboarding key="onboarding" />}</AnimatePresence>
        </main>
      </MotionConfig>
    </MapContext>
  );
}
