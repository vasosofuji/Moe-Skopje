// React-free half of i18n, safe to import from server code (route handlers, lib/server/*).
// The "use client" provider and hooks live in ./index.tsx; a server file importing pick or translate
// from "@/lib/i18n" would get a client reference it cannot call, so import from "@/lib/i18n/core".
import { en } from "./en";
import { mk } from "./mk";

export type Lang = "mk" | "en";
export type Dict = typeof mk;
export type TVars = Record<string, string | number>;

const DICTS: Record<Lang, Dict> = { mk, en };

/** Looks `key` up in the `lang` dictionary and fills `{name}` placeholders from `vars`. */
export function translate(lang: Lang, key: keyof Dict, vars?: TVars): string {
  const s = DICTS[lang][key];
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (Object.hasOwn(vars, k) ? String(vars[k]) : m)) : s;
}

/** Picks the `lang` side of a bilingual text, falling back to the other language when it is empty. */
export function pick(text: { mk: string; en: string }, lang: Lang): string {
  return text[lang] || text[lang === "mk" ? "en" : "mk"];
}
