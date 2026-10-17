"use client";

import type { ReactNode } from "react";
import { Glass } from "@/components/glass/Glass";
import { cx } from "@/lib/cx";
import { useT } from "@/lib/i18n";

/**
 * Floating glass panel on the left for tablet (360 px, ends above the tab bar) and desktop (380 px, full height).
 * The app name is a plain wordmark; `header` stays put; `children` scroll.
 */
export function Sidebar({ desktop, header, children }: { desktop: boolean; header: ReactNode; children: ReactNode }) {
  const { t } = useT();
  return (
    <Glass
      as="aside"
      strong
      aria-label={t("app.name")}
      className={cx("fixed left-4 top-4 z-10 flex flex-col", desktop ? "bottom-4 w-[380px]" : "bottom-(--tab-zone) w-[360px]")}
    >
      <div className="flex shrink-0 flex-col gap-3 p-4 pb-3">
        <p className="t-headline px-1">{t("app.name")}</p>
        {header}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-4">{children}</div>
    </Glass>
  );
}
