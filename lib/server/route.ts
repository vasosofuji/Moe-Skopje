import "server-only";
import { z } from "zod";
import type { LayerId } from "@/lib/layers";
import {
  RouteBodySchema,
  activeClosures,
  crossedBy,
  decodePolyline6,
  googleMapsUrl,
  perimeterM,
  sampleWaypoints,
  wazeUrl,
  type Closure,
  type LngLat,
  type Mode,
} from "@/lib/routing";
import type { Feature, LayerResponse } from "@/lib/sources/types";
import { getLayer } from "./layer";

// --- Limits -----------------------------------------------------------------------------------------------------------------
// FOSSGIS runs valhalla1.openstreetmap.de for volunteers on donated money. Its terms (fossgis.de/arbeitsgruppen/osm-server/
// nutzungsbedingungen, read 2026-10-17): at most ONE request per second, a User-Agent that identifies the app (not a library's),
// a Referer where possible, OSM attribution plus a link to openstreetmap.org/fixthemap shown to users, no bulk use, and no
// guaranteed availability. So: a per-IP and a global cap on what we accept, and a gate that spaces upstream calls by more than a
// second whatever the cap lets in.
// note: every ceiling below is in memory and per warm server instance, so with N instances they are N times higher, and so is
// the upstream rate (the FOSSGIS one-per-second rule only holds for a single instance). A cold start also forgets the counts.
// Move the counters and the gate to a shared store (Supabase) before running more than one instance, or host our own Valhalla.
export const ROUTE_PER_IP = 30;
export const ROUTE_IP_WINDOW_MS = 10 * 60_000;
export const ROUTE_PER_MINUTE = 120;
const GAP_MS = 1100; // upstream calls start at least this far apart
const MAX_QUEUE = 4; // requests waiting for their turn; one more is refused rather than left to time out
const UPSTREAM_TIMEOUT_MS = 8000;
const EXCLUDE_BUDGET_M = 9500; // Valhalla's default max_exclude_polygons_length is 10 km, summed over all polygons

const byIp = new Map<string, number[]>();
let all: number[] = [];
const within = (times: number[] | undefined, now: number, span: number) => (times ?? []).filter((t) => now - t < span);
let gate: Promise<unknown> = Promise.resolve();
let lastCall = -Infinity;
let queued = 0;

/** Test hook: forget every counter and the gate. */
export function resetRouteLimits() {
  byIp.clear();
  all = [];
  gate = Promise.resolve();
  lastCall = -Infinity;
  queued = 0;
}

const ipOf = (req: Request) => req.headers.get("x-real-ip")?.trim() || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

/** Records one request and says whether it is allowed: 30 per IP in 10 minutes, 120 per minute across the instance. A refused request is not recorded. */
export function allowRoute(ip: string, now = Date.now()): boolean {
  const mine = within(byIp.get(ip), now, ROUTE_IP_WINDOW_MS);
  all = within(all, now, 60_000);
  if (mine.length >= ROUTE_PER_IP || all.length >= ROUTE_PER_MINUTE) return false;
  byIp.set(ip, [...mine, now]);
  all.push(now);
  return true;
}

class NoRoute extends Error {} // the router answered: there is no such route
class RouterDown extends Error {} // unreachable, timed out, or an error status
class Busy extends Error {} // too many requests are already waiting for the router

