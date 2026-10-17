# Мое Скопје — 3-minute demo script

**Setup before going on stage:** open the production URL once (warms the GTFS and street caches), clear site data so onboarding shows, laptop in dark mode, phone ready with the same URL.

| Time | Do | Say |
|---|---|---|
| 0:00 | Open the app (fresh). | "Skopje publishes a lot of open data, but it's scattered over a dozen sites. Мое Скопје puts it on one map." |
| 0:15 | Onboarding: language → pick layers → skip location. | "Three taps. Everything you pick here can be changed later in Settings." |
| 0:30 | Main panel: Today widgets (air, weather, "Go out?" score). | "Live from pulse.eco, which already aggregates the state MOEPP stations and citizen sensors." |
| 0:45 | Air heat map; zoom into a station. | "The heat map is built from every sensor in the city. Zoom in and it turns into the actual stations." |
| 1:00 | Outages widget: tap a day, tap an item. | "Water outages are scraped daily from Водовод. We don't paint a whole municipality; we place the outage on the actual streets." |
| 1:20 | Tap a bus stop near the centre, then a departure. | "Real JSP timetable from their official GTFS feed. Tap a bus and we show where it is. Without a GPS key it's an estimated position, and we say so on the badge." |
| 1:40 | Parking layer on. | "City Parking zones, drawn from their own published street lists." |
| 1:55 | Route planner: from my location to the Stone Bridge, by car. | "Routing that avoids active closures and roadworks from MVR notices and OpenStreetMap. One tap hands the detour to Google Maps." |
| 2:15 | ⌘K: "Каков е воздухот во Аеродром?", then tap the citation. | "Ask in Macedonian or English. Answers come only from the live layers, with source and age, and a tap flies you there." |
| 2:35 | Settings → Data sources. | "Every source with an honest status: live, stale, demo data, or static. When a source is down, like EVN's outage feed today, we say so instead of inventing data." |
| 2:50 | Switch to EN and light mode; show the phone. | "Desktop and phone, Macedonian and English. Мое Скопје." |

## Talking points if asked

- **Data:** pulse.eco, Open-Meteo, EMSC, JSP GTFS (Modeshift feed), FZO on-duty pharmacies, Водовод Скопје, MVR traffic notices, OSM (streets, settlements, construction), City Parking zones, skopje.gov.mk events.
- **Honesty:** each layer falls back from live to last-good snapshot to clearly labelled demo data. Nothing fabricated is shown as live.
- **EVN:** their only outage endpoint returns 404 for everyone today; the adapter keeps polling and goes live on its own when it returns.
- **Live bus GPS:** the vehicle API exists but needs a key. With `MODESHIFT_API_KEY` set, the badge switches to "Во живо".
- **Stack:** Next.js on Vercel (fra1), MapLibre + OpenFreeMap, Valhalla routing, an LLM assistant with tool use over the live layers.
