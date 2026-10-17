import { useSyncExternalStore } from "react";
import { useT, type Dict, type Lang } from "@/lib/i18n";
import { getDeviceId } from "@/lib/prefs";
import { parseReply, type Citation } from "./Citation";

/** An error note names its copy, so it follows the language when that changes. */
type Note = Extract<keyof Dict, "assistant.error" | "assistant.rateLimited">;
/** `at` is when the turn began (ms), kept while the answer streams in. */
export type Message = { role: "user" | "assistant"; text: string; at: number; citations?: Citation[]; error?: Note; pending?: boolean };
type State = { messages: Message[]; busy: boolean; disabled: boolean };
export type Assistant = ReturnType<typeof useAssistant>;

const HISTORY = 20; // the server accepts at most 20 turns
/** A gap this long between two turns gets a time caption. */
export const LONG_PAUSE_MS = 15 * 60_000;

// The conversation lives here, not in a component: the Ask tab, the desktop bar and a remounted panel all show the same one.
const EMPTY: State = { messages: [], busy: false, disabled: false };
let state = EMPTY;
const listeners = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
const setReply = (reply: Omit<Message, "at">) => {
  const last = state.messages.at(-1);
  set({ messages: [...state.messages.slice(0, -1), { ...reply, at: last?.at ?? Date.now() }] });
};
const failed = (error: Note) => setReply({ role: "assistant", text: "", error });

/** The conversation right now, and a fresh start. For tests; components read it through useAssistant. */
export const getAssistant = () => state;
export const resetAssistant = () => set({ messages: [], busy: false, disabled: false });

/** What of the streamed answer to show: up to its last finished word, so a half-typed word never hops between lines. */
export const settledText = (text: string) => text.replace(/\S+$/, "");

const nextFrame = (f: () => void): number => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(f) : (setTimeout(f, 16) as unknown as number));
const cancelFrame = (id: number) => (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame(id) : clearTimeout(id));

/** One question to POST /api/assistant, its answer streamed into the last message at most once per frame. */
export async function send(question: string, lang: Lang) {
  const q = question.trim();
  if (!q || state.busy || state.disabled) return;
  let frame = 0;
  const at = Date.now();
  const history: Message[] = [...state.messages, { role: "user", text: q, at }];
  set({ messages: [...history, { role: "assistant", text: "", at, pending: true }], busy: true });
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
    if (res.status === 503) return set({ messages: history, disabled: true });
    if (res.status === 429) return failed("assistant.rateLimited");
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let raw = "";
    const show = () => {
      frame = 0;
      const { text, citations } = parseReply(raw);
      const shown = settledText(text);
      setReply({ role: "assistant", text: shown, citations, pending: !shown.trim() });
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += value;
      frame ||= nextFrame(show);
    }
    const { text, citations } = parseReply(raw);
    if (text.trim()) setReply({ role: "assistant", text: text.trim(), citations });
    else failed("assistant.error");
  } catch {
    failed("assistant.error");
  } finally {
    if (frame) cancelFrame(frame); // a late frame must not paint over the final answer or the error
    set({ busy: false });
  }
}

/** Asks the last question again after a failed answer, in place of the failure. */
export function retry(lang: Lang) {
  const [q, note] = state.messages.slice(-2);
  if (state.busy || !note?.error || q?.role !== "user") return;
  set({ messages: state.messages.slice(0, -2) });
  return send(q.text, lang);
}

/** The shared conversation and the streamed call to POST /api/assistant. `disabled` turns true when the server has no assistant (503). */
export function useAssistant() {
  const { lang } = useT();
  const snapshot = useSyncExternalStore(subscribe, () => state, () => EMPTY);
  return { ...snapshot, send: (question: string) => send(question, lang), retry: () => retry(lang) };
}
