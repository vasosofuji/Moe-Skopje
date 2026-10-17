"use client";

import { LocateFixed, LocateOff, WifiOff, X } from "lucide-react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import { ExplorePanel } from "@/components/explore/ExplorePanel";
import { GlassButton } from "@/components/glass/GlassButton";
import { MapContext, MapView, type LngLat, type MapApi } from "@/components/map/MapView";
import { MarkerCard } from "@/components/map/MarkerCard";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { cx, focusRing } from "@/lib/cx";
import { useT, type Dict } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";
import type { Feature } from "@/lib/sources/types";
import { useHydrated, useIsDesktop, useMedia } from "@/lib/useMedia";
import { BottomSheet, SNAPS, type Snap } from "./BottomSheet";
import { LayerChips } from "./LayerChips";
import { SearchPill } from "./SearchPill";
import { Sidebar } from "./Sidebar";
import { TAB_ICONS, TabBar } from "./TabBar";

export type Tab = "explore" | "report" | "ask" | "settings";
type PanelTab = Exclude<Tab, "ask">;

const spring = { type: "spring", stiffness: 400, damping: 30 } as const;
const TOAST_MS = 6000;

/** Report and Ask until their own tasks land. */
function ComingSoon({ tab }: { tab: "report" | "ask" }) {
  const { t } = useT();
  const Icon = TAB_ICONS[tab];
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-(--system-blue)/12 text-(--system-blue)">
        <Icon size={30} aria-hidden />
      </span>
      <h2 className="t-title2">{t(tab === "ask" ? "assistant.title" : "report.title")}</h2>
      <p className="t-subhead max-w-[280px] text-label-2">{t("shell.comingSoon")}</p>
    </div>
  );
}

function Panel({ tab }: { tab: Tab }) {
  if (tab === "explore") return <ExplorePanel />;
  if (tab === "settings") return <SettingsPanel />;
  return <ComingSoon tab={tab} />;
}

/** Desktop slot for the assistant: a floating 400 px glass panel on the right. */
function AskPanel({ onClose }: { onClose(): void }) {
  const { t } = useT();
  return (
    <motion.aside
      aria-label={t("tab.ask")}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={spring}
      className="glass glass-strong fixed top-4 right-4 bottom-4 z-10 flex w-[400px] flex-col"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t("common.close")}
        className={cx("absolute top-2 right-2 flex size-11 items-center justify-center rounded-full", focusRing)}
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-(--label)/8 text-label-2">
          <X size={15} strokeWidth={2.5} aria-hidden />
        </span>
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <ComingSoon tab="ask" />
      </div>
    </motion.aside>
  );
}

/**
 * The whole app: a full-bleed map with glass chrome floating over it.
 * Phones (<768): search pill on top, vaul bottom sheet, floating tab bar.
 * Tablets (768–1023): 360 px sidebar ending above the tab bar.
 * Desktop (≥1024): 380 px sidebar with the tabs as a segmented control, layer chips top-centre, Ask on the right.
 * Owns the tab, the selected feature and the camera, and shares them through MapContext (`useMap()`).
 */
