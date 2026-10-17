// One overlay line (spec §6, faster per v3): in 0.4 s (opacity, 6 px rise, 4→0 px blur), out 0.3 s. Frames are absolute.
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";

export const Caption = ({ text, in: start, out, ink = false }: { text: string; in: number; out: number; ink?: boolean }) => {
  // Ink lines sit over the hero phone, so they go above it; white lines sit low over footage.
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = interpolate(frame, [start, start + 0.4 * fps], [0, 1], { easing: theme.ease.out, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const exit = interpolate(frame, [out - 0.3 * fps, out], [1, 0], { easing: theme.ease.in, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (frame < start || frame >= out) return null;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: ink ? "8.5%" : "82%", transform: `translateY(calc(-50% + ${(1 - enter) * 6}px))`,
      textAlign: "center", fontFamily: theme.font, fontWeight: 600, fontSize: 52, letterSpacing: "-0.02em", lineHeight: 1.15,
      color: ink ? theme.ink : "#fff", textShadow: ink ? "none" : "0 2px 12px rgb(0 0 0 / .35)",
      opacity: enter * exit, filter: `blur(${(1 - enter) * 4}px)` }}>
      {text}
    </div>
  );
};
