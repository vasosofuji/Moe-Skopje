"use client";

import { ChevronLeft, ChevronRight, Database, Info, Languages, SunMoon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { toggleLayer } from "@/components/onboarding/LayerGrid";
import { cx, focusRing } from "@/lib/cx";
import { useT, type Dict, type Lang } from "@/lib/i18n";
import { isLayerId, LAYERS, type LayerId } from "@/lib/layers";
import { usePrefs, type Prefs } from "@/lib/prefs";
import { version } from "@/package.json";
import { DataHealth, statusSummary, useHealth, type HealthRow } from "./DataHealth";
import { Choice, HeaderButton, List, row, RowContent, rowStatic, Section, SwitchKnob } from "./Grouped";

const spring = { type: "spring", stiffness: 400, damping: 30 } as const;
const LANGS: Lang[] = ["mk", "en"];

// Category order and members. Ids missing from LAYERS drop out, so roadworks shows up once it exists;
// waste and reports are deliberately not listed (spec §11).
const GROUPS: { key: keyof Dict; ids: string[] }[] = [
  { key: "settings.group.environment", ids: ["air", "weather", "earthquakes"] },
  { key: "settings.group.utilities", ids: ["outages-power", "outages-water", "outages-heating"] },
  { key: "settings.group.transport", ids: ["buses", "parking", "roadworks"] },
  { key: "settings.group.services", ids: ["pharmacies", "events", "schools"] },
];

/** Layers offered in Settings, by category; empty categories are dropped. */
export const LAYER_GROUPS: { key: keyof Dict; ids: LayerId[] }[] = GROUPS.map((g) => ({ ...g, ids: g.ids.filter(isLayerId) })).filter(
  (g) => g.ids.length > 0,
);
const LISTED = LAYER_GROUPS.flatMap((g) => g.ids);

function DisplaySection() {
  const { t, lang, setLang } = useT();
  const [prefs, setPrefs] = usePrefs();
  return (
    <Section title={t("settings.display")}>
      <List>
        <div className={rowStatic}>
          <RowContent icon={Languages} title={t("settings.language")}>
            <Choice<Lang>
              id="settings-lang"
              label={t("settings.language")}
              options={LANGS.map((l) => ({ value: l, label: t(`lang.${l}.short`), lang: l, title: t(`lang.${l}`) }))}
              value={lang}
              onChange={setLang}
            />
          </RowContent>
        </div>
        <div className={rowStatic}>
          <RowContent icon={SunMoon} title={t("settings.theme")} wrap>
            <Choice<Prefs["theme"]>
              id="settings-theme"
              label={t("settings.theme")}
              options={(["system", "light", "dark"] as const).map((v) => ({ value: v, label: t(`settings.theme.${v}`) }))}
              value={prefs.theme}
              onChange={(theme) => setPrefs({ theme })}
            />
          </RowContent>
        </div>
      </List>
    </Section>
  );
}

function LayersSection() {
  const { t } = useT();
  const [prefs, setPrefs] = usePrefs();
  const allOn = LISTED.every((id) => prefs.layers.includes(id));
  return (
    <Section
      title={t("settings.mapLayers")}
      action={
        <HeaderButton onClick={() => setPrefs({ layers: allOn ? [] : [...LISTED] })}>
          {t(allOn ? "settings.hideAll" : "settings.showAll")}
        </HeaderButton>
      }
    >
      {LAYER_GROUPS.map((g) => (
        <List key={g.key} label={t(g.key)}>
          {g.ids.map((id) => {
            const on = prefs.layers.includes(id);
            return (
              <button
                key={id}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => setPrefs({ layers: toggleLayer(prefs.layers, id) })}
                className={row}
              >
                <RowContent icon={LAYERS[id].icon} title={t(LAYERS[id].titleKey)}>
                  <SwitchKnob />
                </RowContent>
              </button>
            );
          })}
        </List>
      ))}
    </Section>
  );
}

