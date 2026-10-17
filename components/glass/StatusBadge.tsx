import type { CSSProperties } from "react";
import type { Status } from "@/lib/sources/types";

// ponytail: English copy from spec §6.8; switch to useT() once Task 2's dictionaries land.
const LABEL: Record<Status, string> = { live: "Live", stale: "Stale", offline: "Demo data", static: "Static" };

const COLOR: Record<Status, string> = {
  live: "var(--system-green)",
  stale: "var(--system-orange)",
  offline: "var(--system-gray)",
  static: "var(--system-blue)",
};

/** "3 min", "2 h", "4 d"; null when the timestamp does not parse. */
function age(updatedAt: string): string | null {
  const minutes = (Date.now() - Date.parse(updatedAt)) / 60_000;
  if (!Number.isFinite(minutes)) return null;
  if (minutes < 60) return `${Math.max(1, Math.floor(minutes))} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / 1440)} d`;
}

export function StatusBadge({ status, updatedAt }: { status: Status; updatedAt: string }) {
  const ago = status === "live" || status === "stale" ? age(updatedAt) : null;
  return (
    <span
      className="t-caption inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-(--badge)/15 px-2 whitespace-nowrap"
      style={{ "--badge": COLOR[status] } as CSSProperties}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-(--badge) ring-2 ring-(--badge)/25" />
      {/* Age depends on the clock, so server and client renders may differ by a minute. */}
      <span suppressHydrationWarning>{ago ? `${LABEL[status]} · ${ago}` : LABEL[status]}</span>
    </span>
  );
}
