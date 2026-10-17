import { z } from "zod";
import type { Place } from "./RoutePlanner";

const KEY = "moe-skopje:recent-places";
const MAX = 4;

const Recents = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    kind: z.enum(["poi", "address", "street", "area"]),
    sub: z.string().optional(),
    lng: z.number(),
    lat: z.number(),
  }),
);

/** The places last picked in the planner, newest first. Anything unreadable yields none. */
export function loadRecents(storage?: Storage): Place[] {
  try {
    const parsed = Recents.safeParse(JSON.parse((storage ?? localStorage).getItem(KEY) ?? "[]"));
    return parsed.success ? parsed.data.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Puts `place` first (once) and returns the new list; blocked or full storage just keeps it in memory. */
export function pushRecent(place: Place, storage?: Storage): Place[] {
  const next = [place, ...loadRecents(storage).filter((p) => p.id !== place.id)].slice(0, MAX);
  try {
    (storage ?? localStorage).setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked or full.
  }
  return next;
}
