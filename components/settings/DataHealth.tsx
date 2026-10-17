"use client";

import { ExternalLink } from "lucide-react";
import type { CSSProperties } from "react";
import { age, STATUS_COLOR } from "@/components/glass/StatusBadge";
import { useT, type Dict } from "@/lib/i18n";
import type { TVars } from "@/lib/i18n/core";
import { isLayerId, LAYERS } from "@/lib/layers";
import type { Status } from "@/lib/sources/types";
import { useFetched } from "@/lib/useFetched";
import { List, row, RowContent, rowStatic } from "./Grouped";

export type HealthRow = { id: string; status: Status; updatedAt: string; featureCount: number; source: { name: string; url: string } };

async function readHealth(r: Response): Promise<HealthRow[]> {
  const rows: unknown = r.ok ? await r.json() : null;
  if (!Array.isArray(rows)) throw new Error(String(r.status));
  return rows as HealthRow[];
}

/** GET /api/health, cached: the last answer at once when Settings reopens, refreshed behind it. undefined while loading, null when it failed. */
export const useHealth = () => useFetched("/api/health", readHealth);

const ORDER = ["live", "stale", "offline"] as const;

/**
 * "9 во живо · 2 демо": feeds per status, freshest first, zero counts left out.
 * Static (baked) datasets never go stale, so they say nothing about freshness and are not counted.
 */
export function statusSummary(statuses: Status[], t: (key: keyof Dict, vars?: TVars) => string): string {
  return ORDER.map((s) => [s, statuses.filter((x) => x === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => t(`settings.count.${s}`, { n }))
    .join(" · ");
}

/** Status dot plus age (live, stale) or a short label (demo, static). */
function Freshness({ status, updatedAt }: { status: Status; updatedAt: string }) {
  const { t } = useT();
  const ago = status === "live" || status === "stale" ? age(updatedAt) : null;
  return (
    <span className="t-footnote flex shrink-0 items-center gap-1.5 text-label-2" style={{ "--dot": STATUS_COLOR[status] } as CSSProperties}>
      <span aria-hidden className="size-2 rounded-full bg-(--dot)" />
      {ago ? (
        <>
          <span className="sr-only">{t(`status.${status}`)}, </span>
          {t(`age.${ago.unit}`, { n: ago.n })}
        </>
      ) : (
        t(status === "offline" ? "settings.demo" : "status.static")
      )}
    </span>
  );
}

/** Data sources sub-page body: one compact row per source, linking out to it. */
export function DataHealth({ rows }: { rows: HealthRow[] | null | undefined }) {
  const { t } = useT();

  if (rows === undefined) return <span aria-busy className="skeleton block h-44" />;
  if (!rows?.length) return <p className="t-subhead px-4 text-label-2">{rows ? t("settings.healthEmpty") : t("explore.noData")}</p>;

  return (
    <List>
      {rows.map((r) => {
        const meta = isLayerId(r.id) ? LAYERS[r.id] : undefined;
        const content = (
          <RowContent icon={meta?.icon} title={meta ? t(meta.titleKey) : r.source.name} sub={meta && r.source.name}>
            <Freshness status={r.status} updatedAt={r.updatedAt} />
            {r.source.url && <ExternalLink size={15} aria-hidden className="shrink-0 text-label-2" />}
          </RowContent>
        );
        return r.source.url ? (
          <a key={r.id} href={r.source.url} target="_blank" rel="noreferrer" title={`${t("settings.openSource")}: ${r.source.name}`} className={row}>
            {content}
          </a>
        ) : (
          <div key={r.id} className={rowStatic}>
            {content}
          </div>
        );
      })}
    </List>
  );
}
