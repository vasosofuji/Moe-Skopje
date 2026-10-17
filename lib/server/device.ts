import "server-only";

/** SHA-256 hex of `${deviceId}|${userAgent}` (spec §5.4). Only this hash is used as the assistant's rate-limit key, never the device id. */
export async function deviceHash(deviceId: string, userAgent: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${deviceId}|${userAgent}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// getDeviceId() hands out crypto.randomUUID(); anything else in the header is not from our client.
const DEVICE_ID = /^[\w-]{8,64}$/;

/** Hash for the request's `x-device-id` + user agent, or null when the header is missing or malformed. */
export async function deviceHashOf(req: Request): Promise<string | null> {
  const id = req.headers.get("x-device-id");
  return id && DEVICE_ID.test(id) ? deviceHash(id, req.headers.get("user-agent") ?? "") : null;
}
