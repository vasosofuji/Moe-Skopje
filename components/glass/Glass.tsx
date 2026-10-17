import type { ComponentPropsWithRef, ElementType } from "react";
import { cx } from "@/lib/cx";

export type GlassProps<T extends ElementType = "div"> = {
  as?: T;
  /** Larger blur for big panels, plus edge refraction in Chromium. */
  strong?: boolean;
  className?: string;
} & Omit<ComponentPropsWithRef<T>, "as" | "className">;

export function Glass<T extends ElementType = "div">({ as, strong, className, ...rest }: GlassProps<T>) {
  const Tag: ElementType = as ?? "div";
  return <Tag className={cx("glass", strong && "glass-strong", className)} {...rest} />;
}
