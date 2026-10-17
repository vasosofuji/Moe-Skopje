import { expect, test } from "vitest";
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

test("getDeviceId is stable across calls", () => {
  const s = memStorage({});
  expect(getDeviceId(s)).toBe(getDeviceId(s));
});
