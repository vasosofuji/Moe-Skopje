# Мое Скопје Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A map-first, liquid-glass web app that shows Skopje's live city data (air, weather, outages, buses, parking, pharmacies, earthquakes), takes citizen reports, and answers questions through a Claude-powered assistant, in MK and EN.

**Architecture:** Next.js App Router on Vercel. One server adapter per source returns a shared GeoJSON shape. `getLayer(id)` wraps every adapter in a fallback chain (memory cache → live fetch → Supabase snapshot → seed file), so a layer never errors. The client is one map shell. Panels float over the map as glass: a vaul bottom sheet on mobile, a sidebar on desktop.

**Tech Stack:** Next.js (latest stable) + TypeScript, Tailwind CSS v4, motion, vaul, maplibre-gl, @supabase/supabase-js, @anthropic-ai/sdk, zod, cheerio, lucide-react, vitest, tsx, osmtogeojson (script only).

**Spec:** `docs/superpowers/specs/2026-10-17-moe-skopje-design.md` — read it alongside this plan. Spec §-references below point there.

## Global Constraints

- App name: **Мое Скопје** (Latin: Moe Skopje). Default language MK, second EN. Every user-visible string goes through `useT()`; no hard-coded copy in components.
- Deploy: Vercel region `fra1`. Env vars: `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.
- Secrets never reach the client: `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are only imported in `app/api/**` or `lib/server/**`. Files under `lib/server/` start with `import "server-only"`.
- Assistant model: `claude-opus-5-5`, `output_config: { effort: "low" }`, `betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`.
- Adapter fetch timeout: 8 s (`AbortSignal.timeout(8000)`). Every adapter output passes the zod `FeatureSchema` before use.
- Layer status values: `live | stale | offline | static`. Badge copy: `Live · 3 min`, `Stale · 2 h`, `Demo data`, `Static` (spec §6.8).
- Rate limits: 5 reports per device_hash per hour. 20 assistant messages per device per hour.
- Report photo: client resizes to ≤1600 px JPEG; server rejects anything over 4 MB or not `image/*`.
- Breakpoints: mobile <768 px, tablet 768–1023, desktop ≥1024. Tap targets ≥44 px. No horizontal scroll at 320 px width.
- Sheet snap points `[0.15, 0.5, 0.92]`. Spring `{ type: "spring", stiffness: 400, damping: 30 }`. Press scale `0.96`.
- Glass tokens, type scale, layer colours, AQI thresholds: exactly as in spec §6.2–6.4.
- Accessibility: honour `prefers-reduced-transparency` and `prefers-reduced-motion`. All icon-only buttons have `aria-label`.
- `localStorage` keys: `moe-skopje:prefs`, `moe-skopje:device`. All access in try/catch.
- Skopje centre: `[21.4254, 41.9981]` (lng, lat). Bbox: `21.25,41.90,21.60,42.10` (W,S,E,N).

## Review Focus

1. **A source returns HTTP 200 with changed or empty markup.** The parser yields `[]` and the map silently goes blank. Expected: adapters with `minFeatures > 0` treat too few features as a failure, and the layer falls back to `stale`. Test added in Task 3.
2. **Settlement names in mixed scripts and case.** Outage text says "КАРПОШ 4", "Karpoš", "Аеродром," and so on. Expected: they still match the right municipality. Test added in Task 6.
3. **Outage times parsed in UTC on Vercel.** Times published in local time end up shifted. Expected: times are parsed as `Europe/Skopje` and emitted as ISO with an offset. Test added in Task 6.
4. **`localStorage` missing or corrupt** (Safari private mode, or hand-edited JSON). Expected: defaults are used, and onboarding shows instead of crashing. Test added in Task 2.
5. **iPhone HEIC photo or oversized file.** Canvas decode fails in non-Safari browsers. Expected: if decode fails and the original is ≤4 MB, upload the original; otherwise show a friendly error. The server rejects non-image MIME types and anything over 4 MB with 400. Tests added in Tasks 10–11.

---

## Time budget (6 h total, spec §6 budget)

| Task | Window |
|---|---|
| 1–2 | 0:30–1:00 |
| 3–4 | 1:00–2:00 |
| 5–9 | 2:00–3:30 |
| 10–11 | 3:30–4:15 |
| 12 | 4:15–5:00 |
| 13 | 5:00–5:30 |
| 14 | 5:30–6:00 |

If a task overruns by more than 15 minutes, take its fallback (each task names one) and move on.

---

### Task 1: Scaffold, design tokens, glass primitives

**Files:**
- Create: Next.js app at repo root (`app/`, `package.json`, `tsconfig.json`, …)
- Create: `app/globals.css`: tokens and the `.glass` material
- Create: `components/glass/Glass.tsx`, `components/glass/GlassButton.tsx`, `components/glass/GlassPill.tsx`, `components/glass/GlassCard.tsx`, `components/glass/StatusBadge.tsx`
- Create: `components/glass/RefractionFilter.tsx`: the SVG `feDisplacementMap` definition, rendered once in the layout
- Create: `app/layout.tsx`, `vitest.config.ts`, `.env.example`, `.gitignore`

**Interfaces:**
- Produces: `<Glass as? className? strong?>`: a div with the `.glass` class (`strong` = larger blur for big panels plus refraction). `<GlassButton onClick aria-label? size="sm"|"md">`, which presses down with spring scale 0.96. `<GlassPill>`. `<GlassCard>`. `<StatusBadge status: Status updatedAt: string>`.
- Produces CSS variables: `--glass-bg --glass-stroke --glass-highlight --label --label-2`, the type classes `.t-large-title .t-title2 .t-headline .t-body .t-subhead .t-footnote .t-caption`, and the layer colours `--c-air --c-weather --c-power --c-water --c-heating --c-bus --c-parking --c-pharmacy --c-quake --c-report`.

