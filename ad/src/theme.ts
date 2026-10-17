// Single source of truth for colours, type and motion. Tokens copied from app/globals.css (spec §6, §5).
import { Easing } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin", "cyrillic"] });

const light = {
  bg: "#f2f2f7",
  glassBg: "rgb(255 255 255 / .55)",
  glassStroke: "rgb(255 255 255 / .6)",
  glassHighlight: "rgb(255 255 255 / .7)",
  label: "#000",
  label2: "rgb(60 60 67 / .6)",
  tile: "rgb(255 255 255 / .55)",
  red: "#ff3b30",
  orange: "#ff9500",
  yellow: "#ffcc00",
  green: "#34c759",
  teal: "#30b0c7",
  blue: "#007aff",
  map: { land: "#ece8e1", park: "#dfe6d3", road: "#ffffff", minor: "#f7f5f1", water: "#cfe0ea" },
};

const dark: typeof light = {
  bg: "#000",
  glassBg: "rgb(28 28 30 / .50)",
  glassStroke: "rgb(255 255 255 / .12)",
  glassHighlight: "rgb(255 255 255 / .15)",
  label: "#fff",
  label2: "rgb(235 235 245 / .6)",
  tile: "rgb(255 255 255 / .06)",
  red: "#ff453a",
  orange: "#ff9f0a",
  yellow: "#ffd60a",
  green: "#30d158",
  teal: "#40c8e0",
  blue: "#0a84ff",
  map: { land: "#1c1f26", park: "#1d2620", road: "#3a3d45", minor: "#2a2d34", water: "#14202b" },
};

export type Palette = typeof light;

export const theme = {
  light,
  dark,
  aqiYellowGreen: "#a8d83f", // lib/aqi.ts band ≤40
  ink: "#1d1d1f",
  paper: "#f6f4f0",
  font: fontFamily,
  radius: { card: 14, sheet: 22 },
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1),
    inOut: Easing.bezier(0.83, 0, 0.17, 1),
    in: Easing.bezier(0.7, 0, 0.84, 0),
  },
  spring: {
    ui: { stiffness: 400, damping: 30 }, // app spec §6.5
    smooth: { damping: 20, stiffness: 90, mass: 1 },
  },
} as const;

export const glass = (p: Palette): React.CSSProperties => ({
  background: p.glassBg,
  backgroundImage: "linear-gradient(180deg, rgb(255 255 255 / .18), transparent 40%)",
  backdropFilter: "blur(24px) saturate(180%)",
  border: `0.5px solid ${p.glassStroke}`,
  boxShadow: `inset 0 1px 0 ${p.glassHighlight}, 0 1px 2px rgb(0 0 0 / .06), 0 8px 32px rgb(0 0 0 / .12)`,
  borderRadius: theme.radius.card,
});
