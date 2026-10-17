// Edit timeline. v3 (user, 2026-10-17): snappier cuts on the beat of "Midnight Rendezvous"; H7 removed.
// All values in frames at 24 fps; `to` is exclusive. Self-contained so `node --test` can load it.

export const FPS = 24;
export const TOTAL = 940; // 39.17 s

export const sec = (s: number): number => Math.round(s * FPS);

type Src =
  | { kind: "clip"; file: string; trimIn: number; clipFrames: number; rate: number }
  | { kind: "ui" }
  | { kind: "end" };

export type Shot = { id: string; from: number; to: number; src: Src };
// side: set on the full-screen phone shots; the line sits beside the phone in rows (\n = row break).
export type Caption = { text: string; in: number; out: number; ink?: boolean; side?: "left" | "right" };
export type Cue = { file: string; at: number; volume: number };

// clipFrames from ffprobe (Kling 5 s = 121, 10 s = 241); trimIn and rate picked from the review strips.
const clip = (file: string, trimIn = 0, rate = 1, clipFrames = 121): Src => ({ kind: "clip", file, trimIn, clipFrames, rate });
const ui: Src = { kind: "ui" };

// [id, start frame, source]. Starts sit on beats of the music (105 BPM, one beat = 13.7 frames),
// snapped to the nearest onset where one is within ±0.15 s. Each shot ends where the next one starts.
const CUTS: [string, number, Src][] = [
  ["H1", 0, clip("clips/H1.mp4", 0, 0.9)], // the hand enters at clip frame 56: cut as it appears
  ["H2", 62, clip("clips/H2.mp4", 25)],
  ["weather-insert", 141, ui],
  ["H3", 158, clip("clips/H3.mp4", 50)],
  ["H4", 199, clip("clips/H4.mp4", 65)],
  ["H5a", 226, clip("clips/H5a.mp4", 35)],
  ["H5b", 254, clip("clips/H5b.mp4", 25)],
  ["H5c", 281, clip("clips/H5c.mp4", 45)],
  ["reveal", 336, ui], // section change in the music
  ["route", 446, ui],
  ["H6", 473, clip("clips/H6.mp4", 10)],
  ["air", 511, ui],
  ["pharmacy", 566, ui],
  ["H8", 597, clip("clips/H8.mp4", 50)],
  ["H9", 613, clip("clips/H9.mp4")], // first 1.1 s only: lettering appears on shelves later
  ["H10", 640, clip("clips/H10.mp4", 30, 1, 241)],
  ["end", 830, { kind: "end" }],
];

export const SHOTS: Shot[] = CUTS.map(([id, from, src], i) => ({
  id,
  from,
  to: i + 1 < CUTS.length ? CUTS[i + 1][1] : TOTAL,
  src,
}));

const cap = (text: string, from: number, to: number, ink = false): Caption => ({ text, in: from, out: to, ...(ink && { ink }) });

export const CAPTIONS: Caption[] = [
  cap("You check the weather every morning.", 8, 60),
  cap("But life is more than the weather.", 68, 139),
  cap("Rain means an umbrella.", 162, 197),
  cap("Cold means another layer.", 202, 236),
  cap("Small things change how you prepare.", 240, 333),
  { ...cap("Now extend\nthat check\nto the city\naround you.", 348, 442, true), side: "left" },
  cap("A road closure on your route.", 475, 510), // on the street footage, not over the light map
  { ...cap("Air quality\nin your\nneighborhood.", 516, 564, true), side: "right" },
  cap("A pharmacy open tonight.", 599, 637),
  cap("Think about your usual day.", 650, 722),
  cap("We'll show you what might affect it.", 732, 826),
];

// End frame: wordmark on the beat after the cut, tagline two beats later.
export const END = { wordmark: 840, tagline: 867 };

// Music: song second 5.98 plays at frame 0, so the reveal (frame 336) lands on the section change at 19.98 s.
export const MUSIC = { file: "audio/music.mp3", startFrom: sec(5.981) };

// Synthesised transition sounds (scripts/sfx.mjs), each placed 2 frames before its visual hit.
export const SFX: Cue[] = [
  { file: "sfx/whoosh.wav", at: 139, volume: 0.5 }, // push into the cloud
  { file: "sfx/riser.wav", at: 301, volume: 0.45 }, // door opens into white
  { file: "sfx/boom.wav", at: 334, volume: 0.7 }, // reveal
  { file: "sfx/tick.wav", at: 356, volume: 0.35 }, // city cards land
  { file: "sfx/tick.wav", at: 359, volume: 0.3 },
  { file: "sfx/tick.wav", at: 362, volume: 0.25 },
  { file: "sfx/pop.wav", at: 446, volume: 0.45 }, // closure marker
  { file: "sfx/whoosh.wav", at: 471, volume: 0.35 }, // match cut to the street
  { file: "sfx/tick.wav", at: 515, volume: 0.35 }, // air card
  { file: "sfx/tick.wav", at: 568, volume: 0.35 }, // pharmacy list
  { file: "sfx/whoosh.wav", at: 820, volume: 0.35 }, // into the end frame
  { file: "sfx/boom.wav", at: 838, volume: 0.6 }, // wordmark
];
