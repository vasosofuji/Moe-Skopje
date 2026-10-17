"use client";

import { LocateFixed } from "lucide-react";
import { useState } from "react";
import { GlassButton } from "@/components/glass/GlassButton";
import { cx } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import { useMap } from "./MapView";

/**
 * "My location". The icon turns blue on the tap, before any fix arrives, and pulses until the camera has moved or the
 * lookup failed. The wait lives in this button's own state, so a tap never re-renders the shell.
 */
export function LocateButton({ className }: { className?: string }) {
  const { t } = useT();
  const { location, locate } = useMap();
  const [busy, setBusy] = useState(false);
  return (
    <GlassButton
      shape="circle"
      aria-label={t("map.myLocation")}
      onClick={() => {
        setBusy(true);
        void locate(true).finally(() => setBusy(false));
      }}
      className={className}
    >
      <LocateFixed size={20} aria-hidden className={cx((location || busy) && "text-(--system-blue)", busy && "motion-safe:animate-pulse")} />
    </GlassButton>
  );
}
