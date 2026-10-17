"use client";

import { Check } from "lucide-react";
import type { CSSProperties } from "react";
import { cx, focusRing } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import { HIDDEN_LAYERS, LAYER_IDS, LAYERS, type LayerId } from "@/lib/layers";

/** The must-demo layers (spec §2), in display order. */
export const TIER1 = LAYER_IDS.filter((id) => LAYERS[id].tier === 1 && !HIDDEN_LAYERS.includes(id));

/** `ids` with `id` switched on or off. */
export const toggleLayer = (ids: LayerId[], id: LayerId) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);


/** Onboarding tiles to pick layers: icon, name and a check. Settings edits the same prefs.layers as switch rows. */
export function LayerGrid({ value, onChange }: { value: LayerId[]; onChange(ids: LayerId[]): void }) {
  const { t } = useT();
  return (
    <div className="@container">
      <div className="grid grid-cols-2 gap-2 @md:grid-cols-3">
        {TIER1.map((id) => {
          const { icon: Icon, color, titleKey } = LAYERS[id];
          const on = value.includes(id);
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(toggleLayer(value, id))}
              style={{ "--c": color } as CSSProperties}
              className={cx(
                "relative flex min-h-[84px] flex-col items-start justify-between gap-1.5 rounded-card border-[0.5px] p-3 text-left transition-colors",
                focusRing,
                // Neutral when picked: a system-blue check and hairline border, no category colour fill.
                on ? "border-(--system-blue)/60 bg-(--tile)" : "border-(--glass-stroke) bg-(--tile)",
              )}
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-(--label)/8 text-(--c)">
                <Icon size={17} aria-hidden />
              </span>
              <span className="t-subhead font-semibold">{t(titleKey)}</span>
              <span
                aria-hidden
                className={cx(
                  "absolute right-2.5 top-2.5 flex size-5.5 items-center justify-center rounded-full transition-colors",
                  on ? "bg-(--system-blue) text-white" : "border-[1.5px] border-(--label)/20",
                )}
              >
                {on && <Check size={13} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
