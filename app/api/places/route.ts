import { handlePlaces } from "@/lib/server/places";

export const maxDuration = 15; // Photon (3 s), then Nominatim after its queue (up to ~4 s of waiting, 4 s to answer)

/**
 * GET /api/places?q=&lang=mk|en&near=lng,lat → up to 8 `{ id, name, nameEn?, kind: "poi" | "address" | "street" | "area",
 * category?, address?, area?, lng, lat }`: shops, cafes, schools, hospitals, malls, monuments, addresses, streets and
 * neighbourhoods from OpenStreetMap (Photon, then Nominatim), merged with the baked streets and municipalities.
 * `q` is 2 to 80 characters, `lang` defaults to mk, `near` is optional. See lib/server/places.ts.
 */
export const GET = (req: Request) => handlePlaces(req);
