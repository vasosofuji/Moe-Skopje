"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { cx } from "@/lib/cx";

// The lowest snap is the handle plus a panel's title row (17 px handle, 12 px padding, 18 px eyebrow, 41 px large
// title, 12 px air), all of it above the tab bar.
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
 * The snaps are measured in the area above the tab bar (vaul measures its `container`), and the container clips, so
 * the sheet's bottom edge always sits on the bar, at rest and while dragged. The content is laid out once at full
 * height and only translates; nothing in it is masked, lazily painted or re-rendered while the sheet moves.
 * Inner scrolling only at the top snap; at the lower snaps a drag anywhere moves the sheet. Drag only: a tap on the
 * handle does not cycle the snaps.
 *
 * A `[data-sheet-pin]` block (the chat) is sized to the top snap's visible area (`--sheet-pin-h`) and kept bottom-aligned
 * with the visible part of the sheet at every snap and through a drag: it is shifted up by how far the sheet sits
 * below its top snap, a transform written in the same task as vaul's own and eased with the same curve when it snaps.
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
  const [sheet, setSheet] = useState<HTMLDivElement | null>(null);
  const [body, setBody] = useState<HTMLDivElement | null>(null);
  const [mid, setMid] = useState<number | string>(0.5);
  const area = useRef(0);
  const pinned = useRef<{ el?: HTMLElement; lift?: string }>({});
  const snaps = useMemo(() => [`${PEEK}px`, mid, FULL], [mid]);
  const top = snap === 2;

  const pin = useEffectEvent(() => {
    const el = body?.querySelector<HTMLElement>("[data-sheet-pin]");
    const y = sheet && /translate3d\([^,]+,\s*(-?[\d.]+)px/.exec(sheet.style.transform)?.[1];
    if (!el || !y) return;
    const lift = `translate3d(0, ${Math.min(0, area.current * (1 - FULL) - Number(y)).toFixed(1)}px, 0)`;
    if (pinned.current.el === el && pinned.current.lift === lift) return; // our own write comes back as a mutation
    pinned.current = { el, lift };
    el.style.transform = lift;
  });
  const measure = useEffectEvent(() => {
    const el = body;
    if (!el || !container) return;
    // Hidden panels stay mounted (display: none, no boxes): use the shown panel's block.
    const block = [...el.querySelectorAll("[data-detent]")].find((b) => b.getClientRects().length > 0);
    const bottom = block ? block.getBoundingClientRect().bottom - el.getBoundingClientRect().top - PAD_TOP + el.scrollTop : null;
    area.current = container.clientHeight;
    setMid(midDetent(bottom, area.current));
    pin();
  });
  // On start (a ResizeObserver reports once when it begins), on a panel switch, and whenever the content or the area
  // changes size: a route result, a badge, rotation. setMid bails out when the value is unchanged.
  useLayoutEffect(() => {
    if (!container || !body?.firstElementChild) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(container);
    ro.observe(body.firstElementChild);
    return () => ro.disconnect();
  }, [container, body, title]);

  // data-moving while vaul animates the sheet to a snap (with vaul's drag class, the only time it needs will-change).
  // Native listeners: React does not deliver transitionrun here.
  useEffect(() => {
    if (!sheet) return;
    const mark = (e: TransitionEvent) => {
      if (e.target === sheet && e.propertyName === "transform") sheet.toggleAttribute("data-moving", e.type === "transitionrun");
    };
    const types = ["transitionrun", "transitionend", "transitioncancel"] as const;
    types.forEach((t) => sheet.addEventListener(t, mark));
    return () => types.forEach((t) => sheet.removeEventListener(t, mark));
  }, [sheet]);

  // vaul moves the sheet through its inline transform; a panel mounting or being shown also needs its pin placed.
  useEffect(() => {
    if (!sheet || !body) return;
    const mo = new MutationObserver(() => pin());
    mo.observe(sheet, { attributes: true, attributeFilter: ["style"] });
    mo.observe(body, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
    pin();
    return () => mo.disconnect();
  }, [sheet, body]);

  return (
    <>
      <div
        ref={setContainer}
        className="pointer-events-none fixed inset-x-0 top-0 bottom-[var(--tabbar-h,calc(49px_+_env(safe-area-inset-bottom)))] z-10 overflow-hidden"
      />
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
              ref={setSheet}
              aria-describedby={undefined}
              style={{ height: `${FULL * 100}%` }}
              className={cx(
                // Full width, square bottom corners on the bar. A near-opaque surface without backdrop blur: a blur
                // under a moving sheet re-samples the map on every frame of a drag.
                "glass pointer-events-auto absolute inset-x-0 top-0 flex flex-col rounded-b-none border-b-0 bg-(--glass-bg-solid) [backdrop-filter:none] outline-none",
                // vaul's stylesheet keeps will-change on for good; only while dragged (vaul's class) or snapping.
                "will-change-auto! data-moving:will-change-transform! [&.vaul-dragging]:will-change-transform!",
                // Everything is painted up front (no lazy rows) and placeholders hold still.
                "[&_*]:[content-visibility:visible]! [&_.skeleton]:animate-none",
                // The pin follows a snap with the sheet's own timing (vaul's curve, the .25 s from globals.css).
                "[&_[data-sheet-pin]]:transition-transform [&_[data-sheet-pin]]:duration-250 [&_[data-sheet-pin]]:ease-[cubic-bezier(0.32,0.72,0,1)] [&.vaul-dragging_[data-sheet-pin]]:transition-none",
              )}
            >
              <Drawer.Handle preventCycle className="mt-2 mb-1 shrink-0" style={{ width: 36, background: "var(--label-2)" }} />
              <Drawer.Title className="sr-only">{title}</Drawer.Title>
              <div
                ref={setBody}
                data-vaul-no-drag={top ? "" : undefined}
                className={cx(
                  // A size container: 100cqh is this content box, which is the top snap's visible area.
                  "min-h-0 flex-1 overscroll-contain pt-3 pr-[max(16px,env(safe-area-inset-right))] pb-4 pl-[max(16px,env(safe-area-inset-left))] [container-type:size] [--sheet-pin-h:100cqh]",
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
