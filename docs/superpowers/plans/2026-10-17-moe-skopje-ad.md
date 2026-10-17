# Мое Скопје Ad Film Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce the 55-second, 16:9 Мое Скопје ad as `ad/out/moe-skopje-ad.mp4`.

**Architecture:** Live-action shots come from Higgsfield (Nano Banana Pro keyframes, then Kling 3.0 Pro image-to-video), behind three user-approved credit gates. A Remotion project in `ad/` assembles the clips on a data-driven timeline, composites the app's UI onto static phone screens, sets the captions and end frame, and mixes Storyblocks music and foley.

**Tech Stack:** Remotion 4 (React 19, TypeScript), `@remotion/google-fonts` (Inter, latin + cyrillic), Higgsfield MCP, Storyblocks MCP, Node 24 built-in test runner (native TS type stripping), ffmpeg 9 (system).

**Spec:** `docs/superpowers/specs/2026-10-17-moe-skopje-ad-design.md`

## Global Constraints

- Output: 1920×1080, 24 fps, 1320 frames (55.0 s), H.264 MP4.
- Higgsfield hard cap: 457 credits total. Run `get_cost` and get the user's go-ahead before every generation call; log job ID and credits in `ad/assets.md` after each.
- Keyframes: `nano_banana_pro`, `resolution: "2k"`, `aspect_ratio: "16:9"`. Clips: `kling3_0`, `mode: "pro"`, `sound: "off"`, `duration: 5` (`H10`: 10).
- Every keyframe prompt ends with the spec §2 shared suffix verbatim. No readable text or logos in any generated frame.
- On-screen copy is English and exactly as spec §3; wordmark is "Мое Скопје".
- Captions: Inter 600, 52 px, tracking −0.02 em, centred at 82% height, in 0.6 s (opacity, 6 px rise, 4→0 px blur), out 0.4 s.
- Storyblocks downloads license items on the user's account: download only tracks the user picked.
- The Next.js app is not modified except `tsconfig.json` `exclude`, ESLint `globalIgnores` and `.gitignore`.

## Review Focus

1. A Higgsfield clip shorter than its timeline slot (incl. trim-in offset) would freeze or go black. Expect: timeline test fails before render.
2. A caption that overlaps another caption or runs past its shot's end. Expect: timeline test fails.
3. Cyrillic wordmark falls back to a system font if the cyrillic subset is not loaded. Expect: end-frame still shows Inter "Мое Скопје".
4. Long UI strings (e.g. "Partizanski Odredi Blvd · 08:00–16:00") overflow a card at 1080p. Expect: text truncates with ellipsis, never wraps out of the card; checked on rendered stills.
5. Media files are git-ignored, so a fresh checkout renders without them. Expect: a clear "missing file" error naming the path, not a silent black frame.

---

### Task 1: Remotion scaffold and timeline data

**Files:**
- Create: `ad/package.json`, `ad/tsconfig.json`, `ad/remotion.config.ts`, `ad/src/index.ts`, `ad/src/Root.tsx`, `ad/src/timeline.ts`, `ad/src/timeline.test.ts`, `ad/assets.md`
- Modify: `tsconfig.json` (`exclude` add `"ad"`), `eslint.config.mjs` (`globalIgnores` add `"ad/**"`), `.gitignore` (add `/ad/public/`, `/ad/out/`, `/ad/node_modules/`)

**Interfaces:**
- Produces:
  - `FPS = 24`, `TOTAL = 1320` (frames)
  - `type Shot = { id: string; from: number; to: number; src: { kind: 'clip'; file: string; trimIn: number; clipFrames: number } | { kind: 'ui' } | { kind: 'end' } }` — `from`/`to` in frames, `to` exclusive; `file` relative to `public/`
  - `type Caption = { text: string; in: number; out: number }` — frames
  - `SHOTS: Shot[]`, `CAPTIONS: Caption[]` — values converted from spec §3 seconds × 24 (e.g. caption 1 = `{ in: 19, out: 86 }`)
  - `sec(s: number): number` → `Math.round(s * FPS)`