export function AppShell() {
  const { t, lang, setLang } = useT();
  const [prefs] = usePrefs();
  const hydrated = useHydrated();
  const isDesktop = useIsDesktop();
  const isWide = useMedia("(min-width: 768px)");
  const systemDark = useMedia("(prefers-color-scheme: dark)");
  const dark = prefs.theme === "dark" || (prefs.theme === "system" && systemDark);

  const [tab, setTab] = useState<Tab>("explore");
  const [lastPanel, setLastPanel] = useState<PanelTab>("explore"); // what the desktop sidebar keeps showing while Ask is open
  const [snap, setSnap] = useState<Snap>(SNAPS[0]);
  const [selected, select] = useState<Feature | null>(null);
  const [map, setMap] = useState<MapLibreMap>();
  const [location, setLocation] = useState<LngLat>();
  const [toast, setToast] = useState<keyof Dict | null>(null);

  const askFloating = isDesktop && tab === "ask";
  const sheetFull = !isWide && snap === SNAPS[SNAPS.length - 1]; // the map is covered: hide what floats over it
  const insetLeft = isDesktop ? 412 : isWide ? 392 : 0; // sidebar width plus its 16 px margins
  const insetRight = askFloating ? 432 : 0;

  const flyTo = useCallback(
    (center: LngLat, zoom?: number) => {
      map?.flyTo({
        center,
        zoom: zoom ?? Math.max(map.getZoom(), 14),
        // Centre the target in the part of the map that is not under a panel.
        padding: isWide
          ? { left: insetLeft, right: insetRight, top: 0, bottom: 0 }
          : { left: 0, right: 0, top: 120, bottom: Math.round(innerHeight * 0.35) },
      });
    },
    [map, isWide, insetLeft, insetRight],
  );

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
    if (next !== "ask") setLastPanel(next);
    if (!isWide && snap === SNAPS[0]) setSnap(SNAPS[1]);
  };
  const closeCard = useCallback(() => select(null), []);
  const api = useMemo<MapApi>(() => ({ map, flyTo, select, location, locate }), [map, flyTo, location, locate]);

  const onboarding = hydrated && !prefs.onboarded;
  const other = lang === "mk" ? "en" : "mk";

  return (
    <MapContext value={api}>
      <MotionConfig reducedMotion="user">
        <main className="shell fixed inset-0 overflow-hidden" data-ask={askFloating ? "" : undefined}>
          <div inert={onboarding} className="contents">
            <MapView layers={prefs.layers} dark={dark} onReady={setMap} onTileError={() => setToast("map.tilesUnavailable")} />

            {/* Layout depends on the viewport and saved prefs, which only the client knows. */}
            {hydrated && (
              <>
                {isWide ? (
                  <Sidebar
                    desktop={isDesktop}
                    header={
                      <>
                        <SearchPill />
                        {isDesktop && <TabBar variant="segmented" tab={tab} onChange={go} />}
                      </>
                    }
                  >
                    <Panel tab={askFloating ? lastPanel : tab} />
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
                      <Panel tab={tab} />
                    </BottomSheet>
                  </>
                )}

                {!isDesktop && <TabBar variant="floating" tab={tab} onChange={go} />}
                {isDesktop && <LayerChips askOpen={askFloating} />}
                <AnimatePresence>{askFloating && <AskPanel key="ask" onClose={() => go(lastPanel)} />}</AnimatePresence>

                {!sheetFull && (
                  <GlassButton
                    shape="circle"
                    aria-label={t("map.myLocation")}
                    onClick={() => void locate(true)}
                    className={cx(
                      "fixed z-10",
                      isWide ? cx("bottom-12", askFloating ? "right-[432px]" : "right-4") : "top-[calc(env(safe-area-inset-top)+68px)] right-3",
                    )}
                  >
                    <LocateFixed size={20} aria-hidden className={location ? "text-(--system-blue)" : undefined} />
                  </GlassButton>
                )}

                <AnimatePresence>
                  {map && selected && !sheetFull && (
                    <MarkerCard
                      key={selected.properties.id}
                      feature={selected}
                      map={map}
                      docked={!isDesktop}
                      insetLeft={insetLeft}
                      insetRight={insetRight}
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
                      className={cx(
                        "glass glass-pill t-subhead fixed left-1/2 z-30 max-w-[calc(100vw-24px)] -translate-x-1/2 font-medium",
                        isWide ? "top-[72px]" : "top-[calc(env(safe-area-inset-top)+68px)]",
                      )}
                    >
                      {toast === "map.tilesUnavailable" ? (
                        <WifiOff size={16} aria-hidden className="shrink-0 text-(--system-orange)" />
                      ) : (
                        <LocateOff size={16} aria-hidden className="shrink-0 text-(--system-orange)" />
                      )}
                      {t(toast)}
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
