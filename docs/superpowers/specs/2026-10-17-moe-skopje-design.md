# Мое Скопје — Design Spec

Date: 2026-10-17 · Status: approved in brainstorming · Build budget: 6 hours, one implementer (Claude)

## 1. Intent

**What:** A web app that puts all of Skopje's public, live city data into one intuitive, premium map-first experience.
**For whom:** Skopje residents (MK + EN UI for the demo).
**Success (demo):** Judges see live data from many real sources on one beautiful liquid-glass map, can file a citizen report, and can ask the AI assistant a question answered from live data.
**Success (later):** The same architecture goes to production without a rewrite (adapters → separate ingestion worker, anonymous → Supabase Auth).

**Three pillars:** Know (live city state) · Fix (citizen reports) · Do (services) + AI city assistant.

### Decisions (from grilling)

| Topic | Decision |
|---|---|
| Goal | Hackathon demo, prod-ready architecture |
| Data | Every listed source wired live; unreachable sources fall back to snapshot → seed, clearly badged |
| Team / time | Solo (Claude implements), 6 hours |
| Hosting | Vercel (region `fra1`) + Supabase |
| AI | Anthropic Claude with tool use |
| Name | **Мое Скопје** (Latin: Moe Skopje) |
| Languages | MK (default) + EN |
| Layout | Map-first, Apple Maps style; onboarding picks default layers; changeable in Settings |
| Map | MapLibre GL + OpenFreeMap tiles, custom muted style |
| Theme | Auto light/dark (system), manual override in Settings |
| Report identity | Anonymous + optional nickname, server-side rate limit per device |
| Scope | Tiered (T1 must-demo, T2 if time, T3 post-hackathon) |
| Data architecture | Next.js server adapters + cache + Supabase snapshots |

## 2. Scope

**T1 — must demo (build in this order):**
1. Map shell + onboarding (layer picker) + Settings
2. Air quality — pulse.eco (already aggregates MOEPP official stations + sensor.community sensors; one adapter)
3. Weather — Open-Meteo
4. Outages — EVN (live); water (Водовод), heating (BEG) via fallback
5. Buses — OSM stops/routes (baked) + JSP timetables (fallback)
6. Parking zones — Градски паркинг
7. On-duty pharmacies — FZO
8. Earthquakes — EMSC
9. Citizen reports (photo, pin, category, upvote, status)
10. AI assistant (MK/EN)
11. Data health panel

**T2 — if time:** Events (skopje.gov.mk), waste schedule (Комунална хигиена, fallback), schools & kindergartens (OSM), e-Services guide (uslugi.gov.mk links), "Go out?" score (air + weather).

**T3 — post-hackathon (out of scope now):** procurement/finance transparency, election results, neighbourhood scorecard, satellite NO₂/green cover, clean-air routing, volunteering, lost pets, AL/TR/RO languages, accounts.

## 3. Source reachability (probed 2026-10-17 from user's network)

| Source | Status | Strategy |
|---|---|---|
| skopje.pulse.eco `/rest/current` | 200, JSON, no auth | live |
| air.moepp.gov.mk | 200 | covered via pulse.eco (official sensor ids 1000+); no direct adapter |
| data.sensor.community area filter | 200 (~6 s) | covered via pulse.eco imports (`sensor_dev_*`); no direct adapter |
| api.open-meteo.com | 200 | live |
| evn.mk → elektrodistribucija.mk/Grid/Planned-disconnections.aspx | 200, content loaded dynamically | find XHR endpoint via browser network tab (20 min time-box), else seed |
| gradskiparking.com.mk | 200 | baked zones (OSM) + zone prices; status `static` |
| fzo.org.mk | 200 | live scrape on-duty pharmacies |
| seismicportal.eu (EMSC) | 200 | live |
| amsm.mk, mvr.gov.mk, skopje.gov.mk, uslugi.gov.mk | 200 | T2 / links |
| jsp.com.mk | unreachable (TLS/000) | seed timetables + baked OSM routes |
| vodovod-skopje.com.mk | unreachable (timeout) | adapter attempts live, falls back to seed |
| beg.com.mk / toplifikacija | unreachable | adapter attempts live, falls back to seed |
| Overpass API | 502/500 flaky | never at runtime; bake GeoJSON once via script |
| tiles.openfreemap.org | 200 | map tiles |

Risk: `.mk` sites may block non-MK IPs (Vercel `fra1`). The fallback chain makes this visible but harmless.

## 4. Stack

