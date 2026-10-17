"use client";

import { ChevronLeft, ChevronRight, Database, Info, Languages, SunMoon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toggleLayer } from "@/components/onboarding/LayerGrid";
import { cx, focusRing } from "@/lib/cx";
import { useT, type Dict, type Lang } from "@/lib/i18n";
import { HIDDEN_LAYERS, isLayerId, LAYERS, type LayerId } from "@/lib/layers";
import { usePrefs, type Prefs } from "@/lib/prefs";
import { version } from "@/package.json";
import { DataHealth, statusSummary, useHealth, type HealthRow } from "./DataHealth";
import { Choice, HeaderButton, insetFocus, List, row, RowContent, rowStatic, Section, SwitchKnob } from "./Grouped";

const LANGS: Lang[] = ["mk", "en"];

// Category order and members. Ids missing from LAYERS drop out, so roadworks shows up once it exists;
// HIDDEN_LAYERS (waste) are never listed (spec §11).
const GROUPS: { key: keyof Dict; ids: string[] }[] = [
  { key: "settings.group.environment", ids: ["air", "weather", "earthquakes"] },
  { key: "settings.group.utilities", ids: ["outages-power", "outages-water", "outages-heating"] },
  { key: "settings.group.transport", ids: ["buses", "parking", "roadworks"] },
  { key: "settings.group.services", ids: ["pharmacies"] },
];

/** Layers offered in Settings, by category; empty categories are dropped. */
export const LAYER_GROUPS: { key: keyof Dict; ids: LayerId[] }[] = GROUPS.map((g) => ({ ...g, ids: g.ids.filter((id): id is LayerId => isLayerId(id) && !HIDDEN_LAYERS.includes(id)) })).filter(
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
              label={t("settings.theme")}
              options={(["system", "light", "dark"] as const).map((v) => ({ value: v, label: t(`settings.theme.${v}`) }))}
              value={prefs.theme}
              fill
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
    <div className="flex flex-col gap-6">
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
        className={cx("t-body flex min-h-11 items-center self-start pr-2 text-(--system-blue)", insetFocus)}
      >
        <ChevronLeft size={26} strokeWidth={2.25} aria-hidden />
        {t("common.back")}
      </button>
      <h2 className="t-large-title px-1">{t("settings.sources")}</h2>
      <div className="flex flex-col">
        <DataHealth rows={health} />
        <p className="t-footnote px-4 pt-2 text-label-2">{t("settings.healthBody")}</p>
      </div>
    </div>
  );
}

/** Push/pop slide: the incoming page covers the outgoing one, which drifts a third of the way off like in a navigation stack. */
const PAGE = {
  enter: (dir: 1 | -1) => ({ x: dir > 0 ? "100%" : "-30%", opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: 1 | -1) => ({ x: dir > 0 ? "-30%" : "100%", opacity: 0 }),
};
const SLIDE = { duration: 0.2, ease: [0.32, 0.72, 0, 1] } as const;
const NONE = { duration: 0 } as const;

/**
 * Settings tab as an iOS grouped list: Display, Map layers, Data, About.
 * "Sources" pushes the data health page with a 200 ms slide (none with reduced motion); Back pops it and returns focus to the row.
 */
export function SettingsPanel() {
  const health = useHealth();
  const reduce = useReducedMotion();
  const [{ view, dir }, setNav] = useState<{ view: "root" | "sources"; dir: 1 | -1 }>({ view: "root", dir: 1 });
  const top = useRef<HTMLDivElement>(null);
  const returning = useRef(false);

  const show = (next: "root" | "sources") => {
    returning.current = next === "root";
    setNav({ view: next, dir: next === "sources" ? 1 : -1 });
    top.current?.scrollIntoView({ block: "nearest" }); // a scrolled panel shows the new page from its top
  };

  useEffect(() => {
    if (view === "root" && returning.current) top.current?.querySelector<HTMLElement>("[data-opens='sources']")?.focus({ preventScroll: true });
    returning.current = false;
  }, [view]);

  const page = { variants: PAGE, custom: dir, initial: "enter", animate: "center", exit: "exit", transition: reduce ? NONE : SLIDE } as const;

  return (
    <div ref={top} className="relative overflow-x-clip">
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        {view === "sources" ? (
          <motion.div key="sources" {...page}>
            <SourcesPage health={health} onBack={() => show("root")} />
          </motion.div>
        ) : (
          <motion.div key="root" {...page}>
            <Root health={health} onSources={() => show("sources")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
