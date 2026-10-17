"use client";

import { cx } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import type { Status } from "@/lib/sources/types";

export const STATUS_COLOR: Record<Status, string> = {
  live: "var(--system-green)",
  stale: "var(--system-orange)",
  offline: "var(--system-gray)",
  static: "var(--system-blue)",
};

const RANK: Record<Status, number> = { live: 0, static: 1, stale: 2, offline: 3 };

/** The least trustworthy of `items` (the first wins a tie); undefined when there are none. */
export function worstOf<T extends { status: Status }>(items: readonly (T | undefined)[]): T | undefined {
  return items.reduce<T | undefined>((w, x) => (x && (!w || RANK[x.status] > RANK[w.status]) ? x : w), undefined);
}

export type Age = { n: number; unit: "min" | "h" | "d" };

/** Data age as whole minutes, hours or days (floored, at least 1 min); null when the timestamp does not parse. */
export function age(updatedAt: string, now = Date.now()): Age | null {
  const minutes = (now - Date.parse(updatedAt)) / 60_000;
  if (!Number.isFinite(minutes)) return null;
  if (minutes < 60) return { n: Math.max(1, Math.floor(minutes)), unit: "min" };
  if (minutes < 1440) return { n: Math.floor(minutes / 60), unit: "h" };
  return { n: Math.floor(minutes / 1440), unit: "d" };
}

/**
 * How fresh data is, as small grey caption text (no capsule, no dot): "Демо податоци", "Пред 2 ч". Live and static data
 * are the norm and render nothing unless `showLive` asks for them ("Во живо · 3 мин", "Статично"). `compact` is for
 * narrow tiles: "Демо" and "2 ч", with the full text for screen readers and as the tooltip. Never wraps or shrinks.
 */
export function StatusBadge({
  status,
  updatedAt,
  compact,
  showLive,
  className,
}: {
  status: Status;
  updatedAt: string;
  compact?: boolean;
  showLive?: boolean;
  className?: string;
}) {
  const { t } = useT();
  if ((status === "live" || status === "static") && !showLive) return null;
  const a = status === "live" || status === "stale" ? age(updatedAt) : null;
  const ago = a && t(`age.${a.unit}`, { n: a.n });
  const full =
    status === "stale" ? (ago ? t("status.ago", { age: ago }) : t("status.stale")) : ago ? `${t(`status.${status}`)} · ${ago}` : t(`status.${status}`);
  const short = status === "offline" ? t("status.demo") : status === "stale" ? (ago ?? t("status.stale")) : full;
  return (
    // Age depends on the clock, so server and client renders may differ by a minute.
    <span
      title={compact ? full : undefined}
      suppressHydrationWarning
      className={cx("t-caption inline-block shrink-0 whitespace-nowrap text-label-2 tabular-nums", className)}
    >
      {compact ? (
        <>
          <span aria-hidden suppressHydrationWarning>
            {short}
          </span>
          <span className="sr-only" suppressHydrationWarning>
            {full}
          </span>
        </>
      ) : (
        full
      )}
    </span>
  );
}

/**
 * The note a Today card, widget or detail wears when its data is not live (stale → "Пред 2 ч", offline → "Демо податоци").
 * Renders nothing for live, static or missing data. `updatedAt` is optional: without it a stale note has no age.
 */
export function LayerBadge({ data, className, compact }: { data?: { status: Status; updatedAt?: string }; className?: string; compact?: boolean }) {
  if (!data) return null;
  return <StatusBadge status={data.status} updatedAt={data.updatedAt ?? ""} compact={compact} className={className} />;
}