function Root({ health, onSources }: { health: HealthRow[] | null | undefined; onSources(): void }) {
  const { t } = useT();
  const [, setPrefs] = usePrefs();
  const sources = health ? [...new Map(health.filter((r) => r.source.url).map((r) => [r.source.name, r.source.url]))] : [];
  return (
    <div className="flex flex-col gap-5">
      <h2 className="t-large-title px-1">{t("settings.title")}</h2>

      <DisplaySection />
      <LayersSection />

      <Section title={t("settings.data")}>
        <List>
          <button type="button" data-opens="sources" onClick={onSources} className={row}>
            <RowContent icon={Database} title={t("settings.sources")}>
              {health === undefined ? (
                <span aria-hidden className="skeleton h-3.5 w-20" />
              ) : (
                <span className="t-subhead min-w-0 truncate text-label-2">
                  {health?.length ? statusSummary(health.map((r) => r.status), t) || t("status.static") : t("explore.noData")}
                </span>
              )}
              <ChevronRight size={17} aria-hidden className="-mr-1 shrink-0 text-label-2" />
            </RowContent>
          </button>
        </List>
      </Section>

      <Section
        title={t("settings.about")}
        footer={
          <p>
            {t("settings.openData")}
            {sources.length > 0 && ": "}
            {sources.map(([name, url], i) => (
              <span key={name}>
                {i > 0 && ", "}
                <a href={url} target="_blank" rel="noreferrer" className={cx("rounded-sm text-(--system-blue)", focusRing)}>
                  {name}
                </a>
              </span>
            ))}
            .
          </p>
        }
      >
        <List>
          <div className={rowStatic}>
            <RowContent icon={Info} title={t("settings.version")}>
              <span className="t-subhead tabular-nums text-label-2">{version}</span>
            </RowContent>
          </div>
          <button
            type="button"
            onClick={() => window.confirm(t("settings.resetConfirm")) && setPrefs({ onboarded: false })}
            className={row}
          >
            <RowContent title={<span className="text-(--system-red)">{t("settings.resetOnboarding")}</span>} />
          </button>
        </List>
      </Section>
    </div>
  );
}

function SourcesPage({ health, onBack }: { health: HealthRow[] | null | undefined; onBack(): void }) {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        autoFocus
        onClick={onBack}
        className={cx("t-body -ml-2 flex min-h-11 items-center self-start pr-2 text-(--system-blue)", focusRing)}
      >
        <ChevronLeft size={26} strokeWidth={2.25} aria-hidden />
        {t("common.back")}
      </button>
      <h2 className="t-large-title px-1">{t("settings.sources")}</h2>
      <div className="flex flex-col">
        <DataHealth rows={health} />
        <p className="t-footnote px-4 pt-1.5 text-label-2">{t("settings.healthBody")}</p>
      </div>
    </div>
  );
}

/**
 * Settings tab as an iOS grouped list: Display, Map layers, Data, About.
 * "Sources" pushes the data health page (slide; fades only with reduced motion); Back returns focus to the row.
 */
export function SettingsPanel() {
  const health = useHealth();
  const [view, setView] = useState<"root" | "sources">("root");
  const top = useRef<HTMLDivElement>(null);
  const returning = useRef(false);

  const show = (next: "root" | "sources") => {
    returning.current = next === "root";
    setView(next);
    top.current?.scrollIntoView({ block: "nearest" }); // a scrolled panel shows the new page from its top
  };

  return (
    <div ref={top} className="relative">
      <AnimatePresence mode="popLayout" initial={false}>
        {view === "sources" ? (
          <motion.div key="sources" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={spring}>
            <SourcesPage health={health} onBack={() => show("root")} />
          </motion.div>
        ) : (
          <motion.div
            key="root"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={spring}
            onAnimationComplete={() => {
              if (returning.current) top.current?.querySelector<HTMLElement>("[data-opens='sources']")?.focus();
              returning.current = false;
            }}
          >
            <Root health={health} onSources={() => show("sources")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
