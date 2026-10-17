import "server-only";
import { skopjeToday } from "@/lib/sources/geo";
import { bboxOf } from "@/lib/sources/geom";
import type { Feature, LayerResponse, Status } from "@/lib/sources/types";
import { getLayer } from "./layer";

/** Water, power and heating are three layers; /api/outages merges them into one schedule (spec §11.8). */
export const OUTAGE_LAYERS = ["outages-water", "outages-power", "outages-heating"] as const;
export type OutageType = "water" | "power" | "heating";

export type OutageItem = {
  /** The outage's group id: `detail.outage` of each of its street features, so the UI can pick out the street lines to highlight. */
  id: string;
  type: OutageType;
  /** Status of the layer the outage came from: "offline" means demo data. */
  status: Status;
  startsAt: string;
  endsAt: string;
  municipality: string;
  /** Street names; the raw wording of the notice when only the municipality polygon is known (`detail.approx`). */
  streets: string[];
  bbox: [west: number, south: number, east: number, north: number];
};
export type OutageDay = { date: string; items: OutageItem[] };

const DAY_MS = 86_400_000;
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const text = (v: unknown) => (typeof v === "string" ? v : undefined);

/** `date` (YYYY-MM-DD) plus `n` days. Pure date arithmetic, so a DST switch cannot skip or repeat a day. */
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

type Group = { item: OutageItem; box: [number, number, number, number]; names: Set<string> };

/**
 * The street features of the outage layers → one item per outage (feature group), listed under every Europe/Skopje day
 * it covers within the next `days` days. Outages that have already ended are left out, as the adapters do.
 */
export function groupOutages(layers: LayerResponse[], now: number, days = 7): OutageDay[] {
  const groups = new Map<string, Group>();
  for (const res of layers) {
    for (const f of res.features.features as Feature[]) {
      const p = f.properties;
      if (!p.startsAt || !p.endsAt || Date.parse(p.endsAt) < now) continue;
      const id = text(p.detail?.outage) ?? p.id;
      const box = bboxOf(f.geometry);
      const g = groups.get(id);
      if (g) {
        g.box = [Math.min(g.box[0], box[0]), Math.min(g.box[1], box[1]), Math.max(g.box[2], box[2]), Math.max(g.box[3], box[3])];
      } else {
        groups.set(id, {
          box,
          names: new Set(),
          item: {
            id,
            type: (text(p.detail?.type) as OutageType | undefined) ?? (res.id.replace("outages-", "") as OutageType),
            status: res.status,
            startsAt: p.startsAt,
            endsAt: p.endsAt,
            municipality: text(p.detail?.municipality) ?? p.title.mk,
            streets: [],
            bbox: [0, 0, 0, 0],
          },
        });
      }
      const group = groups.get(id)!;
      // a street feature names its street; a municipality polygon (detail.approx, or an old snapshot without detail.outage) only has the notice's wording
      if (p.detail?.approx || !p.detail?.outage) text(p.detail?.streets)?.split(/\s*;\s*/).filter(Boolean).forEach((s) => group.names.add(s));
      else group.names.add(p.title.mk);
    }
  }

  const today = skopjeToday(now);
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i));
  const out: OutageDay[] = dates.map((date) => ({ date, items: [] }));
  const items = [...groups.values()].map((g): OutageItem => ({ ...g.item, streets: [...g.names], bbox: g.box.map(round5) as OutageItem["bbox"] }));
  items.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
  for (const item of items) {
    const first = skopjeToday(Date.parse(item.startsAt));
    // an outage ending exactly at midnight does not belong to the new day
    const last = skopjeToday(Math.max(Date.parse(item.endsAt) - 1, Date.parse(item.startsAt)));
    out.forEach((day) => {
      if (day.date >= first && day.date <= last) day.items.push(item);
    });
  }
  return out;
}

/** The three outage layers (each through the usual fallback chain), grouped by day. */
export async function getOutageDays(days = 7, now = Date.now()): Promise<OutageDay[]> {
  const layers = await Promise.all(OUTAGE_LAYERS.map((id) => getLayer(id)));
  return groupOutages(layers, now, days);
}
