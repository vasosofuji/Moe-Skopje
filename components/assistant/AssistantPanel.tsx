"use client";

import { ArrowUp, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { GlassButton } from "@/components/glass/GlassButton";
import { GlassPill } from "@/components/glass/GlassPill";
import { cx } from "@/lib/cx";
import { useT } from "@/lib/i18n";
import { getDeviceId } from "@/lib/prefs";
import { CitationChip, PRESS, parseReply, type Citation } from "./Citation";

type Message = { role: "user" | "assistant"; text: string; citations?: Citation[]; error?: boolean; pending?: boolean };

const SUGGESTIONS = ["assistant.suggest.1", "assistant.suggest.2", "assistant.suggest.3"] as const;
const HISTORY = 20; // the server accepts at most 20 turns

/** Three dots; they only bounce when the user allows motion. */
function Typing({ label }: { label: string }) {
  return (
    <span role="status" aria-label={label} className="inline-flex h-5 items-center gap-1">
      {[0, 150, 300].map((delay) => (
        <span key={delay} aria-hidden className="size-1.5 rounded-full bg-label-2 motion-safe:animate-bounce" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </span>
  );
}

/**
 * Ask tab: chat with the city assistant (POST /api/assistant, streamed). Standalone; the shell mounts it in the Ask tab
 * (mobile sheet) or a 400 px floating panel (desktop) and owns the glass surface. Citation chips call `onCitation`.
 */
export function AssistantPanel({ onCitation }: { onCitation(c: Citation): void }) {
  const { t, lang } = useT();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // Scroll the log itself; scrollIntoView would also scroll the sheet or page around it.
  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  const setReply = (reply: Message) => setMessages((m) => [...m.slice(0, -1), reply]);
  const failed = (text: string) => setReply({ role: "assistant", text, error: true });

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history: Message[] = [...messages, { role: "user", text: q }];
    setMessages([...history, { role: "assistant", text: "", pending: true }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": getDeviceId() },
        body: JSON.stringify({
          lang,
          // error notes are UI, not conversation
          messages: history.filter((m) => !m.error && m.text).slice(-HISTORY).map((m) => ({ role: m.role, content: m.text })),
        }),
      });
      if (res.status === 503) return setDisabled(true);
      if (res.status === 429) return failed(t("assistant.rateLimited"));
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let raw = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += value;
        const { text, citations } = parseReply(raw);
        setReply({ role: "assistant", text, citations, pending: !text.trim() });
      }
      const { text, citations } = parseReply(raw);
      if (text.trim()) setReply({ role: "assistant", text: text.trim(), citations });
      else failed(t("assistant.error"));
    } catch {
      failed(t("assistant.error"));
    } finally {
      setBusy(false);
    }
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    void send(input);
  };

  if (disabled) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <Sparkles aria-hidden className="size-8 text-label-2" />
        <p className="t-headline">{t("assistant.unavailable")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <h2 className="t-title2 px-1">{t("assistant.title")}</h2>

      <div ref={logRef} role="log" aria-busy={busy} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1 pb-1">
        {messages.length === 0 ? (
          <>
            <p className="t-subhead text-label-2">{t("assistant.intro")}</p>
            <div className="flex flex-col items-start gap-2">
              {SUGGESTIONS.map((k) => (
                <GlassPill key={k} as="button" type="button" onClick={() => void send(t(k))} className={cx("glass-button t-subhead py-2 text-left", PRESS)}>
                  {t(k)}
                </GlassPill>
              ))}
            </div>
          </>
        ) : (
          messages.map((m, i) =>
            m.role === "user" ? (
              <p key={i} className="t-body max-w-[85%] self-end rounded-[18px] bg-(--system-blue)/85 px-3.5 py-2 break-words whitespace-pre-wrap text-white">
                {m.text}
              </p>
            ) : (
              <div key={i} className="flex max-w-[92%] flex-col items-start gap-2 self-start">
                <p className={cx("t-body rounded-[18px] bg-(--label)/6 px-3.5 py-2 break-words whitespace-pre-wrap", m.error && "text-label-2")}>
                  {m.pending ? <Typing label={t("assistant.typing")} /> : m.text}
                </p>
                {!!m.citations?.length && (
                  <div className="flex max-w-full flex-wrap gap-2">
                    {m.citations.map((c) => (
                      <CitationChip key={`${c.layer}:${c.featureId}`} c={c} onClick={() => onCitation(c)} />
                    ))}
                  </div>
                )}
              </div>
            ),
          )
        )}
      </div>

      <form onSubmit={submit}>
        <GlassPill className="w-full pr-1 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-(--system-blue)">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("assistant.placeholder")}
            aria-label={t("assistant.placeholder")}
            maxLength={2000}
            enterKeyHint="send"
            className="t-body min-w-0 flex-1 bg-transparent outline-none placeholder:text-label-2"
          />
          <GlassButton size="sm" aria-label={t("assistant.send")} onClick={() => submit()} className="shrink-0 bg-(--system-blue) text-white">
            <ArrowUp aria-hidden className="size-5" />
          </GlassButton>
        </GlassPill>
      </form>
    </div>
  );
}