- [ ] **Step 1:** `npm create video@latest` is not used; write `ad/package.json` by hand with `remotion`, `@remotion/cli`, `@remotion/google-fonts` (same 4.x version), `react@19.3.0`, `react-dom@19.3.0`, scripts `studio`, `render`, `test: "node --test src/"`. Run `npm install` in `ad/`. Expected: exit 0.
- [ ] **Step 2: Write the failing test** `ad/src/timeline.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOTS, CAPTIONS, TOTAL } from './timeline.ts';

test('shots tile 0..TOTAL with no gaps or overlaps', () => {
  assert.equal(SHOTS[0].from, 0);
  assert.equal(SHOTS.at(-1)!.to, TOTAL);
  for (let i = 1; i < SHOTS.length; i++) assert.equal(SHOTS[i].from, SHOTS[i - 1].to, SHOTS[i].id);
});

test('every clip covers its slot', () => {
  for (const s of SHOTS) if (s.src.kind === 'clip')
    assert.ok(s.src.trimIn + (s.to - s.from) <= s.src.clipFrames, s.id);
});

test('captions are ordered, non-overlapping, inside TOTAL', () => {
  for (let i = 0; i < CAPTIONS.length; i++) {
    const c = CAPTIONS[i];
    assert.ok(c.in < c.out && c.out <= TOTAL, c.text);
    if (i) assert.ok(c.in >= CAPTIONS[i - 1].out, c.text);
  }
});

test('copy matches spec', () => {
  assert.equal(CAPTIONS.length, 11);
  assert.equal(CAPTIONS[0].text, 'You check the weather every morning.');
  assert.equal(CAPTIONS[10].text, "We'll show you what might affect it.");
});
```

- [ ] **Step 3:** Run `npm test` in `ad/`. Expected: FAIL, cannot find `./timeline.ts`.
- [ ] **Step 4:** Implement `ad/src/timeline.ts` from spec §3. Clip shots use `clipFrames: 120` (5 s) and `240` for `H10`, `trimIn: 0` until real clips are reviewed. Shot 1 is one `clip` shot `H1` (UI overlay handled in Task 4). Shots 7, 3 and the UI halves of 8–10 are `ui`; shot 12 is `end`.
- [ ] **Step 5:** Run `npm test`. Expected: 4 pass.
- [ ] **Step 6:** `Root.tsx` registers one `<Composition id="MoeSkopjeAd" width={1920} height={1080} fps={FPS} durationInFrames={TOTAL} />` rendering an empty `<AbsoluteFill>`. Run `npx remotion compositions src/index.ts`. Expected: lists `MoeSkopjeAd 1920x1080 24fps 1320`.
- [ ] **Step 7:** Apply the three root config edits. Run `npm run lint` and `npx tsc --noEmit` at repo root. Expected: same result as before the change (no new errors from `ad/`).
- [ ] **Step 8:** Create `ad/assets.md` with a table header `| Gate | Job ID | Asset | Model | Credits | Running total |`. Commit: `feat(ad): remotion scaffold and timeline`.

### Task 2: Gate 1 — look and cast (Higgsfield, ~12 credits)

**Files:** `ad/public/stills/cast.png`, `ad/public/stills/window.png`, `ad/assets.md`

**Interfaces:** Produces the approved cast still (job ID recorded in `assets.md`) used as `image_references` in every Task 3 keyframe that shows the person.

- [ ] **Step 1:** Call `get_preferences`; follow its project/folder rule.
- [ ] **Step 2:** `get_cost` for (a) cast portrait, count 4, and (b) window plate, count 2. Present total and prompts to the user. Wait for go-ahead.
- [ ] **Step 3:** Generate (a): spec §2 person, three-quarter medium portrait by a softly lit window, full outfit visible (cream sweater, charcoal coat over arm, sage tote), plus suffix. Generate (b): the `H2` apartment and view from spec §4 with no person in frame, plus suffix.
- [ ] **Step 4:** Show results; user picks one of each. Download picks to `ad/public/stills/`. Log both rows in `assets.md`. Expected running total ≤ 15.

### Task 3: Gate 2 — keyframes (Higgsfield, ~65 credits)

**Files:** `ad/public/stills/<ID>_start.png`, `<ID>_end.png`, `P1.png`, `P2.png`, `ad/out/contact-sheet.png`, `ad/assets.md`

