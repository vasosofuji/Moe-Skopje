"use client";

import type { CSSProperties } from "react";
import { useT } from "@/lib/i18n";
import type { Status } from "@/lib/sources/types";

const COLOR: Record<Status, string> = {
  live: "var(--system-green)",
  stale: "var(--system-orange)",
  offline: "var(--system-gray)",
  static: "var(--system-blue)",
};

export type Age = { n: number; unit: "min" | "h" | "d" };

/** Data age as whole minutes, hours or days (floored, at least 1 min); null when the timestamp does not parse. */
export function age(updatedAt: string, now = Date.now()): Age | null {
  const minutes = (now - Date.parse(updatedAt)) / 60_000;
  if (!Number.isFinite(minutes)) return null;
  if (minutes < 60) return { n: Math.max(1, Math.floor(minutes)), unit: "min" };
  if (minutes < 1440) return { n: Math.floor(minutes / 60), unit: "h" };
  return { n: Math.floor(minutes / 1440), unit: "d" };
}

export function StatusBadge({ status, updatedAt }: { status: Status; updatedAt: string }) {
  const { t } = useT();
  const ago = status === "live" || status === "stale" ? age(updatedAt) : null;
  const label = t(`status.${status}`);
  return (
    <span
      className="t-caption inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-(--badge)/15 px-2 whitespace-nowrap"
      style={{ "--badge": COLOR[status] } as CSSProperties}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-(--badge) ring-2 ring-(--badge)/25" />
      {/* Age depends on the clock, so server and client renders may differ by a minute. */}
      <span suppressHydrationWarning>{ago ? `${label} · ${t(`age.${ago.unit}`, { n: ago.n })}` : label}</span>
    </span>
  );
}
