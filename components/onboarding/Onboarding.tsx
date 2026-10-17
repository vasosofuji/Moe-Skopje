"use client";

import { Check, ChevronLeft, LocateFixed } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Glass } from "@/components/glass/Glass";
import { GlassButton } from "@/components/glass/GlassButton";
import { useMap } from "@/components/map/MapView";
import { AppMark } from "@/components/shell/Sidebar";
import { cx, focusRing } from "@/lib/cx";
import { useT, type Lang } from "@/lib/i18n";
import { DEFAULT_PREFS, usePrefs } from "@/lib/prefs";
import { LayerGrid } from "./LayerGrid";

const spring = { type: "spring", stiffness: 400, damping: 30 } as const;
const STEPS = 3;
const LANGS: Lang[] = ["mk", "en"];

// Soft colour fields behind the glass, so the first screen is frosted colour rather than flat grey while tiles load.
const BACKDROP = [
  "radial-gradient(40% 35% at 20% 20%, color-mix(in srgb, var(--system-blue) 45%, transparent), transparent)",
  "radial-gradient(35% 30% at 85% 30%, color-mix(in srgb, var(--system-pink) 35%, transparent), transparent)",
  "radial-gradient(45% 35% at 50% 95%, color-mix(in srgb, var(--system-teal) 40%, transparent), transparent)",
].join(",");

const primary = "w-full bg-(--system-blue) text-white";

/**
 * First run, full screen over the map: (a) language, (b) layers, (c) optional location. Finishing sets `onboarded`.
 * Modal: the shell makes everything else inert while this is shown.
 */
export function Onboarding() {
  const { t, lang, setLang } = useT();
  const [, setPrefs] = usePrefs();
  const { locate } = useMap();
  const [step, setStep] = useState(0);
  const [layers, setLayers] = useState(() => [...DEFAULT_PREFS.layers]);
  const [location, setLocation] = useState<"idle" | "asking" | "denied">("idle");

  const finish = () => setPrefs({ layers, onboarded: true });
  const askLocation = async () => {
    setLocation("asking");
    if (await locate(false)) finish();
    else setLocation("denied");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50"
      style={{ backgroundImage: BACKDROP }}
    >
      <Glass
        strong
        role="dialog"
        aria-modal
        aria-labelledby="onboarding-title"
        className="flex h-full flex-col overflow-y-auto rounded-none border-0 px-6 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+24px)]"
      >
        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col">
          <div className="flex h-11 items-center justify-between">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className={cx("-ml-3 flex h-11 items-center gap-0.5 rounded-full pr-3 pl-1 t-body text-(--system-blue)", focusRing)}
              >
                <ChevronLeft size={24} aria-hidden />
                {t("common.back")}
              </button>
            ) : (
              <span />
            )}
            <div role="img" aria-label={t("onboarding.step", { n: step + 1, total: STEPS })} className="flex gap-1.5">
              {Array.from({ length: STEPS }, (_, i) => (
                <span
                  key={i}
                  className={cx(
                    "h-2 rounded-full transition-all duration-300",
                    i === step ? "w-5 bg-(--system-blue)" : "w-2 bg-(--label)/20",
                  )}
                />
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }}
              transition={spring}
              className="flex flex-1 flex-col gap-6 pt-8"
            >
              {step === 0 && (
                <>
                  <div className="flex flex-col items-start gap-4">
                    <AppMark size={72} />
                    <h1 id="onboarding-title" className="t-large-title text-balance">
                      {t("onboarding.welcome")}
                    </h1>
                    <p className="t-body text-label-2">{t("onboarding.welcomeBody")}</p>
                  </div>
                  <div role="group" aria-label={t("onboarding.language")} className="flex flex-col gap-2">
                    <p className="t-footnote px-1 font-semibold uppercase tracking-wide text-label-2">{t("onboarding.language")}</p>
                    {LANGS.map((l) => (
                      <button
                        key={l}
                        type="button"
                        lang={l}
                        aria-pressed={lang === l}
                        onClick={() => setLang(l)}
                        className={cx(
                          "flex min-h-14 items-center justify-between rounded-card border-[0.5px] px-4 t-body transition-colors",
                          focusRing,
                          lang === l ? "border-(--system-blue)/50 bg-(--system-blue)/10" : "border-(--glass-stroke) bg-(--tile)",
                        )}
                      >
                        {t(`lang.${l}`)}
                        {lang === l && <Check size={20} strokeWidth={2.5} aria-hidden className="text-(--system-blue)" />}
                      </button>
                    ))}
                  </div>
                  <GlassButton onClick={() => setStep(1)} className={cx(primary, "mt-auto")}>
                    {t("common.continue")}
                  </GlassButton>
                </>
              )}

              {step === 1 && (
                <>
                  <div className="flex flex-col gap-2">
                    <h1 id="onboarding-title" className="t-large-title text-balance">
                      {t("onboarding.layersTitle")}
                    </h1>
                    <p className="t-body text-label-2">{t("onboarding.layersBody")}</p>
                  </div>
                  <LayerGrid value={layers} onChange={setLayers} />
                  <GlassButton onClick={() => setStep(2)} className={cx(primary, "mt-auto")}>
                    {t("common.continue")}
                  </GlassButton>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="flex flex-col items-start gap-4">
                    <span className="flex size-[72px] items-center justify-center rounded-full bg-(--system-blue)/12 text-(--system-blue)">
                      <LocateFixed size={34} aria-hidden />
                    </span>
                    <h1 id="onboarding-title" className="t-large-title text-balance">
                      {t("onboarding.locationTitle")}
                    </h1>
                    <p className="t-body text-label-2">{t("onboarding.locationBody")}</p>
                    {location === "denied" && (
                      <p role="status" className="t-subhead text-(--system-orange)">
                        {t("onboarding.locationDenied")}
                      </p>
                    )}
                  </div>
                  <div className="mt-auto flex flex-col gap-2">
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
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </Glass>
    </motion.div>
  );
}
