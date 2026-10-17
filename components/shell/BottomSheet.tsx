"use client";

import { useEffectEvent, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { cx } from "@/lib/cx";

// The lowest snap is the handle plus a panel's title row (17 px handle, 12 px padding, 18 px eyebrow, 41 px large
// title, 12 px air). Spec §6.5 says 15 %, which is ~110 px on an 812 px phone; a fixed height keeps the title clear of
// the tab bar on short screens too.
const PEEK = 100;
const HANDLE = 17; // the handle row above the content
const PAD_TOP = 12; // the content's pt-3
const AIR = 12; // below the block the middle detent ends at
const FULL = 0.92;
/** 0 = peek, 1 = middle, 2 = full. */
export type Snap = 0 | 1 | 2;

/**
 * Where the middle detent goes: just under the content's `[data-detent]` block (Explore's Today tiles, the route form),
 * so it lands on a section edge instead of cutting a tile in half; clamped to 35–75 % of the sheet's area. Without a
 * block it is half the area.
 */
export function midDetent(blockBottom: number | null, area: number): number | string {
  if (blockBottom === null || area <= 0) return 0.5;
  const px = HANDLE + PAD_TOP + blockBottom + AIR;
  return `${Math.round(Math.min(Math.max(px, area * 0.35), area * 0.75))}px`;
}

/**
 * Phone panel: a non-modal vaul drawer that never closes, so the map behind it stays interactive.
 * Snaps are measured in the area above the tab bar (vaul measures its `container`), so the peek sits above the bar.
 * The sheet itself runs on under the bar to the bottom edge, like iOS.
 * Inner scrolling only at the top snap; at the lower snaps a drag anywhere moves the sheet.
 */
export function BottomSheet({
  snap,
  onSnap,
  title,
  children,
}: {
  snap: Snap;
  onSnap(snap: Snap): void;
  title: string;
  children: ReactNode;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [body, setBody] = useState<HTMLDivElement | null>(null);
  const [mid, setMid] = useState<number | string>(0.5);
  const snaps = useMemo(() => [`${PEEK}px`, mid, FULL], [mid]);
  const top = snap === 2;

  const measure = useEffectEvent(() => {
    const el = body;
    if (!el || !container) return;
    const block = el.querySelector("[data-detent]");
    const bottom = block ? block.getBoundingClientRect().bottom - el.getBoundingClientRect().top - PAD_TOP + el.scrollTop : null;
    setMid(midDetent(bottom, container.clientHeight));
  });
  // On start (a ResizeObserver reports once when it begins) and whenever the content or the area changes size: a tab
  // switch, a route result, a badge, rotation. setMid bails out when the value is unchanged.
  useLayoutEffect(() => {
    if (!container || !body?.firstElementChild) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(container);
    ro.observe(body.firstElementChild);
    return () => ro.disconnect();
  }, [container, body]);

  return (
    <>
      <div ref={setContainer} className="pointer-events-none fixed inset-x-0 top-0 bottom-(--tab-zone) z-10" />
      {container && (
        <Drawer.Root
          open
          modal={false}
          dismissible={false}
          snapPoints={snaps}
          activeSnapPoint={snaps[snap]}
          setActiveSnapPoint={(v) => onSnap(Math.max(0, snaps.indexOf(v ?? snaps[0])) as Snap)}
          container={container}
          noBodyStyles
        >
          <Drawer.Portal>
            <Drawer.Content
              aria-describedby={undefined}
              className="glass glass-strong pointer-events-auto absolute inset-x-2 top-0 flex h-[calc(100%+var(--tab-zone))] flex-col outline-none"
            >
              <Drawer.Handle className="mt-2 mb-1 shrink-0" style={{ width: 36, background: "var(--label-2)" }} />
              <Drawer.Title className="sr-only">{title}</Drawer.Title>
              <div
                ref={setBody}
                data-vaul-no-drag={top ? "" : undefined}
                // At the peek, fade out whatever sits below the title so nothing pokes out under the tab bar.
                style={snap === 0 ? { maskImage: `linear-gradient(#000 ${PEEK - HANDLE - 8}px, transparent ${PEEK - HANDLE}px)` } : undefined}
                className={cx(
                  "min-h-0 flex-1 overscroll-contain px-4 pt-3 pb-[calc(var(--tab-zone)+10dvh)]",
                  top ? "overflow-y-auto" : "overflow-hidden",
                )}
              >
                {/* One wrapper, so the ResizeObserver above sees every content change. */}
                <div className="relative">{children}</div>
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}
    </>
  );
}
