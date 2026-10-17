"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { Segmented } from "@/components/glass/Segmented";
import { LayerGrid } from "@/components/onboarding/LayerGrid";
import { AppMark } from "@/components/shell/Sidebar";
import { useT, type Lang } from "@/lib/i18n";
import { usePrefs, type Prefs } from "@/lib/prefs";
import { DataHealth } from "./DataHealth";

function Section({ title, body, children }: { title: string; body?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="px-1">
        <h3 className="t-headline">{title}</h3>
        {body && <p className="t-footnote text-label-2">{body}</p>}
      </div>
      {children}
    </section>
  );
}

/** Settings tab: language, theme, default layers, data health, about. */
export function SettingsPanel() {
  const { t, lang, setLang } = useT();
  const [prefs, setPrefs] = usePrefs();
  return (
    <div className="flex flex-col gap-6">
      <h2 className="t-large-title px-1">{t("settings.title")}</h2>

      <Section title={t("settings.language")}>
        <Segmented<Lang>
          id="lang-thumb"
          label={t("settings.language")}
          options={[
            { value: "mk", label: t("lang.mk") },
            { value: "en", label: t("lang.en") },
          ]}
          value={lang}
          onChange={setLang}
        />
      </Section>

      <Section title={t("settings.theme")}>
        <Segmented<Prefs["theme"]>
          id="theme-thumb"
          label={t("settings.theme")}
          options={[
            { value: "system", label: t("settings.theme.system"), icon: Monitor },
            { value: "light", label: t("settings.theme.light"), icon: Sun },
            { value: "dark", label: t("settings.theme.dark"), icon: Moon },
          ]}
          value={prefs.theme}
          onChange={(theme) => setPrefs({ theme })}
        />
      </Section>

      <Section title={t("settings.layers")}>
        <LayerGrid value={prefs.layers} onChange={(layers) => setPrefs({ layers })} />
      </Section>

      <Section title={t("settings.health")} body={t("settings.healthBody")}>
        <DataHealth />
      </Section>

      <Section title={t("settings.about")}>
        <div className="flex gap-3 rounded-card border-[0.5px] border-(--glass-stroke) bg-(--tile) p-3">
          <AppMark size={40} />
          <div className="min-w-0">
            <p className="t-headline">{t("app.name")}</p>
            <p className="t-footnote text-label-2">{t("settings.aboutBody")}</p>
          </div>
        </div>
      </Section>
    </div>
  );
}
