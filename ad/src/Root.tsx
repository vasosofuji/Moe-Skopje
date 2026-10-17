import { AbsoluteFill, Composition } from "remotion";
import { FPS, TOTAL } from "./timeline";

const Placeholder = () => <AbsoluteFill style={{ background: "#000" }} />;

export const Root = () => (
  <Composition id="MoeSkopjeAd" component={Placeholder} width={1920} height={1080} fps={FPS} durationInFrames={TOTAL} />
);
