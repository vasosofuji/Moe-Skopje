# andrejcontext.md — Мое Скопје running project history

Repository: https://github.com/vasosofuji/Moe-Skopje

Initial handoff snapshot: **2026-10-17**

Product timezone: **Europe/Skopje**

Product name: **Мое Скопје / Moe Skopje**

This file preserves project conversations, decisions, research, and subsequent work. Read the dated entries as history. A later explicit correction can supersede an earlier statement without erasing it. The supplied original context and the complete source-registry snapshot are archived below so the handoff does not depend on the original ChatGPT session.

### Reading guide

- **Start with the dated Codex handoff:** the exact user instruction, standing context-file rule, and verified empty-repository state.
- **Prior product conversation:** explicit user selections, followed by separately labeled earlier assistant proposals.
- **2026-10-17 source research:** a reconstructed research recap, findings, limitations and proposed next steps; it is not a literal transcript of every research exchange.
- **All 91 source entries:** a compact URL/verification index. Read each full record in Appendix B before implementing it.
- **Appendix A:** the complete supplied context, preserved verbatim as historical text.
- **Appendix B:** the complete structured registry, preserved verbatim and recoverable as JSON.
- **Future sessions:** append dated work records and corrections; retain the original and the superseding decision when reconciling history.

## 2026-10-17 — Move to Codex and establish the context-file rule

### User instruction, verbatim

