"use client";

import { PersonStanding } from "lucide-react";
import { pm10Severity } from "@/lib/aqi";
import { goOutScore } from "@/lib/goOut";
import { useT } from "@/lib/i18n";
import type { Status } from "@/lib/sources/types";
import { Empty, Line, Tile, Value } from "./Tile";

// 70+ is a good day, 40+ is fine with care. Colours are the iOS system ones the Today cards already use.
const band = (score: number) =>
  score >= 70
    ? ({ verdict: "good", color: "var(--system-green)" } as const)
    : score >= 40
      ? ({ verdict: "fair", color: "var(--system-orange)" } as const)
      : ({ verdict: "poor", color: "var(--system-red)" } as const);

/**
 * "Good to go out?" Today tile: a 0..100 score (from PM10, rain and temperature) with a meter, and what pulls it down
 * (else the verdict) as its line. Standalone: the Explore panel passes it the air and weather readings and `source`, the
 * less trustworthy of their two layers (badged when not live).
 */
export function GoOutCard({
  pm10,
  tempC,
  precipMm,
  source,
  loading,
}: {
  pm10: number | null;
  tempC: number | null;
  precipMm: number | null;
  source?: { status: Status; updatedAt?: string };
  /** Neither reading has answered yet: placeholders instead of a "no data" that would flash. */
  loading?: boolean;
}) {
  const { t } = useT();
  const hasData = pm10 !== null || tempC !== null || precipMm !== null;
  const score = goOutScore(pm10, tempC, precipMm);
  const { verdict, color } = band(score);
  const reasons = [
    pm10 !== null && pm10Severity(pm10) >= 2 && t("goOut.reason.air"),
    precipMm !== null && precipMm > 0.5 && t("goOut.reason.rain"),
    tempC !== null && (tempC < 0 || tempC > 35) && t("goOut.reason.temp"),
  ].filter(Boolean);
  const line = reasons.length ? reasons.join(" · ") : t(`goOut.verdict.${verdict}`);

  return (
    <Tile icon={PersonStanding} title={t("goOut.title")} source={source} loading={loading}>
      {hasData ? (
        <>
          <Value>{score}</Value>
          <Line title={line}>{line}</Line>
          <span
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={score}
            aria-label={t("goOut.score", { score })}
            aria-valuetext={t(`goOut.verdict.${verdict}`)}
            className="mt-auto block h-1.5 overflow-hidden rounded-full bg-(--label)/10"
          >
            <span className="block h-full rounded-full" style={{ width: `${score}%`, background: color }} />
          </span>
        </>
      ) : (
        <Empty />
      )}
    </Tile>
  );
}
