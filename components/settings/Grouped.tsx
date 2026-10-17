"use client";

import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "@/lib/cx";

// iOS inset grouped list: small-caps section headers, 44 px rows inside a rounded tile, hairlines inset to the text.

const spring = { type: "spring", stiffness: 400, damping: 30 } as const;

/** Focus ring drawn inside the row, where the rounded list cannot clip it. */
const insetFocus = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--system-blue) focus-visible:rounded-[10px]";

/** A row that is not a control itself (it holds one, or just shows a value). */
export const rowStatic = "group flex w-full items-center pl-4 text-left";
/** A tappable row: press highlight and inset focus ring. */
export const row = cx(rowStatic, "transition-colors hover:bg-(--label)/4 active:bg-(--label)/8", insetFocus);

export function Section({
  title,
  action,
  footer,
  children,
}: {
  title: string;
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col">
      <div className="flex items-end justify-between gap-3 px-4 pb-1.5">
        <h3 className="t-footnote uppercase text-label-2">{title}</h3>
        {action}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
      {footer && <div className="t-footnote px-4 pt-1.5 text-label-2">{footer}</div>}
    </section>
  );
}

/** One rounded tile of rows; `label` is an optional sub-heading above it (a layer category). */
export function List({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      {label && <p className="t-footnote px-4 pb-1 font-medium text-label-2">{label}</p>}
      <div className="overflow-hidden rounded-card border-[0.5px] border-(--glass-stroke) bg-(--tile)">{children}</div>
    </div>
  );
}

/** Text-only button for a section header ("Show all"); the hit area reaches 44 px tall. */
export function HeaderButton({ onClick, children }: { onClick(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="t-footnote relative rounded-md text-(--system-blue) before:absolute before:-inset-x-2 before:-inset-y-3.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--system-blue)"
    >
      {children}
    </button>
  );
}

/** Inside of a row: monochrome icon, title, trailing value or control. The hairline under it starts at the text. */
export function RowContent({
  icon: Icon,
  title,
  sub,
  wrap,
  children,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  /** Second line under the title (a source name). */
  sub?: ReactNode;
  /** Let a wide control drop under the title on narrow screens instead of squeezing it. */
  wrap?: boolean;
  children?: ReactNode;
}) {
  return (
    <>
      {Icon && <Icon size={17} aria-hidden className="mr-3 shrink-0 text-label-2" />}
      <span className="flex min-h-11 min-w-0 flex-1 flex-wrap items-center justify-end gap-x-3 border-b-[0.5px] border-(--label)/12 py-1 pr-4 group-last:border-b-0">
        <span className={cx("flex flex-col", wrap ? "flex-[1_0_auto]" : "min-w-0 flex-1")}>
          <span className="t-subhead truncate">{title}</span>
          {sub && <span className="t-footnote truncate text-label-2">{sub}</span>}
        </span>
        {children}
      </span>
    </>
  );
}

/** Visual half of an iOS switch; the row it sits in carries role="switch" and aria-checked. */
export function SwitchKnob() {
  return (
    <span
      aria-hidden
      className="relative h-6 w-10 shrink-0 rounded-full bg-(--label)/16 transition-colors group-aria-checked:bg-(--system-green) motion-reduce:transition-none"
    >
      <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-[0_2px_4px_rgb(0_0_0/.2)] transition-transform group-aria-checked:translate-x-4 motion-reduce:transition-none" />
    </span>
  );
}

type Option<T extends string> = { value: T; label: string; lang?: string; title?: string };

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Compact segmented control for a row's trailing edge, as a radio group: one tab stop, arrows move the choice.
 * Segments are 44 px tall for touch; the track and thumb drawn inside are 32 px. `id` names the thumb's layout.
 */
export function Choice<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: Option<T>[];
  value: T;
  onChange(value: T): void;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const step = STEP[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (i + step + options.length) % options.length;
    onChange(options[next].value);
    (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative ml-auto flex h-11 shrink-0 before:absolute before:inset-x-0 before:inset-y-1.5 before:rounded-full before:bg-(--label)/8"
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            lang={o.lang}
            title={o.title}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cx(
              "group/seg relative h-11 px-2 t-footnote font-semibold whitespace-nowrap transition-colors outline-none",
              on ? "text-label" : "text-label-2",
            )}
          >
            {on && (
              <motion.span
                layoutId={id}
                transition={spring}
                className="absolute inset-x-0.5 inset-y-2 rounded-full bg-(--thumb) shadow-[0_2px_6px_rgb(0_0_0/.12),0_1px_1px_rgb(0_0_0/.06)]"
              />
            )}
            <span
              aria-hidden
              className="absolute inset-x-0.5 inset-y-2 rounded-full group-focus-visible/seg:outline-2 group-focus-visible/seg:outline-(--system-blue)"
            />
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