- **Next.js** (latest stable, App Router, TypeScript), deployed on Vercel `fra1`.
- **Tailwind CSS v4** for styling; design tokens as CSS variables.
- **motion** (Framer Motion) for spring animations.
- **vaul** for the mobile bottom sheet (snap points, drag).
- **maplibre-gl** directly (no React wrapper).
- **@supabase/supabase-js** — Postgres, Storage.
- **@anthropic-ai/sdk** — assistant with tool use, streaming.
- **zod** — validate every adapter output.
- **cheerio** — HTML scraping.
- **lucide-react** — icons (SF Symbols not licensed for web).
- **vitest** — adapter parser tests.
- i18n: two dictionaries (`mk.ts`, `en.ts`) + `useT()` hook. No i18n library.

## 5. Architecture

```
app/
  layout.tsx                 fonts, theme, i18n provider
  page.tsx                   MapShell (client)
  api/layers/[id]/route.ts   GET → LayerResponse
  api/reports/route.ts       GET list, POST create (rate-limited)
  api/reports/[id]/vote/route.ts  POST upvote
  api/assistant/route.ts     POST, streams Claude response
  api/cron/snapshots/route.ts daily refresh (CRON_SECRET)
components/
  glass/                     Glass, GlassButton, GlassPill, GlassCard, TabBar
  map/                       MapView, layer renderers, MarkerCard
  sheet/                     BottomSheet (mobile), Sidebar (desktop), shared Panel content
  onboarding/, explore/, reports/, assistant/, settings/
lib/
  sources/<id>.ts            one adapter per source
  sources/registry.ts        id → adapter
  layer.ts                   getLayer(id) with fallback chain
  supabase.ts, i18n/, prefs.ts (localStorage)
data/
  static/*.geojson           baked: municipalities, bus stops, bus routes, parking zones, schools
  seed/*.json                fallback per source
scripts/
  bake-osm.ts                one-time Overpass export → data/static
  check-sources.ts           live status table
supabase/schema.sql
```

### 5.1 Adapter contract

```ts
type Status = 'live' | 'stale' | 'offline' | 'static'; // static = baked dataset (OSM routes, zones)
type Feature = GeoJSON.Feature<GeoJSON.Geometry, {
  id: string;
  kind: string;                 // 'air-station' | 'outage' | 'bus-stop' | ...
  title: { mk: string; en: string };
  severity?: 0 | 1 | 2 | 3;     // drives colour
  value?: number; unit?: string;
  startsAt?: string; endsAt?: string;
  detail?: Record<string, string | number>;
}>;
interface Adapter {
  id: string;                   // 'air' | 'weather' | 'outages-power' | ...
  ttl: number;                  // seconds
  source: { name: string; url: string };
  fetch(): Promise<Feature[]>;  // throws on failure
}
interface LayerResponse {
  id: string; status: Status; updatedAt: string;
  source: { name: string; url: string };
  features: GeoJSON.FeatureCollection;
}
```

### 5.2 Fallback chain — `getLayer(id)`

1. In-memory TTL cache per server instance → hit returns cached response. Route sets `Cache-Control: public, s-maxage=<ttl>, stale-while-revalidate=<ttl*10>` so the Vercel CDN serves it.
2. Miss → `adapter.fetch()` with 8 s `AbortSignal.timeout`, then `zod` parse.
3. Success → upsert `source_snapshots(source_id, payload, fetched_at)`; status `live`.
4. Failure → latest snapshot; status `stale` (with its `fetched_at`).
5. No snapshot → `data/seed/<id>.json`; status `offline`.
A layer never returns an error to the UI.

### 5.3 Outage geolocation

EVN/water/heating outages are published as text listing streets/settlements. The adapter matches known settlement and municipality names against the 10 municipality polygons (Центар, Карпош, Аеродром, Кисела Вода, Гази Баба, Чаир, Бутел, Шуто Оризари, Ѓорче Петров, Сарај) and emits the polygon with outage properties. No per-street geocoding. (ponytail: municipality-level precision; add Nominatim street geocoding post-hackathon.)

### 5.4 Data model (Supabase)

```sql
reports(id uuid pk, category text, description text, lat float8, lng float8,
        photo_path text, nickname text, status text default 'new',
        upvotes int default 0, device_hash text, created_at timestamptz default now())
report_votes(report_id uuid, device_hash text, primary key(report_id, device_hash))
source_snapshots(source_id text pk, payload jsonb, fetched_at timestamptz)
storage bucket: report-photos (public read)
```
All writes go through Next.js route handlers using the service-role key; RLS enabled with public read on `reports` only. Rate limit: max 5 reports / device_hash / hour. `device_hash` = SHA-256 of a random id stored in localStorage + user agent. Photos: client-side resize to ≤1600 px JPEG before upload; max 4 MB server-side (Vercel function body limit is 4.5 MB); images only.