> lets move this to codex, and lets work with this repo [https://github.com/vasosofuji/Moe-Skopje](https://github.com/vasosofuji/Moe-Skopje) I want you to make everything we do in a separate context file that we push everytime. It will be called andrejcontext.md and that will be the only file you can always safely edit but essentially will just be our chat history so only add rarely remove

### Operational restatement of that instruction

- Work with the `vasosofuji/Moe-Skopje` repository and maintain **`andrejcontext.md` at the repository root**.
- Record the conversation and work as a running project history. Append new requests, decisions, changes, validation results, blockers, and next steps after each work session.
- Preserve earlier entries. Prefer a dated correction or superseding note to deleting or silently rewriting history; removals should be rare. When a merge contains independent history additions, preserve both and append a reconciliation note if they conflict.
- Update and push this context file with each work session, as requested. Record the actual commit/push result after it is known. A local edit or commit does not establish that the remote repository was updated.
- The user explicitly identifies this file as the file that can always safely be edited. This standing permission does not independently authorize unrelated implementation changes or external actions; use the scope of each requested task for those.
- Keep credentials, tokens, personal access keys, and environment-variable values out of this history. The original conversation mentions access to an Anthropic key but supplies no key value here.

The root-file placement and the suggested contents of each log entry are an operational interpretation of the requested workflow. The user's exact wording above remains the authoritative record.

### Handoff status and limits

This entry was assembled from the user-supplied `Pasted markdown.md`, the 2026-10-17 source research, the user's request to continue in Codex, and a repository inspection during this handoff session. **The initial clone was verified empty on 2026-10-17: branch `main`, no tracked files, and no commits.** No applicable repository `AGENTS.md` or override was found, and Git commit name/email were configured. Push access was not yet tested at the time of this entry.

The current request authorizes the move and the running context file; **app implementation is not part of this handoff task**. The planned initial repository change is only `andrejcontext.md`. Append the actual commit and push outcome after they occur. No app, production adapter, deployment, or live integration is established by the empty repository or this context file.

The earlier pasted discussion called the project an empty folder and sometimes said a feature was “done” or a source was “live.” Those feature-completion claims are archived conversation statements; the current empty-repository inspection does not substantiate them. The 2026-10-17 source research implemented **no production adapters**. Every one of its 91 registry entries has `adapter_implemented: false`. Three public responses were fetched and structurally inspected during research; that does not constitute an app integration.

The initial handoff draft itself does not establish a repository commit or successful push. Append the actual repository work and verification after performing it.

### 12:31:40 Europe/Skopje — GitHub connection update

The user reported:

> github plugin is installed and connected

This records the user-reported connection status. Repository write/push access was not yet verified at this point. The handoff session was checking the newly available GitHub capabilities; append the actual result when known.

## Prior product conversation — explicit preferences and decisions

The exact earlier conversation is preserved in Appendix A. This section distinguishes the user's decisions from the prior assistant's design proposals.

| Topic | Recorded user decision or request |
|---|---|
| Product idea | A Skopje app bringing daily city conditions, civic problem reports, and public services together. The initial concept used the jobs **Know, Fix, Do**. |
| Most recent product emphasis | Find the organizations and sources needed for a **personalized daily newsletter app that tells a person what their day will look like**. The broad civic-app concept remains background; this conversation did not expressly cancel it. |
| Product name | **Мое Скопје**. Other names in the original concept are earlier brainstorming, not the selected name. |
| Demo and longer-term direction | A hackathon demo, with possible production use later. The user wanted broad coverage, including electricity, buses, and the other originally listed sources. |
| Original time constraint | **Six hours, one builder**, stated in the earlier conversation. This is a historical constraint, not a newly verified remaining deadline. |
| Platform | A responsive **web app** for desktop and mobile initially. |
| Visual direction | Premium Apple-inspired styling, glassmorphism / Liquid Glass-like panels. |
| Planning workflow requests | The earlier user asked for an execution plan using “superpowers,” Apple design guidance, and “grill me” questions. This records the request; it does not establish that those skills are installed or that their suggested implementations exist. |
| Hosting and data backend | The user selected **Vercel + Supabase**. |
| AI provider | The user selected **Anthropic** and said they had an API key. No credential is stored here. |
| Demo languages | **Macedonian and English (MK + EN)**. The initial concept suggested Albanian and possibly Turkish/Romani; those are future-scope ideas, not selected demo languages. |
| Map engine and base map | **MapLibre + OpenFreeMap**. |
| Theme | Follow system appearance automatically; the later assistant spec proposed a Settings override. |
| Identity for civic reports | **Anonymous, with optional nickname**. |
| Onboarding | Ask which features/layers should be open on the map by default, and allow changing them in Settings. The user selected layout “option 1”; the exact option menu is absent from the pasted text. |
| Scope management | **Tiered delivery** selected after the user requested broad feature coverage. Do not interpret a tiered sequence as a claim that all sources have already been integrated. |
| Data layer | **Next.js adapters + cache + snapshots** selected. |

### Initial feature ideas retained as background

- **Know:** air quality, water/electricity/heating interruptions, bus routes/stops, published timetables, parking zones/prices, weather, river conditions, and earthquake/public warnings.
- **Fix:** photo/GPS reports for potholes, illegal dumps, broken lights, stray dogs, and similar issues; public status, votes, and a map of reports.
- **Do:** on-duty pharmacies, health-service link-outs, e-services guidance, schools/kindergartens, waste services, events, and volunteering.
- **Later ideas:** procurement/spending transparency, elections, neighborhood scorecards, lost pets, satellite-derived environment views, an outdoor-condition score, and walking/cycling routes informed by air data.

These ideas are product scope, not evidence that the necessary data, institutional workflow, or live API exists. In particular, a public report board alone does not establish municipal acceptance, forwarding, ownership, or resolution of a report.

## Earlier assistant design proposal — not an implementation record

The user selected several technologies above. The following finer details were then proposed by the earlier assistant and should be evaluated against the actual repository and current dependency documentation before adoption:

| Area | Earlier proposal |
|---|---|
| Framework | Next.js App Router with TypeScript. “Latest stable” in the old text is time-dependent and not a pinned version. |
| Styling and motion | Tailwind CSS v4, the `motion` library for springs, and `vaul` for a draggable bottom sheet. |
| Storage | Supabase Postgres, photo storage, and source snapshots. Proposed tables: `reports`, `report_votes`, `source_snapshots`. |
| Source parsing | A per-source adapter under `lib/sources/`, `zod` output validation, `cheerio` for HTML. |
| Endpoints | Proposed layer API returning GeoJSON plus source metadata; reports API; streaming assistant API. |
| AI | `@anthropic-ai/sdk` with tool-assisted answers that cite the underlying city data. |
| Map assets | Static GeoJSON for bus stops/routes, municipal boundaries, and parking zones, where the source and license permit this. |
| Typography/icons | System font stack with Inter fallback; Lucide icons. |
| Mobile layout | Full-screen map, search pill, bottom sheet, and Explore / Report / Ask / Settings navigation. |
| Desktop layout | Floating sidebar, layer controls, and an assistant panel. |
| Onboarding/settings | Language, default map layers, location request, theme override, and a source-health view. |
| Accessibility | Reduced-motion handling, a solid-panel alternative to transparency, clear type and readable contrast. Exact web implementation remains to be validated. |
| Testing | Parser tests using representative saved source responses; a source-check command. The old six-hour plan skipped E2E tests, which was a timeline proposal rather than a permanent testing ban. |

Specific historical claims about Vercel cron limits, deployment-region choice, browser support for visual effects, or library behavior were **not reverified by the source-inventory research**. Do not treat them as current platform guarantees.

### Research changes needed to the earlier proposal

1. The old proposal's automatic `live → stale snapshot → seeded data` fallback must not turn invented outages, duty pharmacies, warnings, or transit status into real operational information. A separate, clearly labeled demo can use fixtures. For the daily product, disclose stale or unavailable sources and keep unknown facts unknown.
2. Matching an outage to a municipality does not establish that the whole municipality is affected. Preserve streets, building ranges, settlements, provider coverage, and location precision. Do not color every household as affected from a broad place-name match.
3. The old claim that several publishers were unreachable is superseded by the newer research where pages were retrieved, including current water, heating, JSP, and waste notices. A failed research request is a local observation, not universal proof of downtime.
4. Current JSP discovery points to `skopjebus.mk`; district-heating operational discovery points to **ESM Distribucija na toplina**. Do not build around old names/domains such as BEG without confirming the provider and network.
5. Collect sources independently of website visits for a dependable daily briefing. The appropriate scheduler and polling limits still need implementation decisions; no recurring job or newsletter delivery was created in the research session.
6. A generic GeoJSON layer is useful for maps but is insufficient as the only storage model for dated notices, revisions, cancellations, validity, and source health. The notice fields below are a **proposed** extension.

## 2026-10-17 — Public-service source research recap

### User request that prompted the research

> this is a context file, keep it in mind. I want you to find me every skopje public service org like vodovod skopje, evn... I want to pull from them to make it like a daily newsletter app that gives you what the day will look like

### What was completed

A source registry was researched and produced as **`moe-skopje-source-registry.json`**, schema version `1.0`, reviewed on **2026-10-17**. It contains **91 publisher/service/channel entries**, rather than 91 distinct legal organizations, installed integrations, or production adapters. It covers core utilities, all ten City of Skopje municipalities, additional municipal enterprises, relevant public services, transport, health, cultural venues, and explicitly identified independent/commercial supporting sources.

The inventory is a practical coverage map. It is **not a certified exhaustive legal register of every clinic, school, kindergarten, municipal branch, or local company**. The City’s own directory supports an eight-enterprise baseline; additional municipal companies were found separately. Geographic scope is primarily the City's ten municipalities, with service areas and travel links that can extend beyond them.

The compact inventory is in Section “All 91 source entries.” Appendix B preserves the complete registry, including acquisition notes, caveats, official evidence URLs, tested responses, proposed integration order, and proposed notice rules. Any later verification should add a new review date and evidence rather than silently treating this snapshot as evergreen.

### Official directory baselines

- [City of Skopje public enterprises](https://skopje.gov.mk/mk/skopje/javni-pretprijatija/): Verified eight-enterprise baseline and official links; do not reuse historical descriptive statistics as current.
- [Municipal/City public-enterprise information-holder register](https://aspi.mk/imateli/201/): Find additional municipal enterprises and official information contacts; listing does not establish a digital feed.
- [City public cultural institutions](https://skopje.gov.mk/mk/skopje/kulturni-ustanovi/): Eight-institution baseline; older linked domains should be cross-checked against newer City Culture profiles.
- [City Culture](https://kultura.skopje.gov.mk/): Current institution profiles and discovery; not established as a complete daily event calendar.
- [Ministry of Culture and Tourism institutions](https://kultura.gov.mk/mk-MK/kontakt/institucii): Expand national cultural venues in Skopje; verify individual site/domain and event freshness.
- [Public health institution map](https://mojtermin.mk/map/ustanovi): Expand clinic/institution directory; no booking integration or current availability extraction established.

### Material findings and corrections

| Finding | Implication for the product | Evidence |
|---|---|---|
| Electricity distribution outages have a dedicated Elektrodistribucija page. Research saw its headings, but did not retrieve validated current outage rows or the dynamic data request. | Treat extraction as unfinished. An empty rendered table is not an all-clear. Keep EVN customer notices separate. | [Outage map](https://elektrodistribucija.mk/Grid/OutagesMap.aspx) |
| Skopje water interruption notices can share one editable HTML page. | Parse individual events, retain versions, preserve original date text, and leave “until completion” end times unknown. The page's reuse restriction also requires resolution before republishing its content. | [Water interruption page](https://vodovod-skopje.com.mk/mk-MK/article/INFORMACIIIZAPREKINNAVODOSNABDUVANjEIDEFEKTI_1) |
| ESM Distribucija publishes operational heating notices. Other heating entities/networks remain separate discovery questions. | Begin with the verified distribution publisher; do not assume coverage of every heating customer, especially the separately identified network gaps. | [Heating notices](https://esm-distribucija.mk/izvestuvanja/) |
| JSP's current discovered site is `skopjebus.mk`, with notices and schedule pages. | Published schedules/diversions are feasible targets; official public GTFS, live vehicle positions, and live arrivals were not verified. | [JSP notices](https://skopjebus.mk/mk/izvestuvanja/) |
| Ulici i Patishta publishes a dated daily location/activity table and recent overnight-work posts. | A strong daily planning source. A maintenance activity is not automatically a road closure. ЦУКС traffic control is distinct from national ЦУК crisis management. | [Daily works](https://uip.gov.mk/) |
| JKP Gazi Baba 2007 is a separate municipal water/waste publisher with actual notices. | Include it alongside City Vodovod. The notice names local service areas; the complete network boundary remains to be established. | [JKP Gazi Baba 2007](https://jkpgb2007.gov.mk/) |
| Additional municipal entities include Butel, Kisela Voda 2022, Aerodrom communal services, Saraj and Shkupi Vjeter; some are confirmed only by directory/municipality evidence. | Keep entity discovery separate from a functioning online feed. Do not double-count a predecessor/renamed sports enterprise without checking its identity. | [Official enterprise register](https://aspi.mk/imateli/201/) |
| pulse.eco documents account access and HTTP Basic authorization for automated API use. | The initial context's easy/free-start idea is not proof of anonymous production API access; no authenticated request was tested. | [pulse.eco API documentation](https://pulse.eco/restapi) |
| Official air data includes unvalidated hourly values. | Preserve station, units, timestamps and quality flags. Do not present all citizen sensor and official readings as equivalent. | [MOEPP overview](https://air.moepp.gov.mk/Pages/DataOverview) |
| The FZO index exposed an October 2026 duty-pharmacy schedule listing, but the actual monthly rows/attachment could not be retrieved. | No specific pharmacy's current duty hours are verified. Do not infer duty, medicine stocks, or an API. | [FZO duty pharmacies](https://fzo.org.mk/dezurni-apteki) |
| CPH Skopje returned a Coming Soon page; ZDS content/access was unreliable; Moj Termin current booking/availability data was not established. | Use carefully validated directories/link-outs until current service schedules can be obtained. No pollen feed was verified. | [CPH](https://cph.mk/), [ZDS](https://zds.mk/), [Moj Termin](https://mojtermin.mk/map/ustanovi) |
| ITM's visible donation table was from 2019 and its linked weekly-schedule article from 2020, despite newer administrative posts elsewhere. Red Cross Skopje had current October 2026 news. | Prefer current dated drive announcements; do not automate an old calendar. Red Cross blood-centre pages also contained conflicting hours requiring validation. | [ITM](https://itm.org.mk/), [Red Cross news](https://ckgs.org.mk/category/novosti/) |
| CUK's official site was reachable but a complete current operational bulletin channel was not established. | Source reliability is unresolved; an empty alert area is not an all-clear. MVR has usable public news for relevant planned restrictions. | [CUK](https://cuk.gov.mk/), [MVR news](https://mvr.gov.mk/mk-MK/odnosi-so-javnost/novosti) |
| The official annual holiday PDF distinguishes communities and contains an apparent typo in one substitute-day sentence. | Validate the annual calendar manually and confirm operator-specific opening hours separately. | [2026 nonworking-day programme](https://www.economy.gov.mk/build/assets/programa-nerabotni-denovi-2026-MHaAbYyO.pdf) |
| City institution directories can contain old domains or descriptions; Universal Hall institutional activity does not mean its hall is open. | Prefer newer official profiles and current event details; maintain institution vs. venue vs. event distinctions. | [City Culture](https://kultura.skopje.gov.mk/) |
| ERC publishes maximum fuel-price decisions, with a readable PDF example verified. Automated notice discovery is unvalidated. | Store the decision's effective timestamp and distinguish a maximum permitted retail price from a live station price. | [ERC fuel section](https://www.erc.org.mk/page.aspx?id=290) |

### Actual public-response checks recorded in the registry

These checks were research probes, not implemented source adapters. The retained registry contains the transport-test metadata.

| Source | What the 2026-10-17 check established | What it did not establish |
|---|---|---|
| Open-Meteo | HTTP 200 JSON with a one-day Skopje forecast, 24 hourly slots and one daily slot. | Production integration, uptime, or suitability of the free hosted tier for a commercial app. Free hosted access was documented for noncommercial use. |
| North Macedonia Meteoalarm Atom feed | HTTP 200, a parsed Atom feed, zero entries in the fetched response. | No hazards, full warning coverage, or permission/access for every other Meteoalarm API product. |
| National Opera and Ballet iCalendar | HTTP 200 calendar response, one calendar component and two event components with UID/start properties. | Completeness of all future events, full RFC validation, or an implemented calendar adapter. |

EMSC/SeismicPortal API documentation was inspected, but an actual event-data request was not validated. No authenticated pulse.eco request was tested. Detailed `public_api_status` fields in Appendix B retain these differences.

## Proposed implementation direction after the handoff

The following is **recommended work**, not a newly confirmed user decision or a completion claim.

1. At the next implementation session, recheck repository state and any new project instructions before making changes. The handoff inspection found `main` empty, with no tracked files or commits. Build or adapt only within the user's next requested scope; the current handoff does not implement the app.
2. Preserve this history and keep the structured registry recoverable. A separate versioned `moe-skopje-source-registry.json` is a sensible companion if the team chooses a repository location; Appendix B contains its complete initial contents.
3. Implement a dependable first briefing from reachable, relevant publishers. Add sources in stages as access and parsing are proven, keeping the full breadth in the registry.
4. Normalize notices with effective times and affected places before producing summaries. Use the assistant to explain evidence-backed data, not invent missing operational facts.
5. Match the daily brief to saved home/work locations, municipality, routes and interests. The exact onboarding and newsletter delivery method still need implementation decisions; email, push delivery and a recurring automation were not set up in the research session.
6. Validate source failure and update behavior using representative cases: duplicate notices, malformed/ambiguous dates, unknown restoration times, cancellations, stale data, and missed fetches. Broaden testing where the actual implementation risks require it.
7. Append the session's outcome, changed files, validation, remaining issues and commit/push status to this file before concluding work.

### Proposed source integration order

1. **First dependable briefing content** — `water_skopje`, `heat_distribution`, `streets_roads`, `jsp`, `mvr`, `meteoalarm_mk`, `open_meteo`. Implement and validate HTML parsers. Respect source reuse conditions; HTML discovery alone is not operational completion.
2. **Complete essential local conditions** — `electricity_distribution`, `air_moepp`, `pulse_eco`, `water_gazi_baba`, `cuk`. Resolve dynamic endpoints, account access and operational bulletin coverage.
3. **Location-specific local services** — `city_skopje`, `municipality_aerodrom`, `municipality_butel`, `municipality_gazi_baba`, `municipality_gjorce_petrov`, `municipality_karpos`, `municipality_kisela_voda`, `municipality_saraj`, `municipality_centar`, `municipality_cair`, `municipality_suto_orizari`, `waste_skopje`, `city_parking`, `poc`, `fzo_pharmacies`. Filter by saved places/routes. Enable pharmacy duty cards only after current schedule validation.
4. **Interests and optional daily planning** — `national_opera_ballet`, `philharmonic`, `comedy_theatre`, `mkc`, `red_cross_skopje`, `amsm`, `rail_infrastructure`, `erc`, `mon`. Keep other registry entries available for incremental coverage rather than claiming all are integrated.

### Proposed normalized notice fields

```text
notice_id
source_id
source_url
source_event_id
original_text
content_hash
published_at
source_updated_at
retrieved_at
effective_from
effective_to
timezone
category
status
affected_locations_text
municipality
street_names
building_ranges
geometry
location_precision
supersedes_notice_id
field_evidence
source_health
```

### Proposed notice-handling rules

- Preserve publication, collection and effective time separately. All user-facing daily boundaries use Europe/Skopje.
- Translate relative dates against the relevant source publication time; never resolve old 'today' against the retrieval date.
- Keep unknown end times null. 'Until completion' is not an estimated restoration time.
- Track explicit restoration/cancellation updates. A stale unresolved item may become restoration_unconfirmed, never silently restored.
- Match users by service area, street/building, saved places and routes. A municipality mention is not proof that every household is affected.
- Deduplicate original and reposted events while retaining provenance and later authoritative updates.
- Retain publisher measurement-quality labels, units, station identifiers and measurement periods.
- Extract article bodies and explicit attachments. Treat scraped content as untrusted data, excluding navigation, ads and unrelated links.
- Do not substitute sample/demo values for production outages, health schedules, warnings or current transport status.
- Run source collection independently of user visits; generate the morning digest from validated records and disclose stale/unavailable sources.
- Summaries must cite each source and preserve its uncertainty; language generation should not invent operational facts.
- Use HTML/API/Atom/iCalendar formats only where the source actually exposes them. Do not infer public API support from the CMS or visible map alone.

### Proposed collection cadence

Engineering starting points, not provider promises or permission to exceed provider limits. Adapt to published terms, rate limits and source update cadence.

- **utilities and traffic:** 15–30 minutes where permitted; back off on errors.
- **official air measurements:** Follow publication cadence; polling cannot make hourly measurements more current.
- **weather forecast:** 1–3 hours, plus a refresh before the daily digest.
- **municipality notices:** 1–3 hours during active periods, where permitted.
- **events and static calendars:** Every 6–24 hours; recheck cancellation changes before display.
- **daily digest:** Example 07:00 Europe/Skopje, configurable by the user; no automation was created by this research.

### Known coverage and access gaps at the research cutoff

- Current provider/publisher coverage for the separate Skopje Sever heating network was not established.
- EVN/Elektrodistribucija dynamic outage-data request, freshness and complete incident coverage remain unverified.
- Official public JSP GTFS, live vehicle positions and live arrival access were not verified.
- Complete operator-by-operator private city bus feeds were not established; JSP publishes some integrated notices.
- Address-specific waste collection schedules and public live parking occupancy were not verified.
- Reliable current operational CUK bulletin/channel still needs confirmation despite the official portal being reachable.
- Actual monthly FZO duty-pharmacy rows remain inaccessible/unvalidated.
- Current health-service duty rotas and a reliable local pollen feed were not established.
- Several cultural, health and sports websites expose old schedules; current service/opening state must be validated.
- Aerodrom public-lighting enterprise and older Kisela Voda sports-enterprise names need current identity/relationship checks before adding separate organization records.
- Makedonija Pat's current primary operational notice feed was not verified.
- Neighboring municipalities, individual schools/kindergartens/clinics, small telecom providers and Red Cross municipal branches need separate expansion if the product promises those specific service areas.

## All 91 source entries — compact discovery index

This index is taken from the complete 2026-10-17 registry. **All 91 have `adapter_implemented: false`.** The status describes research evidence, not runtime integration health. A public page can be read while its current operational data remains incomplete; read the source-specific limitations in Appendix B before implementation.

The publisher type is explicit because this inventory includes commercial utilities, independent data providers, humanitarian organizations and public bodies. “Source URLs” are the discovered publisher/document/interface locations, not a promise of a public API or of a current complete feed.

### Verification legend

- **`response_parsed`:** A public machine-readable response was fetched and its basic structure inspected during this research. No production adapter or uptime guarantee.
- **`page_read`:** Official HTML content was retrieved through web research, sometimes from a cached rendering. Does not prove a working unattended scraper.
- **`document_read`:** An actual official document was retrieved. It still needs per-field validation before operational use.
- **`indexed_official_page`:** Official content was visible in search but direct retrieval or current data extraction was incomplete.
- **`official_directory`:** Organization/channel or website confirmed in an official directory or parent publisher; operational feed may be unverified.
- **`documented_interface`:** Official interface documentation inspected; no authenticated/live data call tested unless explicitly recorded.

### Priority legend

- **`core`:** Important to a general daily briefing or to users in the covered municipality; integration can still be blocked or unverified.
- **`personalized`:** Useful for users whose locations, routes or interests match.
- **`background`:** Directory, contextual information, infrequent changes or later expansion.
- **`candidate`:** Identity or potential source found; a sufficiently current/accesssible operational source is not yet established.

Never infer that a source is unavailable to everyone because one research request failed, or that the service is normal because the source returned no records.

| # | Source ID / publisher | Publisher type | Priority | Verification | Source URLs |
|---|---|---|---|---|---|
| 1 | `electricity_distribution` — Електродистрибуција | `commercial_utility` | `core` | `page_read` | [https://elektrodistribucija.mk/Grid/OutagesMap.aspx](https://elektrodistribucija.mk/Grid/OutagesMap.aspx) |
| 2 | `evn_customer` — EVN / EVN Home | `commercial_utility` | `personalized` | `page_read` | [https://www.evn.mk/](https://www.evn.mk/) |
| 3 | `water_skopje` — ЈП Водовод и канализација — Скопје | `city_enterprise` | `core` | `page_read` | [https://vodovod-skopje.com.mk/mk-MK/article/INFORMACIIIZAPREKINNAVODOSNABDUVANjEIDEFEKTI_1](https://vodovod-skopje.com.mk/mk-MK/article/INFORMACIIIZAPREKINNAVODOSNABDUVANjEIDEFEKTI_1); [https://vodovod-skopje.com.mk/mk-MK/articles/SOOPShTENIJA](https://vodovod-skopje.com.mk/mk-MK/articles/SOOPShTENIJA) |
| 4 | `heat_distribution` — ЕСМ Дистрибуција на топлина | `state_owned_energy_company` | `core` | `page_read` | [https://esm-distribucija.mk/izvestuvanja/](https://esm-distribucija.mk/izvestuvanja/) |
| 5 | `heat_supply` — ЕСМ Снабдување со топлина | `state_owned_energy_company` | `personalized` | `official_directory` | [https://www.esm.com.mk/?page_id=15365](https://www.esm.com.mk/?page_id=15365); [https://www.esm-snabduvanje.com.mk/](https://www.esm-snabduvanje.com.mk/) |
| 6 | `heat_energetika` — АД ЕСМ — подружница Енергетика, Скопје | `state_owned_energy_branch` | `personalized` | `official_directory` | [https://www.esm.com.mk/?page_id=3582](https://www.esm.com.mk/?page_id=3582); [https://www.esm.com.mk/](https://www.esm.com.mk/) |
| 7 | `heat_production` — ЕСМ Производство на топлина | `state_owned_energy_company` | `background` | `official_directory` | [https://www.esm.com.mk/?page_id=15363](https://www.esm.com.mk/?page_id=15363); [https://www.esm.com.mk/?page_id=17237](https://www.esm.com.mk/?page_id=17237) |
| 8 | `jsp` — ЈСП Скопје | `city_enterprise` | `core` | `page_read` | [https://skopjebus.mk/mk/izvestuvanja/](https://skopjebus.mk/mk/izvestuvanja/); [https://skopjebus.mk/mk/schedule/](https://skopjebus.mk/mk/schedule/); [https://skopjebus.mk/mk/app/lines/](https://skopjebus.mk/mk/app/lines/) |
| 9 | `streets_roads` — ЈП Улици и патишта / ЦУКС | `city_enterprise` | `core` | `page_read` | [https://uip.gov.mk/](https://uip.gov.mk/); [https://uip.gov.mk/tsentar-za-upravuva/](https://uip.gov.mk/tsentar-za-upravuva/) |
| 10 | `city_parking` — ЈП Градски паркинг — Скопје | `city_enterprise` | `personalized` | `page_read` | [https://www.gradskiparking.com.mk/](https://www.gradskiparking.com.mk/); [https://www.gradskiparking.com.mk/zonsko-parking-zoni.nspx](https://www.gradskiparking.com.mk/zonsko-parking-zoni.nspx); [https://www.gradskiparking.com.mk/javni-parkiralishta-i-zonsko.nspx](https://www.gradskiparking.com.mk/javni-parkiralishta-i-zonsko.nspx) |
| 11 | `poc` — ЈП Паркинзи на Општина Центар — ПОЦ | `municipal_enterprise` | `personalized` | `page_read` | [https://poc.mk/](https://poc.mk/); [https://poc.mk/?page_id=146](https://poc.mk/?page_id=146); [https://poc.mk/?page_id=136](https://poc.mk/?page_id=136); [https://poc.mk/?page_id=161](https://poc.mk/?page_id=161) |
| 12 | `waste_skopje` — ЈП Комунална хигиена — Скопје | `city_enterprise` | `core` | `page_read` | [https://www.khigiena.com.mk/](https://www.khigiena.com.mk/) |
| 13 | `parks` — ЈП Паркови и зеленило | `city_enterprise` | `personalized` | `page_read` | [https://parkovi.com.mk/](https://parkovi.com.mk/) |
| 14 | `drisla` — ЈП Дрисла — Скопје | `city_enterprise` | `background` | `page_read` | [https://drisla.mk/tekovni-informaczii/](https://drisla.mk/tekovni-informaczii/); [https://drisla.mk/](https://drisla.mk/) |
| 15 | `lajka` — ЈП Лајка | `city_enterprise` | `personalized` | `page_read` | [https://lajka.com.mk/](https://lajka.com.mk/); [https://lajka.com.mk/category/novosti/](https://lajka.com.mk/category/novosti/) |
| 16 | `water_gazi_baba` — ЈКП Гази Баба 2007 | `municipal_enterprise` | `core` | `page_read` | [https://jkpgb2007.gov.mk/](https://jkpgb2007.gov.mk/); [https://jkpgb2007.gov.mk/novosti/](https://jkpgb2007.gov.mk/novosti/) |
| 17 | `jkp_butel` — ЈКП Бутел-Скопје | `municipal_enterprise` | `personalized` | `official_directory` | [https://opstinabutel.gov.mk/контакт-јкп-бутел/](https://opstinabutel.gov.mk/контакт-јкп-бутел/); [https://opstinabutel.gov.mk/](https://opstinabutel.gov.mk/) |
| 18 | `jkp_kisela_voda` — ЈКП Кисела Вода 2022-Скопје | `municipal_enterprise` | `personalized` | `page_read` | [https://opstinakiselavoda.gov.mk/нова-постојана-услуга-за-граѓаните-со/](https://opstinakiselavoda.gov.mk/нова-постојана-услуга-за-граѓаните-со/); [https://opstinakiselavoda.gov.mk/](https://opstinakiselavoda.gov.mk/) |
| 19 | `jkp_aerodrom` — ЈП за комунални дејности на Општина Аеродром–Скопје | `municipal_enterprise` | `personalized` | `official_directory` | [https://aerodrom.gov.mk/](https://aerodrom.gov.mk/) |
| 20 | `jkp_saraj` — ЈКП Сарај-Скопје | `municipal_enterprise` | `candidate` | `official_directory` | [https://aspi.mk/imateli/30294/](https://aspi.mk/imateli/30294/); [https://saraj.gov.mk/?lang=mk](https://saraj.gov.mk/?lang=mk) |
| 21 | `shkupi_vjeter` — ЈП Шкупи Вјетер-Скопје | `municipal_enterprise` | `candidate` | `official_directory` | [https://aspi.mk/imateli/30432/](https://aspi.mk/imateli/30432/); [https://cair.gov.mk/?lang=mk](https://cair.gov.mk/?lang=mk) |
| 22 | `rail_transport` — Железници на РСМ Транспорт | `state_owned_transport` | `personalized` | `indexed_official_page` | [https://mzt.mk/poagane-od-skopje/](https://mzt.mk/poagane-od-skopje/); [https://mzt.mk/pristigane-vo-skopje/](https://mzt.mk/pristigane-vo-skopje/); [https://mzt.mk/](https://mzt.mk/) |
| 23 | `rail_infrastructure` — ЈП Железници на РСМ Инфраструктура | `national_public_enterprise` | `personalized` | `page_read` | [https://mzi.mk/возен-ред/](https://mzi.mk/возен-ред/); [https://mzi.mk/en/timetable/](https://mzi.mk/en/timetable/) |
| 24 | `amsm` — Авто–мото сојуз на Македонија — АМСМ | `motoring_association` | `personalized` | `page_read` | [https://amsm.mk/sostojba-na-patishta/](https://amsm.mk/sostojba-na-patishta/) |
| 25 | `state_roads` — ЈП за државни патишта | `national_public_enterprise` | `personalized` | `page_read` | [https://roads.org.mk/odnosi-so-javnosta/izvestuvanja/](https://roads.org.mk/odnosi-so-javnosta/izvestuvanja/); [https://roads.org.mk/](https://roads.org.mk/) |
| 26 | `skopje_airport` — TAV Македонија — Меѓународен Аеродром Скопје | `commercial_airport_operator` | `personalized` | `page_read` | [https://skp.airports.com.mk/en-EN/flights](https://skp.airports.com.mk/en-EN/flights); [https://skp.airports.com.mk/en-EN/flights/arrival-flights](https://skp.airports.com.mk/en-EN/flights/arrival-flights) |
| 27 | `a1` — А1 Македонија | `commercial_telecom` | `personalized` | `page_read` | [https://www.a1.mk/za-nas?_news_WAR_Newsroomportlet_category=218&_news_WAR_Newsroomportlet_jspPage=%2Fhtml%2Fa1%2Fnewsfrontend%2Fview.jsp&_news_WAR_Newsroomportlet_page=1&p_p_id=news_WAR_Newsroomportlet&p_p_lifecycle=0&p_p_mode=view&p_p_state=normal](https://www.a1.mk/za-nas?_news_WAR_Newsroomportlet_category=218&_news_WAR_Newsroomportlet_jspPage=%2Fhtml%2Fa1%2Fnewsfrontend%2Fview.jsp&_news_WAR_Newsroomportlet_page=1&p_p_id=news_WAR_Newsroomportlet&p_p_lifecycle=0&p_p_mode=view&p_p_state=normal) |
| 28 | `telekom` — Македонски Телеком | `commercial_telecom` | `candidate` | `indexed_official_page` | [https://www.telekom.mk/pres-centar](https://www.telekom.mk/pres-centar); [https://www.telekom.mk/kontakt-privatni](https://www.telekom.mk/kontakt-privatni) |
| 29 | `telekabel` — Телекабел | `commercial_telecom` | `candidate` | `page_read` | [https://telekabel.com.mk/category/soopstenija/](https://telekabel.com.mk/category/soopstenija/) |
| 30 | `aek` — Агенција за електронски комуникации — АЕК | `national_regulator` | `candidate` | `official_directory` | [https://aek.mk/](https://aek.mk/); [https://fm.aek.mk/](https://fm.aek.mk/) |
| 31 | `city_skopje` — Град Скопје | `city_government` | `core` | `page_read` | [https://skopje.gov.mk/mk/](https://skopje.gov.mk/mk/); [https://skopje.gov.mk/mk/apliciraj/javni-povici/](https://skopje.gov.mk/mk/apliciraj/javni-povici/); [https://skopje.gov.mk/mk/apliciraj/subvencii/](https://skopje.gov.mk/mk/apliciraj/subvencii/) |
| 32 | `municipality_aerodrom` — Општина Аеродром | `municipality` | `core` | `official_directory` | [https://aerodrom.gov.mk/](https://aerodrom.gov.mk/) |
| 33 | `municipality_butel` — Општина Бутел | `municipality` | `core` | `page_read` | [https://opstinabutel.gov.mk/](https://opstinabutel.gov.mk/) |
| 34 | `municipality_gazi_baba` — Општина Гази Баба | `municipality` | `core` | `indexed_official_page` | [https://gazibaba.gov.mk/](https://gazibaba.gov.mk/) |
| 35 | `municipality_gjorce_petrov` — Општина Ѓорче Петров | `municipality` | `core` | `page_read` | [https://opstinagpetrov.gov.mk/](https://opstinagpetrov.gov.mk/) |
| 36 | `municipality_karpos` — Општина Карпош | `municipality` | `core` | `page_read` | [https://karpos.gov.mk/](https://karpos.gov.mk/) |
| 37 | `municipality_kisela_voda` — Општина Кисела Вода | `municipality` | `core` | `page_read` | [https://opstinakiselavoda.gov.mk/](https://opstinakiselavoda.gov.mk/) |
| 38 | `municipality_saraj` — Општина Сарај | `municipality` | `core` | `page_read` | [https://saraj.gov.mk/?lang=mk](https://saraj.gov.mk/?lang=mk) |
| 39 | `municipality_centar` — Општина Центар | `municipality` | `core` | `page_read` | [https://www.centar.gov.mk/](https://www.centar.gov.mk/) |
| 40 | `municipality_cair` — Општина Чаир | `municipality` | `core` | `indexed_official_page` | [https://cair.gov.mk/?lang=mk](https://cair.gov.mk/?lang=mk) |
| 41 | `municipality_suto_orizari` — Општина Шуто Оризари | `municipality` | `core` | `page_read` | [https://sutoorizari.gov.mk/](https://sutoorizari.gov.mk/) |
| 42 | `uhmr` — Управа за хидрометеоролошки работи — УХМР | `national_public_service` | `core` | `official_directory` | [https://uhmr.gov.mk/](https://uhmr.gov.mk/); [https://uhmr.gov.mk/dneven-hidroloshki-izveshtaj/](https://uhmr.gov.mk/dneven-hidroloshki-izveshtaj/) |
| 43 | `meteoalarm_mk` — УХМР warnings via Meteoalarm | `official_warning_distribution` | `core` | `response_parsed` | [https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-republic-of-north-macedonia](https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-republic-of-north-macedonia); [https://api.meteoalarm.org/](https://api.meteoalarm.org/) |
| 44 | `air_moepp` — МЖСПП — Државен автоматски мониторинг систем за квалитет на амбиентен воздух | `national_public_service` | `core` | `page_read` | [https://air.moepp.gov.mk/](https://air.moepp.gov.mk/); [https://air.moepp.gov.mk/Pages/DataOverview](https://air.moepp.gov.mk/Pages/DataOverview); [https://air.moepp.gov.mk/Pages/DayReports](https://air.moepp.gov.mk/Pages/DayReports) |
| 45 | `seismology_skopje` — Сеизмолошка опсерваторија, ПМФ–УКИМ | `public_university_institution` | `personalized` | `page_read` | [https://seismobsko.pmf.ukim.edu.mk/](https://seismobsko.pmf.ukim.edu.mk/) |
| 46 | `pulse_eco` — pulse.eco | `independent_environmental_platform` | `core` | `documented_interface` | [https://skopje.pulse.eco/](https://skopje.pulse.eco/); [https://pulse.eco/restapi](https://pulse.eco/restapi) |
| 47 | `open_meteo` — Open-Meteo | `independent_weather_provider` | `core` | `response_parsed` | [https://open-meteo.com/en/docs](https://open-meteo.com/en/docs); [https://open-meteo.com/en/terms](https://open-meteo.com/en/terms) |
| 48 | `emsc` — EMSC / SeismicPortal | `international_seismic_provider` | `personalized` | `documented_interface` | [https://www.seismicportal.eu/fdsn-wsevent.html](https://www.seismicportal.eu/fdsn-wsevent.html); [https://www.seismicportal.eu/fdsnws/event/1/openapi.json](https://www.seismicportal.eu/fdsnws/event/1/openapi.json) |
| 49 | `cuk` — Центар за управување со кризи / РЦУК Скопје | `national_public_service` | `core` | `page_read` | [https://cuk.gov.mk/](https://cuk.gov.mk/); [https://cuk.gov.mk/Page/About/Regional-Centers](https://cuk.gov.mk/Page/About/Regional-Centers) |
| 50 | `mvr` — МВР / СВР Скопје | `national_public_service` | `core` | `page_read` | [https://mvr.gov.mk/mk-MK/odnosi-so-javnost/novosti](https://mvr.gov.mk/mk-MK/odnosi-so-javnost/novosti) |
| 51 | `fzo_pharmacies` — Фонд за здравствено осигурување — ФЗО | `national_public_service` | `core` | `indexed_official_page` | [https://fzo.org.mk/dezurni-apteki](https://fzo.org.mk/dezurni-apteki) |
| 52 | `iph` — Институт за јавно здравје — ИЈЗ | `national_public_health` | `core` | `page_read` | [https://iph.mk/](https://iph.mk/); [https://iph.mk/mk/home/news/1](https://iph.mk/mk/home/news/1) |
| 53 | `iph_healthalert` — ИЈЗ — HealthAlert map | `national_public_health` | `candidate` | `official_directory` | [https://healthalert.mk/](https://healthalert.mk/) |
| 54 | `cph_skopje` — Центар за јавно здравје Скопје | `public_health_institution` | `candidate` | `page_read` | [https://cph.mk/](https://cph.mk/) |
| 55 | `zds` — Здравствен дом Скопје | `public_health_institution` | `candidate` | `indexed_official_page` | [https://zds.mk/](https://zds.mk/); [https://zds.mk/служба-за-итна/](https://zds.mk/служба-за-итна/); [https://zds.mk/kontakt/](https://zds.mk/kontakt/) |
| 56 | `moj_termin` — Мој Термин | `national_public_health_platform` | `background` | `indexed_official_page` | [https://mojtermin.mk/map/ustanovi](https://mojtermin.mk/map/ustanovi); [https://mojtermin.mk/map](https://mojtermin.mk/map) |
| 57 | `ahv` — Агенција за храна и ветеринарство — АХВ | `national_public_service` | `personalized` | `page_read` | [https://fva.gov.mk/mk/izvestuvanje-otpovikuvanje-nebezbedni-proizvodi?page=0](https://fva.gov.mk/mk/izvestuvanje-otpovikuvanje-nebezbedni-proizvodi?page=0); [https://fva.gov.mk/](https://fva.gov.mk/) |
| 58 | `mon` — Министерство за образование и наука — МОН | `national_government` | `personalized` | `page_read` | [https://mon.gov.mk/mk-MK/propisi/kalendari](https://mon.gov.mk/mk-MK/propisi/kalendari); [https://mon.gov.mk/](https://mon.gov.mk/) |
| 59 | `holidays` — Министерство за економија и труд — неработни денови | `national_government` | `core` | `document_read` | [https://www.economy.gov.mk/build/assets/programa-nerabotni-denovi-2026-MHaAbYyO.pdf](https://www.economy.gov.mk/build/assets/programa-nerabotni-denovi-2026-MHaAbYyO.pdf) |
| 60 | `ujp` — Управа за јавни приходи — УЈП | `national_government` | `personalized` | `page_read` | [https://www.ujp.gov.mk/mk/kalendar/pregled/mesec?print=1](https://www.ujp.gov.mk/mk/kalendar/pregled/mesec?print=1) |
| 61 | `uslugi` — Национален портал за е-услуги | `national_government_platform` | `background` | `official_directory` | [https://uslugi.gov.mk/](https://uslugi.gov.mk/) |
| 62 | `posta` — АД Пошта на Северна Македонија | `national_postal_operator` | `personalized` | `page_read` | [https://www.posta.com.mk/](https://www.posta.com.mk/); [https://www.posta.com.mk/работно-време-на-единици-на-поштенска/](https://www.posta.com.mk/работно-време-на-единици-на-поштенска/) |
| 63 | `city_culture` — Град Скопје — портал Култура | `city_government_platform` | `personalized` | `page_read` | [https://kultura.skopje.gov.mk/](https://kultura.skopje.gov.mk/); [https://kultura.skopje.gov.mk/за-нас/](https://kultura.skopje.gov.mk/за-нас/) |
| 64 | `mkc` — Младински културен центар — МКЦ | `city_public_institution` | `personalized` | `official_directory` | [https://mkc.mk/](https://mkc.mk/); [https://kinomilenium.mk/](https://kinomilenium.mk/) |
| 65 | `universal_hall` — ЈУ Универзална сала | `city_public_institution` | `personalized` | `official_directory` | [https://www.univerzalna.com.mk/](https://www.univerzalna.com.mk/) |
| 66 | `zoo` — ЈУ Зоолошка градина Скопје | `city_public_institution` | `personalized` | `official_directory` | [https://zooskopje.com.mk/](https://zooskopje.com.mk/) |
| 67 | `city_library` — Градска библиотека Браќа Миладиновци | `city_public_institution` | `personalized` | `official_directory` | [https://www.gbsk.mk/](https://www.gbsk.mk/) |
| 68 | `kic` — Културно-информативен центар — КИЦ | `city_public_institution` | `personalized` | `page_read` | [https://kic.mk/](https://kic.mk/) |
| 69 | `city_museum` — Музеј на град Скопје | `city_public_institution` | `personalized` | `page_read` | [https://museumskopje.mk/](https://museumskopje.mk/) |
| 70 | `dkc_karpos` — Детски културен центар Карпош | `city_public_institution` | `personalized` | `page_read` | [https://dkckarpos.org.mk/index.php/mk/](https://dkckarpos.org.mk/index.php/mk/) |
| 71 | `koco_racin` — Дом на култура Кочо Рацин | `city_public_institution` | `personalized` | `page_read` | [https://dk-kocoracin.org.mk/](https://dk-kocoracin.org.mk/) |
| 72 | `national_opera_ballet` — Национална опера и балет | `national_public_cultural_institution` | `personalized` | `response_parsed` | [https://operabalet.mk/events/](https://operabalet.mk/events/); [https://operabalet.mk/events/?ical=1](https://operabalet.mk/events/?ical=1) |
| 73 | `philharmonic` — НУ Филхармонија | `national_public_cultural_institution` | `personalized` | `page_read` | [https://www.filharmonija.mk/nastani-i-bileti/](https://www.filharmonija.mk/nastani-i-bileti/) |
| 74 | `mnt` — Македонски народен театар | `national_public_cultural_institution` | `personalized` | `official_directory` | [https://mnt.mk/](https://mnt.mk/) |
| 75 | `dramski` — Драмски театар Скопје | `national_public_cultural_institution` | `personalized` | `indexed_official_page` | [https://dramski.mk/programa/](https://dramski.mk/programa/) |
| 76 | `comedy_theatre` — Театар Комедија | `national_public_cultural_institution` | `personalized` | `page_read` | [https://teatarkomedija.mk/](https://teatarkomedija.mk/) |
| 77 | `kinoteka` — Кинотека | `national_public_cultural_institution` | `personalized` | `indexed_official_page` | [https://kinoteka.mk/category/programa/](https://kinoteka.mk/category/programa/) |
| 78 | `msu` — Музеј на современа уметност | `national_public_cultural_institution` | `personalized` | `page_read` | [https://msu.mk/](https://msu.mk/) |
| 79 | `national_gallery` — Национална галерија | `national_public_cultural_institution` | `personalized` | `page_read` | [https://nationalgallery.mk/](https://nationalgallery.mk/) |
| 80 | `national_library` — НУБ Св. Климент Охридски | `national_public_cultural_institution` | `background` | `official_directory` | [https://nubsk.edu.mk/](https://nubsk.edu.mk/) |
| 81 | `tanec` — Танец | `national_public_cultural_institution` | `background` | `official_directory` | [https://tanec.mk/](https://tanec.mk/) |
| 82 | `archaeological_museum` — Археолошки музеј | `national_public_cultural_institution` | `background` | `official_directory` | [https://amm.org.mk/](https://amm.org.mk/) |
| 83 | `museum_north_macedonia` — Музеј на Северна Македонија | `national_public_cultural_institution` | `background` | `official_directory` | [https://museum.org.mk/](https://museum.org.mk/) |
| 84 | `museum_macedonian_struggle` — Музеј на македонската борба | `national_public_cultural_institution` | `background` | `official_directory` | [https://www.mmb.org.mk/](https://www.mmb.org.mk/) |
| 85 | `turkish_theatre` — Турски театар | `national_public_cultural_institution` | `background` | `official_directory` | [https://www.turktiyatrosu.mk/](https://www.turktiyatrosu.mk/) |
| 86 | `albanian_theatre` — Албански театар | `national_public_cultural_institution` | `background` | `official_directory` | [https://www.teatri.mk/mk/repertoar/kalendar](https://www.teatri.mk/mk/repertoar/kalendar) |
| 87 | `boris_trajkovski` — Спортски центар Борис Трајковски / T Arena | `public_sports_facility` | `personalized` | `page_read` | [https://www.scboristrajkovski.gov.mk/](https://www.scboristrajkovski.gov.mk/); [https://scboristrajkovski.gov.mk/index.php/nastani](https://scboristrajkovski.gov.mk/index.php/nastani); [https://www.scboristrajkovski.gov.mk/index.php/soopshtenija](https://www.scboristrajkovski.gov.mk/index.php/soopshtenija) |
| 88 | `red_cross_skopje` — Црвен крст на Град Скопје | `humanitarian_organization` | `personalized` | `page_read` | [https://ckgs.org.mk/category/novosti/](https://ckgs.org.mk/category/novosti/); [https://ckgs.org.mk/dejnosti/krvodaritelstvo/](https://ckgs.org.mk/dejnosti/krvodaritelstvo/) |
| 89 | `transfusion_medicine` — Институт за трансфузиона медицина | `public_health_institution` | `candidate` | `page_read` | [https://itm.org.mk/](https://itm.org.mk/); [https://itm.org.mk/неделен-распоред-на-крводарителски-а/](https://itm.org.mk/неделен-распоред-на-крводарителски-а/) |
| 90 | `protection_rescue` — Дирекција за заштита и спасување | `national_public_service` | `candidate` | `indexed_official_page` | [https://dzs.gov.mk/Pages/News/Default.cshtml](https://dzs.gov.mk/Pages/News/Default.cshtml); [https://dzs.gov.mk/Default.cshtml](https://dzs.gov.mk/Default.cshtml) |
| 91 | `erc` — Регулаторна комисија за енергетика, водни услуги и услуги за управување со комунален отпад — РКЕ | `national_regulator` | `personalized` | `page_read` | [https://www.erc.org.mk/page.aspx?id=290](https://www.erc.org.mk/page.aspx?id=290); [https://www.erc.org.mk/page.aspx?id=343](https://www.erc.org.mk/page.aspx?id=343); [https://www.erc.org.mk/](https://www.erc.org.mk/) |

## Future dated work entries

Append real session history below or in a new dated section after the archives. The following is a **suggested template**, not a completed session:

```markdown
## YYYY-MM-DD — Session title

### User request and decisions

- Record the new instruction and any explicit decisions. Quote when precision matters.

### Work completed

- Record actual changes and relevant files. Distinguish proposed work from completed work.

### Validation and current state

- Record what was run or inspected, its result, and material limitations.

### Open questions and next work

- Record unresolved items, including source access, data quality and scope choices.

### Repository outcome

- Branch/commit: record actual values after known.
- Push: record the confirmed remote/branch result, or the exact pending/blocked state.
```

## Appendix A — Original supplied context, preserved verbatim

The following is the full user-supplied `Pasted markdown.md`. It includes an earlier mixed conversation: ideas, questions, user choices, assistant proposals, and assistant claims. Preserve it as historical evidence. The research corrections above supersede older source-availability assumptions where explicitly stated. The archive does not prove that the assistant's earlier implementation claims are present in the repository.

Original file SHA-256: `a58e9ca74eb8007423d497e16f1e08b2eab51b42a04cbabe02c49c89b97044df`

<!-- BEGIN ORIGINAL SUPPLIED CONTEXT -->
```text
Concept  Build one app with three jobs:  Know. Live state of the city: air, outages, buses, parking, weather. Fix. Report problems like potholes, illegal dumps, broken lights and stray dogs, and track them until they’re fixed. Do. Get services done: on-duty pharmacies, doctor appointments, e-services, events.  What makes it different: an AI assistant that answers in Macedonian, Albanian and English. Example question: “Is there water in Aerodrom tomorrow, and how bad is the air?” Skopje already has single-purpose apps like AirCare, pulse.eco and the JSP bus apps. Nobody combines them.  Name ideas Комшија / Komšija: means “neighbour”. Friendly, and works in Macedonian, Albanian and Turkish. Чаршија / Čaršija: the old bazaar, a place where everything is in one spot. Камен Мост / Kamen Most: the Stone Bridge, a bridge between citizens and the city. Кале / Kale: the fortress. Short, iconic, easy to brand. Вардар / Vardar: the river that runs through everything. Мое Скопје / Moe Skopje: “My Skopje”. Clear, but it may already be taken. Дише / Diše: “breathes”. Good if you lead with air quality. Градот / Gradot: “The City”. Simple and confident. Skopje OS: works well for a tech-flavoured pitch.  Before you commit, check the .mk domain and existing trademarks and apps. Avoid “Skopsko” because it’s a beer brand.  Features  Live layers (one map)  Air quality (PM10 and PM2.5) by neighbourhood, with health advice and an alert when the air turns bad. Water, electricity and heating outages, filtered to your street. Buses: routes, stops and live position where you can get it. Parking zones and prices, with a reminder before your parking runs out. Weather, the Vardar river level, and earthquake alerts.  Fix the city  Report a problem with a photo and GPS: pothole, wild dump, broken streetlight, stray dog, illegal parking. Public status for each report, plus a map of hotspots. Upvote other people’s reports so the most urgent ones rise.  Services  On-duty pharmacies near you. Hospitals, with links to Мој термин (the national doctor-appointment system). An e-services guide: “how do I get X document”, step by step. Kindergarten and school finder. Waste collection schedule.  Transparency  What the city spends, from public procurement and budget payment data. Election results by polling station. Neighbourhood scorecard: air, green space, services and reports per municipality.  Community  Events: concerts, Kinoteka, MKC, festivals. Volunteering, such as tree planting or cleanup days. Lost and found pets. Neighbourhood notices.  Wow features for the demo  AI city assistant: chat in MK, AL or EN, answered from all the data above. “Should I go out?” score: one number from air, weather and pollen. Satellite view: NO₂ and green cover over time, from Sentinel satellites. Walk or bike routes that avoid bad air, using the sensor data. Data sources  Air and environment  pulse.eco (skopje.pulse.eco): free API with PM10, PM2.5, noise, temperature and humidity from citizen sensors. Best starting point. MOEPP (air.moepp.gov.mk): the official state monitoring stations (Centar, Karpoš, Lisiče, Gazi Baba, Rektorat, Miladinovci). Sensor.community (formerly Luftdaten): many more citizen sensors around Skopje, with an open API. WAQI (aqicn.org): aggregated air-quality API, useful as a fallback. Copernicus Sentinel-5P and Sentinel-2: satellite data for NO₂, vegetation and land use. Copernicus Urban Atlas also covers Skopje.  Weather and hazards  Open-Meteo: free, needs no API key. УХМР / UHMR (the state hydrometeorological service): official forecasts and Vardar river levels. EMSC: earthquake feed with an API. Crisis Management Centre and the 112 emergency service: official alerts.  Transport  ЈСП / JSP Skopje (jsp.com.mk): bus lines and timetables. As far as I know there is no official GTFS feed, so plan to build one from OpenStreetMap route data plus the published timetables. That could be one of your own contributions. Градски паркинг (City Parking): parking zones and prices. AMSM (amsm.mk): road conditions and border wait times. OpenStreetMap: streets, stops, bike lanes and points of interest. This is your base map.  Utilities (mostly announcements you’ll need to scrape)  EVN Македонија (evn.mk): planned power outages. Водовод и канализација Скопје: water cuts. BEG / Топлификација: district heating. Комунална хигиена: waste collection.  Government and open data  data.gov.mk: the national open data portal. ДЗС / State Statistical Office, MakStat database: census 2021 and statistics by municipality. It’s a PX-Web database, which has an API. skopje.gov.mk: City of Skopje decisions, news and events. uslugi.gov.mk: the national e-services catalogue. open.finance.gov.mk: payments made by public institutions. e-nabavki.gov.mk: public procurement. katastar.gov.mk: the cadastre geoportal (land and property boundaries). Central Registry (crm.com.mk): company data. sec.mk: State Election Commission results. mvr.gov.mk: daily police bulletins, which you can scrape for incident maps. The 10 municipality websites: Centar, Karpoš, Aerodrom, Kisela Voda, Gazi Baba, Čair, Butel, Šuto Orizari, Gjorče Petrov, Saraj.  Health and education  mojtermin.mk: the doctor-appointment system. Health Insurance Fund: on-duty pharmacy lists and covered medicines. Institute of Public Health: health alerts and pollen information. Ministry of Education: list of schools. Municipalities: kindergarten lists.  Culture and other  City and municipality event calendars, MKC, Kinoteka, and ticketing sites. Wikidata and OSM: landmarks and museums. Employment Service Agency (av.gov.mk): jobs.  Before you scrape, check each site’s terms of use and robots.txt. Listing sites like pazar3 and reklama5 likely forbid scraping.  Inclusion Support Macedonian, Albanian and English from day one. Albanian is co-official in Skopje. Consider Turkish and Romani for Čair and Šuto Orizari. Make the text large and keep the flows simple for older users. Hackathon MVP A map with 3 layers: air from pulse.eco, outages from EVN and the water utility, and bus stops from OSM. A problem report with photo and GPS, plus a public status board. The AI assistant answering from those layers.  Demo line: “Komšija: one app for everything happening in Skopje, in your language.”  I can turn this into a shareable page for the team if that helps.  Using the superpowers skill create an execution plan that we can afterwards implement, from the stack, to the architecture to how the whole app should look and feel.  For styling I want premium apple style, using apple skills, glassmorphism/liquid glass like UI and so forth.  It needs to be desktop and mobile view compatible, for now it will only be a web app.  Use the grill me skill from github to ask me questions about the project for anything you might need  Empty folder. Fetching grill-me skill and searching Apple design skills.  Since this is a fresh project, I’ll draft a design spec first for your approval before planning implementation—recreating Liquid Glass in CSS myself since the Apple design skills I found target native SwiftUI, not web. Before that, I’ll walk through grill-me style questions one at a time to confirm my understanding of the Skopje hackathon app, starting with the first one.  What is the goal and timeline? This sets the scope: live data integrations versus a polished demo running on seeded data. Hackathon Demo, but keep in mind we might push to prod after a while, also not only 2-3 live feeds, but everything you previously listed, from electricity outages, to busses to everything.  Every source will go live and needs production-ready architecture, so I’ll build a dedicated adapter per source to normalize data into a shared format—many will be scrapers since the sources are announcement pages.  How long until the demo, and how many people are building? About 20 sources each need an adapter, so this decides whether we build them in parallel and how many get made robust. You have 6 hours and its just you  Given the 6-hour solo timeline, I’ll keep every adapter thin—fetch, parse, cache, and fall back to stale data if a source fails. Next I’ll gather the key clarifying questions in one batch.  Where will this run? Problem reports need storage that persists (rows plus photos). Vercel + Supabase (Recommended) Is there an API key for the AI city assistant? Yes, Anthropic key (Recommended) Which name? Мое Скопје Which UI languages for the demo? MK + EN  Name is Мое Скопје. Before the next questions I’m checking which sources this machine can actually reach, so the plan doesn’t depend on guesses.  Most sources respond. Checking the three that failed, plus what the key data endpoints actually return:  Pulse.eco, MOEPP, sensor.community, Open-Meteo, EMSC, EVN, City Parking, AMSM, MVR, FZO, gov portals, and OpenFreeMap tiles are all live; JSP buses, the water utility, BEG heating, and Komunalna Higiena are unreachable and will fall back to seeded “source offline” data, and since Overpass is flaky I’ll bake bus stops/routes into static GeoJSON at build time instead of hitting it at runtime. Next up: the visual design batch.  What should the main layout be? Go with option 1, but have an onboarding where it asks the user what features they want open on the map by default, changeable in settings etc. Which map engine? MapLibre + OpenFreeMap (Recommended) Light or dark? Auto, follows system (Recommended) How do citizens identify themselves when filing a report? Anonymous + optional nickname (Recommended)  Onboarding with default layer selection is done, saved locally and editable in Settings. Given 6 hours can’t cover all \~25 planned features with polish, I’ll prioritize into a batch now.  6 hours won't polish all \~25 features. Which scope tiers do we commit to? The order of the list is the order I build in. Tiered (Recommended) How should the data layer work? Next.js adapters + cache + snapshots (Recommended)  Scope and data architecture are decided. Here’s the full design, section by section. Flag any section you want changed.  1. Stack  Framework: Next.js (latest stable, App Router) with TypeScript. Deployed on Vercel in the Frankfurt region (fra1), the closest one to Skopje. Styling and motion: Tailwind CSS v4 for styling and motion for spring animations. The bottom sheet uses vaul, which already handles snap points and drag. Map: maplibre-gl with OpenFreeMap tiles, restyled in a muted Apple Maps look with light and dark versions. Backend: Supabase, which provides Postgres, photo storage and the snapshot table. Data handling: zod checks every adapter’s output, and cheerio parses the scraped HTML pages. AI: @anthropic-ai/sdk, calling Claude with tool use. Translations: MK and EN as two plain dictionary files with a small hook, no i18n library. Icons: Lucide. SF Symbols aren’t licensed for the web. Font: the system stack, so Apple devices get the real SF Pro. Inter is the fallback everywhere else.  2. Architecture  lib/sources/\<id>.ts        adapter: { id, ttl, fetch() → Feature[] }, one file per source lib/layer.ts               getLayer(id): cache → live fetch → save snapshot | on fail: snapshot (stale) → seed (offline) app/api/layers/[id]        GET → GeoJSON + meta {status: live|stale|offline, updatedAt, source} app/api/reports            GET/POST (server-side rate limit per device) app/api/assistant          streaming Claude, tools: get_layer, list_reports, find_place data/static/\*.geojson      baked once: bus stops/routes, 10 municipality boundaries, parking zones data/seed/\*.json           fallback data for sources that are offline Outages: EVN lists outages by street name. Instead of geocoding each street, the adapter matches settlement names to the 10 municipality boundaries and highlights the affected area on the map. Database tables: reports, report_votes, source_snapshots, plus a storage bucket for report photos. Vercel Cron: the free tier runs cron only once a day, so the daily job just refreshes the snapshots. Normal requests keep the cache fresh by serving the cached copy and refreshing it in the background.  3. Look and feel (Liquid Glass on the web)  Glass material: a translucent background that blurs and boosts the colours behind it (backdrop-filter: blur(24px) saturate(180%)). It has a bright 1px highlight on the top edge, a thin outer border, and a soft multi-layer shadow. A light gradient overlay gives it shine. Refraction: in Chromium browsers, an SVG filter bends the map at the panel edges like real glass. Other browsers get the standard glass. If the system’s “reduce transparency” setting is on, panels become solid. Typography: the iOS type scale. Large Title 34 bold, Title2 22, Headline 17 semibold, Body 17, Footnote 13. Colours: iOS system colours (blue, green, orange, red, indigo, teal), one per layer. Air quality uses the standard AQI scale from green to purple. Shape: corner radius 22 on sheets, 14 on cards, and pill-shaped buttons. Browsers that support it get Apple’s smoother squircle corners (corner-shape: squircle). Motion: springs everywhere (stiffness 400, damping 30). Buttons shrink to 96% when pressed. Animations turn off when the system’s “reduce motion” setting is on. Mobile, under 768px: full-screen map, a glass search pill at the top, and a draggable bottom sheet that snaps to 15%, 50% or 92% of the screen. At the bottom is a floating glass tab bar, iOS 26 style, with Explore, Report, Ask and Settings. Desktop, 1024px and up: a 380px floating glass sidebar on the left, layer chips across the top, and the assistant as a floating panel on the right.  4. Screens  Onboarding: choose language, choose default layers from a grid of toggles, then allow location. Explore: “Today” summary cards and the list of layers. Layer detail: for example Air shows the stations and a 24-hour chart. Marker card: tap anything on the map to get a glass card with its details. Report flow: category, photo, pin, note, submit. Reports list: each report with its status and upvotes. Assistant chat: answers show where the data came from (“pulse.eco, 5 min ago”), and tapping one focuses that spot on the map. Settings: language, default layers, a theme override, and a Data health panel showing every source’s live, stale or offline status. That panel doubles as a strong demo moment.  5. Errors and testing  Failures: each adapter has an 8-second timeout and a zod check. If it fails, the app serves the last snapshot, then seed data. Every layer shows a badge: “Live · 3 min”, “Stale · 2h” or “Demo data”. A failed source never crashes the map. Tests: one parser test per adapter, run against a saved copy of the source’s response (vitest). Source check: npm run check:sources hits every live source and prints a status table. Deliberately skipped: end-to-end (E2E) tests, which are a time sink.  6. Six-hour budget  Hours	Work 0:00–0:30	Spec and plan 0:30–1:00	Scaffold and design tokens 1:00–2:00	Map shell, sheet, onboarding 2:00–3:30	Adapters and layers 3:30–4:15	Reports 4:15–5:00	Assistant 5:00–5:30	T2 features 5:30–6:00	Polish, deploy, demo script  Risks  Some .mk sites may block Vercel’s servers, which are outside Macedonia. The fallback chain covers this. The water, heating, waste and JSP bus sites are already unreachable from here. &#x20;
```
<!-- END ORIGINAL SUPPLIED CONTEXT -->

## Appendix B — Complete 2026-10-17 source-registry snapshot

This is the complete structured research deliverable, included so every source URL, evidence URL, acquisition detail, tested interface, caveat and recommendation remains recoverable after moving the conversation. It can be extracted as JSON into a separately tracked registry if desired. It is an immutable dated research snapshot; append later findings and versioned updates rather than silently reclassifying what was known on this date.

Research metadata such as `page_read`, `response_parsed` and `documented_interface` is deliberately separate from `adapter_implemented`. Do not infer a current live product feature from a source's registry presence.

Original registry filename: `moe-skopje-source-registry.json`

Original registry SHA-256: `9970c543bd41396e06f175611337e0529df1722fbba60767b83051dfdbd96044`

<!-- BEGIN COMPLETE SOURCE REGISTRY -->
```json
{
  "schema_version": "1.0",
  "title": "Мое Скопје — public-service and daily-briefing source registry",
  "review_date": "2026-10-17",
  "timezone": "Europe/Skopje",
  "project_context": {
    "name": "Мое Скопје",
    "briefing_goal": "A personalized daily briefing about what affects the user's day in and around Skopje.",
    "context_file": "Pasted markdown.md",
    "context_use": "Treated as project background; source availability, domains and access claims rechecked for this research."
  },
  "scope": {
    "description": "Core utilities, all ten City municipality administrations, additional municipal enterprises, relevant national/public services, cultural venues, and clearly labeled independent/commercial supporting sources.",
    "source_entry_count": 91,
    "count_note": "Entries represent publishers/services or distribution channels; they are not 91 distinct legal entities or implemented adapters.",
    "verified_city_enterprise_baseline": [
      "Паркови и зеленило",
      "Градски паркинг",
      "Улици и патишта",
      "ЈСП Скопје",
      "Комунална хигиена",
      "Водовод и канализација",
      "Дрисла",
      "Лајка"
    ],
    "all_ten_city_municipalities": [
      "Аеродром",
      "Бутел",
      "Гази Баба",
      "Ѓорче Петров",
      "Карпош",
      "Кисела Вода",
      "Сарај",
      "Центар",
      "Чаир",
      "Шуто Оризари"
    ],
    "exhaustiveness_limit": "This is a practical source inventory, not a certified complete legal register of every public institution, school, clinic, kindergarten, branch or small local service company. The official directories below support further organization-level expansion.",
    "geographic_note": "The City's ten municipalities are the core. Utility service areas, airport access and intercity travel may extend beyond that boundary; use actual service geography."
  },
  "verification_legend": {
    "response_parsed": "A public machine-readable response was fetched and its basic structure inspected during this research. No production adapter or uptime guarantee.",
    "page_read": "Official HTML content was retrieved through web research, sometimes from a cached rendering. Does not prove a working unattended scraper.",
    "document_read": "An actual official document was retrieved. It still needs per-field validation before operational use.",
    "indexed_official_page": "Official content was visible in search but direct retrieval or current data extraction was incomplete.",
    "official_directory": "Organization/channel or website confirmed in an official directory or parent publisher; operational feed may be unverified.",
    "documented_interface": "Official interface documentation inspected; no authenticated/live data call tested unless explicitly recorded."
  },
  "priority_legend": {
    "core": "Important to a general daily briefing or to users in the covered municipality; integration can still be blocked or unverified.",
    "personalized": "Useful for users whose locations, routes or interests match.",
    "background": "Directory, contextual information, infrequent changes or later expansion.",
    "candidate": "Identity or potential source found; a sufficiently current/accesssible operational source is not yet established."
  },
  "source_status_policy": "Never infer that a source is unavailable to everyone because one research request failed, or that the service is normal because the source returned no records.",
  "sources": [
    {
      "id": "electricity_distribution",
      "organization": "Електродистрибуција",
      "publisher_type": "commercial_utility",
      "categories": [
        "electricity"
      ],
      "priority": "core",
      "source_urls": [
        "https://elektrodistribucija.mk/Grid/OutagesMap.aspx"
      ],
      "extract": [
        "Outage type",
        "Affected settlement and location",
        "Start time",
        "Published expected end time"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Web retrieval exposed headings but no outage rows; an empty rendered table is not evidence of no outages.",
        "Raw GET returned HTTP 403 in the research environment; underlying dynamic data request and data timestamps remain unverified.",
        "Published planned end times are estimates."
      ],
      "evidence_urls": [
        "https://elektrodistribucija.mk/Grid/OutagesMap.aspx"
      ],
      "acquisition": "Dynamic webpage; inspect the actual public data request during implementation.",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "evn_customer",
      "organization": "EVN / EVN Home",
      "publisher_type": "commercial_utility",
      "categories": [
        "electricity",
        "customer_services"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://www.evn.mk/"
      ],
      "extract": [
        "Customer-office changes",
        "Service and billing notices"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Use Elektrodistribucija for distribution outages and deduplicate cross-posted notices."
      ],
      "evidence_urls": [
        "https://www.evn.mk/",
        "https://elektrodistribucija.mk/About-us.aspx"
      ],
      "acquisition": "HTML notices",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "water_skopje",
      "organization": "ЈП Водовод и канализација — Скопје",
      "publisher_type": "city_enterprise",
      "categories": [
        "water"
      ],
      "priority": "core",
      "source_urls": [
        "https://vodovod-skopje.com.mk/mk-MK/article/INFORMACIIIZAPREKINNAVODOSNABDUVANjEIDEFEKTI_1",
        "https://vodovod-skopje.com.mk/mk-MK/articles/SOOPShTENIJA"
      ],
      "extract": [
        "Water cuts",
        "Low pressure",
        "Affected streets and buildings",
        "Start time",
        "Restoration notices",
        "Water-quality announcements"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Many events share one editable page; retain page versions and identify individual event blocks.",
        "Dates contain inconsistent formatting; preserve the original text when uncertain.",
        "Until completion means the restoration time is unknown.",
        "Footer explicitly restricts copying/display without written permission; establish permitted reuse before republishing content."
      ],
      "evidence_urls": [
        "https://vodovod-skopje.com.mk/mk-MK/article/INFORMACIIIZAPREKINNAVODOSNABDUVANjEIDEFEKTI_1",
        "https://vodovod-skopje.com.mk/mk-MK/articles/SOOPShTENIJA"
      ],
      "acquisition": "HTML event-block extraction and change detection",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "heat_distribution",
      "organization": "ЕСМ Дистрибуција на топлина",
      "publisher_type": "state_owned_energy_company",
      "categories": [
        "heating"
      ],
      "priority": "core",
      "source_urls": [
        "https://esm-distribucija.mk/izvestuvanja/"
      ],
      "extract": [
        "Heating faults",
        "Address-level supply interruptions",
        "Restoration updates",
        "Seasonal network preparations"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Coverage of separate heating networks must be established; do not assume every Skopje heating customer is covered."
      ],
      "evidence_urls": [
        "https://esm-distribucija.mk/izvestuvanja/"
      ],
      "acquisition": "HTML listing and individual articles",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "heat_supply",
      "organization": "ЕСМ Снабдување со топлина",
      "publisher_type": "state_owned_energy_company",
      "categories": [
        "heating",
        "customer_services"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://www.esm.com.mk/?page_id=15365",
        "https://www.esm-snabduvanje.com.mk/"
      ],
      "extract": [
        "Heating-season notices",
        "Customer services",
        "Billing and connection notices"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Parent verifies the company; current supply website could not be reliably retrieved.",
        "Conflicting indexed content/domain variants require source validation.",
        "Use ESM Distribucija for the verified operational heating feed."
      ],
      "evidence_urls": [
        "https://www.esm.com.mk/?page_id=15365",
        "https://www.esm-snabduvanje.com.mk/"
      ],
      "acquisition": "Parent-company notices; verify canonical supply site before implementation",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "heat_energetika",
      "organization": "АД ЕСМ — подружница Енергетика, Скопје",
      "publisher_type": "state_owned_energy_branch",
      "categories": [
        "heating"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://www.esm.com.mk/?page_id=3582",
        "https://www.esm.com.mk/"
      ],
      "extract": [
        "Notices affecting the Energetika heating network"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Separate network coverage consideration; a dedicated current operational feed was not established."
      ],
      "evidence_urls": [
        "https://www.esm.com.mk/?page_id=3582",
        "https://www.esm.com.mk/"
      ],
      "acquisition": "Filter official parent news by branch and service area",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "heat_production",
      "organization": "ЕСМ Производство на топлина",
      "publisher_type": "state_owned_energy_company",
      "categories": [
        "heating"
      ],
      "priority": "background",
      "source_urls": [
        "https://www.esm.com.mk/?page_id=15363",
        "https://www.esm.com.mk/?page_id=17237"
      ],
      "extract": [
        "Major production or plant changes affecting heat delivery"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Lower daily relevance than distribution notices; no distinct consumer outage feed established."
      ],
      "evidence_urls": [
        "https://www.esm.com.mk/?page_id=15363",
        "https://www.esm.com.mk/?page_id=17237"
      ],
      "acquisition": "Official parent pages and notices",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "jsp",
      "organization": "ЈСП Скопје",
      "publisher_type": "city_enterprise",
      "categories": [
        "buses",
        "cable_car"
      ],
      "priority": "core",
      "source_urls": [
        "https://skopjebus.mk/mk/izvestuvanja/",
        "https://skopjebus.mk/mk/schedule/",
        "https://skopjebus.mk/mk/app/lines/"
      ],
      "extract": [
        "Route diversions",
        "Special and holiday timetables",
        "Ticket-office hours",
        "Published line and stop schedules",
        "Vodno cable-car hours and closure notices"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "No official public GTFS, vehicle-position or live-arrival API was verified.",
        "JSP notices can cover private operators; a comprehensive operator-specific feed set was not established.",
        "Published operating hours do not establish that a cable car or bus is running at the current moment."
      ],
      "evidence_urls": [
        "https://skopjebus.mk/mk/izvestuvanja/",
        "https://skopjebus.mk/mk/schedule/",
        "https://skopje.gov.mk/mk/skopje/javni-pretprijatija/"
      ],
      "acquisition": "HTML notices; validate underlying timetable data separately",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "streets_roads",
      "organization": "ЈП Улици и патишта / ЦУКС",
      "publisher_type": "city_enterprise",
      "categories": [
        "roadworks",
        "traffic"
      ],
      "priority": "core",
      "source_urls": [
        "https://uip.gov.mk/",
        "https://uip.gov.mk/tsentar-za-upravuva/"
      ],
      "extract": [
        "Dated daily work locations and tasks",
        "Road and pavement works",
        "Traffic-signal works",
        "Temporary traffic regimes"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Work activity is not automatically a full road closure; use explicit restrictions.",
        "ЦУКС is the traffic-control department, distinct from national crisis centre ЦУК.",
        "No public real-time traffic API established."
      ],
      "evidence_urls": [
        "https://uip.gov.mk/",
        "https://uip.gov.mk/tsentar-za-upravuva/"
      ],
      "acquisition": "Daily HTML work table and traffic-control notices",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "city_parking",
      "organization": "ЈП Градски паркинг — Скопје",
      "publisher_type": "city_enterprise",
      "categories": [
        "parking"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://www.gradskiparking.com.mk/",
        "https://www.gradskiparking.com.mk/zonsko-parking-zoni.nspx",
        "https://www.gradskiparking.com.mk/javni-parkiralishta-i-zonsko.nspx"
      ],
      "extract": [
        "Charging hours",
        "Holiday exceptions",
        "Zone and tariff changes",
        "Garage/service interruptions"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "No live parking-space occupancy feed verified."
      ],
      "evidence_urls": [
        "https://www.gradskiparking.com.mk/",
        "https://www.gradskiparking.com.mk/zonsko-parking-zoni.nspx",
        "https://www.gradskiparking.com.mk/javni-parkiralishta-i-zonsko.nspx"
      ],
      "acquisition": "HTML notices, zones and tariffs",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "poc",
      "organization": "ЈП Паркинзи на Општина Центар — ПОЦ",
      "publisher_type": "municipal_enterprise",
      "categories": [
        "parking",
        "local_services"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://poc.mk/",
        "https://poc.mk/?page_id=146",
        "https://poc.mk/?page_id=136",
        "https://poc.mk/?page_id=161"
      ],
      "extract": [
        "Centar parking notices",
        "Permits and tariffs",
        "Office hours",
        "Recycling or local-service actions"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Separate provider from Gradski parking.",
        "No live occupancy feed verified; check homepage and news listing for newer posts."
      ],
      "evidence_urls": [
        "https://poc.mk/",
        "https://poc.mk/?page_id=146",
        "https://poc.mk/?page_id=136",
        "https://poc.mk/?page_id=161"
      ],
      "acquisition": "HTML notices",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "waste_skopje",
      "organization": "ЈП Комунална хигиена — Скопје",
      "publisher_type": "city_enterprise",
      "categories": [
        "waste",
        "cleaning"
      ],
      "priority": "core",
      "source_urls": [
        "https://www.khigiena.com.mk/"
      ],
      "extract": [
        "Waste-service changes",
        "Bulky-waste actions",
        "Cleaning announcements",
        "Published service information"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "One research retrieval failed and another returned readable HTML; production reliability is untested.",
        "No address-specific household collection calendar was established."
      ],
      "evidence_urls": [
        "https://www.khigiena.com.mk/",
        "https://skopje.gov.mk/mk/skopje/javni-pretprijatija/"
      ],
      "acquisition": "HTML notices; structured collection schedule requires provider confirmation",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "parks",
      "organization": "ЈП Паркови и зеленило",
      "publisher_type": "city_enterprise",
      "categories": [
        "parks",
        "maintenance",
        "community"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://parkovi.com.mk/"
      ],
      "extract": [
        "Maintenance locations",
        "Park-access notices when published",
        "Planting and cleanup events"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Extract relevant dated articles; exclude unrelated footer content observed on the site.",
        "Maintenance activity alone does not establish a public closure."
      ],
      "evidence_urls": [
        "https://parkovi.com.mk/"
      ],
      "acquisition": "HTML activity notices",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "drisla",
      "organization": "ЈП Дрисла — Скопје",
      "publisher_type": "city_enterprise",
      "categories": [
        "waste",
        "environment"
      ],
      "priority": "background",
      "source_urls": [
        "https://drisla.mk/tekovni-informaczii/",
        "https://drisla.mk/"
      ],
      "extract": [
        "Landfill service changes",
        "Waste acceptance information",
        "Environmental notices"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "This is not the neighborhood household collection-calendar source.",
        "Many articles are institutional/retrospective rather than daily service events."
      ],
      "evidence_urls": [
        "https://drisla.mk/tekovni-informaczii/",
        "https://skopje.gov.mk/mk/skopje/javni-pretprijatija/"
      ],
      "acquisition": "HTML notices",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "lajka",
      "organization": "ЈП Лајка",
      "publisher_type": "city_enterprise",
      "categories": [
        "animal_welfare",
        "community"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://lajka.com.mk/",
        "https://lajka.com.mk/category/novosti/"
      ],
      "extract": [
        "Service notices",
        "Adoption and volunteering events",
        "Locality-specific interventions when published"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Homepage readable; news category returned a browser-check page in one retrieval.",
        "No verified live map of stray dogs or live municipal work-order API."
      ],
      "evidence_urls": [
        "https://lajka.com.mk/",
        "https://lajka.com.mk/category/novosti/"
      ],
      "acquisition": "HTML notices; validate automated access",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "water_gazi_baba",
      "organization": "ЈКП Гази Баба 2007",
      "publisher_type": "municipal_enterprise",
      "categories": [
        "water",
        "waste",
        "cleaning"
      ],
      "priority": "core",
      "source_urls": [
        "https://jkpgb2007.gov.mk/",
        "https://jkpgb2007.gov.mk/novosti/"
      ],
      "extract": [
        "Local water-supply notices",
        "Waste and hygiene service changes"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Important separate publisher for settlements it serves; do not assume Vodovod covers this source.",
        "Homepage notice names Bulachani 1/2, Brnjarci, Viniche and Rashtak; complete service boundary still needs confirmation."
      ],
      "evidence_urls": [
        "https://jkpgb2007.gov.mk/",
        "https://aspi.mk/imateli/30412/"
      ],
      "acquisition": "HTML notices",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "jkp_butel",
      "organization": "ЈКП Бутел-Скопје",
      "publisher_type": "municipal_enterprise",
      "categories": [
        "local_services",
        "cleaning"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://opstinabutel.gov.mk/контакт-јкп-бутел/",
        "https://opstinabutel.gov.mk/"
      ],
      "extract": [
        "Municipal communal-service and work notices"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Dedicated operational publisher/API not established; use municipality notices."
      ],
      "evidence_urls": [
        "https://opstinabutel.gov.mk/контакт-јкп-бутел/",
        "https://opstinabutel.gov.mk/"
      ],
      "acquisition": "Municipal HTML notices and linked documents",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "jkp_kisela_voda",
      "organization": "ЈКП Кисела Вода 2022-Скопје",
      "publisher_type": "municipal_enterprise",
      "categories": [
        "waste",
        "local_services"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://opstinakiselavoda.gov.mk/нова-постојана-услуга-за-граѓаните-со/",
        "https://opstinakiselavoda.gov.mk/"
      ],
      "extract": [
        "Bulk-waste pickup service and changes",
        "Local service notices"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Verified article describes pickup by request; it is not a scheduled route calendar.",
        "Do not double-count older municipal sports-enterprise names without checking whether they are predecessors."
      ],
      "evidence_urls": [
        "https://opstinakiselavoda.gov.mk/нова-постојана-услуга-за-граѓаните-со/",
        "https://opstinakiselavoda.gov.mk/"
      ],
      "acquisition": "Municipality article and future notices",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "jkp_aerodrom",
      "organization": "ЈП за комунални дејности на Општина Аеродром–Скопје",
      "publisher_type": "municipal_enterprise",
      "categories": [
        "cleaning",
        "parks",
        "local_services"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://aerodrom.gov.mk/"
      ],
      "extract": [
        "Municipal cleanup and communal-work notices"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Entity confirmed in official gazette; separate current feed not established.",
        "Municipality homepage returned 403 in this environment."
      ],
      "evidence_urls": [
        "https://www.aerodrom.gov.mk/upload/documents/СЛУЖБЕН%20ГЛАСНИК%20бр.%2030_compressed.pdf"
      ],
      "acquisition": "Municipal notices; verify access",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "jkp_saraj",
      "organization": "ЈКП Сарај-Скопје",
      "publisher_type": "municipal_enterprise",
      "categories": [
        "local_services"
      ],
      "priority": "candidate",
      "source_urls": [
        "https://aspi.mk/imateli/30294/",
        "https://saraj.gov.mk/?lang=mk"
      ],
      "extract": [
        "Communal-service announcements through the municipality"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Official information-holder register lists physical noticeboard access; no independent online feed established."
      ],
      "evidence_urls": [
        "https://aspi.mk/imateli/30294/",
        "https://saraj.gov.mk/?lang=mk"
      ],
      "acquisition": "Municipality or provider partnership",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "shkupi_vjeter",
      "organization": "ЈП Шкупи Вјетер-Скопје",
      "publisher_type": "municipal_enterprise",
      "categories": [
        "local_services",
        "parking",
        "sports"
      ],
      "priority": "candidate",
      "source_urls": [
        "https://aspi.mk/imateli/30432/",
        "https://cair.gov.mk/?lang=mk"
      ],
      "extract": [
        "Relevant municipal enterprise service notices"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Independent online operational feed not established; official register lists physical noticeboard access.",
        "Confirm exact present services and facilities before assigning coverage."
      ],
      "evidence_urls": [
        "https://aspi.mk/imateli/30432/",
        "https://cair.gov.mk/?lang=mk"
      ],
      "acquisition": "Municipality or provider partnership",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "rail_transport",
      "organization": "Железници на РСМ Транспорт",
      "publisher_type": "state_owned_transport",
      "categories": [
        "rail"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://mzt.mk/poagane-od-skopje/",
        "https://mzt.mk/pristigane-vo-skopje/",
        "https://mzt.mk/"
      ],
      "extract": [
        "Published departures and arrivals",
        "Train service notices"
      ],
      "verification": "indexed_official_page",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Direct retrieval returned 502; no live delay feed or API established."
      ],
      "evidence_urls": [
        "https://mzt.mk/poagane-od-skopje/",
        "https://mzi.mk/возен-ред/"
      ],
      "acquisition": "HTML timetable after access validation",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "rail_infrastructure",
      "organization": "ЈП Железници на РСМ Инфраструктура",
      "publisher_type": "national_public_enterprise",
      "categories": [
        "rail"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://mzi.mk/возен-ред/",
        "https://mzi.mk/en/timetable/"
      ],
      "extract": [
        "Dated timetable revisions",
        "Published city-train timetable",
        "Rail infrastructure notices"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Document catalogue verified, actual timetable attachments not parsed.",
        "Static timetable is not a live arrival or delay feed."
      ],
      "evidence_urls": [
        "https://mzi.mk/возен-ред/",
        "https://mzi.mk/en/timetable/"
      ],
      "acquisition": "HTML document catalogue plus linked timetable files",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "amsm",
      "organization": "Авто–мото сојуз на Македонија — АМСМ",
      "publisher_type": "motoring_association",
      "categories": [
        "roads",
        "travel"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://amsm.mk/sostojba-na-patishta/"
      ],
      "extract": [
        "Dated road conditions",
        "Road closures and diversions",
        "Border-crossing updates",
        "Published Jasen crossing windows"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Primarily national/intercity roads; filter for the user's route.",
        "Do not infer street-level congestion from national road bulletin."
      ],
      "evidence_urls": [
        "https://amsm.mk/sostojba-na-patishta/"
      ],
      "acquisition": "HTML daily road bulletin",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "state_roads",
      "organization": "ЈП за државни патишта",
      "publisher_type": "national_public_enterprise",
      "categories": [
        "roads",
        "travel"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://roads.org.mk/odnosi-so-javnosta/izvestuvanja/",
        "https://roads.org.mk/"
      ],
      "extract": [
        "Major works and public-road notices",
        "Toll and access changes when relevant"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Filter out procurement and institutional staffing items.",
        "No public live traffic API verified."
      ],
      "evidence_urls": [
        "https://roads.org.mk/odnosi-so-javnosta/izvestuvanja/",
        "https://roads.org.mk/"
      ],
      "acquisition": "HTML notices and linked documents",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "skopje_airport",
      "organization": "TAV Македонија — Меѓународен Аеродром Скопје",
      "publisher_type": "commercial_airport_operator",
      "categories": [
        "flights",
        "travel"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://skp.airports.com.mk/en-EN/flights",
        "https://skp.airports.com.mk/en-EN/flights/arrival-flights"
      ],
      "extract": [
        "Flight schedule/status when validated",
        "Airport operational notices",
        "Airport ground-transport information"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Flight-page shell is readable; underlying flight data request and public API not validated.",
        "Airport lies outside the City's ten-municipality administrative boundary but is relevant to Skopje travelers."
      ],
      "evidence_urls": [
        "https://skp.airports.com.mk/en-EN/flights",
        "https://skp.airports.com.mk/en-EN/airport-facilities-services/page/information"
      ],
      "acquisition": "Dynamic flight pages; provider feed or validated public data request",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "a1",
      "organization": "А1 Македонија",
      "publisher_type": "commercial_telecom",
      "categories": [
        "internet",
        "mobile",
        "television"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://www.a1.mk/za-nas?_news_WAR_Newsroomportlet_category=218&_news_WAR_Newsroomportlet_jspPage=%2Fhtml%2Fa1%2Fnewsfrontend%2Fview.jsp&_news_WAR_Newsroomportlet_page=1&p_p_id=news_WAR_Newsroomportlet&p_p_lifecycle=0&p_p_mode=view&p_p_state=normal"
      ],
      "extract": [
        "Published service disruptions",
        "Restoration notices",
        "Network changes"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Outage articles were verified in the announcements archive; many describe already-restored events.",
        "No complete live network-status feed established."
      ],
      "evidence_urls": [
        "https://www.a1.mk/za-nas?_news_WAR_Newsroomportlet_category=218&_news_WAR_Newsroomportlet_jspPage=%2Fhtml%2Fa1%2Fnewsfrontend%2Fview.jsp&_news_WAR_Newsroomportlet_page=1&p_p_id=news_WAR_Newsroomportlet&p_p_lifecycle=0&p_p_mode=view&p_p_state=normal"
      ],
      "acquisition": "HTML announcements; distinguish retrospective outages from current issues",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "telekom",
      "organization": "Македонски Телеком",
      "publisher_type": "commercial_telecom",
      "categories": [
        "internet",
        "mobile",
        "television"
      ],
      "priority": "candidate",
      "source_urls": [
        "https://www.telekom.mk/pres-centar",
        "https://www.telekom.mk/kontakt-privatni"
      ],
      "extract": [
        "Material customer service notices"
      ],
      "verification": "indexed_official_page",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "No reliable public operational outage feed established; financial and press announcements are not network status.",
        "Direct press-centre retrieval failed here."
      ],
      "evidence_urls": [
        "https://www.telekom.mk/pres-centar",
        "https://www.telekom.mk/kontakt-privatni"
      ],
      "acquisition": "Provider contact/feed request or verified official customer notices",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "telekabel",
      "organization": "Телекабел",
      "publisher_type": "commercial_telecom",
      "categories": [
        "internet",
        "mobile",
        "television"
      ],
      "priority": "candidate",
      "source_urls": [
        "https://telekabel.com.mk/category/soopstenija/"
      ],
      "extract": [
        "Relevant published customer announcements"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Announcements category verified; complete outage coverage and live status not established."
      ],
      "evidence_urls": [
        "https://telekabel.com.mk/category/soopstenija/"
      ],
      "acquisition": "HTML announcements with service relevance filtering",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "aek",
      "organization": "Агенција за електронски комуникации — АЕК",
      "publisher_type": "national_regulator",
      "categories": [
        "telecom"
      ],
      "priority": "candidate",
      "source_urls": [
        "https://aek.mk/",
        "https://fm.aek.mk/"
      ],
      "extract": [
        "Potential fixed-network outage register",
        "Relevant regulator notices"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "AEK links a fixed-network interruption register; its access, timeliness and public data contents were not verified.",
        "Do not label the register an accessible live outage API."
      ],
      "evidence_urls": [
        "https://aek.mk/"
      ],
      "acquisition": "Investigate officially linked register without assuming public availability",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "city_skopje",
      "organization": "Град Скопје",
      "publisher_type": "city_government",
      "categories": [
        "roadworks",
        "local_services",
        "deadlines",
        "events"
      ],
      "priority": "core",
      "source_urls": [
        "https://skopje.gov.mk/mk/",
        "https://skopje.gov.mk/mk/apliciraj/javni-povici/",
        "https://skopje.gov.mk/mk/apliciraj/subvencii/"
      ],
      "extract": [
        "Citywide service changes",
        "Roadworks and restrictions",
        "Public events",
        "Application and subsidy deadlines"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Retrospective publicity is not a future operational event."
      ],
      "evidence_urls": [
        "https://skopje.gov.mk/mk/",
        "https://skopje.gov.mk/mk/apliciraj/javni-povici/",
        "https://skopje.gov.mk/mk/apliciraj/subvencii/"
      ],
      "acquisition": "HTML news, calls and subsidy notices",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "municipality_aerodrom",
      "organization": "Општина Аеродром",
      "publisher_type": "municipality",
      "categories": [
        "local_services",
        "roadworks",
        "cleaning",
        "schools",
        "deadlines",
        "events"
      ],
      "priority": "core",
      "source_urls": [
        "https://aerodrom.gov.mk/"
      ],
      "extract": [
        "Relevant local works",
        "Waste/cleaning/disinsection notices when published",
        "School and kindergarten notices",
        "Public calls and deadlines",
        "Local events and service-hour changes"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Homepage returned 403; official municipal documents were indexed."
      ],
      "evidence_urls": [
        "https://aerodrom.gov.mk/"
      ],
      "municipality": "Аеродром",
      "acquisition": "HTML announcements and linked documents; API/RSS not established",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "municipality_butel",
      "organization": "Општина Бутел",
      "publisher_type": "municipality",
      "categories": [
        "local_services",
        "roadworks",
        "cleaning",
        "schools",
        "deadlines",
        "events"
      ],
      "priority": "core",
      "source_urls": [
        "https://opstinabutel.gov.mk/"
      ],
      "extract": [
        "Relevant local works",
        "Waste/cleaning/disinsection notices when published",
        "School and kindergarten notices",
        "Public calls and deadlines",
        "Local events and service-hour changes"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [],
      "evidence_urls": [
        "https://opstinabutel.gov.mk/"
      ],
      "municipality": "Бутел",
      "acquisition": "HTML announcements and linked documents; API/RSS not established",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "municipality_gazi_baba",
      "organization": "Општина Гази Баба",
      "publisher_type": "municipality",
      "categories": [
        "local_services",
        "roadworks",
        "cleaning",
        "schools",
        "deadlines",
        "events"
      ],
      "priority": "core",
      "source_urls": [
        "https://gazibaba.gov.mk/"
      ],
      "extract": [
        "Relevant local works",
        "Waste/cleaning/disinsection notices when published",
        "School and kindergarten notices",
        "Public calls and deadlines",
        "Local events and service-hour changes"
      ],
      "verification": "indexed_official_page",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Direct retrieval was intermittent; verify operational access."
      ],
      "evidence_urls": [
        "https://gazibaba.gov.mk/"
      ],
      "municipality": "Гази Баба",
      "acquisition": "HTML announcements and linked documents; API/RSS not established",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "municipality_gjorce_petrov",
      "organization": "Општина Ѓорче Петров",
      "publisher_type": "municipality",
      "categories": [
        "local_services",
        "roadworks",
        "cleaning",
        "schools",
        "deadlines",
        "events"
      ],
      "priority": "core",
      "source_urls": [
        "https://opstinagpetrov.gov.mk/"
      ],
      "extract": [
        "Relevant local works",
        "Waste/cleaning/disinsection notices when published",
        "School and kindergarten notices",
        "Public calls and deadlines",
        "Local events and service-hour changes"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [],
      "evidence_urls": [
        "https://opstinagpetrov.gov.mk/"
      ],
      "municipality": "Ѓорче Петров",
      "acquisition": "HTML announcements and linked documents; API/RSS not established",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "municipality_karpos",
      "organization": "Општина Карпош",
      "publisher_type": "municipality",
      "categories": [
        "local_services",
        "roadworks",
        "cleaning",
        "schools",
        "deadlines",
        "events"
      ],
      "priority": "core",
      "source_urls": [
        "https://karpos.gov.mk/"
      ],
      "extract": [
        "Relevant local works",
        "Waste/cleaning/disinsection notices when published",
        "School and kindergarten notices",
        "Public calls and deadlines",
        "Local events and service-hour changes"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [],
      "evidence_urls": [
        "https://karpos.gov.mk/"
      ],
      "municipality": "Карпош",
      "acquisition": "HTML announcements and linked documents; API/RSS not established",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "municipality_kisela_voda",
      "organization": "Општина Кисела Вода",
      "publisher_type": "municipality",
      "categories": [
        "local_services",
        "roadworks",
        "cleaning",
        "schools",
        "deadlines",
        "events"
      ],
      "priority": "core",
      "source_urls": [
        "https://opstinakiselavoda.gov.mk/"
      ],
      "extract": [
        "Relevant local works",
        "Waste/cleaning/disinsection notices when published",
        "School and kindergarten notices",
        "Public calls and deadlines",
        "Local events and service-hour changes"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Some retrievals failed; readable article pages also contained unrelated footer links. Restrict extraction to article content."
      ],
      "evidence_urls": [
        "https://opstinakiselavoda.gov.mk/"
      ],
      "municipality": "Кисела Вода",
      "acquisition": "HTML announcements and linked documents; API/RSS not established",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "municipality_saraj",
      "organization": "Општина Сарај",
      "publisher_type": "municipality",
      "categories": [
        "local_services",
        "roadworks",
        "cleaning",
        "schools",
        "deadlines",
        "events"
      ],
      "priority": "core",
      "source_urls": [
        "https://saraj.gov.mk/?lang=mk"
      ],
      "extract": [
        "Relevant local works",
        "Waste/cleaning/disinsection notices when published",
        "School and kindergarten notices",
        "Public calls and deadlines",
        "Local events and service-hour changes"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [],
      "evidence_urls": [
        "https://saraj.gov.mk/?lang=mk"
      ],
      "municipality": "Сарај",
      "acquisition": "HTML announcements and linked documents; API/RSS not established",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "municipality_centar",
      "organization": "Општина Центар",
      "publisher_type": "municipality",
      "categories": [
        "local_services",
        "roadworks",
        "cleaning",
        "schools",
        "deadlines",
        "events"
      ],
      "priority": "core",
      "source_urls": [
        "https://www.centar.gov.mk/"
      ],
      "extract": [
        "Relevant local works",
        "Waste/cleaning/disinsection notices when published",
        "School and kindergarten notices",
        "Public calls and deadlines",
        "Local events and service-hour changes"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Public announcement board includes publication/deadline/closed-status fields; parse those explicitly."
      ],
      "evidence_urls": [
        "https://www.centar.gov.mk/"
      ],
      "municipality": "Центар",
      "acquisition": "HTML announcements and linked documents; API/RSS not established",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "municipality_cair",
      "organization": "Општина Чаир",
      "publisher_type": "municipality",
      "categories": [
        "local_services",
        "roadworks",
        "cleaning",
        "schools",
        "deadlines",
        "events"
      ],
      "priority": "core",
      "source_urls": [
        "https://cair.gov.mk/?lang=mk"
      ],
      "extract": [
        "Relevant local works",
        "Waste/cleaning/disinsection notices when published",
        "School and kindergarten notices",
        "Public calls and deadlines",
        "Local events and service-hour changes"
      ],
      "verification": "indexed_official_page",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Official indexed pages confirmed; direct retrieval failed in a research attempt."
      ],
      "evidence_urls": [
        "https://cair.gov.mk/?lang=mk"
      ],
      "municipality": "Чаир",
      "acquisition": "HTML announcements and linked documents; API/RSS not established",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "municipality_suto_orizari",
      "organization": "Општина Шуто Оризари",
      "publisher_type": "municipality",
      "categories": [
        "local_services",
        "roadworks",
        "cleaning",
        "schools",
        "deadlines",
        "events"
      ],
      "priority": "core",
      "source_urls": [
        "https://sutoorizari.gov.mk/"
      ],
      "extract": [
        "Relevant local works",
        "Waste/cleaning/disinsection notices when published",
        "School and kindergarten notices",
        "Public calls and deadlines",
        "Local events and service-hour changes"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [],
      "evidence_urls": [
        "https://sutoorizari.gov.mk/"
      ],
      "municipality": "Шуто Оризари",
      "acquisition": "HTML announcements and linked documents; API/RSS not established",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "uhmr",
      "organization": "Управа за хидрометеоролошки работи — УХМР",
      "publisher_type": "national_public_service",
      "categories": [
        "weather",
        "hydrology"
      ],
      "priority": "core",
      "source_urls": [
        "https://uhmr.gov.mk/",
        "https://uhmr.gov.mk/dneven-hidroloshki-izveshtaj/"
      ],
      "extract": [
        "Official forecasts",
        "Weather warnings",
        "Published daily hydrological reports"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Website returned 502 in web retrieval; hydrological report format, freshness and station coverage not established.",
        "Use the separately verified Meteoalarm channel for the structured official warning feed."
      ],
      "evidence_urls": [
        "https://alertingauthority.wmo.int/authorities.php?recId=91",
        "https://uhmr.gov.mk/"
      ],
      "acquisition": "Official HTML/PDF after access validation",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "meteoalarm_mk",
      "organization": "УХМР warnings via Meteoalarm",
      "publisher_type": "official_warning_distribution",
      "categories": [
        "weather_warning"
      ],
      "priority": "core",
      "source_urls": [
        "https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-republic-of-north-macedonia",
        "https://api.meteoalarm.org/"
      ],
      "extract": [
        "Warning identifier",
        "Area",
        "Severity",
        "Validity",
        "Instructions",
        "Updates/cancellations"
      ],
      "verification": "response_parsed",
      "public_api_status": "documented_atom_feed; other API access varies",
      "automated_fetch_tested": true,
      "limitations": [
        "Tested response had zero entries; this is not a guarantee of no hazards or complete warning coverage.",
        "Separate Meteoalarm API products may require API keys, tokens or approved redistribution access."
      ],
      "evidence_urls": [
        "https://alertingauthority.wmo.int/authorities.php?recId=91",
        "https://api.meteoalarm.org/"
      ],
      "acquisition": "Country Atom/XML warning feed",
      "transport_test": {
        "review_date": "2026-10-17",
        "http_status": 200,
        "content_type": "application/atom+xml; charset=utf-8",
        "parsed_root": "Atom feed",
        "feed_updated": "2026-10-17T09:35:02.520173Z",
        "entry_count": 0
      },
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "air_moepp",
      "organization": "МЖСПП — Државен автоматски мониторинг систем за квалитет на амбиентен воздух",
      "publisher_type": "national_public_service",
      "categories": [
        "air_quality"
      ],
      "priority": "core",
      "source_urls": [
        "https://air.moepp.gov.mk/",
        "https://air.moepp.gov.mk/Pages/DataOverview",
        "https://air.moepp.gov.mk/Pages/DayReports"
      ],
      "extract": [
        "Station measurements",
        "Measurement times",
        "Pollutants and units",
        "Published daily reports and exceedances"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Hourly values are explicitly unvalidated; retain quality status.",
        "Data overview has a downloadable-table UI but no stable documented external API was verified.",
        "Daily report publication date and measurement period may differ."
      ],
      "evidence_urls": [
        "https://air.moepp.gov.mk/",
        "https://air.moepp.gov.mk/Pages/DataOverview",
        "https://air.moepp.gov.mk/Pages/DayReports"
      ],
      "acquisition": "Interactive data tables/downloads plus daily reports; validate data request",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "seismology_skopje",
      "organization": "Сеизмолошка опсерваторија, ПМФ–УКИМ",
      "publisher_type": "public_university_institution",
      "categories": [
        "earthquakes"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://seismobsko.pmf.ukim.edu.mk/"
      ],
      "extract": [
        "Relevant felt-earthquake announcements"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Earthquake announcements report events; they do not forecast today's earthquakes."
      ],
      "evidence_urls": [
        "https://seismobsko.pmf.ukim.edu.mk/"
      ],
      "acquisition": "HTML announcements",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "pulse_eco",
      "organization": "pulse.eco",
      "publisher_type": "independent_environmental_platform",
      "categories": [
        "air_quality",
        "noise",
        "temperature",
        "humidity"
      ],
      "priority": "core",
      "source_urls": [
        "https://skopje.pulse.eco/",
        "https://pulse.eco/restapi"
      ],
      "extract": [
        "Sensor metadata",
        "Readings and measurement times",
        "PM10 and PM2.5",
        "Available temperature, humidity and noise"
      ],
      "verification": "documented_interface",
      "public_api_status": "documented_requires_authentication",
      "automated_fetch_tested": false,
      "limitations": [
        "Automated retrieval requires an account and HTTP Basic authorization according to the official API documentation.",
        "Fair-use throttling applies; no authenticated request tested.",
        "Crowdsourced/sensor-source quality varies; retain source type and do not equate all readings with validated official stations."
      ],
      "evidence_urls": [
        "https://pulse.eco/restapi",
        "https://novoselo.pulse.eco/restapi"
      ],
      "acquisition": "Documented REST JSON API after account setup",
      "documented_endpoints": [
        "https://skopje.pulse.eco/rest/sensor",
        "https://skopje.pulse.eco/rest/current",
        "https://skopje.pulse.eco/rest/data24h"
      ],
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "open_meteo",
      "organization": "Open-Meteo",
      "publisher_type": "independent_weather_provider",
      "categories": [
        "weather_forecast"
      ],
      "priority": "core",
      "source_urls": [
        "https://open-meteo.com/en/docs",
        "https://open-meteo.com/en/terms"
      ],
      "extract": [
        "Hourly temperature and precipitation probability",
        "Daily minima/maxima",
        "Sunrise/sunset",
        "Wind and other requested forecast variables"
      ],
      "verification": "response_parsed",
      "public_api_status": "documented; free noncommercial access tested",
      "automated_fetch_tested": true,
      "limitations": [
        "Hosted free API is for noncommercial use; ads/subscriptions and other commercial use require appropriate commercial access.",
        "Model output is not a local weather-station observation or an official emergency warning.",
        "Attribute data as required by provider terms."
      ],
      "evidence_urls": [
        "https://open-meteo.com/en/docs",
        "https://open-meteo.com/en/terms"
      ],
      "acquisition": "REST JSON forecast API",
      "documented_endpoints": [
        "https://api.open-meteo.com/v1/forecast"
      ],
      "sample_request_url": "https://api.open-meteo.com/v1/forecast?latitude=41.9981&longitude=21.4254&hourly=temperature_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&forecast_days=1&timezone=Europe%2FSkopje",
      "transport_test": {
        "review_date": "2026-10-17",
        "http_status": 200,
        "content_type": "application/json; charset=utf-8",
        "timezone": "Europe/Skopje",
        "hourly_slots": 24,
        "daily_slots": 1
      },
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "emsc",
      "organization": "EMSC / SeismicPortal",
      "publisher_type": "international_seismic_provider",
      "categories": [
        "earthquakes"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://www.seismicportal.eu/fdsn-wsevent.html",
        "https://www.seismicportal.eu/fdsnws/event/1/openapi.json"
      ],
      "extract": [
        "Event time",
        "Location",
        "Magnitude",
        "Depth",
        "Revision identifiers"
      ],
      "verification": "documented_interface",
      "public_api_status": "documented",
      "automated_fetch_tested": false,
      "limitations": [
        "OpenAPI specification inspected; actual event-data request not validated here.",
        "Reported earthquakes are not forecasts."
      ],
      "evidence_urls": [
        "https://www.seismicportal.eu/fdsn-wsevent.html",
        "https://www.seismicportal.eu/fdsnws/event/1/openapi.json"
      ],
      "acquisition": "Documented FDSN event service with JSON/QuakeML/text formats",
      "documented_endpoints": [
        "https://www.seismicportal.eu/fdsnws/event/1/query"
      ],
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "cuk",
      "organization": "Центар за управување со кризи / РЦУК Скопје",
      "publisher_type": "national_public_service",
      "categories": [
        "emergencies",
        "hazards"
      ],
      "priority": "core",
      "source_urls": [
        "https://cuk.gov.mk/",
        "https://cuk.gov.mk/Page/About/Regional-Centers"
      ],
      "extract": [
        "Official incident and public-safety announcements when available",
        "Relevant regional bulletins"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Research homepage surfaced administrative posts; a complete current operational bulletin feed was not established.",
        "An empty active-alert area is not an all-clear.",
        "Confirm reliable official publishing channel before enabling automated emergency summaries."
      ],
      "evidence_urls": [
        "https://cuk.gov.mk/",
        "https://cuk.gov.mk/Page/About/Regional-Centers"
      ],
      "acquisition": "Official notices/confirmed bulletin channel; partnership candidate",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "mvr",
      "organization": "МВР / СВР Скопје",
      "publisher_type": "national_public_service",
      "categories": [
        "traffic",
        "public_safety",
        "customer_services"
      ],
      "priority": "core",
      "source_urls": [
        "https://mvr.gov.mk/mk-MK/odnosi-so-javnost/novosti"
      ],
      "extract": [
        "Planned traffic restrictions",
        "Event and delegation-related road closures",
        "Relevant administrative service changes"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Use the article body's effective date; URLs can contain inconsistent dates.",
        "Select forward-relevant service information; the general incident bulletin is not a complete live incident map."
      ],
      "evidence_urls": [
        "https://mvr.gov.mk/mk-MK/odnosi-so-javnost/novosti"
      ],
      "acquisition": "HTML news with Skopje/time/service filtering",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "fzo_pharmacies",
      "organization": "Фонд за здравствено осигурување — ФЗО",
      "publisher_type": "national_public_service",
      "categories": [
        "pharmacies"
      ],
      "priority": "core",
      "source_urls": [
        "https://fzo.org.mk/dezurni-apteki"
      ],
      "extract": [
        "Published monthly duty-pharmacy schedule, once retrieved and validated"
      ],
      "verification": "indexed_official_page",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Official index listed October 2026, but direct pages returned 403.",
        "Actual October schedule, attachment format, pharmacy rows and duty times were not retrieved.",
        "Do not claim a pharmacy is on duty until that specific schedule is validated; no medicine-stock data established."
      ],
      "evidence_urls": [
        "https://fzo.org.mk/dezurni-apteki"
      ],
      "acquisition": "Monthly schedule publication; retrieval and format still to be validated",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "iph",
      "organization": "Институт за јавно здравје — ИЈЗ",
      "publisher_type": "national_public_health",
      "categories": [
        "public_health"
      ],
      "priority": "core",
      "source_urls": [
        "https://iph.mk/",
        "https://iph.mk/mk/home/news/1"
      ],
      "extract": [
        "Public-health alerts",
        "Vaccination announcements",
        "Relevant surveillance summaries"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Check source publication and reporting periods; do not turn weekly statistics into a live individual risk estimate.",
        "No verified pollen feed."
      ],
      "evidence_urls": [
        "https://iph.mk/",
        "https://iph.mk/mk/home/news/1"
      ],
      "acquisition": "HTML notices and linked reports",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "iph_healthalert",
      "organization": "ИЈЗ — HealthAlert map",
      "publisher_type": "national_public_health",
      "categories": [
        "public_health"
      ],
      "priority": "candidate",
      "source_urls": [
        "https://healthalert.mk/"
      ],
      "extract": [
        "Potential geographically relevant West Nile information"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Linked by IPH; actual map data/API and current content were not inspected."
      ],
      "evidence_urls": [
        "https://iph.mk/"
      ],
      "acquisition": "Map/provider interface to validate",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "cph_skopje",
      "organization": "Центар за јавно здравје Скопје",
      "publisher_type": "public_health_institution",
      "categories": [
        "public_health",
        "sanitation"
      ],
      "priority": "candidate",
      "source_urls": [
        "https://cph.mk/"
      ],
      "extract": [
        "Local public-health and service notices when the publisher is active"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Homepage returned a Coming Soon page; current operational publishing not established."
      ],
      "evidence_urls": [
        "https://cph.mk/"
      ],
      "acquisition": "Verify replacement/current official publication channel",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "zds",
      "organization": "Здравствен дом Скопје",
      "publisher_type": "public_health_institution",
      "categories": [
        "health_services"
      ],
      "priority": "candidate",
      "source_urls": [
        "https://zds.mk/",
        "https://zds.mk/служба-за-итна/",
        "https://zds.mk/kontakt/"
      ],
      "extract": [
        "Polyclinic/service directory",
        "Published night/holiday care information"
      ],
      "verification": "indexed_official_page",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "No trustworthy current duty rota retrieved.",
        "Some page content was malformed or unrelated and homepage access failed; manually validate service details before showing them as current."
      ],
      "evidence_urls": [
        "https://zds.mk/",
        "https://zds.mk/служба-за-итна/",
        "https://zds.mk/kontakt/"
      ],
      "acquisition": "Validated directory/link-out; obtain current rota directly",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "moj_termin",
      "organization": "Мој Термин",
      "publisher_type": "national_public_health_platform",
      "categories": [
        "health_services"
      ],
      "priority": "background",
      "source_urls": [
        "https://mojtermin.mk/map/ustanovi",
        "https://mojtermin.mk/map"
      ],
      "extract": [
        "Health institution directory",
        "Official public appointment-page link-outs"
      ],
      "verification": "indexed_official_page",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "No appointment-booking integration or availability API verified.",
        "Do not reuse cached availability as current availability; no patient data needed for this newsletter."
      ],
      "evidence_urls": [
        "https://mojtermin.mk/map/ustanovi",
        "https://mojtermin.mk/map"
      ],
      "acquisition": "Directory and public-service link-out",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "ahv",
      "organization": "Агенција за храна и ветеринарство — АХВ",
      "publisher_type": "national_public_service",
      "categories": [
        "food_recall",
        "public_health"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://fva.gov.mk/mk/izvestuvanje-otpovikuvanje-nebezbedni-proizvodi?page=0",
        "https://fva.gov.mk/"
      ],
      "extract": [
        "Food/product recalls",
        "Exact product, lot and date details"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Check category and homepage for freshness; preserve precise affected product identifiers."
      ],
      "evidence_urls": [
        "https://fva.gov.mk/mk/izvestuvanje-otpovikuvanje-nebezbedni-proizvodi?page=0",
        "https://fva.gov.mk/"
      ],
      "acquisition": "HTML recall notices",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "mon",
      "organization": "Министерство за образование и наука — МОН",
      "publisher_type": "national_government",
      "categories": [
        "schools",
        "deadlines"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://mon.gov.mk/mk-MK/propisi/kalendari",
        "https://mon.gov.mk/"
      ],
      "extract": [
        "School-year calendars",
        "School breaks",
        "Enrollment/scholarship deadlines"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Linked calendar documents need individual validation.",
        "Individual school/kindergarten exceptions need local publishers."
      ],
      "evidence_urls": [
        "https://mon.gov.mk/mk-MK/propisi/kalendari",
        "https://mon.gov.mk/"
      ],
      "acquisition": "HTML announcement index and linked calendar documents",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "holidays",
      "organization": "Министерство за економија и труд — неработни денови",
      "publisher_type": "national_government",
      "categories": [
        "holidays"
      ],
      "priority": "core",
      "source_urls": [
        "https://www.economy.gov.mk/build/assets/programa-nerabotni-denovi-2026-MHaAbYyO.pdf"
      ],
      "extract": [
        "Official 2026 nonworking-day programme"
      ],
      "verification": "document_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Different holidays apply to different communities; do not assume all closures apply to every user.",
        "Apparent typo in a substitute-day sentence requires manual validation.",
        "Operator holiday hours still require operator-specific notices.",
        "Discover and validate each subsequent year's programme."
      ],
      "evidence_urls": [
        "https://www.economy.gov.mk/build/assets/programa-nerabotni-denovi-2026-MHaAbYyO.pdf"
      ],
      "acquisition": "Annual PDF, human-validated calendar",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "ujp",
      "organization": "Управа за јавни приходи — УЈП",
      "publisher_type": "national_government",
      "categories": [
        "deadlines"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://www.ujp.gov.mk/mk/kalendar/pregled/mesec?print=1"
      ],
      "extract": [
        "Relevant tax-calendar deadlines",
        "Taxpayer category",
        "Forms and official links"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Opt in by relevant taxpayer category; do not infer personal obligations from a general calendar alone."
      ],
      "evidence_urls": [
        "https://www.ujp.gov.mk/mk/kalendar/pregled/mesec?print=1"
      ],
      "acquisition": "HTML monthly calendar",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "uslugi",
      "organization": "Национален портал за е-услуги",
      "publisher_type": "national_government_platform",
      "categories": [
        "public_services"
      ],
      "priority": "background",
      "source_urls": [
        "https://uslugi.gov.mk/"
      ],
      "extract": [
        "Official service catalogue and link-outs"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Officially linked by ministries; direct retrieval timed out.",
        "This is a directory/workflow destination, not a verified daily service-status feed."
      ],
      "evidence_urls": [
        "https://mon.gov.mk/mk-MK/propisi/kalendari",
        "https://uslugi.gov.mk/"
      ],
      "acquisition": "Service catalogue/link-out",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "posta",
      "organization": "АД Пошта на Северна Македонија",
      "publisher_type": "national_postal_operator",
      "categories": [
        "postal_services"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://www.posta.com.mk/",
        "https://www.posta.com.mk/работно-време-на-единици-на-поштенска/"
      ],
      "extract": [
        "Published branch hours",
        "Holiday and service changes"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Hours-page announcement is older; validate its linked current schedule before claiming a branch is open today.",
        "No live queue or parcel-status integration established."
      ],
      "evidence_urls": [
        "https://www.posta.com.mk/",
        "https://www.posta.com.mk/работно-време-на-единици-на-поштенска/"
      ],
      "acquisition": "HTML notices and linked branch-hour documents",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "city_culture",
      "organization": "Град Скопје — портал Култура",
      "publisher_type": "city_government_platform",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://kultura.skopje.gov.mk/",
        "https://kultura.skopje.gov.mk/за-нас/"
      ],
      "extract": [
        "Institution discovery",
        "Published city cultural events"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Aggregator's visible latest posts were older than several institution websites; do not rely on it as a complete daily calendar."
      ],
      "evidence_urls": [
        "https://kultura.skopje.gov.mk/",
        "https://kultura.skopje.gov.mk/за-нас/"
      ],
      "acquisition": "HTML aggregator plus institution-specific sources",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "mkc",
      "organization": "Младински културен центар — МКЦ",
      "publisher_type": "city_public_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://mkc.mk/",
        "https://kinomilenium.mk/"
      ],
      "extract": [
        "Concerts",
        "Workshops",
        "Cinema",
        "Planetarium sessions"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Own-site retrieval failed; City profile verifies activities and URL. Includes Kino Milenium and planetarium services."
      ],
      "evidence_urls": [
        "https://kultura.skopje.gov.mk/младински-културен-центар/",
        "https://mkc.mk/",
        "https://skopje.gov.mk/mk/skopje/kulturni-ustanovi/"
      ],
      "acquisition": "HTML institution events and notices; structured feed not verified",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "universal_hall",
      "organization": "ЈУ Универзална сала",
      "publisher_type": "city_public_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://www.univerzalna.com.mk/"
      ],
      "extract": [
        "Institution-organized city festivals and cultural events"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "City profile describes programming outside the building during reconstruction; do not imply the hall is open."
      ],
      "evidence_urls": [
        "https://kultura.skopje.gov.mk/универзална-сала/",
        "https://www.univerzalna.com.mk/"
      ],
      "acquisition": "HTML institution events and notices; structured feed not verified",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "zoo",
      "organization": "ЈУ Зоолошка градина Скопје",
      "publisher_type": "city_public_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://zooskopje.com.mk/"
      ],
      "extract": [
        "Visiting information",
        "Published closures and hours",
        "Educational events"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Official URL confirmed through City; current website retrieval timed out."
      ],
      "evidence_urls": [
        "https://kultura.skopje.gov.mk/зоолошка-градина-скопје/",
        "https://zooskopje.com.mk/"
      ],
      "acquisition": "HTML institution events and notices; structured feed not verified",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "city_library",
      "organization": "Градска библиотека Браќа Миладиновци",
      "publisher_type": "city_public_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://www.gbsk.mk/"
      ],
      "extract": [
        "Branch-hour changes",
        "Literary events",
        "Bibliobus information when published"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Use the newer City Culture profile for current site discovery; older City directories contain different domains. Own-site retrieval timed out."
      ],
      "evidence_urls": [
        "https://kultura.skopje.gov.mk/библиотека-браќа-миладиновци/",
        "https://www.gbsk.mk/"
      ],
      "acquisition": "HTML institution events and notices; structured feed not verified",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "kic",
      "organization": "Културно-информативен центар — КИЦ",
      "publisher_type": "city_public_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://kic.mk/"
      ],
      "extract": [
        "Exhibitions",
        "Talks",
        "Concerts",
        "Cultural programmes"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Visible event listings were from 2019–2020; a current daily programme is not established."
      ],
      "evidence_urls": [
        "https://kultura.skopje.gov.mk/културно-информативен-центар/",
        "https://kic.mk/"
      ],
      "acquisition": "HTML institution events and notices; structured feed not verified",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "city_museum",
      "organization": "Музеј на град Скопје",
      "publisher_type": "city_public_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://museumskopje.mk/"
      ],
      "extract": [
        "Exhibitions",
        "Workshops",
        "Visiting hours and exceptions"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Homepage read; visible events section was not a verified complete current exhibition calendar."
      ],
      "evidence_urls": [
        "https://kultura.skopje.gov.mk/музеј-на-град-скопје/",
        "https://museumskopje.mk/"
      ],
      "acquisition": "HTML institution events and notices; structured feed not verified",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "dkc_karpos",
      "organization": "Детски културен центар Карпош",
      "publisher_type": "city_public_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://dkckarpos.org.mk/index.php/mk/"
      ],
      "extract": [
        "Children's activities",
        "Workshops",
        "Enrollment and festivals"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Dated October 2026 posts were visible; event dates still need article-level parsing."
      ],
      "evidence_urls": [
        "https://kultura.skopje.gov.mk/детски-културен-центар-карпош/",
        "https://dkckarpos.org.mk/index.php/mk/"
      ],
      "acquisition": "HTML institution events and notices; structured feed not verified",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "koco_racin",
      "organization": "Дом на култура Кочо Рацин",
      "publisher_type": "city_public_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://dk-kocoracin.org.mk/"
      ],
      "extract": [
        "Literary",
        "Art",
        "Educational",
        "Music and folklore events"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Officially linked site read; no structured daily calendar/API established."
      ],
      "evidence_urls": [
        "https://kultura.skopje.gov.mk/дом-на-култура-кочо-рацин/",
        "https://dk-kocoracin.org.mk/"
      ],
      "acquisition": "HTML institution events and notices; structured feed not verified",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "national_opera_ballet",
      "organization": "Национална опера и балет",
      "publisher_type": "national_public_cultural_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://operabalet.mk/events/",
        "https://operabalet.mk/events/?ical=1"
      ],
      "extract": [
        "Performances",
        "Date/time",
        "Venue",
        "Official booking links"
      ],
      "verification": "response_parsed",
      "public_api_status": "published_icalendar_export",
      "automated_fetch_tested": true,
      "limitations": [
        "The feed exports listed events; completeness across all future performances is not established.",
        "Basic calendar/component structure checked; full RFC validation and production adapter not implemented."
      ],
      "evidence_urls": [
        "https://operabalet.mk/events/",
        "https://kultura.gov.mk/mk-MK/kontakt/institucii"
      ],
      "acquisition": "Tested public iCalendar export of listed events; HTML events as supporting source",
      "transport_test": {
        "review_date": "2026-10-17",
        "http_status": 200,
        "content_type": "text/calendar; charset=UTF-8",
        "calendar_version": "2.0",
        "calendar_components": 1,
        "event_components": 2,
        "uid_properties": 2,
        "dtstart_properties": 2
      },
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "philharmonic",
      "organization": "НУ Филхармонија",
      "publisher_type": "national_public_cultural_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://www.filharmonija.mk/nastani-i-bileti/"
      ],
      "extract": [
        "Concerts",
        "Programme",
        "Date/time",
        "Ticket links"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Programme pages found; ticket availability is not established merely by a link."
      ],
      "evidence_urls": [
        "https://www.filharmonija.mk/nastani-i-bileti/",
        "https://kultura.gov.mk/mk-MK/kontakt/institucii"
      ],
      "acquisition": "HTML programme/events; API/RSS/iCalendar not verified",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "mnt",
      "organization": "Македонски народен театар",
      "publisher_type": "national_public_cultural_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://mnt.mk/"
      ],
      "extract": [
        "Repertoire and performance notices"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Official directory confirms URL; direct retrieval failed."
      ],
      "evidence_urls": [
        "https://mnt.mk/",
        "https://kultura.gov.mk/mk-MK/kontakt/institucii"
      ],
      "acquisition": "HTML programme/events; API/RSS/iCalendar not verified",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "dramski",
      "organization": "Драмски театар Скопје",
      "publisher_type": "national_public_cultural_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://dramski.mk/programa/"
      ],
      "extract": [
        "Theatre programme and performance times"
      ],
      "verification": "indexed_official_page",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Current official domain verified; no public API established."
      ],
      "evidence_urls": [
        "https://dramski.mk/programa/",
        "https://kultura.gov.mk/mk-MK/kontakt/institucii"
      ],
      "acquisition": "HTML programme/events; API/RSS/iCalendar not verified",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "comedy_theatre",
      "organization": "Театар Комедија",
      "publisher_type": "national_public_cultural_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://teatarkomedija.mk/"
      ],
      "extract": [
        "Monthly repertoire",
        "Performance dates"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "October/November 2026 repertoire links were visible."
      ],
      "evidence_urls": [
        "https://teatarkomedija.mk/",
        "https://kultura.gov.mk/mk-MK/kontakt/institucii"
      ],
      "acquisition": "HTML programme/events; API/RSS/iCalendar not verified",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "kinoteka",
      "organization": "Кинотека",
      "publisher_type": "national_public_cultural_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://kinoteka.mk/category/programa/"
      ],
      "extract": [
        "Film programme",
        "Screening times",
        "Venue"
      ],
      "verification": "indexed_official_page",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Programme/calendar pages indexed; homepage retrieval returned 403."
      ],
      "evidence_urls": [
        "https://kinoteka.mk/category/programa/",
        "https://kultura.gov.mk/mk-MK/kontakt/institucii"
      ],
      "acquisition": "HTML programme/events; API/RSS/iCalendar not verified",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "msu",
      "organization": "Музеј на современа уметност",
      "publisher_type": "national_public_cultural_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://msu.mk/"
      ],
      "extract": [
        "Exhibition start/end dates",
        "Museum events"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Current dated exhibitions visible; validate venue and opening exceptions."
      ],
      "evidence_urls": [
        "https://msu.mk/",
        "https://kultura.gov.mk/mk-MK/kontakt/institucii"
      ],
      "acquisition": "HTML programme/events; API/RSS/iCalendar not verified",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "national_gallery",
      "organization": "Национална галерија",
      "publisher_type": "national_public_cultural_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://nationalgallery.mk/"
      ],
      "extract": [
        "Exhibitions",
        "Dates",
        "Specific gallery venue"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Some institution news concerns exhibitions outside Skopje; filter actual event venue."
      ],
      "evidence_urls": [
        "https://nationalgallery.mk/",
        "https://kultura.gov.mk/mk-MK/kontakt/institucii"
      ],
      "acquisition": "HTML programme/events; API/RSS/iCalendar not verified",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "national_library",
      "organization": "НУБ Св. Климент Охридски",
      "publisher_type": "national_public_cultural_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "background",
      "source_urls": [
        "https://nubsk.edu.mk/"
      ],
      "extract": [
        "Relevant events or programme",
        "Published opening exceptions"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Official institution/URL discovery only; current calendar completeness and automated retrieval not validated."
      ],
      "evidence_urls": [
        "https://kultura.gov.mk/mk-MK/kontakt/institucii",
        "https://nubsk.edu.mk/"
      ],
      "acquisition": "Institution website after verification",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "tanec",
      "organization": "Танец",
      "publisher_type": "national_public_cultural_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "background",
      "source_urls": [
        "https://tanec.mk/"
      ],
      "extract": [
        "Relevant events or programme",
        "Published opening exceptions"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Official institution/URL discovery only; current calendar completeness and automated retrieval not validated."
      ],
      "evidence_urls": [
        "https://kultura.gov.mk/mk-MK/kontakt/institucii",
        "https://tanec.mk/"
      ],
      "acquisition": "Institution website after verification",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "archaeological_museum",
      "organization": "Археолошки музеј",
      "publisher_type": "national_public_cultural_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "background",
      "source_urls": [
        "https://amm.org.mk/"
      ],
      "extract": [
        "Relevant events or programme",
        "Published opening exceptions"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Official institution/URL discovery only; current calendar completeness and automated retrieval not validated."
      ],
      "evidence_urls": [
        "https://kultura.gov.mk/mk-MK/kontakt/institucii",
        "https://amm.org.mk/"
      ],
      "acquisition": "Institution website after verification",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "museum_north_macedonia",
      "organization": "Музеј на Северна Македонија",
      "publisher_type": "national_public_cultural_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "background",
      "source_urls": [
        "https://museum.org.mk/"
      ],
      "extract": [
        "Relevant events or programme",
        "Published opening exceptions"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Official institution/URL discovery only; current calendar completeness and automated retrieval not validated."
      ],
      "evidence_urls": [
        "https://kultura.gov.mk/mk-MK/kontakt/institucii",
        "https://museum.org.mk/"
      ],
      "acquisition": "Institution website after verification",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "museum_macedonian_struggle",
      "organization": "Музеј на македонската борба",
      "publisher_type": "national_public_cultural_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "background",
      "source_urls": [
        "https://www.mmb.org.mk/"
      ],
      "extract": [
        "Relevant events or programme",
        "Published opening exceptions"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Official institution/URL discovery only; current calendar completeness and automated retrieval not validated."
      ],
      "evidence_urls": [
        "https://kultura.gov.mk/mk-MK/kontakt/institucii",
        "https://www.mmb.org.mk/"
      ],
      "acquisition": "Institution website after verification",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "turkish_theatre",
      "organization": "Турски театар",
      "publisher_type": "national_public_cultural_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "background",
      "source_urls": [
        "https://www.turktiyatrosu.mk/"
      ],
      "extract": [
        "Relevant events or programme",
        "Published opening exceptions"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Official institution/URL discovery only; current calendar completeness and automated retrieval not validated."
      ],
      "evidence_urls": [
        "https://kultura.gov.mk/mk-MK/kontakt/institucii",
        "https://www.turktiyatrosu.mk/"
      ],
      "acquisition": "Institution website after verification",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "albanian_theatre",
      "organization": "Албански театар",
      "publisher_type": "national_public_cultural_institution",
      "categories": [
        "culture",
        "events"
      ],
      "priority": "background",
      "source_urls": [
        "https://www.teatri.mk/mk/repertoar/kalendar"
      ],
      "extract": [
        "Relevant events or programme",
        "Published opening exceptions"
      ],
      "verification": "official_directory",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Official institution/URL discovery only; current calendar completeness and automated retrieval not validated."
      ],
      "evidence_urls": [
        "https://kultura.gov.mk/mk-MK/kontakt/institucii",
        "https://www.teatri.mk/mk/repertoar/kalendar"
      ],
      "acquisition": "Institution website after verification",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "boris_trajkovski",
      "organization": "Спортски центар Борис Трајковски / T Arena",
      "publisher_type": "public_sports_facility",
      "categories": [
        "sports",
        "facilities",
        "events"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://www.scboristrajkovski.gov.mk/",
        "https://scboristrajkovski.gov.mk/index.php/nastani",
        "https://www.scboristrajkovski.gov.mk/index.php/soopshtenija"
      ],
      "extract": [
        "Facility/pool maintenance",
        "Opening-hour changes",
        "Sports events"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Visible notices included April 2025 and older items; current daily opening/event coverage not established."
      ],
      "evidence_urls": [
        "https://www.scboristrajkovski.gov.mk/",
        "https://scboristrajkovski.gov.mk/index.php/nastani",
        "https://www.scboristrajkovski.gov.mk/index.php/soopshtenija"
      ],
      "acquisition": "HTML notices; seek current schedule source",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "red_cross_skopje",
      "organization": "Црвен крст на Град Скопје",
      "publisher_type": "humanitarian_organization",
      "categories": [
        "blood_donation",
        "community",
        "social_services"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://ckgs.org.mk/category/novosti/",
        "https://ckgs.org.mk/dejnosti/krvodaritelstvo/"
      ],
      "extract": [
        "Upcoming blood drives",
        "Volunteering and training",
        "Relevant support/service changes"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "News was current to October 2026, but an undated blood-centre page contains conflicting hours; validate hours separately."
      ],
      "evidence_urls": [
        "https://ckgs.org.mk/category/novosti/",
        "https://ckgs.org.mk/dejnosti/krvodaritelstvo/"
      ],
      "acquisition": "Dated HTML news/events",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "transfusion_medicine",
      "organization": "Институт за трансфузиона медицина",
      "publisher_type": "public_health_institution",
      "categories": [
        "blood_donation"
      ],
      "priority": "candidate",
      "source_urls": [
        "https://itm.org.mk/",
        "https://itm.org.mk/неделен-распоред-на-крводарителски-а/"
      ],
      "extract": [
        "Current donation schedule if obtained",
        "Donor service changes"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Visible planned-action schedule was from 2019 and linked weekly article from 2020; not suitable as today's schedule."
      ],
      "evidence_urls": [
        "https://itm.org.mk/",
        "https://itm.org.mk/неделен-распоред-на-крводарителски-а/"
      ],
      "acquisition": "Obtain current validated schedule; do not automate stale schedule",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "protection_rescue",
      "organization": "Дирекција за заштита и спасување",
      "publisher_type": "national_public_service",
      "categories": [
        "emergencies",
        "hazards"
      ],
      "priority": "candidate",
      "source_urls": [
        "https://dzs.gov.mk/Pages/News/Default.cshtml",
        "https://dzs.gov.mk/Default.cshtml"
      ],
      "extract": [
        "Official preparedness or public safety notices"
      ],
      "verification": "indexed_official_page",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Direct retrieval failed; current operational feed not established."
      ],
      "evidence_urls": [
        "https://dzs.gov.mk/Pages/News/Default.cshtml",
        "https://dzs.gov.mk/Default.cshtml"
      ],
      "acquisition": "Official notices after access validation",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    },
    {
      "id": "erc",
      "organization": "Регулаторна комисија за енергетика, водни услуги и услуги за управување со комунален отпад — РКЕ",
      "publisher_type": "national_regulator",
      "categories": [
        "fuel_prices",
        "utility_tariffs"
      ],
      "priority": "personalized",
      "source_urls": [
        "https://www.erc.org.mk/page.aspx?id=290",
        "https://www.erc.org.mk/page.aspx?id=343",
        "https://www.erc.org.mk/"
      ],
      "extract": [
        "Published maximum retail fuel prices",
        "Effective date/time",
        "Relevant tariff changes"
      ],
      "verification": "page_read",
      "public_api_status": "not_verified",
      "automated_fetch_tested": false,
      "limitations": [
        "Actual fuel notice PDF was verified; automated discovery from section pages not established.",
        "These are maximum retail prices, not live prices at individual stations."
      ],
      "evidence_urls": [
        "https://www.erc.org.mk/page.aspx?id=290",
        "https://www.erc.org.mk/page.aspx?id=343",
        "https://www.erc.org.mk/"
      ],
      "acquisition": "Official notice/PDF discovery and parsing",
      "review_date": "2026-10-17",
      "adapter_implemented": false
    }
  ],
  "official_directories": [
    {
      "title": "City of Skopje public enterprises",
      "url": "https://skopje.gov.mk/mk/skopje/javni-pretprijatija/",
      "use": "Verified eight-enterprise baseline and official links; do not reuse historical descriptive statistics as current."
    },
    {
      "title": "Municipal/City public-enterprise information-holder register",
      "url": "https://aspi.mk/imateli/201/",
      "use": "Find additional municipal enterprises and official information contacts; listing does not establish a digital feed."
    },
    {
      "title": "City public cultural institutions",
      "url": "https://skopje.gov.mk/mk/skopje/kulturni-ustanovi/",
      "use": "Eight-institution baseline; older linked domains should be cross-checked against newer City Culture profiles."
    },
    {
      "title": "City Culture",
      "url": "https://kultura.skopje.gov.mk/",
      "use": "Current institution profiles and discovery; not established as a complete daily event calendar."
    },
    {
      "title": "Ministry of Culture and Tourism institutions",
      "url": "https://kultura.gov.mk/mk-MK/kontakt/institucii",
      "use": "Expand national cultural venues in Skopje; verify individual site/domain and event freshness."
    },
    {
      "title": "Public health institution map",
      "url": "https://mojtermin.mk/map/ustanovi",
      "use": "Expand clinic/institution directory; no booking integration or current availability extraction established."
    }
  ],
  "coverage_gaps": [
    "Current provider/publisher coverage for the separate Skopje Sever heating network was not established.",
    "EVN/Elektrodistribucija dynamic outage-data request, freshness and complete incident coverage remain unverified.",
    "Official public JSP GTFS, live vehicle positions and live arrival access were not verified.",
    "Complete operator-by-operator private city bus feeds were not established; JSP publishes some integrated notices.",
    "Address-specific waste collection schedules and public live parking occupancy were not verified.",
    "Reliable current operational CUK bulletin/channel still needs confirmation despite the official portal being reachable.",
    "Actual monthly FZO duty-pharmacy rows remain inaccessible/unvalidated.",
    "Current health-service duty rotas and a reliable local pollen feed were not established.",
    "Several cultural, health and sports websites expose old schedules; current service/opening state must be validated.",
    "Aerodrom public-lighting enterprise and older Kisela Voda sports-enterprise names need current identity/relationship checks before adding separate organization records.",
    "Makedonija Pat's current primary operational notice feed was not verified.",
    "Neighboring municipalities, individual schools/kindergartens/clinics, small telecom providers and Red Cross municipal branches need separate expansion if the product promises those specific service areas."
  ],
  "recommended_integration_order": [
    {
      "stage": 1,
      "goal": "First dependable briefing content",
      "source_ids": [
        "water_skopje",
        "heat_distribution",
        "streets_roads",
        "jsp",
        "mvr",
        "meteoalarm_mk",
        "open_meteo"
      ],
      "note": "Implement and validate HTML parsers. Respect source reuse conditions; HTML discovery alone is not operational completion."
    },
    {
      "stage": 2,
      "goal": "Complete essential local conditions",
      "source_ids": [
        "electricity_distribution",
        "air_moepp",
        "pulse_eco",
        "water_gazi_baba",
        "cuk"
      ],
      "note": "Resolve dynamic endpoints, account access and operational bulletin coverage."
    },
    {
      "stage": 3,
      "goal": "Location-specific local services",
      "source_ids": [
        "city_skopje",
        "municipality_aerodrom",
        "municipality_butel",
        "municipality_gazi_baba",
        "municipality_gjorce_petrov",
        "municipality_karpos",
        "municipality_kisela_voda",
        "municipality_saraj",
        "municipality_centar",
        "municipality_cair",
        "municipality_suto_orizari",
        "waste_skopje",
        "city_parking",
        "poc",
        "fzo_pharmacies"
      ],
      "note": "Filter by saved places/routes. Enable pharmacy duty cards only after current schedule validation."
    },
    {
      "stage": 4,
      "goal": "Interests and optional daily planning",
      "source_ids": [
        "national_opera_ballet",
        "philharmonic",
        "comedy_theatre",
        "mkc",
        "red_cross_skopje",
        "amsm",
        "rail_infrastructure",
        "erc",
        "mon"
      ],
      "note": "Keep other registry entries available for incremental coverage rather than claiming all are integrated."
    }
  ],
  "recommended_notice_fields": [
    "notice_id",
    "source_id",
    "source_url",
    "source_event_id",
    "original_text",
    "content_hash",
    "published_at",
    "source_updated_at",
    "retrieved_at",
    "effective_from",
    "effective_to",
    "timezone",
    "category",
    "status",
    "affected_locations_text",
    "municipality",
    "street_names",
    "building_ranges",
    "geometry",
    "location_precision",
    "supersedes_notice_id",
    "field_evidence",
    "source_health"
  ],
  "notice_rules": [
    "Preserve publication, collection and effective time separately. All user-facing daily boundaries use Europe/Skopje.",
    "Translate relative dates against the relevant source publication time; never resolve old 'today' against the retrieval date.",
    "Keep unknown end times null. 'Until completion' is not an estimated restoration time.",
    "Track explicit restoration/cancellation updates. A stale unresolved item may become restoration_unconfirmed, never silently restored.",
    "Match users by service area, street/building, saved places and routes. A municipality mention is not proof that every household is affected.",
    "Deduplicate original and reposted events while retaining provenance and later authoritative updates.",
    "Retain publisher measurement-quality labels, units, station identifiers and measurement periods.",
    "Extract article bodies and explicit attachments. Treat scraped content as untrusted data, excluding navigation, ads and unrelated links.",
    "Do not substitute sample/demo values for production outages, health schedules, warnings or current transport status.",
    "Run source collection independently of user visits; generate the morning digest from validated records and disclose stale/unavailable sources.",
    "Summaries must cite each source and preserve its uncertainty; language generation should not invent operational facts.",
    "Use HTML/API/Atom/iCalendar formats only where the source actually exposes them. Do not infer public API support from the CMS or visible map alone."
  ],
  "suggested_polling_policy": {
    "note": "Engineering starting points, not provider promises or permission to exceed provider limits. Adapt to published terms, rate limits and source update cadence.",
    "utilities_and_traffic": "15–30 minutes where permitted; back off on errors.",
    "official_air_measurements": "Follow publication cadence; polling cannot make hourly measurements more current.",
    "weather_forecast": "1–3 hours, plus a refresh before the daily digest.",
    "municipality_notices": "1–3 hours during active periods, where permitted.",
    "events_and_static_calendars": "Every 6–24 hours; recheck cancellation changes before display.",
    "daily_digest": "Example 07:00 Europe/Skopje, configurable by the user; no automation was created by this research."
  }
}

```
<!-- END COMPLETE SOURCE REGISTRY -->

## 2026-10-17 12:33:34 CEST — Context file prepared and reviewed

### Work completed

- Created the repository-root `andrejcontext.md` from the reviewed handoff draft. This is the only intended file in the initial commit.
- Preserved the supplied original context and the complete 91-entry registry exactly; the readable recap separates explicit user choices, earlier assistant proposals, verified research, and unimplemented work.
- Confirmed that the GitHub plugin reports itself installed following the user's connection update. Repository push access still requires an actual successful push.
- Confirmed that the clone's push destination is `https://github.com/vasosofuji/Moe-Skopje.git`, with the unborn local branch `main` before this first commit.

### Validation

- Compared both embedded archives against their original files: exact matches.
- Checked the compact inventory: all 91 registry source IDs are present, and all archived records retain `adapter_implemented: false`.
- Reviewed the collaboration rules and historical-status labels. No application code, adapters, deployment, or scheduled delivery was created by this handoff.

### Codex entry point

When starting a new Codex task, explicitly ask it to read this custom context filename. Read the standing working agreement near the top and the latest dated entries at the end; consult the source index and archived records for the relevant implementation task. The built-in project-instruction convention is `AGENTS.md`; a custom filename should not be assumed to load automatically without a prompt or configuration. Reference: https://learn.chatgpt.com/docs/agent-configuration/agents-md

Suggested opening prompt:

```text
Read andrejcontext.md before working on this repository. Use it as our running project history. Append a dated entry for each work session, preserving earlier entries and adding corrections instead of silently rewriting history. Include the updated context in each push. andrejcontext.md is the only file with standing edit permission; scope all other file changes to my current task. Inspect the current repository and latest entries before treating any historical proposal as implemented.
```

### Repository outcome at the time of this entry

The file is ready for the first commit and push. This entry precedes publication and does not claim that GitHub has been updated. Record a successful publication or a blocker in a subsequent dated entry. Git history supplies each commit's own identifier; recording a prior push does not require a recursive chain of receipt-only commits.

## 2026-10-17 12:37:48 CEST — GitHub read access verified; publication blocked

### User update carried forward

The user confirmed that the GitHub plugin was installed and connected. The connected GitHub interface subsequently read the target repository successfully, confirming that the connection works for repository reads.

### Work and observed outcome

- Created local initial commit `0fe1d02e1969dbbcce8ce5e81a99325c56cc5555` on `main`, containing only `andrejcontext.md`. The working tree was clean after that commit.
- The normal authenticated-push attempt could not proceed: Git reported `could not read Username for 'https://github.com': terminal prompts disabled`. No terminal credential was available for that attempt.
- The connected GitHub interface verified that `vasosofuji/Moe-Skopje` is public, its default branch is `main`, its branch list is empty, and its contents endpoint reports an empty repository.
- Attempted to create only `andrejcontext.md` through the connected GitHub contents-write action, with the exact reviewed content from the initial local commit. The file's SHA-256 for that attempt was `b674b17f4b2abbe874cd3c1c4763379201d144ebf789505666202f31724be30a`.
- GitHub rejected the write with **HTTP 403: `Resource not accessible by integration`**, normalized as `FORBIDDEN`. A general repository response reported `permissions.push: true`, but the specific integration contents-write request was still denied. The actual write result is the relevant evidence.
- A subsequent branch read still returned an empty list. **No commit or file was published to GitHub.**
- This was GitHub's integration authorization restriction, not a sandbox approval-review rejection. No attempt was made to bypass it or to change access controls.

### Current handoff state and next action

The full context is available locally as `andrejcontext.md`, including this appended result, and is being committed locally. App implementation remains unstarted. The only incomplete handoff step is publishing this file to the requested repository.

Continue in Codex with the repository and this file, or provide an authorized GitHub connection that permits the required repository write. Start by reading the working agreement and latest dated entries. Before publishing, recheck the remote so any intervening user changes are preserved. A later successful publication should append a dated correction to this blocked status rather than erase this record.

## 2026-10-17 12:41:31 CEST — User requests direct move to Codex

User instruction:

> move to codex

Checked the available session capabilities, including a fresh capability inventory: no direct action for moving this conversation into Codex is exposed, and the local `codex` executable is absent. The controllable browser inventory contains only a blank browser tab and no native application surface for switching the current ChatGPT view. No Codex session was created or moved by this check.

The prepared `andrejcontext.md` remains the complete handoff file. Its existing GitHub publication blocker remains unresolved; no new repository-write attempt was made without an access change. Continue through the application's Codex selector or a Codex workspace, explicitly reading this file and preserving its history.
