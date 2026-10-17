// Places phone-size UI onto a phone screen in a 1920×1080 asset, measured once per asset (plan Task 4 step 6).
import { quadToMatrix3d, type Pt } from "./quad";
import { SCREEN_W } from "./AppScreen";

type Quad = [Pt, Pt, Pt, Pt];

export const SCREENS: Record<"P1" | "H1", { quad: Quad; radius: number }> = {
  // P1.png scaled to 1920×1080: screen glass inside the bezel.
  P1: { quad: [[798, 173], [1124, 173], [1124, 905], [798, 905]], radius: 44 },
  // H1 clip frame 0: phone lying on the table, slight perspective.
  H1: { quad: [[810, 263], [1111, 263], [1142, 790], [790, 790]], radius: 36 },
};

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const size = (q: Quad) => ({
  w: (dist(q[0], q[1]) + dist(q[3], q[2])) / 2,
  h: (dist(q[0], q[3]) + dist(q[1], q[2])) / 2,
});

/** Content height at SCREEN_W width that keeps the screen's aspect ratio. */
export const screenHeight = (at: keyof typeof SCREENS) => {
  const { w, h } = size(SCREENS[at].quad);
  return Math.round((SCREEN_W * h) / w);
};

export const Screen = ({ at, opacity = 1, children }: { at: keyof typeof SCREENS; opacity?: number; children: React.ReactNode }) => {
  const { quad, radius } = SCREENS[at];
  const h = screenHeight(at);
  const r = (radius * SCREEN_W) / size(quad).w;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: SCREEN_W, height: h, transformOrigin: "0 0",
      transform: quadToMatrix3d(SCREEN_W, h, quad), borderRadius: r, overflow: "hidden", opacity }}>
      {children}
    </div>
  );
};
