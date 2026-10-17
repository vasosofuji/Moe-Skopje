# Мое Скопје — Ad Film Design Spec

Date: 2026-10-17 · Status: draft for user review · Source storyboard: `message.txt` (user, Apple-paced, ~55 s)

## 1. Intent

**What:** A 55-second cinematic ad for Мое Скопје. No voiceover. Clean, a little dramatic, Apple-like pacing and precision.
**Idea:** A small morning check opens into a bigger picture of your day. We follow one person mostly through their actions; Skopje is recognisable through the places they move through. The film begins with someone checking a screen to prepare for the day and ends with them putting it down and living it.
**Success:** It reads as a considered product film. The product reveal (21–27 s) is the strongest moment. The UI on screen is crisp and on-brand, never garbled AI text.

### Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Format | 16:9, 1920×1080, 24 fps, H.264 MP4 |
| On-screen text | English. Wordmark stays Cyrillic: **Мое Скопје** |
| Road-closure beat | Kept as in the storyboard, although routing is not an app feature yet |
| Sound | Music + subtle foley, both from Storyblocks. Higgsfield audio is speech-only, so it is not used |
| Pipeline | Approach A: Higgsfield live-action (stills → image-to-video), UI + type + edit + mix in Remotion |
| Budget | **457 Higgsfield credits, hard cap.** Stop and ask before anything would cross it |
| Approvals | User approves before every Higgsfield generation batch, with its exact cost |

## 2. Look

- **Palette:** warm whites, charcoal, muted sage green, natural skin tones. Evening introduces deeper blue.
- **Season:** autumn in Skopje. Plane trees turning yellow, soft low sun, a chance of rain.
- **Camera:** deliberate, slow, mostly locked or gentle dolly. Shallow depth of field. Spherical lenses, 35–85 mm feel. Fine film grain, soft contrast, no teal-orange.
- **Person (default, confirmed at Gate 1):** woman, about 28, dark brown hair in a loose low bun, natural skin, minimal makeup. Cream ribbed wool sweater; charcoal wool coat from shot 5 on; muted sage-green canvas tote. Seen mostly through hands, shoulders and back.
- **Places:** high-floor apartment in Karpoš with a large window, sheer linen curtain and an oak table; view over rooftops to Vodno with the Millennium Cross. Centar/Karpoš streets for exteriors.
- **Rules for every generated frame:** no readable text, no logos, no signage lettering. Phone screens are black glass (UI is composited in the edit).

**Shared prompt suffix** (appended to every keyframe prompt):
`cinematic film still, shot on ARRI Alexa 35, soft natural light, shallow depth of field, gentle film grain, restrained warm palette of warm white, charcoal and muted sage green, Apple commercial aesthetic, photorealistic, no text, no logos`

## 3. Timeline

Times are in seconds of the final cut. "HF" = Higgsfield clip, "UI" = Remotion graphics.

