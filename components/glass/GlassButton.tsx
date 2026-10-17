import type { CSSProperties, MouseEventHandler, ReactNode, Ref } from "react";
import { cx, focusRing } from "@/lib/cx";

const SIZE = {
  sm: { box: "h-11", circle: "w-11", text: "px-4 t-subhead font-semibold" },
  md: { box: "h-12", circle: "w-12", text: "px-5 t-headline" },
} as const;

type GlassButtonProps = {
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** "circle" is for icon-only buttons, which must then have an aria-label. */
  shape?: "pill" | "circle";
  size?: "sm" | "md";
  type?: "button" | "submit";
  disabled?: boolean;
  "aria-label"?: string;
  /** Makes the button a toggle (chips, filters). */
  "aria-pressed"?: boolean;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLButtonElement>;
  children: ReactNode;
};

/** Glass capsule or circle button. Press feedback (instant 97 % scale and tint) comes from .glass-button in globals.css. */
export function GlassButton({ shape = "pill", size = "md", type = "button", className, children, ...rest }: GlassButtonProps) {
  const s = SIZE[size];
  return (
    <button
      type={type}
      {...rest}
      className={cx(
        "glass glass-pill glass-button justify-center select-none disabled:pointer-events-none disabled:opacity-40",
        focusRing,
        s.box,
        shape === "circle" ? cx(s.circle, "px-0") : s.text,
        className,
      )}
    >
      {children}
    </button>
  );
}
