"use client";

import { Compass, MessageCircle, Settings, type LucideIcon } from "lucide-react";
import { Segmented } from "@/components/glass/Segmented";
import { cx, focusRing } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import type { Tab } from "./AppShell";

export const TAB_ICONS: Record<Tab, LucideIcon> = {
  explore: Compass,
  ask: MessageCircle,
  settings: Settings,
};
const TABS = Object.keys(TAB_ICONS) as Tab[];

/**
 * The tabs. `bar`: the solid iOS tab bar along the bottom of phones and tablets, 49 px plus the home-indicator inset
 * (--tabbar-h); the phone sheet rests on top of it. Three equal tabs, glyph over label, the current one in system blue.
 * `segmented`: a segmented control for the top of the desktop sidebar, without Ask (the chat bar over the map has it).
 */
export function TabBar({ tab, onChange, variant }: { tab: Tab; onChange(tab: Tab): void; variant: "bar" | "segmented" }) {
  const { t } = useT();

  if (variant === "segmented") {
    const tabs = TABS.filter((v) => v !== "ask");
    return (
      <nav aria-label={t("shell.tabs")}>
        <Segmented id="tab-thumb" label={t("shell.tabs")} options={tabs.map((v) => ({ value: v, label: t(`tab.${v}`) }))} value={tab} onChange={onChange} />
      </nav>
    );
  }

  return (
    <nav
      aria-label={t("shell.tabs")}
      className="fixed inset-x-0 bottom-0 z-(--z-bar) flex h-(--tabbar-h) border-t-[0.5px] border-(--bar-hairline) bg-(--bar-bg) pr-(--safe-r) pb-(--safe-b) pl-(--safe-l)"
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
            // Press feedback: the tab dims at once, as on iOS (no scale or tint on a full-height bar segment).
            className={cx(
              "flex min-w-0 flex-1 flex-col items-center gap-0.5 pt-[7px] active:scale-100 active:opacity-50 active:shadow-none",
              focusRing,
              on ? "text-(--system-blue)" : "text-(--system-gray)",
            )}
          >
            <Icon size={24} strokeWidth={on ? 2.25 : 1.75} aria-hidden />
            <span className="max-w-full truncate px-1 text-[10px] leading-3 font-medium">{t(`tab.${id}`)}</span>
          </button>
        );
      })}
    </nav>
  );
}