- [ ] **Step 1:** Build the batch from spec §4: start frames `H1 H2 H3 H4 H5a H5b H5c H6 H7 H8 H9 H10`, end frames `H1 H2 H3 H4 H5c H6 H10`, stills `P1 P2`. Count 2 for `H1_end`, `H2_start`, `H3_start`, `H6_start`; count 1 otherwise. `H2_start` passes cast + window plate as `image_references`; `H2_end` and `H10_start` pass the approved `H2_start` as `image_references`; `P2` passes `P1`.
- [ ] **Step 2:** `get_cost` for the batch; present total, running total and remaining cap. Wait for go-ahead.
- [ ] **Step 3:** Generate with `generate_image_batch` (≤12 per call). Download all to `ad/public/stills/`.
- [ ] **Step 4:** Build a labelled contact sheet with ffmpeg (`tile=5x5`, `drawtext` labels) to `ad/out/contact-sheet.png`; show it. Reject any frame with visible lettering. User approves; re-generate rejected frames only after a fresh `get_cost` and go-ahead.
- [ ] **Step 5:** Log rows in `assets.md`. Expected running total ≤ 80.

### Task 4: UI graphics and screen compositing

**Files:**
- Create: `ad/src/ui/tokens.ts`, `ad/src/ui/quad.ts`, `ad/src/ui/quad.test.ts`, `ad/src/ui/Screen.tsx`, `ad/src/ui/Cards.tsx`, `ad/src/ui/RouteMap.tsx`, `ad/src/ui/Reveal.tsx`, `ad/src/Caption.tsx`, `ad/src/EndFrame.tsx`

**Interfaces:**
- Consumes: `FPS`, `CAPTIONS` from Task 1; `P1.png`, `P2.png`, `H1_start.png` from Task 3.
- Produces:
  - `quadToMatrix3d(w: number, h: number, corners: [Pt, Pt, Pt, Pt]): string` — `Pt = [x, y]`, corners clockwise from top-left; returns a CSS `matrix3d(...)` mapping a `w×h` box onto the quad
  - `SCREENS: Record<'H1' | 'P1' | 'P2', [Pt, Pt, Pt, Pt]>` — measured screen corners in 1920×1080 frame pixels
  - `<Screen at="H1" | "P1" | "P2" dark?: boolean>{children}</Screen>` — 390×844 CSS-px screen content mapped onto that quad
  - `<WeatherCard compact?: boolean />`, `<ClosureCard />`, `<AirCard />`, `<PharmacyCard dark?: boolean />`, `<RouteMap progress: number />` (0..1), `<Reveal />` (self-timed from its Sequence start)
  - `<Caption text in out />`, `<EndFrame />`

- [ ] **Step 1: Write the failing test** `ad/src/ui/quad.test.ts`: identity quad `[[0,0],[w,0],[w,h],[0,h]]` returns a matrix equal (±1e-9) to `matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)`; a quad shifted by (100, 50) returns translation terms 100 and 50; a scaled quad `[[0,0],[2w,0],[2w,2h],[0,2h]]` returns scale 2 on both axes.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL, missing `quad.ts`.
- [ ] **Step 3:** Implement `quadToMatrix3d`: solve the 8-unknown homography from the 4 point pairs (Gaussian elimination), then lay the 3×3 `[a b c; d e f; g h 1]` into column-major `matrix3d(a,d,0,g, b,e,0,h, 0,0,1,0, c,f,0,1)`.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5:** `tokens.ts` copies light and dark values from `app/globals.css` (`--glass-*`, `--label*`, `--system-*`) and radii 14/22. Load Inter with `loadFont('normal', { weights: ['500','600','700'], subsets: ['latin','cyrillic'] })`. Card copy exactly as spec §5. Single-line strings use `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`.
- [ ] **Step 6:** Measure `SCREENS` corners by opening each still at full size and reading the four screen corners; record them in `Screen.tsx`.
- [ ] **Step 7:** `Reveal` per spec §5: weather card compacts with `spring({ fps, config: { stiffness: 400, damping: 30 } })`, then three cards rise and fade in with 3-frame (≈120 ms) stagger, total ≈60 frames.
- [ ] **Step 8:** `Caption` and `EndFrame` per spec §6 (end frame `#f6f4f0`, wordmark 96 px/700, tagline 32 px/500 `rgb(60 60 67 / .6)` 34 frames after the wordmark).
- [ ] **Step 9:** Temporary preview: mount `Reveal` on `P1` and `EndFrame` in the composition; run `npx remotion still src/index.ts MoeSkopjeAd out/ui-reveal.png --frame=600` and `--frame=1300` for the end frame. Expected: UI sits inside the phone glass with no visible edge gap; all card text on one line; "Мое Скопје" rendered in Inter. Commit: `feat(ad): UI cards, screen compositing, captions, end frame`.

### Task 5: Gate 3 — video clips (Higgsfield, ~130 credits)

**Files:** `ad/public/clips/<ID>.mp4`, `ad/assets.md`

