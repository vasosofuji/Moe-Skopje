"use client";

import { Compass, Megaphone, Settings, Sparkles, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { GlassPill } from "@/components/glass/GlassPill";
import { Segmented } from "@/components/glass/Segmented";
import { cx, focusRing } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import type { Tab } from "./AppShell";

const spring = { type: "spring", stiffness: 400, damping: 30 } as const;

export const TAB_ICONS: Record<Tab, LucideIcon> = {
  explore: Compass,
  report: Megaphone,
  ask: Sparkles,
  settings: Settings,
};
const TABS = Object.keys(TAB_ICONS) as Tab[];

/**
 * The four tabs. `floating`: the glass capsule at the bottom of phones and tablets, safe-area aware.
 * `segmented`: a segmented control for the top of the desktop sidebar.
 */
export function TabBar({ tab, onChange, variant }: { tab: Tab; onChange(tab: Tab): void; variant: "floating" | "segmented" }) {
  const { t } = useT();

  if (variant === "segmented") {
    return (
      <nav aria-label={t("shell.tabs")}>
        <Segmented id="tab-thumb" label={t("shell.tabs")} options={TABS.map((v) => ({ value: v, label: t(`tab.${v}`) }))} value={tab} onChange={onChange} />
      </nav>
    );
  }

  return (
    <GlassPill
      as="nav"
      aria-label={t("shell.tabs")}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+8px)] left-1/2 z-20 h-[62px] w-[min(400px,calc(100vw-24px))] -translate-x-1/2 gap-0 px-1"
    >
      {TABS.map((id) => {
        const Icon = TAB_ICONS[id];
        const on = id === tab;
        return (
          <button
            key={id}
            type="button"
            aria-current={on ? "page" : undefined}
            onClick={() => onChange(id)}
            className={cx(
              "relative flex h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full transition-colors",
              focusRing,
              on ? "text-(--system-blue)" : "text-label",
            )}
          >
            {on && (
              <motion.span layoutId="tab-highlight" transition={spring} className="absolute inset-0 rounded-full bg-(--label)/8" />
            )}
            <Icon size={22} strokeWidth={on ? 2.25 : 1.75} aria-hidden className="relative" />
            <span className="relative max-w-full truncate px-1 text-[10px] font-semibold leading-3">{t(`tab.${id}`)}</span>
          </button>
        );
      })}
    </GlassPill>
  );
}
