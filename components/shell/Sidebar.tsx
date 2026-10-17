"use client";

import type { ReactNode } from "react";
import { Glass } from "@/components/glass/Glass";
import { useT } from "@/lib/i18n";

/**
 * Floating glass panel on the left for tablet (360 px, ends above the tab bar) and desktop (380 px, full height); its
 * box comes from layout-tokens.css. The app name is a plain wordmark; `header` stays put; `children` scroll.
 */
export function Sidebar({ header, children }: { header: ReactNode; children: ReactNode }) {
  const { t } = useT();
  return (
    <Glass
      as="aside"
      strong
      aria-label={t("app.name")}
      className="fixed top-(--map-t) bottom-(--sidebar-b) left-(--sidebar-l) z-(--z-sheet) flex w-(--sidebar-w) flex-col"
    >
      <div className="flex shrink-0 flex-col gap-3 p-4 pb-3">
        <p className="t-headline px-1">{t("app.name")}</p>
        {header}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-4">{children}</div>
    </Glass>
  );
}
