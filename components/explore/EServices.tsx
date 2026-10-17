"use client";

import { Baby, BookUser, Building, Car, ExternalLink, House, IdCard, Receipt, Stethoscope, type LucideIcon } from "lucide-react";
import tasks from "@/data/seed/eservices.json";
import { GlassCard } from "@/components/glass/GlassCard";
import { cx, focusRing } from "@/lib/cx";
import { pick, useT } from "@/lib/i18n";

const ICONS: Record<string, LucideIcon> = {
  "id-card": IdCard,
  passport: BookUser,
  "birth-certificate": Baby,
  company: Building,
  property: House,
  "tax-return": Receipt,
  vehicle: Car,
  doctor: Stethoscope,
};

/** "Sort it out online": the common citizen tasks, each a link to the official portal (uslugi.gov.mk or mojtermin.mk). Standalone. */
export function EServices() {
  const { t, lang } = useT();
  return (
    <GlassCard>
      <h3 className="t-headline">{t("eservices.title")}</h3>
      <p className="t-footnote text-label-2 mt-0.5">{t("eservices.hint")}</p>
      <ul className="mt-2">
        {tasks.map(({ id, title, url }) => {
          const Icon = ICONS[id] ?? ExternalLink;
          return (
            <li key={id} className="border-t border-(--glass-stroke) first:border-t-0">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={cx("flex min-h-11 items-center gap-3 rounded-card py-1", focusRing)}
              >
                <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-(--system-blue) text-white">
                  <Icon size={18} />
                </span>
                <span className="t-body min-w-0 flex-1">{pick(title, lang)}</span>
                <ExternalLink size={15} aria-hidden className="shrink-0 text-label-2" />
                <span className="sr-only">{t("eservices.opensNew")}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </GlassCard>
  );
}
