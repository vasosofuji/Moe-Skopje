import { useSyncExternalStore } from "react";
import { z } from "zod";
import type { Lang } from "@/lib/i18n/core";
import { isLayerId, type LayerId } from "@/lib/layers";

export type Prefs = {
  lang: Lang;
  theme: "system" | "light" | "dark";
  layers: LayerId[];
  onboarded: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  lang: "mk",
  theme: "system",
  layers: ["air", "outages-power", "buses"],
  onboarded: false,
};

const PREFS_KEY = "moe-skopje:prefs";
const DEVICE_KEY = "moe-skopje:device";

const StoredPrefs = z.object({
  lang: z.enum(["mk", "en"]),
  theme: z.enum(["system", "light", "dark"]),
  layers: z.array(z.string()),
  onboarded: z.boolean(),
});

const defaults = (): Prefs => ({ ...DEFAULT_PREFS, layers: [...DEFAULT_PREFS.layers] });

/** Reads prefs from `storage` (default localStorage). Any problem yields the defaults; unknown layer ids are dropped. */
export function loadPrefs(storage?: Storage): Prefs {
  try {
    const raw = (storage ?? localStorage).getItem(PREFS_KEY);
    if (raw === null) return defaults();
    const parsed = StoredPrefs.safeParse(JSON.parse(raw));
    if (!parsed.success) return defaults();
    return { ...parsed.data, layers: parsed.data.layers.filter(isLayerId) };
  } catch {
    return defaults();
  }
}

export function savePrefs(p: Prefs, storage?: Storage): void {
  try {
    (storage ?? localStorage).setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Storage blocked or full: prefs live in memory for this session only.
  }
}

/**
 * A v4 UUID that never throws. crypto.randomUUID only exists in secure contexts (https, localhost), so over
 * http://<LAN-ip> (phone testing) fall back to getRandomValues, and to Math.random if there is no crypto at all.
 * The id is a rate-limit pseudonym, not a secret.
 */
function randomId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (typeof c?.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

let memoryDeviceId: string | undefined;

/** Anonymous random id for this browser; the server hashes it with the user agent (spec §5.4). */
export function getDeviceId(storage?: Storage): string {
  try {
    const s = storage ?? localStorage;
    let id = s.getItem(DEVICE_KEY);
    if (!id) {
      id = randomId();
      s.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    // Storage blocked: keep one id for the page's lifetime so rate limits still apply to it.
    return (memoryDeviceId ??= randomId());
  }
}

// One shared store so every usePrefs() caller (provider, shell, settings) sees the same value.
// The server snapshot is always the defaults and localStorage is only read on the client, so
// hydration matches the server HTML and React then re-renders with the saved prefs.
let current: Prefs | undefined;
const listeners = new Set<() => void>();

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
const getSnapshot = () => (current ??= loadPrefs());
const getServerSnapshot = () => DEFAULT_PREFS;

function updatePrefs(patch: Partial<Prefs>) {
  current = { ...getSnapshot(), ...patch };
  savePrefs(current);
  listeners.forEach((l) => l());
}

export function usePrefs(): [Prefs, (p: Partial<Prefs>) => void] {
  return [useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot), updatePrefs];
}