type Deps = {
  fetch?: typeof fetch;
  now?: () => number;
  layer?: (id: LayerId) => Promise<LayerResponse>;
  gapMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

/** Runs `call` once its turn comes: strictly one at a time, `gapMs` after the previous one began. */
function spaced<T>(call: () => Promise<T>, deps: Deps): Promise<T> {
  if (queued >= MAX_QUEUE) return Promise.reject(new Busy());
  queued++;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const turn = gate.then(async () => {
    const wait = lastCall + (deps.gapMs ?? GAP_MS) - now();
    if (wait > 0) await sleep(wait);
    lastCall = now();
    queued--;
  });
  gate = turn.catch(() => {});
  return turn.then(call);
}

// --- Routers -----------------------------------------------------------------------------------------------------------------

type Path = { geometry: LngLat[]; distanceM: number; durationS: number };
type Ask = { from: LngLat; to: LngLat; mode: Mode; avoid: LngLat[][] };
type Provider = { name: "valhalla" | "ors"; route: (ask: Ask, deps: Deps) => Promise<Path> };

const userAgent = () => `MoeSkopje/1.0 (Skopje city-data app${process.env.ROUTER_CONTACT ? `; ${process.env.ROUTER_CONTACT}` : ""})`;

const ValhallaReply = z.object({
  trip: z.object({ summary: z.object({ length: z.number(), time: z.number() }), legs: z.array(z.object({ shape: z.string() })).min(1) }),
});

async function post(url: string, headers: Record<string, string>, body: unknown, deps: Deps): Promise<unknown> {
  let res: Response;
  try {
    res = await spaced(
      () => (deps.fetch ?? fetch)(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) }),
      deps,
    );
  } catch (err) {
    if (err instanceof Busy) throw err;
    throw new RouterDown(`${new URL(url).host}: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (res.status === 400 || res.status === 404) throw new NoRoute(`${new URL(url).host} HTTP ${res.status}`); // Valhalla 400: no path; ORS 404: no routable point
  if (!res.ok) throw new RouterDown(`${new URL(url).host} HTTP ${res.status}`);
  return res.json().catch(() => {
    throw new RouterDown(`${new URL(url).host}: unreadable answer`);
  });
}

const valhalla: Provider = {
  name: "valhalla",
  async route({ from, to, mode, avoid }, deps) {
    // the URL is configurable on purpose: FOSSGIS asks apps not to hard-wire it
    const url = process.env.VALHALLA_URL || "https://valhalla1.openstreetmap.de/route";
    const referer = process.env.NEXT_PUBLIC_SITE_URL;
    const body = {
      locations: [{ lon: from[0], lat: from[1] }, { lon: to[0], lat: to[1] }],
      costing: mode,
      directions_type: "none", // the shape is all we need
      ...(avoid.length ? { exclude_polygons: avoid } : {}),
    };
    const parsed = ValhallaReply.safeParse(await post(url, { "User-Agent": userAgent(), ...(referer ? { Referer: referer } : {}) }, body, deps));
    if (!parsed.success) throw new RouterDown("valhalla: unexpected answer");
    const { summary, legs } = parsed.data.trip;
    return { geometry: legs.flatMap((l) => decodePolyline6(l.shape)), distanceM: summary.length * 1000, durationS: summary.time };
  },
};

const ORS_PROFILE: Record<Mode, string> = { auto: "driving-car", bicycle: "cycling-regular", pedestrian: "foot-walking" };
const OrsReply = z.object({
  features: z
    .array(z.object({ geometry: z.object({ coordinates: z.array(z.tuple([z.number(), z.number()]).rest(z.number())) }), properties: z.object({ summary: z.object({ distance: z.number(), duration: z.number() }) }) }))
    .min(1),
});

/** OpenRouteService, used only when ORS_API_KEY is set and Valhalla could not answer. */
const ors: Provider = {
  name: "ors",
  async route({ from, to, mode, avoid }, deps) {
    const body = {
      coordinates: [from, to],
      ...(avoid.length ? { options: { avoid_polygons: { type: "MultiPolygon", coordinates: avoid.map((ring) => [ring]) } } } : {}),
    };
    const reply = await post(`https://api.openrouteservice.org/v2/directions/${ORS_PROFILE[mode]}/geojson`, { Authorization: process.env.ORS_API_KEY ?? "", "User-Agent": userAgent() }, body, deps);
    const parsed = OrsReply.safeParse(reply);
    if (!parsed.success) throw new RouterDown("ors: unexpected answer");
    const f = parsed.data.features[0];
    return { geometry: f.geometry.coordinates.map((c): LngLat => [c[0], c[1]]), distanceM: f.properties.summary.distance, durationS: f.properties.summary.duration };
  },
};

// --- The plan ------------------------------------------------------------------------------------------------------------------

const CLOSURE_LAYERS: LayerId[] = ["roadworks"];

/** Closures on now, from the roadworks layer. Water and heating outages are not closures: the road stays open. A layer on demo data ("offline") is ignored: never detour around something that may not exist. */
async function closuresNow(now: number, deps: Deps): Promise<Closure[]> {
  const layers = await Promise.all(CLOSURE_LAYERS.map((id) => (deps.layer ?? getLayer)(id)));
  return activeClosures(layers.filter((l) => l.status !== "offline").flatMap((l) => l.features.features as Feature[]), now);
}

