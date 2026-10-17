"use client";

import { ChevronDown, ChevronUp, CornerUpRight } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { RoutePlanner } from "@/components/route/RoutePlanner";
import { cx, focusRing } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import { spring } from "@/lib/motion";
import { Conversation } from "./AssistantPanel";
import { ChatField } from "./ChatInput";
import type { Citation } from "./Citation";
import { useAssistant } from "./chatStore";

const iconButton = cx("flex size-11 shrink-0 items-center justify-center rounded-full text-label-2", focusRing);

/**
 * A part of the bar's surface that folds away to nothing (and stays mounted, so a planner keeps its fields and route).
 * It clips rather than hides: a hidden overflow is a scroll container, and scrollIntoView would shift its content while it unfolds.
 */
function Fold({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={open ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
      transition={spring}
      inert={!open}
      className="overflow-clip"
    >
      {children}
    </motion.div>
  );
}

/**
 * Desktop Spotlight bar, docked at the bottom centre of the map: ask the assistant, or open directions with the glyph at
 * its trailing edge. The conversation or the planner unfolds above the field inside the same glass, so bar and panel are
 * one surface that grows upward (the field's 22 px corners sit concentric in the surface's 28 px). ⌘K / Ctrl+K focuses the
 * input. Esc folds the panel; a click outside folds the chat (not the planner, whose points are picked on the map). A
 * folded planner keeps its route on the map until its X clears it. `left` is the screen width the sidebar covers.
 */
export function AskBar({ left, onCitation }: { left: number; onCitation(c: Citation): void }) {
  const { t } = useT();
  const chat = useAssistant();
  const [input, setInput] = useState("");
  const [view, setView] = useState<"chat" | "route" | null>(null);
  const [routing, setRouting] = useState(false); // the planner is mounted (it may be folded away)
  const [focused, setFocused] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
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
    if (!input.trim() || chat.busy || chat.disabled) return;
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
      <div className="glass glass-strong pointer-events-auto flex w-full max-w-[560px] flex-col overflow-clip rounded-[28px]">
        {hasChat && (
          <Fold open={chatOpen}>
            {chat.disabled ? (
              <p className="t-subhead p-4 text-label-2">{t("assistant.unavailable")}</p>
            ) : (
              <Conversation chat={chat} onCitation={cite} className="max-h-[min(50vh,480px)] p-4" />
            )}
          </Fold>
        )}

        {routing && (
          <Fold open={view === "route"}>
            <div className="max-h-[60vh] overflow-y-auto overscroll-contain p-4">
              <RoutePlanner
                variant="bar"
                insetLeft={left}
                onClose={() => {
                  setRouting(false);
                  setView(null);
                }}
              />
            </div>
          </Fold>
        )}

        <form onSubmit={submit} className={cx("flex items-end gap-1 p-1.5", (chatOpen || view === "route") && "border-t-[0.5px] border-(--label)/10")}>
          <ChatField
            ref={field}
            value={input}
            onChange={setInput}
            canSend={!chat.busy && !chat.disabled && !!input.trim()}
            onFocus={() => {
              setFocused(true);
              if (hasChat && view === null) setView("chat");
            }}
            onBlur={() => setFocused(false)}
            hint={
              !hasChat &&
              !focused &&
              !input && (
                <kbd aria-hidden className="t-caption mb-3 shrink-0 rounded-md bg-(--label)/6 px-1.5 py-0.5 font-sans text-label-2">
                  {mac ? "⌘K" : "Ctrl K"}
                </kbd>
              )
            }
          />
          {hasChat && (
            <button
              type="button"
              onClick={() => setView(chatOpen ? null : "chat")}
              aria-label={t(chatOpen ? "assistant.collapse" : "assistant.expand")}
              aria-expanded={chatOpen}
              className={iconButton}
            >
              {chatOpen ? <ChevronDown size={20} aria-hidden /> : <ChevronUp size={20} aria-hidden />}
            </button>
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
