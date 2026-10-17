import { afterEach, expect, test, vi } from "vitest";
import { DEFAULT_PREFS, getDeviceId, loadPrefs } from "./prefs";

/** Minimal in-memory Storage: just what prefs.ts touches. */
function memStorage(init: Record<string, string>): Storage {
  const data = { ...init };
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  } as unknown as Storage;
}

test("loadPrefs returns defaults when storage throws", () => {
  const bad = {
    getItem: () => {
      throw new Error("denied");
    },
  } as unknown as Storage;
  expect(loadPrefs(bad)).toEqual(DEFAULT_PREFS);
});

test("loadPrefs returns defaults on corrupt JSON", () => {
  const s = memStorage({ "moe-skopje:prefs": "{not json" });
  expect(loadPrefs(s)).toEqual(DEFAULT_PREFS);
});

test("loadPrefs drops unknown layer ids and keeps valid ones", () => {
  const s = memStorage({
    "moe-skopje:prefs": JSON.stringify({ ...DEFAULT_PREFS, layers: ["air", "bogus"], onboarded: true }),
  });
  expect(loadPrefs(s).layers).toEqual(["air"]);
  expect(loadPrefs(s).onboarded).toBe(true);
});

test("a new visitor starts with air, water outages and buses", () => {
  expect(DEFAULT_PREFS.layers).toEqual(["air", "outages-water", "buses"]);
  expect(loadPrefs(memStorage({})).layers).toEqual(["air", "outages-water", "buses"]);
});

test("loadPrefs drops hidden layers, so waste stays off even if it was saved", () => {
  const s = memStorage({ "moe-skopje:prefs": JSON.stringify({ ...DEFAULT_PREFS, layers: ["air", "waste", "buses"] }) });
  expect(loadPrefs(s).layers).toEqual(["air", "buses"]);
});

test("getDeviceId is stable across calls", () => {
  const s = memStorage({});
  expect(getDeviceId(s)).toBe(getDeviceId(s));
});

// crypto.randomUUID only exists in secure contexts, so http://<LAN-ip> (phone testing) has no randomUUID.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

test("getDeviceId works without crypto.randomUUID and stays stable", () => {
  vi.stubGlobal("crypto", { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
  const s = memStorage({});
  const id = getDeviceId(s);
  expect(id).toMatch(UUID_V4);
  expect(getDeviceId(s)).toBe(id);
});

test("getDeviceId never throws, even with no crypto and blocked storage", () => {
  vi.stubGlobal("crypto", undefined);
  const blocked = {
    getItem: () => {
      throw new Error("denied");
    },
  } as unknown as Storage;
  const id = getDeviceId(blocked);
  expect(id).toMatch(UUID_V4);
  expect(getDeviceId(blocked)).toBe(id);
});
