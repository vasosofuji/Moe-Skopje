// Shot 7 screen content: weather card compacts, then the city brief rises underneath (spec §5).
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme, type Palette } from "../theme";
import { AppScreen } from "./AppScreen";
import { AirCard, ClosureCard, PharmacyCard, WeatherCard } from "./Cards";

export const REVEAL_START = 12; // frames into the shot before the card starts to compact

const Rise = ({ delay, children }: { delay: number; children: React.ReactNode }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: theme.spring.ui });
  return (
    <div style={{ opacity: s, transform: `translateY(${interpolate(s, [0, 1], [36, 0])}px) scale(${interpolate(s, [0, 1], [0.96, 1])})` }}>
      {children}
    </div>
  );
};

export const Reveal = ({ p, h }: { p: Palette; h: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const compact = spring({ frame: frame - REVEAL_START, fps, config: theme.spring.ui });
  const cards = REVEAL_START + 10;
  return (
    <AppScreen p={p} h={h}>
      <div style={{ position: "absolute", left: 12, right: 12, top: interpolate(compact, [0, 1], [h * 0.3, 64]),
        display: "flex", flexDirection: "column", gap: 10 }}>
        <WeatherCard p={p} compact={compact} />
        <Rise delay={cards}><ClosureCard p={p} /></Rise>
        <Rise delay={cards + 3}><AirCard p={p} /></Rise>
        <Rise delay={cards + 6}><PharmacyCard p={p} /></Rise>
      </div>
    </AppScreen>
  );
};

/** Weather-only screen (shots 1 and 3): the full card sitting where the reveal begins. */
export const WeatherScreen = ({ p, h }: { p: Palette; h: number }) => (
  <AppScreen p={p} h={h}>
    <div style={{ position: "absolute", left: 12, right: 12, top: h * 0.3 }}>
      <WeatherCard p={p} />
    </div>
  </AppScreen>
);
