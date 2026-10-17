"use client";

import { Search } from "lucide-react";
import { useId, useState, type FocusEvent } from "react";
import { Glass } from "@/components/glass/Glass";
import { useMap } from "@/components/map/MapView";
import { featureCenter } from "@/components/map/renderLayer";
import { TIER1, toggleLayer } from "@/components/onboarding/LayerGrid";
import { cx, focusRing } from "@/lib/cx";
import { pick, useT } from "@/lib/i18n";
import { LAYERS, type LayerId } from "@/lib/layers";
import { usePrefs } from "@/lib/prefs";
import type { Feature } from "@/lib/sources/types";
import { cachedLayers } from "@/lib/useLayer";

const MAX_RESULTS = 6;

type Hit = { key: string; layer: LayerId; title: string; sub: string; run(): void };

/**
 * Search over layer names (switches the layer on) and the titles of features already loaded (flies there and opens
 * the card), in both languages. `floating` is the glass pill over the map; otherwise it is a field inside a panel.
 */
export function SearchPill({ floating, className }: { floating?: boolean; className?: string }) {
  const { t, lang } = useT();
  const [prefs, setPrefs] = usePrefs();
  const { flyTo, select } = useMap();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const listId = useId();

  const q = query.trim().toLocaleLowerCase();
  const matches = (s: string) => s.toLocaleLowerCase().includes(q);
  const hits: Hit[] = !q
    ? []
    : [
        ...TIER1.filter((id) => matches(t(LAYERS[id].titleKey))).map((id) => ({
          key: `layer:${id}`,
          layer: id,
          title: t(LAYERS[id].titleKey),
          sub: t("map.layers"),
          run: () => {
            if (!prefs.layers.includes(id)) setPrefs({ layers: toggleLayer(prefs.layers, id) });
          },
        })),
        ...cachedLayers().flatMap(({ id, data }) =>
          (data.features.features as Feature[])
            .filter((f) => matches(f.properties.title.mk) || matches(f.properties.title.en))
            .map((f) => ({
              key: `${id}:${f.properties.id}`,
              layer: id,
              title: pick(f.properties.title, lang),
              sub: t(LAYERS[id].titleKey),
              run: () => {
                flyTo(featureCenter(f.geometry), 15);
                select(f);
              },
            })),
        ),
      ].slice(0, MAX_RESULTS);

  const choose = (hit: Hit) => {
    hit.run();
    setQuery("");
    setOpen(false);
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const onBlur = (e: FocusEvent<HTMLFormElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
  };

  const field = (
    <>
      <Search size={18} aria-hidden className="shrink-0 text-label-2" />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => e.key === "Escape" && setQuery("")}
        placeholder={t("search.placeholder")}
        aria-label={t("search.placeholder")}
        aria-controls={listId}
        enterKeyHint="search"
        autoComplete="off"
        className="t-body h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-label-2"
      />
    </>
  );

  const results = open && !!q && (
    <>
      <ul id={listId} aria-label={t("shell.searchResults")}>
        {hits.map((hit) => {
          const { icon: Icon, color } = LAYERS[hit.layer];
          return (
            <li key={hit.key}>
              <button
                type="button"
                onClick={() => choose(hit)}
                className={cx(
                  "flex min-h-12 w-full items-center gap-3 rounded-[10px] px-2.5 text-left hover:bg-(--label)/6",
                  focusRing,
                )}
              >
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ background: color }}
                >
                  <Icon size={16} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="t-subhead block truncate font-semibold">{hit.title}</span>
                  <span className="t-footnote block truncate text-label-2">{hit.sub}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!hits.length && <p className="t-subhead px-2.5 py-3 text-label-2">{t("shell.noResults")}</p>}
    </>
  );

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (hits[0]) choose(hits[0]);
      }}
      onBlur={onBlur}
      className={cx("relative", className)}
    >
      {floating ? (
        // One surface: the results unfold out of the pill and share its glass, corners and shadow (the row is 1 px
        // under --search-h for the hairline border).
        <Glass
          strong={!!results}
          className="flex flex-col overflow-hidden rounded-3xl has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-(--system-blue)"
        >
          <div className="flex h-[calc(var(--search-h)-1px)] shrink-0 items-center gap-2 px-4">{field}</div>
          {/* Never taller than the free map: they stop above the controls row, the sheet and the tab bar. */}
          {results && (
            <div className="max-h-[calc(100dvh-var(--map-t)-var(--controls-b)-var(--control)-var(--gap))] overflow-y-auto overscroll-contain border-t-[0.5px] border-(--label)/10 p-1.5">
              {results}
            </div>
          )}
        </Glass>
      ) : (
        <>
          <div className="flex h-11 items-center gap-2 rounded-full bg-(--label)/6 px-3.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-(--system-blue)">
            {field}
          </div>
          {/* In the sidebar the results are part of the panel, right under the field. */}
          {results && <div className="mt-1.5">{results}</div>}
        </>
      )}
    </form>
  );
}
