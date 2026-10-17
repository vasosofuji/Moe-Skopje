"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/glass/StatusBadge";
import { cx, focusRing } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import { isLayerId, LAYERS } from "@/lib/layers";
import type { Status } from "@/lib/sources/types";

type Row = { id: string; status: Status; updatedAt: string; featureCount: number; source: { name: string; url: string } };

/** One row per registered source from GET /api/health: status badge, size and a link to the source. */
export function DataHealth() {
  const { t } = useT();
  const [rows, setRows] = useState<Row[] | null>(); // undefined while loading, null when the request failed

  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/health", { signal: ac.signal })
      .then((r) => (r.ok ? (r.json() as Promise<Row[]>) : Promise.reject(new Error(String(r.status)))))
      .then(setRows)
      .catch(() => !ac.signal.aborted && setRows(null));
    return () => ac.abort();
  }, []);

  if (rows === undefined) {
    return (
      <div aria-busy className="flex flex-col gap-2">
        <span className="skeleton h-12" />
        <span className="skeleton h-12" />
      </div>
    );
  }
  if (!rows?.length) return <p className="t-subhead px-1 text-label-2">{t("settings.healthEmpty")}</p>;

  return (
    <ul className="divide-y-[0.5px] divide-(--label)/10 rounded-card border-[0.5px] border-(--glass-stroke) bg-(--tile)">
      {rows.map((row) => {
        const meta = isLayerId(row.id) ? LAYERS[row.id] : undefined;
        const Icon = meta?.icon;
        return (
          <li key={row.id} className="flex min-h-14 items-center gap-3 py-2 pr-1 pl-3">
            {Icon && (
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-[9px] text-white"
                style={{ background: meta.color }}
              >
                <Icon size={18} aria-hidden />
              </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
              <span className="t-subhead w-full truncate font-semibold">{meta ? t(meta.titleKey) : row.source.name}</span>
              <span className="flex max-w-full flex-wrap items-center gap-x-2 gap-y-0.5">
                <StatusBadge status={row.status} updatedAt={row.updatedAt} />
                <span className="t-footnote truncate text-label-2">
                  {row.source.name} · {t("settings.items", { n: row.featureCount })}
                </span>
              </span>
            </div>
            {row.source.url && (
              <a
                href={row.source.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`${t("settings.openSource")}: ${row.source.name}`}
                className={cx("flex size-11 shrink-0 items-center justify-center rounded-full text-(--system-blue)", focusRing)}
              >
                <ExternalLink size={18} aria-hidden />
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
