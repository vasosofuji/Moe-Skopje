"use client";

import { useState, type ReactNode } from "react";
import { Drawer } from "vaul";
import { cx } from "@/lib/cx";

export const SNAPS = [0.15, 0.5, 0.92];
export type Snap = number | string | null;

/**
 * Phone panel: a non-modal vaul drawer that never closes, so the map behind it stays interactive.
 * Snap fractions are of the area above the tab bar (vaul measures its `container`), so even the 15 % snap shows the
 * handle and header above the bar. The sheet itself runs on under the bar to the bottom edge, like iOS.
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
