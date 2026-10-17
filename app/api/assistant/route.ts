import { AssistantBodySchema, allowMessage, clientIp, streamAnswer } from "@/lib/server/assistant";
import { deviceHashOf } from "@/lib/server/reports";

export const maxDuration = 60; // a few tool rounds plus the answer

const fail = (status: number, code: string) => Response.json({ code }, { status });

/**
 * POST /api/assistant (JSON `{ messages, lang }`, header x-device-id) → streamed text/plain answer,
 * always ending in `\n[[cite:<json>]]` (`[]` when a tool returned no features). 400 { code } | 429 { code: "rate" } | 503 { code: "disabled" }.
 */
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return fail(503, "disabled"); // the UI shows its disabled state

  const hash = await deviceHashOf(req);
  if (!hash) return fail(400, "device");

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail(400, "input");
  }
  const body = AssistantBodySchema.safeParse(json);
  if (!body.success) return fail(400, "input");
  if (!allowMessage(hash, clientIp(req))) return fail(429, "rate");

  const { messages, lang } = body.data;
  while (messages[0].role === "assistant") messages.shift(); // the client sends its last 20 turns; the API wants a user turn first
  return new Response(streamAnswer(messages, lang), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
