"use client";

import { useEffect, useState } from "react";
import { GlassPill } from "@/components/glass/GlassPill";
import { useT } from "@/lib/i18n";
import { nextDepartures, timetable } from "@/lib/sources/bus-timetable";

/** Re-reads the clock so the list drops departures that have left. Client-only: the first value differs between server and browser. */
function useNow(everyMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

/** Next three departures at a bus stop, from the approximate seed timetable. Standalone; the MarkerCard mounts it for `kind: "bus-stop"` (`lines` is `detail.lines` split on ","). */
export function BusDepartures({ stopId, lines }: { stopId: string; lines: string[] }) {
  const { t } = useT();
  const now = useNow();
  const departures = nextDepartures(stopId, now, 3, lines);
  const hasTimetable = lines.some((line) => line in timetable);

  return (
    <section className="flex flex-col gap-2">
      <h3 className="t-footnote text-label-2">{t("buses.next")}</h3>
      {departures.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {departures.map((d) => (
            <GlassPill as="li" key={`${d.line}@${d.at}`}>
              <span className="sr-only">{t("buses.line", { line: d.line })}</span>
              <span aria-hidden className="t-headline" style={{ color: "var(--c-bus)" }}>
                {d.line}
              </span>
              <span className="t-body tabular-nums">{d.at}</span>
            </GlassPill>
          ))}
        </ul>
      ) : (
        <p className="t-subhead text-label-2">{t(hasTimetable ? "buses.none" : "buses.noTimetable")}</p>
      )}
      {hasTimetable && <p className="t-caption text-label-2">{t("buses.approximate")}</p>}
    </section>
  );
}
