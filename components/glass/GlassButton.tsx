"use client";

import { motion, useReducedMotion } from "motion/react";
import type { MouseEventHandler, ReactNode } from "react";
import { cx } from "@/lib/cx";

const spring = { type: "spring", stiffness: 400, damping: 30 } as const;
const fade = { duration: 0.15 } as const;

const SIZE = {
  sm: { box: "h-11", icon: "w-11", text: "px-4 t-subhead font-semibold" },
  md: { box: "h-12", icon: "w-12", text: "px-5 t-headline" },
} as const;

type GlassButtonProps = {
  onClick: MouseEventHandler<HTMLButtonElement>;
  /** Required for icon-only buttons; an aria-label makes the button a circle. */
  "aria-label"?: string;
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
};

export function GlassButton({ onClick, "aria-label": label, size = "md", className, children }: GlassButtonProps) {
  const reduceMotion = useReducedMotion();
  const s = SIZE[size];
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      whileTap={reduceMotion ? { opacity: 0.6 } : { scale: 0.96 }}
      transition={reduceMotion ? fade : spring}
      className={cx(
        "glass glass-pill glass-button justify-center select-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--system-blue)",
        s.box,
        label ? cx(s.icon, "px-0") : s.text,
        className,
      )}
    >
      {children}
    </motion.button>
  );
}
