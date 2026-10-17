// The app's map-first shell at phone size: muted map, status bar, content floating on top (spec §6.6).
import { theme, type Palette } from "../theme";

export const SCREEN_W = 390;

// Stylised Karpoš-ish street grid; no labels. Drawn in a 390×900 box.
export const MapBackdrop = ({ p, children }: { p: Palette; children?: React.ReactNode }) => (
  <svg width="100%" height="100%" viewBox="0 0 390 900" preserveAspectRatio="xMidYMid slice"
    style={{ position: "absolute", inset: 0 }}>
    <rect width="390" height="900" fill={p.map.land} />
    <path d="M-20 610 C 90 560, 170 640, 260 600 S 380 520, 420 540 L 420 600 C 360 590, 300 660, 240 660 S 90 620, -20 680 Z"
      fill={p.map.water} />
    <path d="M30 120 h110 v90 h-110Z M250 720 h120 v110 h-120Z" fill={p.map.park} rx="12" />
    <g stroke={p.map.minor} strokeWidth="7" strokeLinecap="round">
      {[90, 170, 250, 330].map((x) => <path key={x} d={`M${x} -10 L${x - 30} 910`} />)}
      {[60, 230, 330, 470, 760, 850].map((y) => <path key={y} d={`M-10 ${y} L400 ${y - 25}`} />)}
    </g>
    <g stroke={p.map.road} strokeWidth="13" strokeLinecap="round">
      <path d="M-10 410 L400 370" />
      <path d="M205 -10 L170 910" />
      <path d="M-10 540 C 120 500, 260 520, 400 470" />
    </g>
    {children}
  </svg>
);

const StatusBar = ({ p }: { p: Palette }) => (
  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 54, display: "flex", alignItems: "center",
    justifyContent: "space-between", padding: "14px 32px 0", fontWeight: 600, fontSize: 16, color: p.label }}>
    <span>8:04</span>
    <span style={{ width: 26, height: 12, borderRadius: 3.5, border: `1.5px solid ${p.label}`, opacity: 0.85, padding: 1.5 }}>
      <span style={{ display: "block", width: "70%", height: "100%", background: p.label, borderRadius: 1.5 }} />
    </span>
  </div>
);

export const AppScreen = ({ p, h, map = true, children }: { p: Palette; h: number; map?: boolean; children?: React.ReactNode }) => (
  <div style={{ position: "relative", width: SCREEN_W, height: h, overflow: "hidden", background: p.bg,
    fontFamily: theme.font, color: p.label, letterSpacing: "-0.01em" }}>
    {map && <MapBackdrop p={p} />}
    <StatusBar p={p} />
    {children}
  </div>
);
