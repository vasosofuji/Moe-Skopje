import { Composition } from "remotion";
import { FPS, TOTAL } from "./timeline";
import { Ad } from "./Ad";

export const Root = () => (
  <Composition id="MoeSkopjeAd" component={Ad} width={1920} height={1080} fps={FPS} durationInFrames={TOTAL} />
);
