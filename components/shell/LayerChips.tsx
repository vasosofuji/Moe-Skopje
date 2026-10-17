"use client";

import type { CSSProperties } from "react";
import { GlassButton } from "@/components/glass/GlassButton";
import { TIER1, toggleLayer } from "@/components/onboarding/LayerGrid";
import { cx } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import { LAYERS } from "@/lib/layers";
import { usePrefs } from "@/lib/prefs";

/**
 * Desktop row of layer toggles, centred in the map area right of the sidebar (and left of the assistant panel).
 * When the chips do not fit, the row scrolls sideways inside itself; the page never does.
 */
export function LayerChips({ askOpen }: { askOpen: boolean }) {
  const { t } = useT();
  const [prefs, setPrefs] = usePrefs();
  return (
    <div className={cx("pointer-events-none fixed left-[412px] top-4 z-10", askOpen ? "right-[432px]" : "right-4")}>
      <div
        role="group"
        aria-label={t("map.layers")}
        className="pointer-events-auto mx-auto -my-3 flex w-fit max-w-full gap-2 overflow-x-auto px-1 py-3 [scrollbar-width:none]"
      >
        {TIER1.map((id) => {
          const { icon: Icon, color, titleKey } = LAYERS[id];
          const on = prefs.layers.includes(id);
          return (
            <GlassButton
              key={id}
              size="sm"
              aria-pressed={on}
              onClick={() => setPrefs({ layers: toggleLayer(prefs.layers, id) })}
              style={{ "--chip": color } as CSSProperties}
              className={cx(
                "shrink-0 gap-1.5 whitespace-nowrap",
                on ? "bg-[color-mix(in_srgb,var(--glass-bg),var(--chip)_22%)] text-label" : "text-label-2",
              )}
            >
              <Icon size={16} aria-hidden className={on ? "text-(--chip)" : undefined} />
              {t(titleKey)}
            </GlassButton>
          );
        })}
      </div>
    </div>
  );
}
