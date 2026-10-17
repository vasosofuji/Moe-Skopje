// Live smoke test of POST /api/route against the FOSSGIS Valhalla server. Three upstream requests, spaced by the route's own gate
// (>1 s apart, as their usage policy asks): the free route, then the same trip with a synthetic closure laid across it.
// Run: npx tsx --conditions=react-server scripts/smoke-route.ts   (the condition lets lib/server/* import "server-only" outside Next)
import type { LayerId } from "../lib/layers";
import { activeClosures, crossedBy, type LngLat } from "../lib/routing";
import { handleRoute } from "../lib/server/route";
import type { Feature, LayerResponse } from "../lib/sources/types";

const FROM: LngLat = [21.4318, 41.9957]; // Плоштад Македонија
const TO: LngLat = [21.3893, 42.0043]; // Карпош
const post = (body: unknown) => new Request("http://localhost/api/route", { method: "POST", headers: { "x-real-ip": "smoke" }, body: JSON.stringify(body) });
const layerWith = (features: Feature[]) => async (id: LayerId): Promise<LayerResponse> => ({
  id,
  status: "live",
  updatedAt: new Date().toISOString(),
  source: { name: "smoke", url: "" },
  features: { type: "FeatureCollection", features: id === "roadworks" ? features : [] },
});

type Reply = { geometry: { coordinates: LngLat[] }; avoided: unknown[]; detourM: number };
type Run = { status: number; json: Reply };

async function run(features: Feature[]): Promise<Run> {
  const res = await handleRoute(post({ from: FROM, to: TO, mode: "auto" }), { layer: layerWith(features) });
  return { status: res.status, json: (await res.json()) as Reply };
}
const show = (r: Run) => ({ ...r.json, geometry: `LineString of ${r.json.geometry?.coordinates?.length} points` });

async function main() {
  const free = await run([]);
  console.log("free route:", free.status, show(free));
  if (free.status !== 200) process.exit(1);

  // a closure across the middle of the free route: the road around its middle vertex
  const line: LngLat[] = free.json.geometry.coordinates;
  const mid = Math.floor(line.length / 2);
  const closure: Feature = {
    type: "Feature",
    geometry: { type: "LineString", coordinates: line.slice(Math.max(0, mid - 1), mid + 2) },
    properties: { id: "smoke:closure", kind: "regime", title: { mk: "Пробно затворање", en: "Smoke-test closure" } },
  };

  const detour = await run([closure]);
  console.log("with a closure on the route:", detour.status, show(detour));
  if (detour.status !== 200) process.exit(1);

  const stillCrosses = crossedBy(detour.json.geometry.coordinates, activeClosures([closure], Date.now())).length;
  console.log("avoided:", detour.json.avoided.length, "| still crossing the closure:", stillCrosses, "| detour +", detour.json.detourM, "m");
  if (detour.json.avoided.length !== 1 || stillCrosses !== 0) {
    console.error("SMOKE FAILED: the detour did not avoid the closure");
    process.exit(1);
  }
  console.log("SMOKE OK");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
