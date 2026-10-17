"use client";

import { Check, ChevronLeft, LocateFixed } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Glass } from "@/components/glass/Glass";
import { GlassButton } from "@/components/glass/GlassButton";
import { useMap } from "@/components/map/MapView";
import { cx, focusRing } from "@/lib/cx";
import { useT, type Lang } from "@/lib/i18n";
import { fade } from "@/lib/motion";
import { DEFAULT_PREFS, usePrefs } from "@/lib/prefs";
import { LayerGrid } from "./LayerGrid";

const STEPS = 3;
const LANGS: Lang[] = ["mk", "en"];

const primary = "w-full bg-(--system-blue) text-white";

type Nav = { step: number; dir: 1 | -1 };
type Motion = { dir: 1 | -1; still: boolean };

/** Steps cross-fade while drifting 24 px along the direction of travel: 180 ms in all, fade only with reduced motion. */
const STEP = {
  enter: ({ dir, still }: Motion) => ({ opacity: 0, x: still ? 0 : dir * 24 }),
  center: { opacity: 1, x: 0 },
  exit: ({ dir, still }: Motion) => ({ opacity: 0, x: still ? 0 : dir * -24 }),
};
const STEP_TRANSITION = { duration: 0.18, ease: "easeOut" } as const;

// Each step is remounted (keyed), so its Body starts scrolled to the top. Footer stays pinned and clears the home indicator.
const Body = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain pt-4 pb-4">{children}</div>
);
const Footer = ({ children }: { children: ReactNode }) => (
  <div className="flex shrink-0 flex-col gap-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+16px)]">{children}</div>
);
const Heading = ({ children }: { children: ReactNode }) => (
  <h1 id="onboarding-title" tabIndex={-1} className="t-large-title text-balance outline-none">
    {children}
  </h1>
);

/**
 * First run, full screen over the map: (a) language, (b) layers, (c) optional location. Finishing sets `onboarded`.
 * Modal: the shell makes everything else inert while this is shown.
 */
export function Onboarding() {
  const { t, lang, setLang } = useT();
  const [, setPrefs] = usePrefs();
  const { locate } = useMap();
  const reduce = useReducedMotion();
  const [{ step, dir }, setNav] = useState<Nav>({ step: 0, dir: 1 });
  const [layers, setLayers] = useState(() => [...DEFAULT_PREFS.layers]);
  const [location, setLocation] = useState<"idle" | "asking" | "denied">("idle");
  const dialog = useRef<HTMLDivElement>(null);

  const go = (to: number) => setNav({ step: to, dir: to > step ? 1 : -1 });
  const finish = () => setPrefs({ layers, onboarded: true });
  const askLocation = async () => {
    setLocation("asking");
    if (await locate(false)) finish();
    else setLocation("denied");
  };

  // The pressed button unmounts with its step: hand focus to the new step's title, which also moves it into the dialog on open.
  useEffect(() => {
    const titles = dialog.current?.querySelectorAll<HTMLElement>("#onboarding-title");
    titles?.[titles.length - 1]?.focus({ preventScroll: true });
  }, [step]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={fade}
      className="fixed inset-0 z-50"
    >
      <Glass
        strong
        role="dialog"
        aria-modal
        aria-labelledby="onboarding-title"
        className="flex h-full flex-col overflow-hidden rounded-none border-0 pt-[calc(env(safe-area-inset-top)+16px)] pr-[max(24px,env(safe-area-inset-right))] pl-[max(24px,env(safe-area-inset-left))]"
      >
        <div ref={dialog} className="relative mx-auto flex min-h-0 w-full max-w-[440px] flex-1 flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => go(step - 1)}
                className={cx("-ml-3 flex h-11 items-center gap-0.5 rounded-full pr-3 pl-1 t-body text-(--system-blue)", focusRing)}
              >
                <ChevronLeft size={24} aria-hidden />
                {t("common.back")}
              </button>
            ) : (
              <span />
            )}
            <p className="t-footnote tabular-nums text-label-2">{t("onboarding.step", { n: step + 1, total: STEPS })}</p>
          </div>

          <AnimatePresence mode="popLayout" initial={false} custom={{ dir, still: !!reduce }}>
            <motion.div
              key={step}
              custom={{ dir, still: !!reduce }}
              variants={STEP}
              initial="enter"
              animate="center"
              exit="exit"
              transition={STEP_TRANSITION}
              className="flex min-h-0 flex-1 flex-col"
            >
              {step === 0 && (
                <>
                  <Body>
                    <div className="flex flex-col items-start gap-2">
                      <Heading>{t("onboarding.welcome")}</Heading>
                      <p className="t-body text-label-2">{t("onboarding.welcomeBody")}</p>
                    </div>
                    <div role="group" aria-label={t("onboarding.language")} className="flex flex-col gap-2">
                      <p className="t-caption px-1 uppercase tracking-wide text-label-2">{t("onboarding.language")}</p>
                      {LANGS.map((l) => (
                        <button
                          key={l}
                          type="button"
                          lang={l}
                          aria-pressed={lang === l}
                          onClick={() => setLang(l)}
                          className={cx(
                            "flex min-h-14 items-center justify-between rounded-card border-[1.5px] px-4 t-body transition-colors",
                            focusRing,
                            lang === l ? "border-(--system-blue) bg-(--system-blue)/10" : "border-(--label)/10 bg-(--tile)",
                          )}
                        >
                          {t(`lang.${l}`)}
                          {lang === l && <Check size={20} strokeWidth={2.5} aria-hidden className="text-(--system-blue)" />}
                        </button>
                      ))}
                    </div>
                  </Body>
                  <Footer>
                    <GlassButton onClick={() => go(1)} className={primary}>
                      {t("common.continue")}
                    </GlassButton>
                  </Footer>
                </>
              )}

              {step === 1 && (
                <>
                  <Body>
                    <div className="flex flex-col gap-2">
                      <Heading>{t("onboarding.layersTitle")}</Heading>
                      <p className="t-body text-label-2">{t("onboarding.layersBody")}</p>
                    </div>
                    <LayerGrid value={layers} onChange={setLayers} />
                  </Body>
                  <Footer>
                    <GlassButton onClick={() => go(2)} className={primary}>
                      {t("common.continue")}
                    </GlassButton>
                  </Footer>
                </>
              )}

              {step === 2 && (
                <>
                  <Body>
                    <div className="flex flex-col items-start gap-4">
                      <LocateFixed size={34} aria-hidden className="text-(--system-blue)" />
                      <Heading>{t("onboarding.locationTitle")}</Heading>
                      <p className="t-body text-label-2">{t("onboarding.locationBody")}</p>
                      {location === "denied" && (
                        <p role="status" className="t-subhead text-(--system-orange)">
                          {t("onboarding.locationDenied")}
                        </p>
                      )}
                    </div>
                  </Body>
                  <Footer>
                    {location === "denied" ? (
                      <GlassButton onClick={finish} className={primary}>
                        {t("onboarding.start")}
                      </GlassButton>
                    ) : (
                      <>
                        <GlassButton onClick={askLocation} disabled={location !== "idle"} className={primary}>
                          {t("onboarding.allowLocation")}
                        </GlassButton>
                        <GlassButton onClick={finish} className="w-full">
                          {t("onboarding.skip")}
                        </GlassButton>
                      </>
                    )}
                  </Footer>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </Glass>
    </motion.div>
  );
}
