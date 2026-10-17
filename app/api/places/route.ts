import { PlacesQuery, searchPlaces } from "@/lib/server/places";

/** GET /api/places?q= (1 to 60 characters) → up to 8 `{ name, nameEn?, kind, area?, lng, lat }`, Latin or Cyrillic. 400 `{ code: "input" }` for a bad `q`. */
export async function GET(req: Request) {
  const q = PlacesQuery.safeParse({ q: new URL(req.url).searchParams.get("q") ?? "" });
  if (!q.success) return Response.json({ code: "input" }, { status: 400 });
  return Response.json(await searchPlaces(q.data.q), {
    headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" },
  });
}
