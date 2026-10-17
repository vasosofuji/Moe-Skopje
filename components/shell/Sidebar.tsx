"use client";

import { MapPinned } from "lucide-react";
import type { ReactNode } from "react";
import { Glass } from "@/components/glass/Glass";
import { cx } from "@/lib/cx";
import { useT } from "@/lib/i18n";

/** App icon: a pin on an iOS blue-to-indigo squircle. */
export function AppMark({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center bg-linear-to-br from-(--system-blue) to-(--system-indigo) text-white shadow-[0_4px_14px_rgb(0_0_0/.15)]"
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    >
      <MapPinned size={size * 0.56} strokeWidth={2} />
    </span>
  );
}

/**
 * Floating glass panel on the left for tablet (360 px, ends above the tab bar) and desktop (380 px, full height).
 * `header` stays put; `children` scroll.
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
        <div className="flex items-center gap-2.5 px-1">
          <AppMark />
          <span className="t-headline">{t("app.name")}</span>
        </div>
        {header}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2 pb-4">{children}</div>
    </Glass>
  );
}
