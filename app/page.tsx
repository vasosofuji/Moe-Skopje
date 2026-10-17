"use client";

// Temporary check page for the glass primitives (Task 1). Task 4 replaces it with the map shell.
import { Layers, LocateFixed, Search, SunMoon } from "lucide-react";
import type { CSSProperties } from "react";
import { Glass } from "@/components/glass/Glass";
import { GlassButton } from "@/components/glass/GlassButton";
import { GlassCard } from "@/components/glass/GlassCard";
import { GlassPill } from "@/components/glass/GlassPill";
import { StatusBadge } from "@/components/glass/StatusBadge";

const SCENE: CSSProperties = {
  backgroundImage: [
    "linear-gradient(rgb(255 255 255 / .3) 1px, transparent 1px)",
    "linear-gradient(90deg, rgb(255 255 255 / .3) 1px, transparent 1px)",
    "radial-gradient(circle at 18% 22%, var(--system-pink), transparent 38%)",
    "radial-gradient(circle at 82% 30%, var(--system-blue), transparent 42%)",
    "radial-gradient(circle at 45% 88%, var(--system-yellow), transparent 42%)",
    "linear-gradient(135deg, var(--system-indigo), var(--system-teal))",
  ].join(","),
  backgroundSize: "36px 36px, 36px 36px, auto, auto, auto, auto",
};

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function toggleTheme() {
  const root = document.documentElement;
  const dark = root.dataset.theme
    ? root.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
}

export default function Page() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4" style={SCENE}>
      <div className="flex w-full max-w-md flex-col gap-4">
        <GlassPill className="h-12">
          <Search size={18} aria-hidden className="text-label-2" />
          <span className="t-body text-label-2">Пребарај Скопје</span>
        </GlassPill>

        <Glass strong className="flex flex-col gap-3 p-6">
          <h1 className="t-large-title">Мое Скопје</h1>
          <p className="t-subhead text-label-2">Живи податоци за градот, на едно место.</p>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="live" updatedAt={minutesAgo(3)} />
            <StatusBadge status="stale" updatedAt={minutesAgo(120)} />
            <StatusBadge status="offline" updatedAt={minutesAgo(0)} />
            <StatusBadge status="static" updatedAt={minutesAgo(0)} />
          </div>
        </Glass>

        <div className="flex items-start gap-3">
          <GlassCard className="flex-1">
            <p className="t-footnote text-label-2">Воздух · Центар</p>
            <p className="t-title2">18 µg/m³</p>
            <p className="t-caption mt-1" style={{ color: "var(--c-air)" }}>PM10 · добар</p>
          </GlassCard>
          <div className="flex flex-col gap-3">
            <GlassButton size="sm" aria-label="Слоеви" onClick={() => {}}>
              <Layers size={20} />
            </GlassButton>
            <GlassButton aria-label="Моја локација" onClick={() => {}}>
              <LocateFixed size={20} />
            </GlassButton>
          </div>
        </div>

        <GlassButton onClick={toggleTheme}>
          <SunMoon size={20} aria-hidden />
          Промени тема
        </GlassButton>
      </div>
    </main>
  );
}
