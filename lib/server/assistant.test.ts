import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Feature, LayerResponse } from "@/lib/sources/types";
import {
  ASSISTANT_PER_HOUR,
  ASSISTANT_PER_IP_HOUR,
  ASSISTANT_PER_MINUTE,
  allowMessage,
  findPlace,
  makeTools,
  resetAssistantLimits,
  streamAnswer,
  summarizeLayer,
} from "./assistant";
import { parseReply } from "@/components/assistant/Citation";
import { translate } from "@/lib/i18n/core";
import { POST } from "@/app/api/assistant/route";

// The Anthropic SDK is replaced by a scripted tool runner, so no test here can reach the network.
const h = vi.hoisted(() => ({ toolRunner: ((): unknown => ({ [Symbol.asyncIterator]: async function* () {} })) as (params: unknown) => unknown }));
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {}
  class Anthropic {
    static APIError = APIError;
    beta = { messages: { toolRunner: (params: unknown) => h.toolRunner(params) } };
  }
  return { default: Anthropic };
});

beforeEach(() => resetAssistantLimits());

const point = (id: string, lng: number, lat: number, severity?: 0 | 1 | 2 | 3): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lng, lat] },
  properties: { id, kind: "air-station", title: { mk: `Станица ${id}`, en: `Station ${id}` }, severity, value: 40, unit: "µg/m³" },
});

const layer = (features: Feature[], status: LayerResponse["status"] = "live", minutesAgo = 3): LayerResponse => ({
  id: "air",
  status,
  updatedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  source: { name: "Pulse.eco", url: "https://skopje.pulse.eco" },
  features: { type: "FeatureCollection", features },
});

const rows = (text: string) => text.split("\n").filter((l) => /^s\d+ \|/.test(l));

test("summarizeLayer caps at 15 features and includes status + age", () => {
  const features = Array.from({ length: 20 }, (_, i) => point(`s${i}`, 21.4 + i / 100, 42, i === 7 ? 3 : 0));
  const text = summarizeLayer(layer(features, "stale", 3), "mk");

  expect(text).toContain("status stale");
  expect(text).toContain("3 min");
  expect(text).toContain("Pulse.eco");
  expect(rows(text)).toHaveLength(15);
  expect(rows(text)[0]).toMatch(/^s7 \| Станица s7 \| 40 µg\/m³ \|/); // highest severity first, title in the asked language
  expect(summarizeLayer(layer(features), "en")).toContain("Station s7");
  expect(summarizeLayer(layer([], "offline"), "en")).toContain("demo data");
});

test("summarizeLayer with near sorts by distance", () => {
  const features = [point("s1", 21.5, 42.05, 3), point("s2", 21.43, 42.0), point("s3", 21.45, 42.01)];
  const ids = rows(summarizeLayer(layer(features), "en", [21.425, 41.998])).map((l) => l.split(" | ")[0]);
  expect(ids).toEqual(["s2", "s3", "s1"]);
});

test("find_place matches Latin input to Cyrillic name", async () => {
  const [first] = await findPlace("karpos");
  expect(first.name).toBe("Карпош");
  // a point inside the Skopje bbox (21.25,41.90,21.60,42.10)
  expect(first.lng).toBeGreaterThan(21.25);
  expect(first.lng).toBeLessThan(21.6);
  expect(first.lat).toBeGreaterThan(41.9);
  expect(first.lat).toBeLessThan(42.1);

  expect((await findPlace("Aerodrom"))[0].name).toBe("Аеродром");
  expect((await findPlace("ka")).length).toBeLessThanOrEqual(5);
  expect(await findPlace("k")).toEqual([]); // one letter is too short to search
});

test("the tools are get_layer, list_reports and find_place, with eager input streaming", () => {
  const tools = makeTools("mk", []);
  expect(tools.map((t) => t.name)).toEqual(["get_layer", "list_reports", "find_place"]);
  expect(tools.every((t) => t.eager_input_streaming)).toBe(true);
});

test("allowMessage lets 20 messages per device through each hour", () => {
  const t0 = 1_000_000;
  for (let i = 0; i < ASSISTANT_PER_HOUR; i++) expect(allowMessage("device-a", "1.1.1.1", t0 + i)).toBe(true);
  expect(allowMessage("device-a", "1.1.1.2", t0 + 100)).toBe(false);
  expect(allowMessage("device-b", "1.1.1.2", t0 + 100)).toBe(true); // per device
  expect(allowMessage("device-a", "1.1.1.1", t0 + 60 * 60_000 + 1)).toBe(true); // the oldest one has aged out
});

