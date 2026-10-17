// Run from ad/: node scripts/premiere-plan.mjs  ->  out/premiere-plan.json (read by scripts/premiere-build.jsx)
// Turns src/timeline.ts into absolute paths and seconds for the Premiere project.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { CAPTIONS, FPS, MUSIC, SFX, SHOTS, TOTAL } from "../src/timeline.ts";

const root = path.resolve(import.meta.dirname, "..");
const abs = (...p) => path.join(root, ...p).replaceAll("\\", "/");
const s = (f) => +(f / FPS).toFixed(4);
const db = (v) => +(20 * Math.log10(v)).toFixed(1);

const plan = {
  fps: FPS,
  total: s(TOTAL),
  project: abs("premiere", "MoeSkopje_Ad.prproj"),
  footage: SHOTS.filter((x) => x.src.kind === "clip").map((x) => ({
    id: x.id, file: abs("public", x.src.file), start: s(x.from), dur: s(x.to - x.from),
    srcIn: s(x.src.trimIn), srcDur: s((x.to - x.from) * x.src.rate), rate: x.src.rate,
  })),
  ui: SHOTS.filter((x) => x.src.kind !== "clip").map((x) => ({ id: x.id, file: abs("out", "layers", `UI-${x.id}.mov`), start: s(x.from) })),
  overlays: [
    { id: "H1-screen", file: abs("out", "layers", "Overlay-H1-screen.mov"), start: 0 },
    ...["H5c", "H10"].map((id) => {
      const shot = SHOTS.find((x) => x.id === id);
      return { id: `${id}-white-dip`, file: abs("out", "layers", "Overlay-white-dip.mov"), start: s(shot.to - 12) };
    }),
  ],
  captions: CAPTIONS.map((c, i) => ({ text: c.text, file: abs("out", "layers", `Caption-${String(i + 1).padStart(2, "0")}.mov`), start: s(c.in) })),
  music: { file: abs("public", "audio", "music.wav"), srcIn: s(MUSIC.startFrom) },
  // Same curve as Ad.tsx musicVolume, as [seconds, dB] keys.
  musicKeys: [[0, -40], [10, -3.1], [330, -3.1], [340, -0.4], [630, -0.4], [650, -1.9], [TOTAL - 50, -1.9], [TOTAL - 2, -40]].map(([f, d]) => [s(f), d]),
  sfx: SFX.map((c) => ({ file: abs("public", c.file), at: s(c.at), db: db(c.volume) })),
  markers: SHOTS.map((x) => ({ t: s(x.from), name: x.id })),
};
writeFileSync(path.join(root, "out", "premiere-plan.json"), JSON.stringify(plan, null, 2));
console.log(`plan: ${plan.footage.length} footage, ${plan.ui.length} UI, ${plan.overlays.length} overlays, ${plan.captions.length} captions, ${plan.sfx.length} sfx`);
