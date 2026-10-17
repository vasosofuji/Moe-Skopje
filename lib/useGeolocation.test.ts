import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { createGeolocation } from "./useGeolocation";

type Watch = { ok(p: unknown): void; err(e: unknown): void; opts: PositionOptions };

/** A navigator.geolocation whose watches the test drives by hand. */
function mockGeo() {
  const watches = new Map<number, Watch>();
  let next = 1;
  const geo = {
    watchPosition: vi.fn((ok: Watch["ok"], err: Watch["err"], opts: PositionOptions) => {
      watches.set(next, { ok, err, opts });
      return next++;
    }),
    clearWatch: vi.fn((id: number) => void watches.delete(id)),
  };
  vi.stubGlobal("navigator", { geolocation: geo });
  const current = () => [...watches.values()].at(-1)!;
  return {
    geo,
    active: () => watches.size,
    fix: (lng: number, lat: number, accuracy = 30) =>
      current().ok({ coords: { longitude: lng, latitude: lat, accuracy }, timestamp: Date.now() }),
    fail: (code: number) => current().err({ code }),
  };
}

beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test("a fix under two minutes old answers at once, without a new watch", async () => {
  const m = mockGeo();
  const g = createGeolocation();
  const first = g.locate();
  m.fix(21.43, 42);
  expect(await first).toEqual([21.43, 42]);
  const calls = m.geo.watchPosition.mock.calls.length;

  vi.setSystemTime(Date.now() + 119_000);
  expect(await g.locate()).toEqual([21.43, 42]); // no further fix is delivered: this would hang if it waited
  expect(m.geo.watchPosition).toHaveBeenCalledTimes(calls);
});

test("watches coarse first, then upgrades to high accuracy; only one watch is ever open", async () => {
  const m = mockGeo();
  const g = createGeolocation();
  const p = g.locate();
  expect(m.geo.watchPosition.mock.calls[0][2].enableHighAccuracy).toBe(false);
  m.fix(21.43, 42, 800);
  await p;
  expect(m.geo.watchPosition.mock.calls[1][2].enableHighAccuracy).toBe(true);
  expect(m.active()).toBe(1);

  m.fix(21.431, 42.001, 12); // a refinement: stored, no second watch
  expect(m.geo.watchPosition).toHaveBeenCalledTimes(2);
  expect(g.get()?.accuracy).toBe(12);
});

test("concurrent calls share one request", async () => {
  const m = mockGeo();
  const g = createGeolocation();
  const a = g.locate();
  const b = g.locate();
  expect(b).toBe(a);
  expect(m.geo.watchPosition).toHaveBeenCalledTimes(1);
  m.fix(21.4, 41.99);
  expect(await Promise.all([a, b])).toEqual([[21.4, 41.99], [21.4, 41.99]]);
});

test("denied, timed out or no geolocation at all give null", async () => {
  const m = mockGeo();
  const g = createGeolocation();
  const denied = g.locate();
  m.fail(1);
  expect(await denied).toBeNull();
  expect(m.active()).toBe(0);

  const retry = g.locate(); // the next tap asks again (the browser answers denied straight away)
  expect(m.geo.watchPosition).toHaveBeenCalledTimes(2);
  m.fail(3); // timeout
  expect(await retry).toBeNull();

  vi.stubGlobal("navigator", {});
  expect(await createGeolocation().locate()).toBeNull();
});

test("a stale fix waits for a fresh one from a restarted watch", async () => {
  const m = mockGeo();
  const g = createGeolocation();
  const first = g.locate();
  m.fix(21.43, 42);
  await first;

  vi.setSystemTime(Date.now() + 121_000);
  let got: unknown = "waiting";
  const again = g.locate().then((at) => (got = at));
  await Promise.resolve();
  expect(got).toBe("waiting");
  expect(m.geo.watchPosition.mock.calls.at(-1)![2].enableHighAccuracy).toBe(false);
  expect(m.active()).toBe(1);

  m.fix(21.5, 42.02);
  await again;
  expect(got).toEqual([21.5, 42.02]);
});

test("a failed GPS watch falls back to the coarse one", async () => {
  const m = mockGeo();
  const g = createGeolocation();
  const p = g.locate();
  m.fix(21.43, 42);
  await p;
  m.fail(2); // position unavailable on the high-accuracy watch
  expect(m.geo.watchPosition.mock.calls.at(-1)![2].enableHighAccuracy).toBe(false);
  expect(m.active()).toBe(1);
});

test("the watch stops while the tab is hidden and resumes when it is back", async () => {
  const doc = { hidden: false, on: undefined as undefined | (() => void), addEventListener: (_: string, fn: () => void) => (doc.on = fn) };
  vi.stubGlobal("document", doc);
  const m = mockGeo();
  const g = createGeolocation();
  const p = g.locate();
  m.fix(21.43, 42);
  await p;
  expect(m.active()).toBe(1);

  doc.hidden = true;
  doc.on?.();
  expect(m.active()).toBe(0);

  doc.hidden = false;
  doc.on?.();
  expect(m.active()).toBe(1);
  expect(m.geo.watchPosition.mock.calls.at(-1)![2].enableHighAccuracy).toBe(true);
});

test("subscribers hear every fix, but the shared position moves only past 25 m", async () => {
  const m = mockGeo();
  const g = createGeolocation();
  const heard = vi.fn();
  g.subscribe(heard);
  const p = g.locate();
  m.fix(21.43, 42);
  await p;
  const first = g.getShared();
  m.fix(21.43005, 42.00005); // about 6 m
  expect(g.getShared()).toBe(first);
  m.fix(21.4306, 42.0004); // about 60 m
  expect(g.getShared()).not.toBe(first);
  expect(heard).toHaveBeenCalledTimes(3);
});
