"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { usePrefs } from "@/lib/prefs";
import { translate, type Dict, type Lang, type TVars } from "./core";

// Server code must import pick/translate from "@/lib/i18n/core": everything exported here is a client reference.
export { pick, type Dict, type Lang } from "./core";

type I18n = {
  t(key: keyof Dict, vars?: TVars): string;
  lang: Lang;
  setLang(l: Lang): void;
};

const makeT = (lang: Lang) => (key: keyof Dict, vars?: TVars) => translate(lang, key, vars);

// The default is Macedonian so a component rendered without the provider (a test, a story) still shows copy.
const I18nContext = createContext<I18n>({ lang: "mk", t: makeT("mk"), setLang: () => {} });

/**
 * Language comes from prefs, so it hydrates after the first paint (no SSR mismatch) and persists.
 * Also mirrors lang and theme onto <html>: prefs.theme "system" removes data-theme, otherwise sets it.
 * note: a saved theme that differs from the OS one flashes for a frame; add a pre-paint script if it matters.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [{ lang, theme }, setPrefs] = usePrefs();
  const value = useMemo<I18n>(() => ({ lang, t: makeT(lang), setLang: (l) => setPrefs({ lang: l }) }), [lang, setPrefs]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);

  return <I18nContext value={value}>{children}</I18nContext>;
}

export const useT = () => useContext(I18nContext);
