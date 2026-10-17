"use client";

import { motion } from "motion/react";
import { StatusBadge } from "@/components/glass/StatusBadge";
import { toggleLayer } from "@/components/onboarding/LayerGrid";
import { cx, focusRing } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import { LAYERS, type LayerId } from "@/lib/layers";
import { usePrefs } from "@/lib/prefs";
import { useLayer } from "@/lib/useLayer";

const spring = { type: "spring", stiffness: 400, damping: 30 } as const;

/** One row of the layer list: the whole row is the switch, so the tap target spans its full width. */
export function LayerRow({ id }: { id: LayerId }) {
  const { t } = useT();
  const [prefs, setPrefs] = usePrefs();
  const on = prefs.layers.includes(id);
  const { data, loading } = useLayer(id, on);
  const { icon: Icon, color, titleKey } = LAYERS[id];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => setPrefs({ layers: toggleLayer(prefs.layers, id) })}
      className={cx("flex min-h-14 w-full items-center gap-3 rounded-card px-3 py-2 text-left", focusRing)}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] text-white" style={{ background: color }}>
        <Icon size={18} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <span className="t-body w-full truncate">{t(titleKey)}</span>
        {on &&
          (loading ? (
            <span className="skeleton h-4 w-20" />
          ) : data ? (
            <StatusBadge status={data.status} updatedAt={data.updatedAt} />
          ) : (
            <span className="t-footnote text-label-2">{t("explore.noData")}</span>
          ))}
      </span>
      <span
        aria-hidden
        className={cx(
          "relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200",
          on ? "bg-(--system-green)" : "bg-(--label)/15",
        )}
      >
        <motion.span
          initial={false}
          animate={{ x: on ? 20 : 0 }}
          transition={spring}
          className="absolute left-0.5 top-0.5 size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/.15),0_1px_1px_rgb(0_0_0/.16)]"
        />
      </span>
    </button>
  );
}
