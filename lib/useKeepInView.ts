import { useEffect } from "react";

/**
 * While `on` is truthy (a different truthy value counts as a new start), keeps the focused element in view: once on the next
 * frame, and again whenever the on-screen keyboard resizes the visual viewport. "nearest" moves nothing that is already visible.
 */
export function useKeepInView(on: unknown) {
  useEffect(() => {
    if (!on) return;
    const keep = () => document.activeElement?.scrollIntoView({ block: "nearest" });
    const frame = requestAnimationFrame(keep);
    window.visualViewport?.addEventListener("resize", keep);
    return () => {
      cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener("resize", keep);
    };
  }, [on]);
}
