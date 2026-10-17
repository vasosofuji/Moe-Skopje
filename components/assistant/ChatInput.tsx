"use client";

import { ArrowUp } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode, type Ref } from "react";
import { cx } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import { useKeepInView } from "@/lib/useKeepInView";

/**
 * The chat text field: one line that grows to four (22 px each), then scrolls. Enter sends through the enclosing form,
 * Shift+Enter starts a new line. 11 px above and below make one line 44 px tall, the height of the buttons next to it.
 */
export function ChatInput({ ref, className, value, onKeyDown, onFocus, onBlur, ...rest }: ComponentProps<"textarea">) {
  const own = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  useKeepInView(focused); // a phone keyboard must not cover it

  useLayoutEffect(() => {
    const el = own.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`; // max-h clamps it at four lines
  }, [value]);

  return (
    <textarea
      {...rest}
      ref={(el) => {
        own.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      value={value}
      rows={1}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        // keyCode 229 is the IME still composing (Enter then confirms a candidate)
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229 && !e.defaultPrevented) {
          e.preventDefault();
          e.currentTarget.form?.requestSubmit();
        }
      }}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      className={cx("t-body block max-h-[110px] min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-[11px] outline-none placeholder:text-label-2", className)}
    />
  );
}

/**
 * The composer: a rounded field (22 px) with a hairline border and the send button inside it, grey until there is
 * something to send. It goes in a <form>; the form's onSubmit does the sending. `hint` sits left of the button.
 */
export function ChatField({
  ref,
  value,
  onChange,
  canSend,
  hint,
  onFocus,
  onBlur,
}: {
  ref?: Ref<HTMLTextAreaElement>;
  value: string;
  onChange(value: string): void;
  canSend: boolean;
  hint?: ReactNode;
  onFocus?(): void;
  onBlur?(): void;
}) {
  const { t } = useT();
  return (
    <div className="flex min-w-0 flex-1 items-end gap-1 rounded-[22px] border-[0.5px] border-(--label)/15 bg-(--label)/4 pr-1.5 pl-3.5 focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-(--system-blue)">
      <ChatInput
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={t("assistant.barPlaceholder")}
        aria-label={t("assistant.barPlaceholder")}
        maxLength={2000}
        enterKeyHint="send"
        autoComplete="off"
      />
      {hint}
      <button
        type="submit"
        disabled={!canSend}
        aria-label={t("assistant.send")}
        className="relative mb-[6px] flex size-8 shrink-0 items-center justify-center rounded-full bg-(--system-blue) text-white before:absolute before:-inset-1.5 before:content-[''] disabled:bg-(--label)/10 disabled:text-label-2"
      >
        <ArrowUp size={18} strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}
