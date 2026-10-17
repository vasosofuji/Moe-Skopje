"use client";

import { useEffect } from "react";

// Displacement map stretched over the panel: the red ramp drives x, the green ramp drives y, and a blurred
// neutral-grey core cancels both, so only a thin band at the edges bends the backdrop inward, like a lens rim.
const MAP = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">` +
    `<linearGradient id="x"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#000"/></linearGradient>` +
    `<linearGradient id="y" x2="0" y2="1"><stop offset="0" stop-color="#0f0"/><stop offset="1" stop-color="#000"/></linearGradient>` +
    `<filter id="b"><feGaussianBlur stdDeviation="3"/></filter>` +
    `<rect width="100" height="100" fill="url(#x)"/>` +
    `<rect width="100" height="100" fill="url(#y)" style="mix-blend-mode:screen"/>` +
    `<rect x="6" y="6" width="88" height="88" rx="10" fill="#808080" filter="url(#b)"/>` +
    `</svg>`,
)}`;

/** SVG filter behind `.glass-strong` refraction. Rendered once in the root layout. */
export function RefractionFilter() {
  useEffect(() => {
    // Only Chromium renders SVG filters inside backdrop-filter. Safari and Firefox may still report support
    // and then drop the whole backdrop, so also require the Chromium-only navigator.userAgentData.
    if (CSS.supports("backdrop-filter", "url(#x)") && "userAgentData" in navigator) {
      document.documentElement.dataset.refraction = "";
    }
  }, []);

  return (
    <svg aria-hidden width="0" height="0" className="pointer-events-none absolute">
      <filter id="glass-refraction" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={MAP} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />
        <feDisplacementMap in="SourceGraphic" in2="map" scale="48" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
