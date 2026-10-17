"use client";

import { PersonStanding } from "lucide-react";
import { pm10Severity } from "@/lib/aqi";
import { goOutScore } from "@/lib/goOut";
import { useT } from "@/lib/i18n";

const R = 22;
const CIRCUMFERENCE = 2 * Math.PI * R;

// 70+ is a good day, 40+ is fine with care. Colours are the iOS system ones the Today cards already use.
const band = (score: number) =>
  score >= 70
    ? ({ verdict: "good", color: "var(--system-green)" } as const)
    : score >= 40
      ? ({ verdict: "fair", color: "var(--system-orange)" } as const)
      : ({ verdict: "poor", color: "var(--system-red)" } as const);

/**
 * "Good to go out?" Today tile: a score ring (0..100 from PM10, rain and temperature) with a one-line verdict and what pulls
 * it down. Same tile shape as the other Today cards. Standalone: the Explore panel passes it the air and weather readings.
 */
export function GoOutCard({ pm10, tempC, precipMm }: { pm10: number | null; tempC: number | null; precipMm: number | null }) {
  const { t } = useT();
  const hasData = pm10 !== null || tempC !== null || precipMm !== null;
  const score = goOutScore(pm10, tempC, precipMm);
  const { verdict, color } = band(score);
  const reasons = [
    pm10 !== null && pm10Severity(pm10) >= 2 && t("goOut.reason.air"),
    precipMm !== null && precipMm > 0.5 && t("goOut.reason.rain"),
    tempC !== null && (tempC < 0 || tempC > 35) && t("goOut.reason.temp"),
  ].filter(Boolean);

  return (
    <section className="flex min-h-[116px] min-w-0 flex-col rounded-card border-[0.5px] border-(--glass-stroke) bg-(--tile) p-3">
      <h3 className="t-footnote flex min-w-0 items-center gap-1.5 font-semibold text-label-2">
        <PersonStanding size={15} aria-hidden className="shrink-0" style={{ color: hasData ? color : "var(--label-2)" }} />
        <span className="truncate">{t("goOut.title")}</span>
      </h3>
      <div className="mt-auto flex min-w-0 items-center gap-3 pt-3">
        {hasData ? (
          <>
            <div role="img" aria-label={t("goOut.score", { score })} className="relative size-[52px] shrink-0">
              <svg viewBox="0 0 52 52" aria-hidden className="size-full -rotate-90">
                <circle cx="26" cy="26" r={R} fill="none" stroke="var(--label)" strokeOpacity={0.12} strokeWidth="5" />
                <circle
                  cx="26"
                  cy="26"
                  r={R}
                  fill="none"
                  stroke={color}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE * (1 - score / 100)}
                />
              </svg>
              <span aria-hidden className="t-headline absolute inset-0 flex items-center justify-center tabular-nums">
                {score}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="t-footnote font-medium">{t(`goOut.verdict.${verdict}`)}</p>
              {reasons.length > 0 && <p className="t-caption text-label-2">{reasons.join(" · ")}</p>}
            </div>
          </>
        ) : (
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="t-title2 text-label-2">—</p>
            <p className="t-footnote truncate text-label-2">{t("explore.noData")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