Report categories: pothole, illegal dump, streetlight, stray dogs, illegal parking, water leak, other.

### 5.5 AI assistant

- Model: `claude-opus-5-5` (constant in `lib/assistant.ts`), `output_config.effort: "low"` (chat), server-side refusal fallback `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`).
- System prompt: city assistant for Skopje, answer in the UI language, only state facts returned by tools, cite source + age.
- Tools: `get_layer(id)` (returns compact summary of LayerResponse), `list_reports(near?, category?)`, `find_place(name)` (searches baked GeoJSON names).
- Streaming to a glass chat panel. Citations render as chips; tapping one flies the map to that feature.
- Server-side only; `ANTHROPIC_API_KEY` never reaches the client. Basic per-device rate limit (20 msgs / hour).

### 5.6 Preferences

`localStorage` key `moe-skopje:prefs` = `{ lang, theme, layers: string[], onboarded: boolean }`. Wrapped in try/catch; defaults if unavailable.

## 6. Look and feel

### 6.1 Principles (Apple HIG translated to web)

Content first (the map is the hero; chrome floats over it) · clarity (one primary action per surface) · depth (glass layers over live content) · deference (UI recedes, data colours stand out) · direct manipulation (drag sheet, tap marker, springy feedback).

### 6.2 Liquid Glass material

```css
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 0.5px solid var(--glass-stroke);
  box-shadow: inset 0 1px 0 var(--glass-highlight),
              0 1px 2px rgb(0 0 0 / .06), 0 8px 32px rgb(0 0 0 / .12);
  background-image: linear-gradient(180deg, rgb(255 255 255 / .18), transparent 40%);
}
```
| Token | Light | Dark |
|---|---|---|
| `--glass-bg` | `rgb(255 255 255 / .55)` | `rgb(28 28 30 / .50)` |
| `--glass-stroke` | `rgb(255 255 255 / .6)` | `rgb(255 255 255 / .12)` |
| `--glass-highlight` | `rgb(255 255 255 / .7)` | `rgb(255 255 255 / .15)` |
| `--label` | `#000` | `#fff` |
| `--label-2` | `rgb(60 60 67 / .6)` | `rgb(235 235 245 / .6)` |

- **Refraction (progressive):** Chromium-only SVG `feDisplacementMap` filter on large panels' edges; others get standard glass.
- `@media (prefers-reduced-transparency: reduce)` → solid `--glass-bg` at alpha .95, no blur.
- `@media (prefers-reduced-motion: reduce)` → no springs, fades only.
- Theme: `data-theme` on `<html>` overrides system.

### 6.3 Typography

Font stack: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", Inter, system-ui, sans-serif` (Inter via `next/font` with Cyrillic subset).

| Style | Size/Line | Weight |
|---|---|---|
| Large Title | 34/41 | 700 |
| Title 2 | 22/28 | 700 |
| Headline | 17/22 | 600 |
| Body | 17/22 | 400 |
| Subheadline | 15/20 | 400 |
| Footnote | 13/18 | 400 |
| Caption | 12/16 | 500 |

Letter-spacing slightly negative on large sizes (−0.4 px at 34).

### 6.4 Colour

iOS system colours, one per layer: Air `systemGreen→AQI scale`, Weather `systemTeal`, Power outages `systemYellow`, Water `systemBlue`, Heating `systemOrange`, Buses `systemIndigo`, Parking `systemPurple`, Pharmacies `systemRed`, Earthquakes `systemBrown`, Reports `systemPink`.
AQI (PM10 µg/m³): ≤20 green, ≤40 yellow-green, ≤50 yellow, ≤100 orange, ≤150 red, >150 purple.

### 6.5 Shape & motion

Radii: sheet 22, card 14, chip/pill 999. `corner-shape: squircle` where supported. Springs: `{ type: 'spring', stiffness: 400, damping: 30 }`. Press: scale .96. Sheet snaps: 15% / 50% / 92%. Marker card: scale-in from tap point.

### 6.6 Layout

- **Mobile (<768 px):** full-bleed map · top glass search pill + language/profile button · vaul bottom sheet (3 snaps) · floating glass pill tab bar (Explore, Report, Ask, Settings), safe-area aware (`env(safe-area-inset-bottom)`).
- **Tablet (768–1023):** sheet becomes a 360 px floating left card; tab bar stays.
- **Desktop (≥1024):** 380 px floating glass sidebar left (tabs as segmented control at top), layer chips row top-centre, assistant as floating right panel (400 px), map controls bottom-right.
- No horizontal scroll at any width; all tap targets ≥44 px.

### 6.7 Screens

