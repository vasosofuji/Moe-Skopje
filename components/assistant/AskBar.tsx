"use client";

import { ArrowUp, ChevronDown, ChevronUp, CornerUpRight, MessageCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { GlassButton } from "@/components/glass/GlassButton";
import { RoutePlanner } from "@/components/route/RoutePlanner";
import { cx, focusRing } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import { spring } from "@/lib/motion";
import { Conversation, useAssistant } from "./AssistantPanel";
import type { Citation } from "./Citation";

const hidden = { opacity: 0, y: 12 };
const shown = { opacity: 1, y: 0 };
const panel = "glass glass-strong absolute inset-x-0 bottom-full mb-2 flex max-h-[60vh] flex-col";
const iconButton = cx("flex size-11 shrink-0 items-center justify-center rounded-full text-label-2", focusRing);

/**
 * Desktop Spotlight bar, docked at the bottom centre of the map: ask the assistant, or open directions with the glyph at
 * its trailing edge. Both unfold in the same glass panel above the bar (max 60vh). ⌘K / Ctrl+K focuses the input.
 * Esc folds the panel; a click outside folds the chat (not the planner, whose points are picked on the map). A folded
 * planner keeps its route on the map until its X clears it. `left` is the screen width the sidebar covers.
 */
export function AskBar({ left, onCitation }: { left: number; onCitation(c: Citation): void }) {
  const { t } = useT();
  const chat = useAssistant();
  const [input, setInput] = useState("");
  const [view, setView] = useState<"chat" | "route" | null>(null);
  const [routing, setRouting] = useState(false); // the planner is mounted (it may be folded away)
  const [focused, setFocused] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const mac = /Mac|iPhone|iPad/.test(navigator.userAgent);
  const hasChat = chat.messages.length > 0 || chat.disabled;
  const chatOpen = view === "chat" && hasChat;

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
    if (view !== "chat") return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setView(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [view]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chat.busy) return;
    void chat.send(input);
    setInput("");
    setView("chat");
  };
  const cite = (c: Citation) => {
    setView(null);
    onCitation(c);
  };
  const toggleRoute = () => {
    if (view === "route") return setView(null);
    setRouting(true);
    setView("route");
  };

  return (
    <div
      ref={root}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation(); // Esc here is the bar's, not the marker card's
        if (view) setView(null);
        else field.current?.blur();
      }}
      className="pointer-events-none fixed right-(--safe-r) bottom-(--ask-b) left-(--sidebar-r) z-(--z-bar) flex justify-center px-(--ask-inset)"
    >
      <div className="pointer-events-auto relative w-full max-w-[560px]">
        <AnimatePresence>
          {chatOpen && (
            <motion.section key="chat" initial={hidden} animate={shown} exit={hidden} transition={spring} aria-label={t("assistant.title")} className={panel}>
              {chat.disabled ? (
                <p className="t-subhead p-4 text-label-2">{t("assistant.unavailable")}</p>
              ) : (
                <Conversation chat={chat} onCitation={cite} className="p-4" />
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {routing && (
          // Folded, not unmounted, so the route stays on the map and the fields keep their places.
          <motion.div
            initial={hidden}
            animate={view === "route" ? shown : hidden}
            transition={spring}
            inert={view !== "route"}
            className={cx(panel, "overflow-y-auto overscroll-contain p-4", view !== "route" && "pointer-events-none")}
          >
            <RoutePlanner
              variant="bar"
              insetLeft={left}
              onClose={() => {
                setRouting(false);
                setView(null);
              }}
            />
          </motion.div>
        )}

        <form
          onSubmit={submit}
          className="glass glass-pill h-14 w-full gap-2 pr-1.5 pl-5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-(--system-blue)"
        >
          <MessageCircle size={19} aria-hidden className="mr-1 shrink-0 text-label-2" />
          <input
            ref={field}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => {
              setFocused(true);
              if (hasChat && view === null) setView("chat");
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
          ) : hasChat ? (
            <button
              type="button"
              onClick={() => setView(chatOpen ? null : "chat")}
              aria-label={t(chatOpen ? "assistant.collapse" : "assistant.expand")}
              aria-expanded={chatOpen}
              className={iconButton}
            >
              {chatOpen ? <ChevronDown size={20} aria-hidden /> : <ChevronUp size={20} aria-hidden />}
            </button>
          ) : (
            !focused && (
              <kbd aria-hidden className="t-caption shrink-0 rounded-md bg-(--label)/6 px-1.5 py-0.5 font-sans text-label-2">
                {mac ? "⌘K" : "Ctrl K"}
              </kbd>
            )
          )}
          <button
            type="button"
            onClick={toggleRoute}
            aria-label={t("route.title")}
            aria-pressed={view === "route"}
            className={cx(iconButton, routing && "text-(--system-blue)", view === "route" && "bg-(--system-blue)/12")}
          >
            <CornerUpRight size={20} aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}
