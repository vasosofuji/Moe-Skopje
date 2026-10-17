"use client";

import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { cx, focusRing } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import { skopjeTime } from "@/lib/i18n/format";
import { ChatField } from "./ChatInput";
import { CitationChip, type Citation } from "./Citation";
import { LONG_PAUSE_MS, useAssistant, type Assistant } from "./chatStore";

/** Three dots in a small grey capsule: the only sign that an answer is on its way; they pulse only when motion is allowed. */
function Typing({ label }: { label: string }) {
  return (
    <span role="status" aria-label={label} className="inline-flex h-7 items-center gap-1 rounded-full bg-(--label)/6 px-3">
      {[0, 200, 400].map((delay) => (
        <span key={delay} aria-hidden className="size-1.5 rounded-full bg-(--label-2) motion-safe:animate-pulse [animation-duration:1.2s]" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}

const NEAR_BOTTOM = 64; // px from the end of the log that still counts as "reading the latest"

/**
 * The message log, the way Messages lays it out: your lines are blue bubbles on the right, the answer is plain text on the
 * surface itself with citation chips under it. Lines of one speaker sit 4 px apart, speakers 16 px, and a time caption
 * only marks a long pause. The log scrolls itself (scrollIntoView would also move the sheet or page around it) and
 * follows the answer only while the reader is at the bottom. An answer is as wide as the log, so streaming adds lines
 * under it and never changes its width.
 */
export function Conversation({ chat, onCitation, className }: { chat: Assistant; onCitation(c: Citation): void; className?: string }) {
  const { t } = useT();
  const logRef = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  const turns = chat.messages.length;

  // A new turn always brings the log to the end; text arriving within a turn only does so for a reader who is there.
  useLayoutEffect(() => {
    follow.current = true;
  }, [turns]);
  useLayoutEffect(() => {
    const log = logRef.current;
    if (log && follow.current) log.scrollTop = log.scrollHeight;
  }, [chat.messages]);

  return (
    <div
      ref={logRef}
      role="log"
      aria-label={t("assistant.title")}
      aria-busy={chat.busy}
      onScroll={(e) => {
        const log = e.currentTarget;
        follow.current = log.scrollHeight - log.scrollTop - log.clientHeight < NEAR_BOTTOM;
      }}
      className={cx("flex min-h-0 flex-col overflow-y-auto overscroll-contain", className)}
    >
      {chat.messages.map((m, i) => {
        const prev = chat.messages[i - 1];
        const stamp = !!prev && m.role === "user" && m.at - prev.at > LONG_PAUSE_MS;
        const gap = !prev ? "" : stamp ? "mt-2" : prev.role === m.role ? "mt-1" : "mt-4";
        return (
          <div key={i} className="contents">
            {stamp && <p className="t-caption mt-4 self-center text-label-2 tabular-nums">{skopjeTime(new Date(m.at))}</p>}
            {m.role === "user" ? (
              <p className={cx("t-body max-w-[85%] self-end rounded-[18px] bg-(--system-blue) px-3 py-2 break-words whitespace-pre-wrap text-white", gap)}>{m.text}</p>
            ) : (
              <div className={cx("flex min-w-0 flex-col items-start gap-2", gap)}>
                {m.pending ? (
                  <Typing label={t("assistant.typing")} />
                ) : m.error ? (
                  <p className="t-footnote text-label-2">
                    {t(m.error)}
                    {m.error === "assistant.error" && i === chat.messages.length - 1 && !chat.busy && (
                      <>
                        {" "}
                        <button type="button" onClick={chat.retry} className={cx("relative font-semibold text-(--system-blue) before:absolute before:-inset-x-2 before:-inset-y-3 before:content-['']", focusRing)}>
                          {t("common.retry")}
                        </button>
                      </>
                    )}
                  </p>
                ) : (
                  <div className="t-body flex flex-col gap-2.5 leading-[1.45] break-words">
                    {m.text
                      .split(/\n{2,}/)
                      .filter(Boolean)
                      .map((para, j) => (
                        <p key={j} className="whitespace-pre-wrap">
                          {para}
                        </p>
                      ))}
                  </div>
                )}
                {!!m.citations?.length && (
                  <div className="-my-1.5 flex w-full gap-2 overflow-x-auto overscroll-x-contain py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {m.citations.map((c) => (
                      <CitationChip key={`${c.layer}:${c.featureId}`} c={c} onClick={() => onCitation(c)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Ask tab on phones and tablets (inside the sheet or sidebar, which own the glass surface): the conversation and the
 * input as one surface, the field being the panel's bottom edge under a hairline. The panel fills its container (the
 * sheet's visible area, which pins it to the bottom there, or the sidebar), the log takes the room above the field and
 * scrolls itself with the newest lines at the bottom, so the field never moves. Desktop uses AskBar instead.
 */
export function AssistantPanel({ onCitation }: { onCitation(c: Citation): void }) {
  const { t } = useT();
  const chat = useAssistant();
  const [input, setInput] = useState("");
  const talking = chat.messages.length > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chat.busy) return;
    void chat.send(input);
    setInput("");
  };

  if (chat.disabled) return <p className="t-subhead px-1 py-2 text-label-2">{t("assistant.unavailable")}</p>;

  return (
    <div data-sheet-pin className="flex h-(--sheet-pin-h,100%) flex-col">
      {talking ? (
        // The first line's auto margin keeps a short conversation down by the field.
        <Conversation chat={chat} onCitation={onCitation} className="flex-1 px-1 pb-3 [&>:first-child>:first-child]:mt-auto" />
      ) : (
        <p className="t-footnote mt-auto px-1 pb-3 text-label-2">{t("assistant.empty")}</p>
      )}
      <form onSubmit={submit} className={cx("shrink-0", talking && "border-t-[0.5px] border-(--label)/10 pt-3")}>
        <ChatField value={input} onChange={setInput} canSend={!chat.busy && !!input.trim()} />
      </form>
    </div>
  );
}
