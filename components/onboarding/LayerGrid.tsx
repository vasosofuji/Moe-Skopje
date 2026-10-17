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


/**
 * Onboarding tiles to pick layers: icon and name, all the same size. A picked tile gets a system-blue border, a faint
 * blue tint and a filled check; unpicked ones show an empty ring. Settings edits the same prefs.layers as switch rows.
 */
export function LayerGrid({ value, onChange }: { value: LayerId[]; onChange(ids: LayerId[]): void }) {
  const { t } = useT();
  return (
    <div className="@container">
      <div className="grid auto-rows-[100px] grid-cols-2 gap-2 @md:grid-cols-3">
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
                "relative flex min-w-0 flex-col items-start justify-between rounded-card border-[1.5px] p-3 text-left transition-colors",
                focusRing,
                on ? "border-(--system-blue) bg-(--system-blue)/10" : "border-(--label)/10 bg-(--tile)",
              )}
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-(--label)/8 text-(--c)">
                <Icon size={16} aria-hidden />
              </span>
              <span className="t-subhead line-clamp-2 font-semibold">{t(titleKey)}</span>
              <span
                aria-hidden
                className={cx(
                  "absolute top-4 right-3 flex size-5 items-center justify-center rounded-full transition-colors",
                  on ? "bg-(--system-blue) text-white" : "border-[1.5px] border-(--label)/20",
                )}
              >
                {on && <Check size={12} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
