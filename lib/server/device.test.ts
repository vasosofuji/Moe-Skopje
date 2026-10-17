import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { deviceHash, deviceHashOf } from "./device";

const DEVICE = "0b6f1c1e-7a52-4b43-8d0e-9f3a7c2b1d11";
const UA = "Mozilla/5.0 (test)";

test("deviceHash is the SHA-256 hex of `${deviceId}|${userAgent}`", async () => {
  const expected = createHash("sha256").update(`${DEVICE}|${UA}`).digest("hex");
  expect(await deviceHash(DEVICE, UA)).toBe(expected);
  expect(await deviceHash(DEVICE, "other agent")).not.toBe(expected);
});

test("deviceHashOf hashes x-device-id + user agent, and is null for a missing or malformed id", async () => {
  const req = (headers: Record<string, string>) => new Request("http://localhost/", { headers });
  expect(await deviceHashOf(req({ "x-device-id": DEVICE, "user-agent": UA }))).toBe(await deviceHash(DEVICE, UA));
  expect(await deviceHashOf(req({}))).toBeNull();
  expect(await deviceHashOf(req({ "x-device-id": "short" }))).toBeNull();
  expect(await deviceHashOf(req({ "x-device-id": "bad id with spaces!!" }))).toBeNull();
});
