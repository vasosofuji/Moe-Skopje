// Air beat: the app's PM10 heat map (spec §11.5) blooms over the map, then the air card rises.
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme, type Palette } from "../theme";
import { AppScreen, MapBackdrop } from "./AppScreen";
import { AirCard } from "./Cards";

// [x, y, radius, colour] in MapBackdrop's 390×900 box; mostly yellow-green with a greener park edge.
const BLOBS: [number, number, number, string][] = [
  [200, 330, 150, theme.aqiYellowGreen],
  [110, 200, 110, "#34c759"],
  [300, 470, 130, theme.aqiYellowGreen],
  [150, 560, 120, "#ffcc00"],
  [290, 760, 110, "#34c759"],
];

export const AirMap = ({ p, h }: { p: Palette; h: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = spring({ frame: frame - 6, fps, config: theme.spring.ui });
  return (
    <AppScreen p={p} h={h} map={false}>
      <MapBackdrop p={p}>
        <defs>
          {BLOBS.map(([, , , c], i) => (
            <radialGradient key={i} id={`heat${i}`}>
              <stop offset="0" stopColor={c} stopOpacity="0.55" />
              <stop offset="1" stopColor={c} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>
        {BLOBS.map(([x, y, r], i) => {
          const s = interpolate(frame, [i * 2, i * 2 + 16], [0, 1], { easing: theme.ease.out, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return <circle key={i} cx={x} cy={y} r={r * (0.7 + 0.3 * s)} fill={`url(#heat${i})`} opacity={s} />;
        })}
      </MapBackdrop>
      <div style={{ position: "absolute", left: 12, right: 12, bottom: 34, opacity: card,
        transform: `translateY(${interpolate(card, [0, 1], [30, 0])}px)` }}>
        <AirCard p={p} big />
      </div>
    </AppScreen>
  );
};