| # | Time | Picture | Source | On-screen text (in / out) |
|---|---|---|---|---|
| 1 | 0.0–4.0 | Extreme close-up, phone on oak table. Light sweeps the glass, the screen wakes to the weather card, a hand grips the phone's sides and starts to lift. Cut on the lift | HF `H1` + UI on static screen | "You check the weather every morning." (0.8 / 3.6) |
| 2 | 4.0–8.0 | Wider, the phone held at the same frame position. She stands by the window, lowers the phone, focus racks to the city | HF `H2` | "But life is more than the weather." (4.6 / 7.8) |
| 3 | 8.0–9.0 | Full-frame screen insert: forecast, push into the umbrella glyph | UI | — |
| 4 | 9.0–12.0 | Match cut: glyph curve → wooden umbrella handle on a hook. A hand lifts it in one clean action | HF `H3` | "Rain means an umbrella." (9.4 / 11.8) |
| 5 | 12.0–15.0 | Charcoal coat slides over a shoulder; the fabric crosses the lens and wipes the frame | HF `H4` | "Cold means another layer." (12.4 / 14.8) |
| 6 | 15.0–21.0 | Keys lifted (15–17) · tote settled on shoulder (17–19) · door opens, daylight floods to white (19–21) | HF `H5a` `H5b` `H5c` | "Small things change how you prepare." (15.6 / 20.4) |
| 7 | 21.0–27.0 | **Product reveal.** White dissolves into the hero phone on a warm seamless background. Weather card visible, then it expands smoothly into the city brief: road closure, air quality, duty pharmacy. One continuous movement | HF still `P1` + UI | "Now extend that check to the city around you." (22.0 / 26.6) |
| 8 | 27.0–31.0 | Route line on the screen bends around a closure (27–28.2) → match cut to overhead street, she turns onto another pavement in the same direction | UI + HF `H6` | "A road closure on your route." (28.0 / 30.8) |
| 9 | 31.0–35.0 | Air card settles into place (31–32) → leafy residential street, people walking, light between buildings | UI + HF `H7` | "Air quality in your neighborhood." (32.0 / 34.8) |
| 10 | 35.0–39.0 | Evening. Pharmacy listing on the phone, dark UI (35–36) → glowing green cross (36–37.5) → she approaches the entrance, warm light on the pavement (37.5–39) | UI on `P2` + HF `H8` `H9` | "A pharmacy open tonight." (36.0 / 38.8) |
| 11 | 39.0–49.0 | Window composition from shot 2, now at dusk. She sets the phone down and walks out of frame. Hold on the city lights | HF `H10` (10 s) | "Think about your usual day." (40.5 / 44.0) · "We'll show you what might affect it." (44.8 / 48.6) |
| 12 | 49.0–55.0 | Warm white end frame. **Мое Скопје**, then the tagline | Remotion | Wordmark (49.6) · "A forecast for your day." (51.0), hold to 55.0 |

## 4. Generated assets

Keyframes use **Nano Banana Pro**, 2K, 16:9 (2 credits each). Clips use **Kling 3.0 Pro**, 5 s unless noted, start frame + end frame where listed, sound off. The approved cast still from Gate 1 is passed as an image reference for every keyframe that shows the person.

