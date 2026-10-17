import { handleReverse } from "@/lib/server/places";

export const maxDuration = 10;

/** GET /api/places/reverse?lng=&lat= → `{ name, address? }` of the nearest house, shop or street (the "set on map" label). See lib/server/places.ts. */
export const GET = (req: Request) => handleReverse(req);