- [ ] **Step 1: Init git and scaffold**

```bash
git init
npx create-next-app@latest . --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-npm --turbopack
```
If it refuses because `docs/` exists, move `docs/` to the scratchpad, scaffold, and move it back.

- [ ] **Step 2: Install dependencies**

```bash
npm i maplibre-gl vaul motion @supabase/supabase-js @anthropic-ai/sdk zod cheerio lucide-react server-only
npm i -D vitest tsx osmtogeojson @types/geojson
```
Add these scripts: `"test": "vitest run"`, `"check:sources": "tsx scripts/check-sources.ts"`, `"bake:osm": "tsx scripts/bake-osm.ts"`.

- [ ] **Step 3: Write tokens and the glass material in `app/globals.css`**

Use the exact values from spec §6.2–6.4. Light tokens go on `:root`. Dark tokens go under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }` and again on `:root[data-theme="dark"]`. Add `@media (prefers-reduced-transparency: reduce)`: glass becomes solid at alpha .95 with no backdrop-filter. Add `@supports (corner-shape: squircle)` to apply `corner-shape: squircle`. Font stack per spec §6.3: Inter via `next/font/google` with subsets `["latin","cyrillic"]`, exposed as `--font-inter` and placed after the Apple system fonts. `body` gets an explicit background (`#f2f2f7` light, `#000` dark).

- [ ] **Step 4: Build the glass components and `RefractionFilter`**

The refraction filter is applied only when `CSS.supports("backdrop-filter", "url(#x)")` is true, which in practice means Chromium. Elsewhere the panel keeps standard glass. Every spring animation reads `useReducedMotion()` from `motion`; when it is true, use a 150 ms opacity fade instead.

- [ ] **Step 5: Verify**

Run `npm run dev`. Temporarily render a `<Glass strong>` over a gradient on `app/page.tsx`. Check light mode, dark mode, and Chrome DevTools "Emulate CSS prefers-reduced-transparency".
Expected: blurred translucent panel, top highlight, hairline border. Solid when reduced transparency is on.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: scaffold Next.js app with liquid glass design tokens"
```

---

### Task 2: i18n, preferences, device id

**Files:**
- Create: `lib/i18n/mk.ts`, `lib/i18n/en.ts`, `lib/i18n/index.tsx`
- Create: `lib/prefs.ts`
- Test: `lib/prefs.test.ts`

**Interfaces:**
- Produces: `type Lang = "mk" | "en"`. `type Dict = typeof mk` (EN must satisfy the same keys). `<I18nProvider>`. `useT(): { t(key: keyof Dict, vars?: Record<string,string|number>): string; lang: Lang; setLang(l: Lang): void }`. `pick(text: {mk:string;en:string}, lang): string`.
- Produces: `type Prefs = { lang: Lang; theme: "system"|"light"|"dark"; layers: LayerId[]; onboarded: boolean }`. `DEFAULT_PREFS` has `lang:"mk"`, `theme:"system"`, `layers:["air","outages-power","buses","reports"]` and `onboarded:false`. Also `loadPrefs(storage?: Storage): Prefs`, `savePrefs(p: Prefs, storage?: Storage): void`, `getDeviceId(storage?: Storage): string` (a `crypto.randomUUID()` persisted under `moe-skopje:device`), and `usePrefs(): [Prefs, (p: Partial<Prefs>) => void]`.
- Produces: `type LayerId = "air" | "weather" | "outages-power" | "outages-water" | "outages-heating" | "buses" | "parking" | "pharmacies" | "earthquakes" | "reports" | "events" | "waste" | "schools"`. Exported from `lib/layers.ts` together with `LAYERS: Record<LayerId, { color: string /* css var */; icon: LucideIconName; titleKey: keyof Dict; tier: 1 | 2 }>`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/prefs.test.ts
test("loadPrefs returns defaults when storage throws", () => {
  const bad = { getItem: () => { throw new Error("denied") } } as unknown as Storage;
  expect(loadPrefs(bad)).toEqual(DEFAULT_PREFS);
});
test("loadPrefs returns defaults on corrupt JSON", () => {
  const s = memStorage({ "moe-skopje:prefs": "{not json" });
  expect(loadPrefs(s)).toEqual(DEFAULT_PREFS);
});
test("loadPrefs drops unknown layer ids and keeps valid ones", () => {
  const s = memStorage({ "moe-skopje:prefs": JSON.stringify({ ...DEFAULT_PREFS, layers: ["air", "bogus"], onboarded: true }) });
  expect(loadPrefs(s).layers).toEqual(["air"]);
  expect(loadPrefs(s).onboarded).toBe(true);
});
test("getDeviceId is stable across calls", () => {
  const s = memStorage({});
  expect(getDeviceId(s)).toBe(getDeviceId(s));
});
```
`memStorage` is a small in-file helper that implements `getItem` and `setItem` over an object.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run lib/prefs.test.ts`. Expected: FAIL, `loadPrefs` is not exported.

- [ ] **Step 3: Implement `lib/prefs.ts`, `lib/layers.ts` and the i18n files**

`loadPrefs` validates the stored JSON with a zod schema. On any failure it returns `DEFAULT_PREFS`, and it filters `layers` to known ids. The MK dictionary is the source of copy. Write natural Macedonian, not a literal translation of the English.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run lib/prefs.test.ts`. Expected: 4 passed.

- [ ] **Step 5: Commit** `feat: i18n dictionaries, prefs and device id`

