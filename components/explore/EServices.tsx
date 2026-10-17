"use client";

import { Baby, BookUser, Building, Car, ExternalLink, House, IdCard, Receipt, Stethoscope, type LucideIcon } from "lucide-react";
import tasks from "@/data/seed/eservices.json";
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
    <section className="rounded-card border-[0.5px] border-(--glass-stroke) bg-(--tile) p-3">
      <h3 className="t-headline px-1">{t("eservices.title")}</h3>
      <p className="t-footnote text-label-2 mt-0.5 px-1">{t("eservices.hint")}</p>
      <ul className="mt-2">
        {tasks.map(({ id, title, url }) => {
          const Icon = ICONS[id] ?? ExternalLink;
          return (
            <li key={id} className="border-t-[0.5px] border-(--label)/10 first:border-t-0">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={cx("flex min-h-11 items-center gap-3 rounded-[10px] px-1 py-1 hover:bg-(--label)/5", focusRing)}
              >
                <Icon size={19} aria-hidden className="shrink-0 text-(--system-blue)" />
                <span className="t-subhead min-w-0 flex-1">{pick(title, lang)}</span>
                <ExternalLink size={15} aria-hidden className="shrink-0 text-label-2" />
                <span className="sr-only">{t("eservices.opensNew")}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
