"use client";

import { useState, type CSSProperties } from "react";
import { StatusBadge } from "@/components/glass/StatusBadge";
import { isLayerId, LAYERS, type LayerId } from "@/lib/layers";
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
    isLayerId(c.layer) && str(c.featureId) && num(c.lng) && num(c.lat) && str(c.source) && num(c.ageMin) && str(c.title) &&
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

/** Press feedback for plain glass buttons (GlassButton's is a spring; these wrap text, which its fixed height can't). */
export const PRESS =
  "active:scale-96 motion-reduce:active:scale-100 motion-reduce:active:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--system-blue)";

/** Chip under an answer: layer colour, feature title, source and status badge. Tapping flies the map to it. */
export function CitationChip({ c, onClick }: { c: Citation; onClick(): void }) {
  // StatusBadge wants a timestamp; the server sends the age as of when the answer arrived, so pin it once.
  const [updatedAt] = useState(() => new Date(Date.now() - c.ageMin * 60_000).toISOString());
  return (
    <button type="button" onClick={onClick} className={`glass glass-pill glass-button min-w-0 max-w-full gap-2 py-1 pr-2 pl-3 text-left ${PRESS}`}>
      <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-(--dot)" style={{ "--dot": LAYERS[c.layer].color } as CSSProperties} />
      <span className="flex min-w-0 flex-col">
        <span className="t-footnote truncate font-semibold">{c.title}</span>
        <span className="t-caption truncate text-label-2">{c.source}</span>
      </span>
      <StatusBadge status={c.status} updatedAt={updatedAt} />
    </button>
  );
}