type Plan = { provider: Provider["name"]; path: Path; free: Path; avoided: Closure[]; unavoidable: Closure[] };

/**
 * One router, two steps: the route as the router likes it, then, if that runs through a closure, the route with exclusion
 * polygons around the closures it crossed. Asking for the free route first means only closures that matter are sent (a short
 * exclusion list, well inside Valhalla's perimeter limit) and `avoided` is exact. No way around → the free route and the
 * closures it still crosses (`unavoidable`).
 */
async function planWith(provider: Provider, ask: Omit<Ask, "avoid">, closures: Closure[], deps: Deps): Promise<Plan> {
  const free = await provider.route({ ...ask, avoid: [] }, deps);
  const crossed = crossedBy(free.geometry, closures);
  if (!crossed.length) return { provider: provider.name, path: free, free, avoided: [], unavoidable: [] };

  const rings: LngLat[][] = [];
  let used = 0;
  for (const c of crossed) {
    const cost = c.rings.reduce((sum, r) => sum + perimeterM(r), 0);
    if (used + cost <= EXCLUDE_BUDGET_M) {
      rings.push(...c.rings);
      used += cost;
    }
  }
  try {
    const path = rings.length ? await provider.route({ ...ask, avoid: rings }, deps) : free;
    const still = crossedBy(path.geometry, crossed);
    return { provider: provider.name, path, free, avoided: crossed.filter((c) => !still.includes(c)), unavoidable: still };
  } catch (err) {
    if (err instanceof NoRoute) return { provider: provider.name, path: free, free, avoided: [], unavoidable: crossed }; // the closure cuts the destination off
    throw err;
  }
}

const fail = (status: number, code: string) => Response.json({ code }, { status });
const brief = (c: Closure) => ({ id: c.id, title: c.title });

/**
 * POST /api/route. Body `{ from: [lng, lat], to: [lng, lat], mode?: "auto" | "bicycle" | "pedestrian" }`, both points inside the
 * Skopje box. Answers 400 { code: "input" | "bbox" }, 404 { code: "noroute" }, 429 { code: "rate" }, 502 { code: "router" }.
 */
export async function handleRoute(req: Request, deps: Deps = {}): Promise<Response> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail(400, "input");
  }
  const body = RouteBodySchema.safeParse(json);
  if (!body.success) return fail(400, body.error.issues.some((i) => i.message === "bbox") ? "bbox" : "input");
  const now = deps.now ?? Date.now;
  if (!allowRoute(ipOf(req), now())) return fail(429, "rate");

  const { from, to, mode } = body.data;
  const closures = await closuresNow(now(), deps);
  const providers = [valhalla, ...(process.env.ORS_API_KEY ? [ors] : [])];
  let plan: Plan | undefined;
  let down: unknown;
  for (const provider of providers) {
    try {
      plan = await planWith(provider, { from, to, mode }, closures, deps);
      break;
    } catch (err) {
      if (err instanceof NoRoute) return fail(404, "noroute");
      if (err instanceof Busy) return fail(429, "rate");
      down = err;
      console.warn(`[route] ${provider.name} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  if (!plan) {
    console.warn(`[route] no router answered: ${down instanceof Error ? down.message : String(down)}`);
    return fail(502, "router");
  }

  const waypoints = plan.avoided.length ? sampleWaypoints(plan.path.geometry, plan.free.geometry) : [];
  return Response.json(
    {
      geometry: { type: "LineString", coordinates: plan.path.geometry.map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]) },
      distanceM: Math.round(plan.path.distanceM),
      durationS: Math.round(plan.path.durationS),
      detourM: plan.avoided.length ? Math.max(0, Math.round(plan.path.distanceM - plan.free.distanceM)) : 0,
      avoided: plan.avoided.map(brief),
      unavoidable: plan.unavoidable.map(brief),
      googleMapsUrl: googleMapsUrl(from, to, mode, waypoints),
      wazeUrl: wazeUrl(to),
      wazeDestinationOnly: true,
      provider: plan.provider,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