---

### Task 3: Adapter contract and `getLayer` fallback chain

**Files:**
- Create: `lib/sources/types.ts`, `lib/server/layer.ts`, `lib/server/supabase.ts`, `lib/sources/registry.ts`
- Create: `app/api/layers/[id]/route.ts`, `app/api/health/route.ts`
- Create: `supabase/schema.sql`
- Test: `lib/server/layer.test.ts`

**Interfaces:**
- Produces in `lib/sources/types.ts`: `Status`, `Feature`, `FeatureSchema` (zod), `Adapter`, `LayerResponse`, exactly as in spec §5.1. On top of that, `Adapter` gains `minFeatures: number` (default 0) and `seed: () => Promise<Feature[]>` (loads `data/seed/<id>.json`). Static adapters set `static: true`.
- Produces: `getLayer(id: LayerId, deps?: { now?: () => number; snapshots?: SnapshotStore }): Promise<LayerResponse>`.
- Produces: `interface SnapshotStore { get(id): Promise<{ payload: Feature[]; fetchedAt: string } | null>; put(id, payload: Feature[]): Promise<void> }`. There is a Supabase implementation and an in-memory one for tests. If the Supabase env vars are missing, the Supabase store becomes a no-op.
- Produces: `registry: Record<LayerId, Adapter>`. Tasks 5–9 and 13 add their adapters here.
- Produces: `GET /api/layers/[id]` → `LayerResponse` with `Cache-Control: public, s-maxage=${ttl}, stale-while-revalidate=${ttl*10}`; unknown id → 404. `GET /api/health` → `Array<{ id, status, updatedAt, featureCount, source }>`.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/server/layer.test.ts — registry is mocked with vi.mock
test("live fetch returns status live and writes a snapshot", async () => { /* adapter resolves 2 features → status "live", snapshots.put called once */ });
test("adapter throws → latest snapshot with status stale and its fetchedAt", async () => {});
test("adapter throws, no snapshot → seed with status offline", async () => {});
test("fewer features than minFeatures counts as failure → stale", async () => {
  // adapter minFeatures: 1 resolves [] ; snapshot exists → status "stale"
});
test("invalid feature shape counts as failure → stale", async () => {});
test("second call within ttl does not call adapter.fetch again", async () => {});
test("static adapter → status static, no snapshot write", async () => {});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run lib/server/layer.test.ts`. Expected: FAIL, the module is not found.

- [ ] **Step 3: Implement `getLayer` following spec §5.2**

The in-memory cache is a `Map<LayerId, { at: number; res: LayerResponse }>`, valid for `adapter.ttl` seconds (ponytail: per-instance cache, the CDN header does the real work). `getLayer` never throws. As a last resort it returns `{ status: "offline", features: empty FeatureCollection }`.

- [ ] **Step 4: Write `supabase/schema.sql`**

Tables `reports`, `report_votes` and `source_snapshots` exactly as in spec §5.4. Enable RLS on all three. Add one policy, `select` on `reports` for `anon`. Create the storage bucket with `insert into storage.buckets (id, name, public) values ('report-photos','report-photos', true) on conflict do nothing;`. Add an index on `reports(device_hash, created_at)`.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run lib/server/layer.test.ts`. Expected: 7 passed.

- [ ] **Step 6: Manual Supabase setup (user)**

The user creates the Supabase project, runs `supabase/schema.sql` in the SQL editor, and fills `.env.local` from `.env.example`. While waiting for that, keep working: the snapshot store is a no-op without env vars.

- [ ] **Step 7: Commit** `feat: adapter contract, getLayer fallback chain, layers API`

---

### Task 4: Map shell, responsive panels, onboarding, settings

**Files:**
- Create: `components/map/MapView.tsx`, `components/map/mapStyle.ts`, `components/map/renderLayer.ts`, `components/map/MarkerCard.tsx`
- Create: `components/shell/AppShell.tsx`, `components/shell/BottomSheet.tsx`, `components/shell/Sidebar.tsx`, `components/shell/TabBar.tsx`, `components/shell/SearchPill.tsx`, `components/shell/LayerChips.tsx`
- Create: `components/explore/ExplorePanel.tsx`, `components/explore/LayerRow.tsx`
- Create: `components/onboarding/Onboarding.tsx`, `components/onboarding/LayerGrid.tsx`
- Create: `components/settings/SettingsPanel.tsx`, `components/settings/DataHealth.tsx`
- Create: `lib/useLayer.ts`, `lib/useMedia.ts`
- Modify: `app/page.tsx` renders `<AppShell/>`

**Interfaces:**
- Consumes: `getLayer` over `GET /api/layers/[id]`, `usePrefs`, `useT`, `LAYERS`, and the glass components.
- Produces: `useLayer(id: LayerId, enabled: boolean): { data?: LayerResponse; loading: boolean }`, which uses `fetch`, re-fetches every `60 s` while enabled, and does not re-fetch while the tab is hidden. Also `useIsDesktop(): boolean` (≥1024).
- Produces: `type Tab = "explore" | "report" | "ask" | "settings"`. `<AppShell>` owns `tab`, `selectedFeature`, and `flyTo(lngLat, zoom?)`, exposed through `MapContext`: `useMap(): { flyTo; select(feature: Feature | null); map?: maplibregl.Map }`.
- Produces: `renderLayer(map, id: LayerId, fc: FeatureCollection, color: string)`. It adds or updates a GeoJSON source `src-${id}` and layers `${id}-fill` (polygons, opacity .25), `${id}-line` and `${id}-circle` (radius 7, white 2 px stroke). Colour comes from `severity` when present (0 green, 1 yellow, 2 orange, 3 red), otherwise the layer colour.
- `LayerGrid` is shared by Onboarding and Settings: `<LayerGrid value: LayerId[] onChange(ids) />`.

