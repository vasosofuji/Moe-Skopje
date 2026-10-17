"use client";

import { useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { cx } from "@/lib/cx";

// The lowest snap is the handle plus a panel's title row (17 px handle, 12 px padding, 18 px eyebrow, 41 px large
// title, 12 px air). Spec §6.5 says 15 %, which is ~110 px on an 812 px phone; a fixed height keeps the title clear of
// the tab bar on short screens too.
const PEEK = 100;
const HANDLE = 17; // the handle row above the content
export const SNAPS: (number | string)[] = [`${PEEK}px`, 0.5, 0.92];
export type Snap = number | string | null;

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
  const top = snap === SNAPS[SNAPS.length - 1];
  return (
    <>
      <div ref={setContainer} className="pointer-events-none fixed inset-x-0 top-0 bottom-(--tab-zone) z-10" />
      {container && (
        <Drawer.Root
          open
          modal={false}
          dismissible={false}
          snapPoints={SNAPS}
          activeSnapPoint={snap}
          setActiveSnapPoint={onSnap}
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
                data-vaul-no-drag={top ? "" : undefined}
                // At the peek, fade out whatever sits below the title so nothing pokes out under the tab bar.
                style={
                  snap === SNAPS[0]
                    ? { maskImage: `linear-gradient(#000 ${PEEK - HANDLE - 8}px, transparent ${PEEK - HANDLE}px)` }
                    : undefined
                }
                className={cx(
                  "min-h-0 flex-1 overscroll-contain px-4 pt-3 pb-[calc(var(--tab-zone)+10dvh)]",
                  top ? "overflow-y-auto" : "overflow-hidden",
                )}
              >
                {children}
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}
    </>
  );
}
