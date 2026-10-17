"use client";

import { ArrowUp, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { GlassButton } from "@/components/glass/GlassButton";
import { cx, focusRing } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import { Conversation, Suggestions, useAssistant } from "./AssistantPanel";
import type { Citation } from "./Citation";

const spring = { type: "spring", stiffness: 400, damping: 30 } as const;
const rise = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 12 }, transition: spring };

/**
 * Desktop assistant: a Spotlight-style glass bar docked at the bottom centre of the map, always there.
 * ⌘K / Ctrl+K focuses it; focused and empty it offers suggestions; asking unfolds the conversation above it
 * (max 60vh). Esc or a click outside folds it away; a citation folds it and shows the feature on the map.
 * `left` is the screen width the sidebar covers, so the bar centres in the visible map.
 */
export function AskBar({ left, onCitation }: { left: number; onCitation(c: Citation): void }) {
  const { t } = useT();
  const chat = useAssistant();
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const mac = /Mac|iPhone|iPad/.test(navigator.userAgent);
  const hasChat = chat.messages.length > 0 || chat.disabled;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        field.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const ask = (q: string) => {
    if (!q.trim() || chat.busy) return;
    void chat.send(q);
    setInput("");
    setOpen(true);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(input);
  };
  const cite = (c: Citation) => {
    setOpen(false);
    onCitation(c);
  };

  return (
    <div
      ref={root}
      style={{ left }}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation(); // Esc here is the bar's, not the marker card's
        if (open) setOpen(false);
        else field.current?.blur();
      }}
      className="pointer-events-none fixed right-0 bottom-12 z-20 flex justify-center px-[88px]"
    >
      <div className="pointer-events-auto relative w-full max-w-[560px]">
        <AnimatePresence>
          {open && hasChat && (
            <motion.section
              key="chat"
              {...rise}
              aria-label={t("assistant.title")}
              className="glass glass-strong absolute inset-x-0 bottom-full mb-2 flex max-h-[60vh] flex-col"
            >
              <header className="flex shrink-0 items-center justify-between pt-1 pr-1 pl-4">
                <h2 className="t-footnote font-semibold text-label-2">{t("assistant.title")}</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={t("assistant.collapse")}
                  className={cx("flex size-11 items-center justify-center rounded-full text-label-2", focusRing)}
                >
                  <ChevronDown size={20} aria-hidden />
                </button>
              </header>
              {chat.disabled ? (
                <p className="t-subhead px-4 pb-4 text-label-2">{t("assistant.unavailable")}</p>
              ) : (
                <Conversation chat={chat} onCitation={cite} className="px-4 pb-4" />
              )}
            </motion.section>
          )}
          {focused && !input && !hasChat && (
            <motion.div key="suggest" {...rise} className="absolute inset-x-0 bottom-full mb-3">
              <Suggestions compact onPick={ask} />
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={submit} className="glass glass-pill h-14 w-full gap-3 pr-1.5 pl-5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-(--system-blue)">
          <MessageCircle size={19} aria-hidden className="shrink-0 text-label-2" />
          <input
            ref={field}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => {
              setFocused(true);
              if (hasChat) setOpen(true);
            }}
            onBlur={() => setFocused(false)}
            placeholder={t("assistant.barPlaceholder")}
            aria-label={t("assistant.barPlaceholder")}
            aria-keyshortcuts={mac ? "Meta+K" : "Control+K"}
            maxLength={2000}
            enterKeyHint="send"
            autoComplete="off"
            className="t-body h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-label-2"
          />
          {input.trim() ? (
            <GlassButton size="sm" shape="circle" type="submit" aria-label={t("assistant.send")} disabled={chat.busy} className="shrink-0 bg-(--system-blue) text-white">
              <ArrowUp aria-hidden className="size-5" />
            </GlassButton>
          ) : hasChat && !open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={t("assistant.expand")}
              className={cx("flex size-11 shrink-0 items-center justify-center rounded-full text-label-2", focusRing)}
            >
              <ChevronUp size={20} aria-hidden />
            </button>
          ) : (
            !focused && (
              <kbd aria-hidden className="t-caption mr-2.5 shrink-0 rounded-md bg-(--label)/6 px-1.5 py-0.5 font-sans text-label-2">
                {mac ? "⌘K" : "Ctrl K"}
              </kbd>
            )
          )}
        </form>
      </div>
    </div>
  );
}