- [ ] **Step 1: MapView**

`maplibre-gl` is loaded with a dynamic import inside `useEffect` (SSR-safe). The style is `https://tiles.openfreemap.org/styles/positron` in light mode and `…/styles/dark` in dark mode. `mapStyle.ts` exports `muteStyle(map)`, which lowers label and road saturation through `setPaintProperty` for the Apple Maps feel. Start at centre `[21.4254, 41.9981]`, zoom 12. Bounds are the bbox from Global Constraints. Attribution control stays visible (an OSM licence requirement). Switch styles when the theme changes, then re-add the layers on `style.load`. On tile error, show a glass toast with `t("map.tilesUnavailable")`.

- [ ] **Step 2: Responsive shell**

- **Mobile:** `BottomSheet` is a vaul `Drawer` with `snapPoints={[0.15,0.5,0.92]}`, `modal={false}` and `dismissible={false}`, so the map stays interactive. It sits above the floating `TabBar` (glass pill, `env(safe-area-inset-bottom)`). `SearchPill` sits at the top.
- **Desktop:** `Sidebar` is a 380 px floating `<Glass strong>`, 16 px from the left, top and bottom. Inside it, the tabs become a segmented control. `LayerChips` sits top-centre.
- **Tablet:** the sidebar narrows to 360 px and the `TabBar` stays.
- Panel content (`ExplorePanel`, `SettingsPanel`, and so on) is the same component in all three layouts.

- [ ] **Step 3: Explore panel**

The "Today in Skopje" cards come first: Air now, Weather, Active outages, Next bus. Each reads from `useLayer`. While loading, show a skeleton shimmer. Below the cards, a `LayerRow` for each Tier 1 layer: icon, name, `StatusBadge`, and a toggle bound to `prefs.layers`.

- [ ] **Step 4: MarkerCard**

Clicking the map runs `queryRenderedFeatures` over the visible `*-circle` and `*-fill` layers. The top hit goes to `select()`. The card shows `pick(title)`, `value unit`, `detail` rows, source, and `StatusBadge`. It scales in with the spring, and closes on Escape or a tap on the map.

- [ ] **Step 5: Onboarding and settings**

- **Onboarding** shows when `!prefs.onboarded`, as a full-screen `<Glass strong>` over the map. Step (a) is language. Step (b) is `LayerGrid`, preselected with `DEFAULT_PREFS.layers`. Step (c) asks for location through `navigator.geolocation`, optional, and saves the result for "Next bus near you". Finishing sets `onboarded: true`.
- **SettingsPanel** holds language, theme (writes `data-theme` on `<html>`), `LayerGrid`, `DataHealth` (reads `/api/health` and shows a row per source with `StatusBadge` and a link), and About.

- [ ] **Step 6: Verify in the built-in browser**

Run `npm run dev` and check widths 375 and 1440, light and dark. Clearing site data must show onboarding again. Toggling a layer must persist across reload. Expected: no horizontal scroll at 320 px. The map still pans when the sheet is at 15%.
Fallback if vaul fights the map's gestures: a fixed sheet with three height buttons.

- [ ] **Step 7: Commit** `feat: map shell, responsive glass panels, onboarding, settings`

---

### Task 5: Static OSM bake (municipalities, buses, parking, pharmacies, schools)

**Files:**
- Create: `scripts/bake-osm.ts`
- Create (output): `data/static/municipalities.geojson`, `bus-stops.geojson`, `bus-routes.geojson`, `parking.geojson`, `pharmacies.geojson`, `schools.geojson`
- Create: `lib/sources/static.ts`

**Interfaces:**
- Produces: `staticAdapter(id: LayerId, file: string, kind: string, opts?: { titleFrom?: string }): Adapter`. It reads the GeoJSON, maps OSM `name` / `name:en` to `title{mk,en}`, and sets `static: true` and `ttl: 86400`.
- Produces: `municipalities(): Promise<FeatureCollection<Polygon|MultiPolygon, { name_mk: string; name_en: string }>>`, which Task 6 uses.

- [ ] **Step 1: Write `scripts/bake-osm.ts`**

It POSTs Overpass QL over the bbox to the first endpoint that answers 200: `https://overpass-api.de/api/interpreter`, then `https://overpass.kumi.systems/api/interpreter`, then `https://maps.mail.ru/osm/tools/overpass/api/interpreter`. Results go through `osmtogeojson` and into `data/static/*.geojson`. Queries:
- municipalities: `rel["boundary"="administrative"]["name"~"^(Центар|Карпош|Аеродром|Кисела Вода|Гази Баба|Чаир|Бутел|Шуто Оризари|Ѓорче Петров|Сарај)$"]` with `out geom;`
- bus stops: `node["highway"="bus_stop"]`
- bus routes: `rel["route"="bus"]` with `out geom;` (lines only)
- parking: `nwr["amenity"="parking"]` with `out center;`
- pharmacies: `nwr["amenity"="pharmacy"]` with `out center;`
- schools: `nwr["amenity"~"^(school|kindergarten)$"]` with `out center;`

- [ ] **Step 2: Run it and verify**

Run: `npm run bake:osm`. Expected: 6 files. `municipalities.geojson` has exactly 10 features. Bus stops number over 300. Commit the outputs, since they are the runtime data.
Fallback if every Overpass endpoint fails: download the Geofabrik `macedonia-latest.osm.pbf` extract and stop for user help. Do not burn more than 15 minutes on this.