| ID | Start keyframe | End keyframe | Motion prompt |
|---|---|---|---|
| `H1` | Top-down extreme close-up of a black smartphone lying flat on a light oak table, screen dark glass, morning sunlight beam at the left edge of frame, linen texture blurred at the edge | Same framing, sunlight beam across the phone, a woman's hand gripping the phone's long edges, not covering the screen, phone lifted a few millimetres | Locked camera. Sunlight slowly sweeps across the glass for 3 s, then a hand enters from the bottom right, grips the phone by its edges and begins to lift it. The screen stays dark |
| `H2` | Medium-wide inside a high-floor Karpoš apartment. The woman stands beside a large window in three-quarter profile, holding the phone at chest height in the centre of frame, screen facing her. Beyond the glass, Skopje rooftops and Vodno with the Millennium Cross, soft and out of focus, morning haze | Same framing, phone lowered to her side, the city now sharp, she looks out | Locked camera. She slowly lowers the phone; focus racks from the phone to the city beyond the window |
| `H3` | Close-up by an apartment door: a charcoal umbrella with a curved natural-wood J-handle hangs on a brass wall hook; the curve of the handle sits at frame centre | Same framing, the hook is empty, the umbrella is lifted out of frame upward | A hand enters, takes the curved handle and lifts the umbrella off the hook in one clean, unhurried action. Locked camera |
| `H4` | Close-up of a shoulder in a cream ribbed wool sweater, the charcoal wool coat entering from frame left | The charcoal wool coat fabric fills the entire frame, soft texture, slightly out of focus | The coat slides over the shoulder towards camera until the fabric covers the lens. Slow and tactile |
| `H5a` | Close-up of a small white ceramic dish with brass keys on an oak console table, soft window light | — | A hand lifts the keys from the dish. Locked camera, shallow focus |
| `H5b` | Close-up of the sage-green canvas tote being lifted onto a shoulder of the charcoal coat | — | The strap settles on the shoulder, the bag swings slightly and comes to rest |
| `H5c` | From inside the apartment hallway, a front door closed, a woman's hand on the handle, soft dim interior | Doorway fully open, bright daylight blown out to near-white, the woman a soft silhouette | The door opens and daylight floods in until the frame is nearly white. Slow push forward |
| `H6` | Top-down overhead drone shot of a tree-lined Skopje street corner in autumn, the woman in charcoal coat and sage tote walking left to right along the pavement | Same overhead framing, she has turned the corner and walks downward along the perpendicular pavement | Locked overhead camera. She walks left to right and turns the corner onto the other pavement. Her path matches the rerouted line on screen |
| `H7` | Wide shot of a quiet residential street in Karpoš, plane trees with yellow autumn leaves, low-rise apartment buildings, morning light between the buildings, a few people walking | — | Gentle forward dolly. Leaves move in a light wind, people walk unhurried, sunlight flickers through the trees |
| `H8` | Close-up of a glowing green LED pharmacy cross sign mounted on a building facade at dusk, deep blue sky, no lettering visible | — | The cross glows softly; a slow push-in; a faint flicker of passing headlights on the wall |
| `H9` | Medium shot from behind and slightly to the side, the woman in charcoal coat walking towards a small pharmacy entrance at dusk, warm light from the shop window falling across the pavement, no lettering | — | She walks towards the entrance; camera follows slowly at walking pace |
| `H10` (10 s) | Same composition as the approved `H2` start frame, now at dusk: deep blue sky, city lights across Skopje, the Millennium Cross lit on Vodno, warm interior lamp. She stands at the window holding the phone | Same composition, the window empty, phone lying face-down on the sill, city lights glowing | She sets the phone face-down on the sill and walks out of frame. The camera holds. The city lights twinkle softly |
| `P1` | Hero still: a modern black smartphone, thin bezels, no logos, standing upright and perfectly front-facing in the centre of frame on a warm off-white seamless background, soft contact shadow, screen pure black | — | Still only. Push-in is done in Remotion |
| `P2` | `P1` relit for evening: same phone and framing, background shifted to deep dusk blue with a soft warm rim light | — | Still only |

Phone screens are composited only where the device does not move: the first 2.5 s of `H1` and the stills `P1`/`P2`. Screen corners are measured once per asset and the UI is mapped with a CSS `matrix3d` transform.

## 5. UI graphics (Remotion)

Rebuilt from the app's design tokens (`app/globals.css`, spec §6): liquid glass cards (`--glass-bg`, 24 px blur, 0.5 px stroke), radii 14/22, iOS system colours per layer, Inter with negative tracking on large sizes. Day UI uses the light theme; shot 10 uses the dark theme.

| Card | Content | Accent |
|---|---|---|
| Weather (shots 1, 3, 7) | "Karpoš" · "12°" · "Light rain from 14:00" · umbrella glyph "70%" · hourly row | `--system-teal` |
| Road closure (7, 8) | "Road closure on your route" · "Partizanski Odredi Blvd · 08:00–16:00" · "Detour adds 4 min" | `--system-orange` |
| Air quality (7, 9) | "Air in Karpoš" · "PM10 38 µg/m³" · "Moderate" · 24 h sparkline | AQI band ≤40 (yellow-green) |
| Duty pharmacy (7, 10) | "Pharmacy on duty tonight" · three rows with distance and "Open until 07:00" | `--system-red` |
| Route map (8) | Stylised street lines, blue route line A→B, closure segment with an orange stop marker; the route redraws and bends around it left→right then down | `--system-blue`, `--system-orange` |

**Reveal animation (shot 7):** the weather card starts full-height, eases up and compacts (spring: stiffness 400, damping 30), then the three city cards slide up and fade in with 120 ms stagger. One continuous movement, about 2.5 s.

