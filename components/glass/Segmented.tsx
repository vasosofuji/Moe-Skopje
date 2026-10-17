"use client";

import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { cx, focusRing } from "@/lib/cx";
import { spring } from "@/lib/motion";


type Option<T extends string> = { value: T; label: string; icon?: LucideIcon };

/**
 * iOS segmented control: a recessed track with a raised thumb that springs to the chosen segment.
 * `id` names the thumb's shared layout, so it must be unique on the page.
 */
export function Segmented<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: Option<T>[];
  value: T;
  onChange(value: T): void;
}) {
  return (
    <div role="group" aria-label={label} className="flex h-11 rounded-full bg-(--label)/6">
      {options.map(({ value: v, label: text, icon: Icon }) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(v)}
            className={cx(
              "relative flex min-w-0 flex-1 items-center justify-center rounded-full px-2 t-footnote font-semibold transition-colors",
              focusRing,
              on ? "text-label" : "text-label-2",
            )}
          >
            {on && (
              <motion.span
                layoutId={id}
                transition={spring}
                className="absolute inset-1 rounded-full bg-(--thumb) shadow-[0_3px_8px_rgb(0_0_0/.12),0_1px_1px_rgb(0_0_0/.06)]"
              />
            )}
            <span className="relative flex min-w-0 items-center gap-1.5">
              {Icon && <Icon size={15} aria-hidden className="shrink-0" />}
              <span className="truncate">{text}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