- [ ] **Step 3: Register static adapters**

Add `buses` (stops plus routes merged, kind `bus-stop` / `bus-route`), `parking` and `schools` (Tier 2) to the registry. `parking` adds `detail.zonePrice` from `data/seed/parking-zones.json`, a small hand-written table of City Parking zone prices with the source URL `https://www.gradskiparking.com.mk/`.

- [ ] **Step 4: Commit** `feat: bake OSM static datasets`

---

### Task 6: Outages (power live, water and heating fallback)

**Files:**
- Create: `lib/sources/outages.ts`, `lib/sources/geo.ts`
- Create: `data/seed/outages-power.json`, `data/seed/outages-water.json`, `data/seed/outages-heating.json`
- Create: `lib/sources/__fixtures__/evn.*` (saved real response)
- Test: `lib/sources/outages.test.ts`

**Interfaces:**
- Consumes: `municipalities()` from Task 5.
- Produces: `normalizeName(s: string): string`, which lowercases, strips diacritics, transliterates Latin to Macedonian Cyrillic, and drops trailing numbers and punctuation. Also `matchMunicipality(text: string): string | null`, which returns `name_mk`.
- Produces: `parseSkopjeTime(date: string, time: string): string`, an ISO string with the `+01:00` or `+02:00` offset that `Europe/Skopje` has on that date.
- Produces adapters `outages-power` (ttl 900, minFeatures 0), `outages-water` and `outages-heating` (ttl 1800). Each emits the municipality polygon with `kind:"outage"`, `severity: 2`, `startsAt`, `endsAt`, and `detail.streets`.

- [ ] **Step 1: Find the EVN data endpoint (20 min time-box)**

Open `https://www.elektrodistribucija.mk/Grid/Planned-disconnections.aspx?lang=mk-mk` in the built-in browser and use `read_network_requests` to find the XHR or postback that returns the outage rows. Save one real response to `lib/sources/__fixtures__/evn.(json|html)`. If nothing turns up within the time-box, check `/GisMap.aspx`, then fall back to seed only and record that decision in a code comment.

- [ ] **Step 2: Write the failing tests**

```ts
test("matchMunicipality handles case, script and suffix numbers", () => {
  expect(matchMunicipality("КАРПОШ 4")).toBe("Карпош");
  expect(matchMunicipality("Karpoš")).toBe("Карпош");
  expect(matchMunicipality("ул. Партизанска, Аеродром,")).toBe("Аеродром");
  expect(matchMunicipality("Gjorce Petrov")).toBe("Ѓорче Петров");
  expect(matchMunicipality("Куманово")).toBeNull();
});
test("parseSkopjeTime uses local offset (summer +02:00, winter +01:00)", () => {
  expect(parseSkopjeTime("17.10.2026", "09:00")).toBe("2026-10-17T09:00:00+02:00");
  expect(parseSkopjeTime("17.12.2026", "09:00")).toBe("2026-12-17T09:00:00+01:00");
});
test("EVN fixture parses into municipality polygons with start/end", async () => { /* ≥1 feature, kind outage, startsAt < endsAt */ });
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run `npx vitest run lib/sources/outages.test.ts`. Expected: FAIL.

- [ ] **Step 4: Implement**

`parseSkopjeTime` derives the offset with `Intl.DateTimeFormat("en", { timeZone: "Europe/Skopje", timeZoneName: "longOffset" })`. The water adapter tries `https://www.vodovod-skopje.com.mk/` and the heating adapter tries `https://www.beg.com.mk/`. Both were unreachable when probed, so they throw on timeout or parse failure and fall back to seed. Each seed file holds 2–3 realistic entries in the same shape (ponytail: municipality-level precision, spec §5.3).

- [ ] **Step 5: Run the tests and confirm they pass**

Run `npx vitest run lib/sources/outages.test.ts`. Expected: 3 passed.

- [ ] **Step 6: Commit** `feat: outage adapters with municipality matching`

---

### Task 7: Air quality (pulse.eco) and weather (Open-Meteo)

**Files:**
- Create: `lib/sources/air.ts`, `lib/sources/weather.ts`, `lib/aqi.ts`
- Create: `lib/sources/__fixtures__/pulse-current.json`, `pulse-sensor.json`, `open-meteo.json` (saved with curl)
- Test: `lib/sources/air.test.ts`, `lib/aqi.test.ts`

**Interfaces:**
- Produces: `pm10Severity(v: number): 0|1|2|3` and `aqiColor(v: number): string`. Thresholds from spec §6.4: ≤20 green, ≤40 yellow-green, ≤50 yellow, ≤100 orange, ≤150 red, >150 purple. Severity is 0 for ≤40, 1 for ≤50, 2 for ≤100, and 3 above that.
- Produces the adapter `air` (ttl 600, minFeatures 1). It reads `https://skopje.pulse.eco/rest/current` and `/rest/sensor` (cached 24 h in memory) and emits one point per sensor that has pm10 or pm25. `value` is pm10 (pm25 if no pm10), `unit:"µg/m³"`, `detail: { pm10, pm25, no2?, o3?, noise?, temperature? }`, and the title is the sensor `description`. `detail.official = true` when `sensorId` is numeric (MOEPP stations).
- Produces the adapter `weather` (ttl 900, minFeatures 1): `https://api.open-meteo.com/v1/forecast?latitude=41.9981&longitude=21.4254&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability&timezone=Europe%2FSkopje&forecast_days=1`. It emits one point at the centre with `detail` holding the current values and `detail.hourly`, a JSON string of 24 hourly values.

- [ ] **Step 1: Save the fixtures**

