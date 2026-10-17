import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { getAssistant, resetAssistant, retry, send, settledText } from "./chatStore";

const stream = (...chunks: string[]) =>
  new Response(
    new ReadableStream({
      start(c) {
        for (const x of chunks) c.enqueue(new TextEncoder().encode(x));
        c.close();
      },
    }),
  );

let calls: { messages: { role: string; content: string }[] }[] = [];
const answer = (...replies: (Response | Error)[]) => {
  calls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(init.body as string));
      const next = replies.shift();
      if (next instanceof Error) throw next;
      return next ?? stream("");
    }),
  );
};
const shown = () => getAssistant().messages.map((m) => [m.role, m.text]);

beforeEach(() => resetAssistant());
afterEach(() => vi.unstubAllGlobals());

test("settledText drops a half-typed last word", () => {
  expect(settledText("Во Карпош е ")).toBe("Во Карпош е ");
  expect(settledText("Во Карпош е чи")).toBe("Во Карпош е ");
  expect(settledText("Карпош")).toBe("");
});

test("the conversation lives outside any component, and later turns send it as history", async () => {
  answer(stream("Здраво, ", "свет."), stream("Втор одговор."));
  await send("Прашање 1", "mk");
  expect(shown()).toEqual([["user", "Прашање 1"], ["assistant", "Здраво, свет."]]);
  await send("Прашање 2", "mk");
  expect(calls[1].messages.map((m) => m.content)).toEqual(["Прашање 1", "Здраво, свет.", "Прашање 2"]);
  expect(getAssistant().messages).toHaveLength(4);
});

test("a failed answer is a note kept out of the history, and retry asks the same question again", async () => {
  answer(new Error("offline"), stream("Готово."));
  await send("Прашање", "mk");
  expect(getAssistant().messages.at(-1)).toMatchObject({ role: "assistant", text: "", error: "assistant.error" });
  await retry("mk");
  expect(shown()).toEqual([["user", "Прашање"], ["assistant", "Готово."]]);
  expect(calls).toHaveLength(2);
});

test("429 says so, and 503 turns the assistant off for good", async () => {
  answer(new Response(null, { status: 429 }));
  await send("a", "en");
  expect(getAssistant().messages.at(-1)?.error).toBe("assistant.rateLimited");
  resetAssistant();
  answer(new Response(null, { status: 503 }));
  await send("b", "en");
  expect(getAssistant()).toMatchObject({ disabled: true, busy: false });
  expect(getAssistant().messages.map((m) => m.role)).toEqual(["user"]);
  answer(stream("x"));
  await send("c", "en");
  expect(calls).toHaveLength(0);
});
