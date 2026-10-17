import {
  Activity,
  Bus,
  CalendarDays,
  CloudSun,
  Construction,
  Droplets,
  Flame,
  GraduationCap,
  Pill,
  SquareParking,
  Trash2,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Dict } from "@/lib/i18n/core";

export type LayerId =
  | "air"
  | "weather"
  | "outages-power"
  | "outages-water"
  | "outages-heating"
  | "buses"
  | "parking"
  | "pharmacies"
  | "earthquakes"
  | "roadworks"
  | "events"
  | "waste"
  | "schools";

export type LayerMeta = {
  /** CSS colour expression; MapLibre cannot read var(), resolve it with getComputedStyle first. */
  color: string;
  icon: LucideIcon;
  titleKey: keyof Dict;
  /** 1 = must demo, 2 = if time (spec §2). */
  tier: 1 | 2;
};

// ponytail: spec §6.4 colours only the first ten layers; the tier-2 ones borrow a system colour.
export const LAYERS: Record<LayerId, LayerMeta> = {
  air: { color: "var(--c-air)", icon: Wind, titleKey: "layer.air", tier: 1 },
  weather: { color: "var(--c-weather)", icon: CloudSun, titleKey: "layer.weather", tier: 1 },
  "outages-power": { color: "var(--c-power)", icon: Zap, titleKey: "layer.outages-power", tier: 1 },
  "outages-water": { color: "var(--c-water)", icon: Droplets, titleKey: "layer.outages-water", tier: 1 },
  "outages-heating": { color: "var(--c-heating)", icon: Flame, titleKey: "layer.outages-heating", tier: 1 },
  buses: { color: "var(--c-bus)", icon: Bus, titleKey: "layer.buses", tier: 1 },
  parking: { color: "var(--c-parking)", icon: SquareParking, titleKey: "layer.parking", tier: 1 },
  pharmacies: { color: "var(--c-pharmacy)", icon: Pill, titleKey: "layer.pharmacies", tier: 1 },
  earthquakes: { color: "var(--c-quake)", icon: Activity, titleKey: "layer.earthquakes", tier: 1 },
  roadworks: { color: "var(--c-roadworks)", icon: Construction, titleKey: "layer.roadworks", tier: 1 },
  events: { color: "var(--system-indigo)", icon: CalendarDays, titleKey: "layer.events", tier: 2 },
  waste: { color: "var(--system-green)", icon: Trash2, titleKey: "layer.waste", tier: 2 },
  schools: { color: "var(--system-teal)", icon: GraduationCap, titleKey: "layer.schools", tier: 2 },
};

export const LAYER_IDS = Object.keys(LAYERS) as LayerId[];

/** Layers that stay in the registry but are never shown or offered (UI, assistant, health): waste has no real schedule source. */
export const HIDDEN_LAYERS: readonly LayerId[] = ["waste"];

export const isLayerId = (v: unknown): v is LayerId => typeof v === "string" && Object.hasOwn(LAYERS, v);