```bash
curl -s https://skopje.pulse.eco/rest/current > lib/sources/__fixtures__/pulse-current.json
curl -s https://skopje.pulse.eco/rest/sensor > lib/sources/__fixtures__/pulse-sensor.json
curl -s "<open-meteo url above>" > lib/sources/__fixtures__/open-meteo.json
```

- [ ] **Step 2: Write the failing tests**

```ts
test("pm10Severity thresholds", () => {
  expect([20, 40, 41, 50, 51, 100, 101, 151].map(pm10Severity)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
});
test("air fixture → one feature per sensor with pm data, values numeric", () => { /* features.length > 10; every value is a finite number; official flag set for sensorId "1000" */ });
test("air ignores readings older than 3 hours", () => {});
test("weather fixture → one feature with temperature", () => {});
```

- [ ] **Step 3: Implement, run the tests, confirm they pass**

pulse.eco returns `value` as a string, so parse it to a number and drop NaN. Group readings by `sensorId` and keep the latest `stamp` per type.
Run `npx vitest run lib/sources/air.test.ts lib/aqi.test.ts`. Expected: all pass.

- [ ] **Step 4: Air layer detail**

Add `components/explore/AirDetail.tsx`: stations sorted by pm10 (highest first), a health advice line keyed by severity (`t("air.advice.0".."3")`), and a 24 h sparkline drawn as inline SVG from `https://skopje.pulse.eco/rest/avgData/day?sensorId=-1&type=pm10&from=..&to=..`. If the sparkline fetch fails, hide the sparkline. Weather needs no detail beyond its Today card.

- [ ] **Step 5: Commit** `feat: air quality and weather adapters`

---

### Task 8: Earthquakes (EMSC) and on-duty pharmacies

**Files:**
- Create: `lib/sources/earthquakes.ts`, `lib/sources/pharmacies.ts`
- Create: `lib/sources/__fixtures__/emsc.json`
- Test: `lib/sources/earthquakes.test.ts`

**Interfaces:**
- Produces the adapter `earthquakes` (ttl 600, minFeatures 0): `https://www.seismicportal.eu/fdsnws/event/1/query?format=json&lat=41.9981&lon=21.4254&maxradius=2&limit=20&orderby=time`. It maps each event to a point with `value: mag`, `unit: "M"`, severity (mag <3 → 0, <4 → 1, <5 → 2, otherwise 3), and `startsAt: time`.
- Produces the adapter `pharmacies` (ttl 3600). The base is `data/static/pharmacies.geojson`. The live part marks `detail.onDuty = true`: scrape the FZO / Ministry of Health on-duty list (spend no more than 15 minutes finding the page from `https://fzo.org.mk/`) and match pharmacy names with `normalizeName`. Fallback: `onDuty` = OSM `opening_hours` contains `24/7`. Status is `live` only when the scrape worked; otherwise the adapter throws and the chain serves OSM-based seed data (`offline`).

- [ ] **Step 1: Write the failing test** `emsc fixture → features with mag and severity`, plus `mag 4.2 → severity 2`
- [ ] **Step 2: Run the test and confirm it fails.** Implement both adapters. Run the test again and confirm it passes: `npx vitest run lib/sources/earthquakes.test.ts`
- [ ] **Step 3: Commit** `feat: earthquakes and pharmacies adapters`

---

### Task 9: Bus timetables and the source check script

**Files:**
- Create: `lib/sources/buses.ts`: wraps the Task 5 static buses adapter and replaces the `buses` registry entry
- Create: `data/seed/jsp-timetables.json`
- Create: `scripts/check-sources.ts`

**Interfaces:**
- Produces: `nextDepartures(stopId: string, now: Date, n = 3): Array<{ line: string; at: string }>` from the seed timetable: per-line `headwayMin` and `firstAt` / `lastAt` for the 10 busiest JSP lines, stops referenced by OSM `route_ref`. The bus-stop `detail` gains `lines` (from OSM `route_ref`). The MarkerCard renders `nextDepartures` for `kind: "bus-stop"`. The adapter first tries `http://jsp.com.mk/` (unreachable when probed) and otherwise keeps status `static`.
- Produces: `npm run check:sources`, which loops over `registry`, calls `adapter.fetch()` directly with timing, and prints a table: `id | ok | ms | features | error`.

- [ ] **Step 1: Write the failing test** in `lib/sources/buses.test.ts`

```ts
test("nextDepartures respects headway and service hours", () => {
  // line with firstAt 05:00, lastAt 23:00, headway 10 → at 22:55 returns ["23:00"] only; at 04:00 returns first 3 from 05:00
});
```

- [ ] **Step 2: Run the test and confirm it fails.** Implement it. Run the test again and confirm it passes.
- [ ] **Step 3: Run `npm run check:sources`.** Expected: a table with no crash. `air`, `weather` and `earthquakes` are ok, and the others show their failure reason.
- [ ] **Step 4: Commit** `feat: bus timetables and source check script`

---

### Task 10: Reports API

**Files:**
- Create: `app/api/reports/route.ts`, `app/api/reports/[id]/vote/route.ts`
- Create: `lib/server/reports.ts`, `lib/reports-schema.ts`
- Create: `lib/sources/reports.ts` (adapter that reads the table, ttl 30)
- Test: `lib/server/reports.test.ts`

