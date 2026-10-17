// Run from ad/: node scripts/render-layers.mjs [filter]  ->  out/layers/*.mov
// Bundles once, then renders every UI-, Overlay- and Caption- composition for the Premiere project.
// Opaque layers: ProRes 422 HQ. Layers with alpha (overlays, captions): ProRes 4444.
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";
import { mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "out", "layers");
mkdirSync(outDir, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.join(root, "src", "index.ts"), publicDir: path.join(root, "public") });
const comps = (await getCompositions(serveUrl)).filter((c) => /^(UI|Overlay|Caption)-/.test(c.id) && c.id.includes(process.argv[2] ?? ""));

for (const c of comps) {
  const alpha = !c.id.startsWith("UI-");
  await renderMedia({
    serveUrl,
    composition: c,
    codec: "prores",
    proResProfile: alpha ? "4444" : "hq",
    ...(alpha && { imageFormat: "png", pixelFormat: "yuva444p10le" }),
    muted: true,
    concurrency: 3, // keep the machine responsive
    outputLocation: path.join(outDir, `${c.id}${process.env.SUFFIX ?? ""}.mov`), // SUFFIX=_v2: new file, Premiere may lock the old one
  });
  console.log("rendered", c.id);
}