test("allowMessage: rotating device ids from one IP stops at 40 per hour", () => {
  const t0 = 1_000_000;
  for (let i = 0; i < ASSISTANT_PER_IP_HOUR; i++) expect(allowMessage(`fresh-${i}`, "9.9.9.9", t0 + i * 1000)).toBe(true);
  expect(allowMessage("fresh-new", "9.9.9.9", t0 + 50_000)).toBe(false);
  expect(allowMessage("fresh-new", "8.8.8.8", t0 + 50_000)).toBe(true); // another network is unaffected
  expect(allowMessage("fresh-late", "9.9.9.9", t0 + 60 * 60_000 + 1)).toBe(true); // the oldest one has aged out
});

test("allowMessage: a global cap of 60 per minute applies to every caller together", () => {
  const t0 = 1_000_000;
  for (let i = 0; i < ASSISTANT_PER_MINUTE; i++) expect(allowMessage(`dev-${i}`, `10.0.0.${i}`, t0 + i)).toBe(true);
  expect(allowMessage("dev-extra", "10.0.1.1", t0 + 100)).toBe(false);
  expect(allowMessage("dev-extra", "10.0.1.1", t0 + 60_000 + 10)).toBe(true); // the minute rolled over
});

test("a request the global cap turned away does not use up the caller's own quota", () => {
  const t0 = 1_000_000;
  for (let i = 0; i < ASSISTANT_PER_MINUTE; i++) allowMessage(`dev-${i}`, `10.0.0.${i}`, t0);
  for (let i = 0; i < 5; i++) expect(allowMessage("patient", "7.7.7.7", t0 + 1)).toBe(false);
  for (let i = 0; i < ASSISTANT_PER_HOUR; i++) expect(allowMessage("patient", "7.7.7.7", t0 + 61_000 + i)).toBe(true);
});

const ask = (headers: Record<string, string>) =>
  POST(
    new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ lang: "en", messages: [{ role: "user", content: "How is the air?" }] }),
    }),
  );
const device = (i: number) => ({ "x-device-id": `device-number-${i}-aaaa` });

test("POST /api/assistant: a fresh device id per request does not get around the per-IP limit", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const statuses: number[] = [];
  for (let i = 0; i < ASSISTANT_PER_IP_HOUR + 1; i++) {
    const res = await ask({ ...device(i), "x-real-ip": "203.0.113.7" });
    statuses.push(res.status);
    await res.text();
  }
  expect(statuses.slice(0, ASSISTANT_PER_IP_HOUR).every((s) => s === 200)).toBe(true);
  expect(statuses[ASSISTANT_PER_IP_HOUR]).toBe(429);
});

test("POST /api/assistant keys on x-real-ip, else the first x-forwarded-for entry, else a shared 'unknown'", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const fill = async (headers: Record<string, string>, from: number) => {
    for (let i = 0; i < ASSISTANT_PER_IP_HOUR; i++) await (await ask({ ...device(from + i), ...headers })).text();
  };
  await fill({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }, 0);
  expect((await ask({ ...device(500), "x-forwarded-for": "198.51.100.1, 10.9.9.9" })).status).toBe(429); // same first entry
  expect((await ask({ ...device(501), "x-forwarded-for": "198.51.100.2" })).status).toBe(200);
  expect((await ask({ ...device(502), "x-real-ip": "198.51.100.3", "x-forwarded-for": "198.51.100.1" })).status).toBe(200); // x-real-ip wins
  expect((await ask({ ...device(503), "x-real-ip": "198.51.100.1", "x-forwarded-for": "198.51.100.4" })).status).toBe(429);
  await fill({}, 600);
  expect((await ask(device(700))).status).toBe(429); // no IP headers at all: one shared bucket
});

const savedKey = process.env.ANTHROPIC_API_KEY;
afterEach(() => {
  if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = savedKey;
});

test("POST /api/assistant is 503 { code: disabled } without ANTHROPIC_API_KEY", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const res = await POST(
    new Request("http://localhost/api/assistant", {
      method: "POST",
      headers: { "content-type": "application/json", "x-device-id": "0b6f1c1e-7a52-4b43-8d0e-9f3a7c2b1d11" },
      body: JSON.stringify({ lang: "mk", messages: [{ role: "user", content: "Каков е воздухот во Карпош?" }] }),
    }),
  );
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({ code: "disabled" });
});

// --- the streamed answer: citation trailer (M5) and retries (M6) ---------------------------------------------------------