**Interfaces:**
- Produces: `ReportCategory = "pothole"|"dump"|"streetlight"|"dogs"|"parking"|"water-leak"|"other"`. `ReportInputSchema` (zod) has `category`, `description` (≤500 characters), `lat`, `lng` (inside the bbox), and `nickname` (≤32 characters, optional).
- Produces: `deviceHash(deviceId: string, userAgent: string): Promise<string>`, the SHA-256 hex of `${deviceId}|${userAgent}` via `crypto.subtle`.
- Produces: `validatePhoto(file: File | null): { ok: true } | { ok: false; code: "type" | "size" }`. It accepts only `image/*` up to 4 \* 1024 \* 1024 bytes. A null file is allowed, since the photo is optional.
- Produces: `POST /api/reports` (multipart: `data` JSON plus optional `photo`, header `x-device-id`) → `201 { id }`, or `400 { code }`, or `429 { code: "rate" }`. It uploads the photo to `report-photos/${id}.jpg` using the service role. `GET /api/reports?near=lng,lat` → the newest 100. `POST /api/reports/[id]/vote` → `200 { upvotes }`. A repeat vote from the same device returns `409`.
- Produces: the adapter `reports`, which emits the reports as points with `kind: "report"`, `detail: { category, status, upvotes, photoUrl }`.

- [ ] **Step 1: Write the failing tests**

```ts
test("validatePhoto rejects non-images", () => expect(validatePhoto(new File(["x"], "a.pdf", { type: "application/pdf" }))).toEqual({ ok: false, code: "type" }));
test("validatePhoto rejects > 4 MB", () => { /* 4*1024*1024+1 bytes image/jpeg → code size */ });
test("validatePhoto accepts HEIC under 4 MB", () => { /* type image/heic → ok */ });
test("ReportInputSchema rejects coordinates outside Skopje bbox", () => {});
test("rate limit: 6th report within an hour → 429", async () => { /* supabase count mocked to 5 */ });
```

- [ ] **Step 2: Run the tests and confirm they fail.** Implement. Run the tests again and confirm they pass: `npx vitest run lib/server/reports.test.ts`
- [ ] **Step 3: Without Supabase env vars, the routes return `503 { code: "disabled" }`.** The UI shows a disabled state (spec §7).
- [ ] **Step 4: Commit** `feat: reports API with validation and rate limit`

---

### Task 11: Report flow and reports list UI

**Files:**
- Create: `components/reports/ReportFlow.tsx`, `components/reports/CategoryGrid.tsx`, `components/reports/PhotoStep.tsx`, `components/reports/PinStep.tsx`, `components/reports/ReportsList.tsx`
- Create: `lib/resizeImage.ts`
- Test: `lib/resizeImage.test.ts`

**Interfaces:**
- Consumes: `POST /api/reports`, `getDeviceId`, `useMap().flyTo`, `validatePhoto`.
- Produces: `resizeImage(file: File, max = 1600): Promise<Blob | File>`. It decodes with `createImageBitmap` and draws to a canvas, producing `image/jpeg` at quality 0.82. If decoding throws, it returns the original `file`. The caller then runs `validatePhoto` and shows `t("report.photoTooLarge")` when that fails.

- [ ] **Step 1: Write the failing test.** When `createImageBitmap` throws, `resizeImage` returns the same File instance (stub `createImageBitmap` with `vi.stubGlobal`).
- [ ] **Step 2: Run the test and confirm it fails.** Implement. Run it again and confirm it passes.
- [ ] **Step 3: Build the flow UI**

The steps are category grid, photo (`<input type="file" accept="image/*" capture="environment">`), pin, and note plus nickname. The pin step draws a draggable map marker starting at the GPS position, or the map centre if there's none. On success, show a glass check animation and select the new report on the map. The step indicator springs between steps. `ReportsList` shows a card per report with a category icon, a relative time, a status chip, and an upvote `GlassButton` that updates optimistically and rolls back on 409 or an error.

- [ ] **Step 4: Verify in the browser at 375 px.** File a report with a photo. Expected: it appears on the map within 30 s (adapter ttl), and a second vote is refused.
- [ ] **Step 5: Commit** `feat: report flow and list`

---

### Task 12: AI city assistant

**Files:**
- Create: `lib/server/assistant.ts`, `app/api/assistant/route.ts`
- Create: `components/assistant/AssistantPanel.tsx`, `components/assistant/Citation.tsx`
- Test: `lib/server/assistant.test.ts`

**Interfaces:**
- Consumes: `getLayer`, the reports adapter, the static GeoJSON names.
- Produces: `summarizeLayer(res: LayerResponse, lang: Lang, near?: [number, number]): string`, compact text the model sees. It includes the status, the data age in minutes, the source name, and at most 15 features (the nearest to `near` when given, otherwise the highest severity), each written as `id | title | value unit | detail`.
- Produces tools built with `betaZodTool` and spread with `eager_input_streaming: true`: `get_layer({ id: LayerId, near?: { lng, lat } })`, `list_reports({ category?: ReportCategory })` and `find_place({ name: string })`. `find_place` searches municipalities, stops and pharmacies with `normalizeName` and returns ≤5 `{ name, lng, lat }`.
- Produces: `POST /api/assistant` with body `{ messages: Anthropic.Beta.BetaMessageParam[]; lang: Lang }` and header `x-device-id`. It streams `text/plain` chunks. When a tool returns features, it appends one final line `\n[[cite:<json array of {layer, featureId, lng, lat, source, ageMin}>]]`, which the client strips and renders as `Citation` chips. Errors: `429` from the rate limit, `503` when the key is missing.
- Model params: `model: "claude-opus-5-5"`, `max_tokens: 4096`, `output_config: { effort: "low" }`, `betas: ["server-side-fallback-2026-07-01"]`, `fallbacks: "default"`, `stream: true`, via `client.beta.messages.toolRunner(...)`. If the TS types don't accept `fallbacks`, pass it as a typed extra param and leave a comment. Never use a raw fetch.

