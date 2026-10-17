// Shot 8: the planned route meets a closure and redraws around it. Coordinates share MapBackdrop's 390×900 box.
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme, type Palette } from "../theme";
import { AppScreen, MapBackdrop } from "./AppScreen";
import { ClosureCard } from "./Cards";

const ORIGINAL = "M318 150 L208 150 L196 400 L183 700 L92 742";
const DETOUR = "M318 150 L208 150 L201 300 L300 290 L292 520 L188 528 L183 700 L92 742";
const DETOUR_LEN = 1080; // generous; dash offset only needs to exceed the true length

export const RouteMap = ({ p, h }: { p: Palette; h: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const closure = spring({ frame, fps, config: theme.spring.ui });
  const draw = interpolate(frame, [7, 25], [0, 1], { easing: theme.ease.inOut, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const card = spring({ frame: frame - 3, fps, config: theme.spring.ui });

  return (
    <AppScreen p={p} h={h} map={false}>
      <MapBackdrop p={p}>
        <path d={ORIGINAL} stroke={p.blue} strokeOpacity={1 - 0.75 * draw} strokeWidth="9" fill="none"
          strokeLinecap="round" strokeLinejoin="round" strokeDasharray={draw > 0 ? "2 16" : undefined} />
        <path d={DETOUR} stroke={p.blue} strokeWidth="9" fill="none" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={DETOUR_LEN} strokeDashoffset={DETOUR_LEN * (1 - draw)} />
        <g transform={`translate(198 400) scale(${closure})`}>
          <rect x="-9" y="-60" width="18" height="120" rx="9" fill={p.orange} />
          <circle r="20" fill={p.orange} stroke="#fff" strokeWidth="4" />
          <rect x="-10" y="-3" width="20" height="6" rx="3" fill="#fff" />
        </g>
        <circle cx="318" cy="150" r="11" fill={p.blue} stroke="#fff" strokeWidth="4" />
        <circle cx="92" cy="742" r="11" fill="#fff" stroke={p.blue} strokeWidth="5" />
      </MapBackdrop>
      <div style={{ position: "absolute", left: 12, right: 12, bottom: 34, opacity: card,
        transform: `translateY(${interpolate(card, [0, 1], [30, 0])}px)` }}>
        <ClosureCard p={p} />
      </div>
    </AppScreen>
  );
};
