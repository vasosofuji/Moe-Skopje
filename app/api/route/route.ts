import { handleRoute } from "@/lib/server/route";

export const maxDuration = 30; // the free route, then the detour, each spaced by a second and capped at 8 s

/**
 * POST /api/route (JSON `{ from: [lng, lat], to: [lng, lat], mode }`) → `{ geometry, distanceM, durationS, detourM, avoided,
 * unavoidable, googleMapsUrl, wazeUrl, wazeDestinationOnly, provider }`. See lib/server/route.ts.
 */
export const POST = (req: Request) => handleRoute(req);
