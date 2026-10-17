// Shot 12: warm white end frame, wordmark then tagline (spec §6). Frames are local to the shot.
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";

const Line = ({ delay, children, style }: { delay: number; children: React.ReactNode; style: React.CSSProperties }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: theme.spring.smooth });
  return (
    <div style={{ ...style, opacity: s, transform: `translateY(${interpolate(s, [0, 1], [10, 0])}px)`, filter: `blur(${(1 - s) * 6}px)` }}>
      {children}
    </div>
  );
};

export const EndFrame = ({ wordmarkAt, taglineAt }: { wordmarkAt: number; taglineAt: number }) => (
  <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, #fbfaf7, ${theme.paper} 70%)`, fontFamily: theme.font,
    alignItems: "center", justifyContent: "center", gap: 24 }}>
    <Line delay={wordmarkAt} style={{ fontSize: 96, fontWeight: 700, letterSpacing: "-0.03em", color: theme.ink }}>Мое Скопје</Line>
    <Line delay={taglineAt} style={{ fontSize: 32, fontWeight: 500, color: theme.light.label2 }}>A forecast for your day.</Line>
  </AbsoluteFill>
);