1. **Onboarding** (full-screen glass over blurred map): (a) welcome + language, (b) layer grid — tiles with icon, name, toggle; 4 preselected (Air, Outages, Buses, Reports), (c) location permission (optional), → map.
2. **Explore:** "Today in Skopje" cards (Air now, Weather, Active outages count, Next bus near you) → layer list with toggles and status badges.
3. **Layer detail:** e.g. Air — stations sorted by value, 24 h sparkline, health advice.
4. **Marker card:** glass card anchored to the tapped feature: title, value, time, source, status badge.
5. **Report flow:** category grid → photo (camera/file) → pin (map drag, defaults to GPS) → note + nickname → submit → success with share.
6. **Reports:** list + map pins, upvote, status chip.
7. **Ask:** chat with suggested prompts ("Каков е воздухот во Аеродром?", "Има ли струја утре во Карпош?").
8. **Settings:** language, theme, default layers (same grid as onboarding), Data health (every source: status, last update, link), About.

### 6.8 Status badges

`Live · 3 min` (green dot) · `Stale · 2 h` (orange) · `Demo data` (grey, offline seed) · `Static` (blue, baked dataset). Shown on layer rows, marker cards, assistant citations.

## 7. Error handling

- Adapters: 8 s timeout, zod validation, fallback chain (§5.2). Never throw to UI.
- Map tile failure: show glass toast "Map tiles unavailable" and keep panels usable.
- Reports: client validates; server re-validates (zod), rejects non-images, >4 MB, rate-limited → 429 with friendly MK/EN message.
- Assistant: tool errors returned to the model as text; API failure → inline "Assistant unavailable" bubble.
- Missing env vars at boot: log once; reports/assistant show disabled state instead of crashing.

## 8. Testing

- `vitest`: one parser test per adapter against a saved fixture (`lib/sources/__fixtures__/`).
- `getLayer` fallback test: adapter throws → snapshot → seed.
- `npm run check:sources`: hits every live adapter, prints table (id, status, ms, feature count).
- Manual: mobile (375 px) + desktop pass in browser, light + dark.
- Skipped: E2E suite (add Playwright post-hackathon).

## 9. Environment

`ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`. Vercel Hobby cron = daily only → `/api/cron/snapshots` daily; freshness via request-time revalidation.

## 10. Path to production (not built now)

Split `lib/sources` into a scheduled worker writing `source_snapshots`; frontend reads snapshots only. Add Supabase Auth, moderation queue + city admin view for reports, Playwright, monitoring on source health, AL language, street-level geocoding.

## 11. Scope change (user, 2026-10-17, during build) — supersedes earlier sections where they conflict

1. **No citizen reporting.** Reports (UI, API, adapter, schema tables, assistant `list_reports`) are removed. Tabs: Explore, Ask, Settings.
2. **Main panel = information widgets only.** Layer toggles live only in Settings. No layer-chip pills over the map on desktop.
3. **De-slop.** No sparkle icons, no logo tile, no gradient icon squares, no decorative glow. Typographic wordmark only.
4. **Desktop assistant** is a Spotlight-style glass chat bar docked bottom-centre (⌘K / Ctrl+K), expanding upward into the conversation. Mobile keeps Ask as a sheet tab.
5. **Air quality** renders as a heat map (MapLibre `heatmap` layer weighted by PM10) from the pulse.eco sensors, with station points at high zoom.
6. **Buses** use JSP's official GTFS (Modeshift producer feed, refreshed daily): stops only, no route lines. A stop card lists the next scheduled departures per line. Tapping a departure shows that bus on the map:
   - **Live GPS** from Modeshift's vehicles API when `MODESHIFT_API_KEY` is set. The endpoint exists but returns 401 without a key; there is no public realtime feed.
   - **Otherwise an estimated position**, interpolated along the GTFS shape from `stop_times`, labelled "Проценета позиција (возен ред)".
7. **Parking** renders real zone regions (A0 orange, A red, B yellow, C green, D white per City Parking). Zone streets come from gradskiparking.com.mk zone lists, matched to OSM street geometry, buffered and unioned.
8. **Outages** are geolocated at street level, not by painting whole municipalities. Painting a whole municipality made Karpoš (36.7 km², correct per OSM) look like half the city. Affected streets come from the baked OSM street index.
   - **Main panel** gets an outage widget grouped by day for the next 7 days; tapping an entry flies to its streets.
   - **Water:** scraped from vodovod-skopje.com.mk (live).
   - **Electricity:** EVN's only data endpoint (`portal-api.elektrodistribucija.mk/DSO/Prekini/ZemiPrekini`) returns 404 for everyone as of 2026-10-17. The adapter keeps polling and flips to live automatically when it returns; until then it serves seed data with the honest "Demo data" badge.