type Turn = { events: unknown[]; fail?: Error; beforeEvents?: () => Promise<void> };
const delta = (text: string) => ({ type: "content_block_delta", delta: { type: "text_delta", text } });
/** One model turn as the SDK's tool runner yields it: an event stream plus finalMessage(). */
const streamOf = ({ events, fail, beforeEvents }: Turn) => ({
  async *[Symbol.asyncIterator]() {
    await beforeEvents?.();
    for (const e of events) yield e;
    if (fail) throw fail;
  },
  finalMessage: async () => ({ stop_reason: "end_turn", content: [{ type: "text" }] }),
});
const runnerOf = (...turns: Turn[]) => ({
  params: { messages: [] },
  async *[Symbol.asyncIterator]() {
    for (const t of turns) yield streamOf(t);
  },
});
/** Scripts what each toolRunner() call returns, in order; `calls` records the params it was given. */
function script(...runners: ReturnType<typeof runnerOf>[]) {
  const calls: { tools: { name: string; run(input: unknown): Promise<string> }[] }[] = [];
  h.toolRunner = (params) => {
    calls.push(params as (typeof calls)[number]);
    return runners.shift() ?? runnerOf();
  };
  return calls;
}
const answerOf = async (lang: "mk" | "en" = "en") => new Response(streamAnswer([{ role: "user", content: "Hi" }], lang)).text();
const TRAILER = /\n\[\[cite:(.*)\]\]$/;

test("the answer always ends with the server's own citation trailer, even when there is nothing to cite", async () => {
  script(runnerOf({ events: [delta("Здраво.")] }));
  const raw = await answerOf("mk");
  expect(raw).toBe("Здраво.\n[[cite:[]]]");
  expect(parseReply(raw)).toEqual({ text: "Здраво.", citations: [] });
});

test("the trailer lists what the tools returned (deduplicated), and parseReply reads it back", async () => {
  const calls = script(
    runnerOf({
      events: [delta("Три училишта.")],
      beforeEvents: async () => {
        const getLayer = calls[0].tools.find((t) => t.name === "get_layer")!;
        await getLayer.run({ id: "schools" });
        await getLayer.run({ id: "schools" }); // the same three again
      },
    }),
  );
  const raw = await answerOf("en");
  const { text, citations } = parseReply(raw);
  expect(text).toBe("Три училишта.");
  expect(citations).toHaveLength(3);
  expect(new Set(citations.map((c) => c.featureId)).size).toBe(3);
  expect(citations.every((c) => c.layer === "schools" && c.status === "static")).toBe(true);
});

test("a trailer the model wrote itself cannot supply citations: the server's trailer is last and the client reads only that", async () => {
  const forged = [{ layer: "air", featureId: "air-forged", lng: 21.4, lat: 42, source: "Evil", ageMin: 0, title: "Forged", status: "live" }];
  const mark = `\n[[cite:${JSON.stringify(forged)}]]`;
  script(runnerOf({ events: [delta("Sure."), delta(mark.slice(0, 9)), delta(mark.slice(9))] }));
  const raw = await answerOf();
  expect(raw).toMatch(/\n\[\[cite:\[\]\]\]$/); // the real trailer, empty
  expect(parseReply(raw).citations).toEqual([]);
  // while the forged text is still the newest thing in the stream it is not a trailer either: more text follows it
  expect(parseReply(`Sure.${mark} and more`).citations).toEqual([]);
  expect(TRAILER.exec(raw)?.[1]).toBe("[]");
});

test("an error ends the answer with the inline message and still the trailer", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  script(runnerOf({ events: [delta("Part")], fail: new Error("boom") }));
  const raw = await answerOf("en");
  expect(raw).toBe(`Part\n\n${translate("en", "assistant.error")}\n[[cite:[]]]`);
});

test("a turn that failed before any text is re-issued once, and the answer is not doubled", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const calls = script(runnerOf({ events: [], fail: new SyntaxError("bad tool json") }), runnerOf({ events: [delta("Hi there.")] }));
  const raw = await answerOf("en");
  expect(calls).toHaveLength(2);
  expect(raw).toBe("Hi there.\n[[cite:[]]]");
  expect(warn).toHaveBeenCalledWith(expect.stringMatching(/before any text.*re-issu/));
});

test("once text has streamed, a failure is never re-issued: the text is not repeated, the inline error ends the answer", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const calls = script(
    runnerOf({ events: [delta("Checking the air. ")], fail: new SyntaxError("bad tool json") }),
    runnerOf({ events: [delta("Checking the air. Fine.")] }), // what a re-issue would have produced
  );
  const raw = await answerOf("en");
  expect(calls).toHaveLength(1);
  expect(raw).toBe(`Checking the air. \n\n${translate("en", "assistant.error")}\n[[cite:[]]]`);
  expect(raw.match(/Checking the air\./g)).toHaveLength(1);
});

test("a turn that keeps failing before any text gives up after the retries with the inline error", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const calls = script(...Array.from({ length: 5 }, () => runnerOf({ events: [], fail: new SyntaxError("bad tool json") })));
  const raw = await answerOf("en");
  expect(calls.length).toBeLessThanOrEqual(3);
  expect(raw).toBe(`\n\n${translate("en", "assistant.error")}\n[[cite:[]]]`);
});
