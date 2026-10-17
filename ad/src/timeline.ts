// Edit timeline from spec §3 (docs/superpowers/specs/2026-10-17-moe-skopje-ad-design.md).
// All values in frames at 24 fps; `to` is exclusive. Self-contained so `node --test` can load it.

export const FPS = 24;
export const TOTAL = 1320; // 55 s

export const sec = (s: number): number => Math.round(s * FPS);

type Src =
  | { kind: "clip"; file: string; trimIn: number; clipFrames: number; rate: number }
  | { kind: "ui" }
  | { kind: "end" };

export type Shot = { id: string; from: number; to: number; src: Src };
export type Caption = { text: string; in: number; out: number; ink?: boolean };

// clipFrames from ffprobe (Kling 5 s = 121, 10 s = 241); trimIn and rate picked from the review strips.
const clip = (file: string, trimIn = 0, rate = 1, clipFrames = 121): Src => ({ kind: "clip", file, trimIn, clipFrames, rate });
const ui: Src = { kind: "ui" };

// [id, start second, source]; each shot ends where the next one starts.
const CUTS: [string, number, Src][] = [
  ["H1", 0, clip("clips/H1.mp4", 0, 0.6)], // slowed: the hand enters at clip frame 56, cut as it appears
  ["H2", 4, clip("clips/H2.mp4", 10)],
  ["weather-insert", 8, ui],
  ["H3", 9, clip("clips/H3.mp4", 20)],
  ["H4", 12, clip("clips/H4.mp4", 40)],
  ["H5a", 15, clip("clips/H5a.mp4", 25)],
  ["H5b", 17, clip("clips/H5b.mp4", 20)],
  ["H5c", 19, clip("clips/H5c.mp4", 50)],
  ["reveal", 21, ui],
  ["route", 27, ui],
  ["H6", 28.2, clip("clips/H6.mp4")],
  ["air", 31, ui],
  ["H7", 32, clip("clips/H7.mp4", 20)],
  ["pharmacy", 35, ui],
  ["H8", 36, clip("clips/H8.mp4", 40)],
  ["H9", 37.5, clip("clips/H9.mp4")], // first 1.5 s only: lettering appears on shelves later
  ["H10", 39, clip("clips/H10.mp4", 0, 1, 241)],
  ["end", 49, { kind: "end" }],
];

export const SHOTS: Shot[] = CUTS.map(([id, start, src], i) => ({
  id,
  from: sec(start),
  to: i + 1 < CUTS.length ? sec(CUTS[i + 1][1]) : TOTAL,
  src,
}));

const cap = (text: string, from: number, to: number): Caption => ({ text, in: sec(from), out: sec(to) });

export const CAPTIONS: Caption[] = [
  cap("You check the weather every morning.", 0.8, 3.6),
  cap("But life is more than the weather.", 4.6, 7.8),
  cap("Rain means an umbrella.", 9.4, 11.8),
  cap("Cold means another layer.", 12.4, 14.8),
  cap("Small things change how you prepare.", 15.6, 20.4),
  { ...cap("Now extend that check to the city around you.", 22.0, 26.6), ink: true }, // charcoal, above the hero phone
  cap("A road closure on your route.", 28.0, 30.8),
  cap("Air quality in your neighborhood.", 32.0, 34.8),
  cap("A pharmacy open tonight.", 36.0, 38.8),
  cap("Think about your usual day.", 40.5, 44.0),
  cap("We'll show you what might affect it.", 44.8, 48.6),
];

// End frame (spec §6): wordmark at 49.6 s, tagline 1.4 s later.
export const END = { wordmark: sec(49.6), tagline: sec(51.0) };
