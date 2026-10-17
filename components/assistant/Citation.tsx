"use client";

import { focusRing } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import { HIDDEN_LAYERS, isLayerId, LAYERS, type LayerId } from "@/lib/layers";
import type { Status } from "@/lib/sources/types";

/** A feature an assistant answer used. The server appends them as `\n[[cite:<json Citation[]>]]`. */
export type Citation = {
  layer: LayerId;
  featureId: string;
  lng: number;
  lat: number;
  source: string;
  ageMin: number;
  title: string;
  status: Status;
};

const MARK = "\n[[cite:";
const STATUSES: readonly string[] = ["live", "stale", "offline", "static"];
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown) => typeof v === "string";

/** The trailer is model-adjacent text, so every field is checked before a chip can move the map. */
function isCitation(v: unknown): v is Citation {
  const c = v as Record<string, unknown> | null;
  return (
    typeof c === "object" && c !== null &&
    isLayerId(c.layer) && !HIDDEN_LAYERS.includes(c.layer) && str(c.featureId) && num(c.lng) && num(c.lat) && str(c.source) && num(c.ageMin) && str(c.title) &&
    STATUSES.includes(c.status as string)
  );
}

/**
 * Splits the streamed text so far into the visible answer and its citations. Works on any prefix of the stream:
 * a trailer that is only partly there is hidden, so the marker never flashes on screen however the chunks split.
 */
export function parseReply(raw: string): { text: string; citations: Citation[] } {
  const at = raw.lastIndexOf(MARK);
  if (at >= 0) {
    const body = raw.slice(at + MARK.length);
    let citations: Citation[] = [];
    // Only the last trailer counts, and only when it ends the stream: the server always writes one last, so a lookalike the
    // model wrote earlier is followed by more text and is never believed.
    if (body.endsWith("]]")) {
      try {
        const list: unknown = JSON.parse(body.slice(0, -2));
        if (Array.isArray(list)) citations = list.filter(isCitation);
      } catch {
        // not complete yet, or not ours
      }
    }
    return { text: raw.slice(0, at), citations };
  }
  for (let n = Math.min(MARK.length - 1, raw.length); n > 0; n--) {
    if (raw.endsWith(MARK.slice(0, n))) return { text: raw.slice(0, -n), citations: [] };
  }
  return { text: raw, citations: [] };
}

/**
 * Chip under an answer, one of a row that scrolls sideways: the layer's own glyph in its colour and the feature's title,
 * plus the data's age as a grey caption when it is not live. 32 px tall with a 44 px touch area. Tapping flies the map to it.
 */
export function CitationChip({ c, onClick }: { c: Citation; onClick(): void }) {
  const { t } = useT();
  const { icon: Icon, color } = LAYERS[c.layer];
  const ago = c.status === "live" || c.status === "static" ? null : c.ageMin < 60 ? t("age.min", { n: Math.max(1, c.ageMin) }) : c.ageMin < 1440 ? t("age.h", { n: Math.floor(c.ageMin / 60) }) : t("age.d", { n: Math.floor(c.ageMin / 1440) });
  return (
    <button
      type="button"
      onClick={onClick}
      title={c.source}
      className={`relative inline-flex h-8 max-w-64 shrink-0 items-center gap-1.5 rounded-full bg-(--label)/6 pr-3 pl-2.5 text-left before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] ${focusRing}`}
    >
      <Icon size={14} aria-hidden className="shrink-0" style={{ color }} />
      <span className="t-footnote truncate font-medium">{c.title}</span>
      {ago && <span className="t-caption shrink-0 text-label-2">{ago}</span>}
    </button>
  );
}
