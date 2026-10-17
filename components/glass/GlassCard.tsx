import type { ElementType } from "react";
import { cx } from "@/lib/cx";
import { Glass, type GlassProps } from "./Glass";

/** Glass with card radius (14) and 16 px padding. */
export function GlassCard<T extends ElementType = "div">({ className, ...rest }: GlassProps<T>) {
  return <Glass {...(rest as GlassProps<T>)} className={cx("glass-card", className)} />;
}
