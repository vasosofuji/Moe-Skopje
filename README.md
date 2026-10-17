# Мое Скопје

Skopje publishes a lot of open data, but it is scattered over a dozen sites. Мое Скопје puts it on one map: air quality, weather, water/power/heating outages, buses, parking, on-duty pharmacies, earthquakes and roadworks, in Macedonian and English, on desktop and phone.

## Features

- **Live map layers** on MapLibre + OpenFreeMap, picked during onboarding and changeable in Settings.
- **Today widgets**: air, weather and a "Go out?" score.
- **Air heat map** from every pulse.eco sensor; zoom in to see the stations.
- **Outages** scraped daily from Водовод and placed on the actual streets.
- **Buses** from the official JSP GTFS feed, with live GPS when a Modeshift key is set (estimated positions otherwise, labelled as such).
- **Parking zones** drawn from City Parking's published street lists.
- **Route planner** that avoids active closures and roadworks, with a hand-off to Google Maps.
- **Assistant** (⌘K): ask in Macedonian or English; answers come only from the live layers, with source, age and a tap-to-fly citation.
- **Honest data status**: each layer falls back from live, to last-good snapshot, to clearly labelled demo data. Nothing fabricated is shown as live.

## Data sources

pulse.eco, Open-Meteo, EMSC, JSP GTFS (Modeshift), FZO on-duty pharmacies, Водовод Скопје, EVN, MVR traffic notices, OpenStreetMap, City Parking, skopje.gov.mk.

## Stack

Next.js 16 (App Router), React 19, Tailwind 4, MapLibre GL, Valhalla routing (OpenRouteService fallback), Photon/Nominatim geocoding, Supabase for snapshots, Anthropic API for the assistant, Vitest. Deployed on Vercel (`fra1`) with a daily snapshot cron.

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

### Environment

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Assistant |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Snapshot storage (schema in `supabase/schema.sql`) |
| `CRON_SECRET` | Protects `/api/cron/snapshots` |
| `MODESHIFT_API_KEY` | Optional: live bus GPS |
| `ROUTER_CONTACT` | Contact appended to the routing/geocoding User-Agent |
| `ORS_API_KEY` | Optional: OpenRouteService fallback router |
| `PHOTON_URL` | Optional: custom Photon server |

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Vitest suite |
| `npm run lint` | ESLint |
| `npm run check:sources` | Ping every data source |
| `npm run bake:osm` | Bake OSM streets/settlements/construction into static GeoJSON |
| `npm run bake:parking` | Bake City Parking zones |

## Layout

```
app/          pages and API routes (air-trend, assistant, buses, cron, health, layers, outages, places, route)
components/   map, shell, explore, route, assistant, onboarding, settings UI
lib/sources/  one adapter per data source
lib/server/   layer cache, routing, geocoding, assistant, Supabase
scripts/      data baking and source checks
ad/           Remotion project for the promo video
docs/         demo script and source notes
```
