"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { LayerBadge } from "@/components/glass/StatusBadge";
import { cx, focusRing } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import type { Status } from "@/lib/sources/types";

/**
 * A Today tile. Every tile has the same anatomy: a header (15 px glyph, caption label, the data badge pinned right), a big
 * value, one secondary line and an optional footer on the bottom edge (a scale bar, a distance). Slots have fixed heights
 * and the tile a fixed minimum, so nothing moves when data arrives. With `onOpen` a button stretched over the tile opens
 * more; `opens` tags it for focus return. `source` is badged (compact) when it is not live.
 */
export function Tile({
  icon: Icon,
  title,
  source,
  loading,
  onOpen,
  openLabel,
  opens,
  children,
}: {
  icon: LucideIcon;
  title: string;
  source?: { status: Status; updatedAt?: string };
  loading?: boolean;
  onOpen?(): void;
  openLabel?: string;
  opens?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-busy={loading}
      className={cx(
        "relative flex min-h-[140px] min-w-0 flex-col rounded-card border-[0.5px] border-(--glass-stroke) bg-(--tile) p-3",
        // Press feedback for the whole tile: in at once, out in 180 ms; the button's own press tint covers the tile.
        onOpen && "transition-[scale] duration-180 has-[button:active]:scale-98 has-[button:active]:duration-0 motion-reduce:has-[button:active]:scale-100",
      )}
    >
      {onOpen && (
        <button
          type="button"
          data-opens={opens}
          onClick={onOpen}
          aria-label={openLabel}
          className={cx("absolute inset-0 rounded-card active:scale-100", focusRing)}
        />
      )}
      <div className="flex h-6 min-w-0 items-center gap-2">
        <h3 className="flex min-w-0 flex-1 items-center gap-1.5 text-label-2">
          <Icon size={15} strokeWidth={2.25} aria-hidden className="shrink-0" />
          <span className="t-caption truncate font-semibold tracking-wide uppercase" title={title}>
            {title}
          </span>
        </h3>
        {!loading && <LayerBadge data={source} compact />}
      </div>
      {loading ? (
        <>
          <span className="flex h-[41px] items-center">
            <span className="skeleton h-7 w-16" />
          </span>
          <span className="flex h-[18px] items-center">
            <span className="skeleton h-3 w-24" />
          </span>
        </>
      ) : (
        children
      )}
    </section>
  );
}

/** The tile's big number with its unit tight against it. */
export function Value({ children, unit, dim }: { children: ReactNode; unit?: string; dim?: boolean }) {
  return (
    <p className={cx("t-large-title min-w-0 truncate tabular-nums", dim && "text-label-2")}>
      {children}
      {unit && <span className="t-subhead ml-0.5 font-semibold text-label-2">{unit}</span>}
    </p>
  );
}

/** The one secondary line under the value; long text ends in an ellipsis and shows in full as the tooltip. */
export function Line({ children, title, className }: { children: ReactNode; title?: string; className?: string }) {
  return (
    <p className={cx("t-footnote truncate font-medium", className)} title={title}>
      {children}
    </p>
  );
}

/** A dash and "no data", in the value and line slots. */
export function Empty() {
  const { t } = useT();
  return (
    <>
      <Value dim>—</Value>
      <Line className="text-label-2">{t("explore.noData")}</Line>
    </>
  );
}
