// Line glyphs drawn in SVG (no emoji). 24×24 viewBox, stroke = currentColor.
import type { CSSProperties } from "react";

type P = { size?: number; style?: CSSProperties };
const svg = (size: number, style: CSSProperties | undefined, children: React.ReactNode, sw = 1.8) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" style={style}>{children}</svg>
);

// Cloud top arc spans x 6..18 at y 4.5..; Shot 3 pushes into this arc for the match cut.
export const CloudRain = ({ size = 24, style }: P) =>
  svg(size, style, <>
    <path d="M7 15.5h10.5a3.5 3.5 0 0 0 .4-7A6 6 0 0 0 6.4 9.6 3 3 0 0 0 7 15.5Z" />
    <path d="M9 18.5l-.8 2M13 18.5l-.8 2M17 18.5l-.8 2" />
  </>);

export const Sun = ({ size = 24, style }: P) =>
  svg(size, style, <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.6 5.6l1 1M17.4 17.4l1 1M5.6 18.4l1-1M17.4 6.6l1-1" />
  </>);

export const Umbrella = ({ size = 24, style }: P) =>
  svg(size, style, <>
    <path d="M3 12a9 9 0 0 1 18 0Z" />
    <path d="M12 12v6.5a2 2 0 0 1-4 0" />
  </>);

export const Barrier = ({ size = 24, style }: P) =>
  svg(size, style, <>
    <rect x="3" y="8" width="18" height="5" rx="1" />
    <path d="M7 8l-3 5M12 8l-3 5M17 8l-3 5M21 8l-3 5M6 13v6M18 13v6" />
  </>);

export const Leaf = ({ size = 24, style }: P) =>
  svg(size, style, <>
    <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" />
    <path d="M5 19l7-7" />
  </>);

export const Cross = ({ size = 24, style }: P) =>
  svg(size, style, <path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5Z" />);

export const Pin = ({ size = 24, style }: P) =>
  svg(size, style, <>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </>);