- [ ] **Step 1:** Build 12 `kling3_0` requests from spec §4 using approved stills as `start_image` / `end_image`. `get_cost` the batch; present total, running total and remaining cap. Wait for go-ahead.
- [ ] **Step 2:** Generate with `generate_video_batch`; download to `ad/public/clips/`. Log rows.
- [ ] **Step 3:** Verify each file: `ffprobe -v error -show_entries stream=width,height,r_frame_rate,duration -of csv=p=0 <file>`. Record actual frame count; update `clipFrames` and `trimIn` in `timeline.ts`. Run `npm test`. Expected: pass (a fail means a clip is too short for its slot: pick a new `trimIn` or flag for retake).
- [ ] **Step 4:** Each retake: show the failing clip and the reason, `get_cost`, go-ahead, regenerate, re-verify. Stop and ask if the next retake would exceed 457 total. Commit `timeline.ts` changes: `feat(ad): real clip trims`.

### Task 6: Assembly

**Files:** Create `ad/src/Ad.tsx`; modify `ad/src/Root.tsx`

**Interfaces:** Consumes everything from Tasks 1 and 4; clip files from Task 5.

- [ ] **Step 1:** `Ad` maps `SHOTS` to `<Sequence from durationInFrames>`; clip shots render `<OffthreadVideo src={staticFile(file)} startFrom={trimIn} muted />`. Before mounting, check each file is listed in `getStaticFiles()`; if missing, throw `Error(\`missing public/${file}\`)`.
- [ ] **Step 2:** Shot-specific layers: `H1` frames 0–60 get `<Screen at="H1">` with `WeatherCard` fading in at frame 30 (screen wake); shot 3 is a full-frame `WeatherCard` pushing in to the umbrella glyph (scale 1→6 over 24 frames, glyph centred at the `H3_start` handle position); shot 7 is `P1` with a 1.00→1.06 push and `Reveal`; a 12-frame white-to-`P1` dissolve at 504; shot 8 starts with `RouteMap` on `P1`; shot 9 with `AirCard` on `P1`; shot 10 with `PharmacyCard dark` on `P2`; `CAPTIONS` render on top of everything except the end frame.
- [ ] **Step 3:** Render key stills: frames 40, 100, 200, 560, 660, 744, 850, 1000, 1300. Expected: each matches its spec §3 row; captions legible over footage. Show them to the user.
- [ ] **Step 4:** Commit: `feat(ad): assemble timeline`.

### Task 7: Sound

**Files:** `ad/public/audio/music.*`, `ad/public/audio/sfx/*.wav`, modify `ad/src/Ad.tsx`, `ad/src/timeline.ts` (add `SFX: { file: string; at: number; volume: number }[]`)

- [ ] **Step 1:** `search_audio` (music: `required_keywords: "piano"`, `has_vocals: false`, `min_duration: 60`, `min_bpm: 70`, `max_bpm: 90`). Shortlist 3 with preview URLs; user picks one. Only then `get_download_url` for that track.
- [ ] **Step 2:** For the cue list in spec §7, search SFX and present picks with previews; download only approved items. Log licences in `assets.md`.
- [ ] **Step 3:** Add `SFX` entries at spec §7 times; extend `timeline.test.ts` with: every `SFX.at < TOTAL`. Run `npm test`. Expected: pass.
- [ ] **Step 4:** Music as `<Audio>` with a volume curve: room tone only to frame 360, fade in 360–384, +3 dB at 504, −3 dB from 840, resolving note aligned to 1176 (trim `startFrom` so a musical downbeat lands there), fade out by 1320.
- [ ] **Step 5:** Commit: `feat(ad): music and foley`.

### Task 8: Final render and check

- [ ] **Step 1:** `npx remotion render src/index.ts MoeSkopjeAd out/moe-skopje-ad.mp4 --codec=h264 --crf=16 --audio-bitrate=320k`.
- [ ] **Step 2:** `ffprobe` the output. Expected: 1920x1080, 24/1 fps, duration 55.0 s ± 0.05.
- [ ] **Step 3:** `ffmpeg -i out/moe-skopje-ad.mp4 -af loudnorm=print_format=summary -f null -`. Expected: integrated −14 ± 1 LUFS, true peak ≤ −1 dBTP. If not, adjust master gain and re-render.
- [ ] **Step 4:** Send the MP4 to the user; collect notes; iterate. Final commit of source only (media stays git-ignored): `feat(ad): final cut`.
