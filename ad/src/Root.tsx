import { AbsoluteFill, Composition } from "remotion";
import { CAPTIONS, FPS, SHOTS, TOTAL } from "./timeline";
import { Ad, H1Wake, ShotView, ToWhite } from "./Ad";
import { Caption } from "./Caption";

const size = { width: 1920, height: 1080, fps: FPS };

// Layers for the Premiere project (scripts/render-layers.mjs): one clip per UI shot, the H1 screen
// overlay, the white dip and one clip per caption, so each can be moved and trimmed on its own.
const UI_SHOTS = SHOTS.filter((s) => s.src.kind !== "clip");
const H1 = SHOTS.find((s) => s.id === "H1")!;

export const Root = () => (
  <>
    <Composition id="MoeSkopjeAd" component={Ad} durationInFrames={TOTAL} {...size} />
    {UI_SHOTS.map((s) => (
      <Composition key={s.id} id={`UI-${s.id}`} component={() => <ShotView shot={s} />} durationInFrames={s.to - s.from} {...size} />
    ))}
    <Composition id="Overlay-H1-screen" component={() => <AbsoluteFill><H1Wake /></AbsoluteFill>} durationInFrames={H1.to - H1.from} {...size} />
    <Composition id="Overlay-white-dip" component={() => <ToWhite from={0} frames={12} />} durationInFrames={12} {...size} />
    {CAPTIONS.map((c, i) => (
      <Composition key={i} id={`Caption-${String(i + 1).padStart(2, "0")}`}
        component={() => <Caption text={c.text} in={0} out={c.out - c.in} ink={c.ink} />} durationInFrames={c.out - c.in} {...size} />
    ))}
  </>
);