## 6. Typography

- Overlay lines: Inter 600, 52 px at 1080p, tracking −0.02 em. White with a soft 0 2 12 px black-at-35% shadow over footage; charcoal `#1d1d1f` on white frames.
- One line at a time, centred horizontally at about 82% of frame height.
- Entrance: 0.6 s, opacity 0→1, rise 6 px, blur 4→0 px, ease-out. Exit: 0.4 s fade.
- End frame: background `#f6f4f0`. Wordmark "Мое Скопје" Inter 700, 96 px, charcoal, centred. Tagline "A forecast for your day." Inter 500, 32 px, `rgb(60 60 67 / .6)`, 24 px below, fades in 1.4 s after the wordmark.

## 7. Sound

All from Storyblocks. Each download licenses the item on the user's account; the user picks the music track before anything is downloaded.

- **Music:** instrumental, no vocals, at least 60 s, restrained piano and soft pulse, roughly 70–90 BPM. Three previews are shortlisted for the user. Edit points: room tone only until 15 s, pulse from 15 s, lift at 21 s (reveal), softens at 35 s, single resolving note at 49 s.
- **Foley:** fingers taking the phone's edges (2.6 s), quiet room tone (0–8 s), city ambience fading in (4 s), wooden tap of the umbrella leaving the hook (9.5 s), fabric movement and a quiet zip (12–15 s), keys (15.3 s), bag strap (17.3 s), door latch and swell of outdoor air (19 s), footsteps on pavement (28–31 s), wind through leaves (31–35 s), evening street tone (35–39 s).
- **Mix:** music around −18 LUFS under foley, final master at −14 LUFS integrated, true peak −1 dBTP.

## 8. Production gates and budget (457 credits, hard cap)

| Gate | Generates | Est. credits | User approves |
|---|---|---|---|
| 1 Look and cast | 4 cast variants (one call, count 4) + 2 window plates (location and grade, no person) | ~12 | Face, wardrobe, grade |
| 2 Keyframes | All remaining start/end stills from §4 plus `P1`/`P2`; 2 variants only for match-cut frames (`H1` end, `H2` start, `H3` start, `H6` start); `H2` start uses the cast and window plate as references | ~65 | One contact sheet |
| 3 Video | 12 Kling clips, 1 take each (`H10` at 10 s) | ~130 | Rough cut with clips in place |
| Retakes | Only clips that fail review, one at a time | ≤200 | Each retake |
| Buffer | Untouched without asking | ~50 | — |

Before each gate: exact cost via `get_cost`, then the user's go-ahead. After each batch: running total. Job IDs and credits are logged in `ad/assets.md`.

## 9. Project layout

```
ad/
  package.json        remotion, @remotion/cli, @remotion/google-fonts, react, react-dom
  remotion.config.ts
  src/
    index.ts          registerRoot
    Root.tsx          one composition: 1920×1080, 24 fps, 1320 frames
    Ad.tsx            the timeline from §3
    Caption.tsx       overlay line (§6)
    EndFrame.tsx
    ui/               Phone screen, cards and route map (§5)
  public/             clips/, stills/, audio/ (git-ignored)
  out/                renders (git-ignored)
  assets.md           job IDs, credits, licences
```

Root config changes: add `ad` to `tsconfig.json` `exclude`, `ad/**` to the ESLint `globalIgnores`, and `/ad/public/`, `/ad/out/`, `/ad/node_modules/` to `.gitignore`. The app itself is not touched.

## 10. Risks

- **Identity drift across clips:** keyframes carry the cast reference; most shots show hands, shoulders or her back.
- **Landmark accuracy:** Vodno and the Millennium Cross are approximated by the model. Kept soft and hazy in the background.
- **Garbled text in generated frames:** every prompt forbids lettering; any frame with visible text is rejected at Gate 2.
- **Screen compositing:** only on static device frames, so no tracking is needed.
- **Budget:** one take per clip by default; retakes require approval and are counted against the cap.
