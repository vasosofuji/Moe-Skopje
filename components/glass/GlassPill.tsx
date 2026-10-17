import type { ElementType } from "react";
import { cx } from "@/lib/cx";
import { Glass, type GlassProps } from "./Glass";

/** Glass capsule: inline row, 44 px min height. Search pill, tab bar, layer chips. */
export function GlassPill<T extends ElementType = "div">({ className, ...rest }: GlassProps<T>) {
  return <Glass {...(rest as GlassProps<T>)} className={cx("glass-pill", className)} />;
}