- [ ] **Step 1: Write the failing tests**

```ts
test("summarizeLayer caps at 15 features and includes status + age", () => {});
test("summarizeLayer with near sorts by distance", () => {});
test("find_place matches Latin input to Cyrillic name", async () => { /* "karpos" → Карпош */ });
```

- [ ] **Step 2: Run the tests and confirm they fail.** Implement `summarizeLayer` and the tools. Run them again and confirm they pass.

- [ ] **Step 3: Implement the route**

Follow the streaming tool-runner loop from the claude-api skill (`typescript/claude-api/streaming.md` → "Streaming with Tool Use"). Stream `text_delta` into the response. Stop on a `refusal` stop reason and send `t("assistant.refused")`. Stop on `max_tokens` combined with `tool_use`. Rethrow `Anthropic.APIError` and turn it into an inline error message. Rate limit: an in-memory `Map<deviceHash, number[]>` holding the last hour's timestamps (ponytail: per-instance, use a Supabase table if abused).

The system prompt (fixed text, in English, telling the model to answer in the user's language) says:
- You are Мое Скопје's city assistant for Skopje.
- Answer in `{lang}`.
- Use tools for any fact about current conditions, and never invent values.
- Say how old the data is and where it comes from.
- If a layer's status is `offline`, say it is demo data.
- Keep answers to 2–4 sentences.

- [ ] **Step 4: Build the AssistantPanel**

A glass chat with 3 suggested prompts from i18n (spec §6.7, for example "Каков е воздухот во Аеродром?"). User bubbles are tinted with the system blue. Assistant text streams in. Citation chips call `flyTo` and `select` on tap. On desktop the panel floats on the right at 400 px; on mobile it uses the sheet's "Ask" tab.

- [ ] **Step 5: Verify**

Ask, in MK, "Каков е воздухот во Карпош?". Expected: an answer with a live value, a source and an age. A citation chip appears and flies the map to Karpoš.

- [ ] **Step 6: Commit** `feat: Claude city assistant with live data tools`

---

### Task 13: Tier 2 (only if the clock is at or before 5:00)

Do these in order and stop at 5:30 regardless of progress.

**Files:** `lib/sources/events.ts`, `lib/sources/waste.ts`, `lib/goOut.ts`, `lib/goOut.test.ts`, `data/seed/eservices.json`, `components/explore/EServices.tsx`

**Interfaces:**
- Produces: `goOutScore(pm10: number | null, tempC: number | null, precipMm: number | null): number`. Start at 100. Subtract the PM10 penalty: ≤20 → 0, ≤40 → 10, ≤50 → 25, ≤100 → 50, ≤150 → 70, >150 → 90. Subtract 20 if precipitation is over 0.5 mm. Subtract 15 if the temperature is below 0 or above 35. Clamp to 0..100. Null inputs add no penalty. Shown as a Today card ring.
- `events` adapter: scrape `https://skopje.gov.mk/` news and events and emit points at the venue (`find_place`), or at the centre when there's no match. Fallback: seed.
- `waste` adapter: seed weekly schedule per municipality, status `offline`, rendered as municipality fills with today's collection.
- e-Services: a static list of 8 common tasks (ID card, passport, birth certificate, company registration, property certificate, tax return, vehicle registration, doctor appointment). Each links to `https://uslugi.gov.mk/` or `https://mojtermin.mk/`; verify every link opens before committing.

- [ ] **Step 1: Write the `goOutScore` tests**: `(15, 20, 0) → 100`, `(120, 20, 1) → 10`, `(200, 40, 2) → 0`, `(null, null, null) → 100`. Confirm they fail, implement, confirm they pass.
- [ ] **Step 2: Implement events, waste and e-Services.** Register them in the registry and `LAYERS` (tier 2).
- [ ] **Step 3: Commit** `feat: tier 2 layers and go-out score`

---

### Task 14: Polish, deploy, demo script

**Files:**
- Create: `vercel.json` with `{ "regions": ["fra1"], "crons": [{ "path": "/api/cron/snapshots", "schedule": "0 5 * * *" }] }`
- Create: `app/api/cron/snapshots/route.ts`, which requires `Authorization: Bearer ${CRON_SECRET}` and calls `getLayer` for every non-static id
- Create: `app/manifest.ts` (name Мое Скопје, theme colour, icons), `app/icon.svg`
- Create: `docs/demo-script.md`

- [ ] **Step 1: Run the full test suite.** `npm test`. Expected: all pass. `npm run build`: no type errors.
- [ ] **Step 2: Polish pass in the built-in browser** at 375, 768 and 1440, light and dark. Check focus rings are visible, every icon button has an `aria-label`, there's no layout shift when the sheet snaps, skeletons replace spinners, and the motion and transparency fallbacks work.
- [ ] **Step 3: Deploy (user approves the outward-facing step)**

The user runs `npx vercel link` and adds the 5 env vars in the Vercel dashboard. Then `npx vercel --prod`. Open the production URL and run `/api/health`. Expected: an array with every layer, none throwing. Note which ones are `offline` from `fra1` that were `live` locally (the geo-block risk) for the demo narrative.
- [ ] **Step 4: Write `docs/demo-script.md`**, a 3-minute flow:
  1. Onboarding.
  2. The air map, plus a tap on an official MOEPP station.
  3. The outages fill in Karpoš.
  4. Next bus at a stop.
  5. File a pothole report with a photo.
  6. Ask the assistant in MK, then tap the citation.
  7. The Data health panel: "every source, live, honest about failures".
  8. Switch to EN and dark mode.
- [ ] **Step 5: Commit** `chore: deploy config, cron, manifest, demo script`
