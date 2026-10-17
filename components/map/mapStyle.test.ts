import type { Map as MapLibreMap } from "maplibre-gl";
import { expect, test } from "vitest";
import { labelField, localizeLabels } from "./mapStyle";

test("labelField prefers the app language, then falls back to the tile's default name", () => {
  expect(labelField("mk")).toEqual(["coalesce", ["get", "name:mk"], ["get", "name"]]);
  expect(labelField("en")).toEqual(["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]]);
});

test("localizeLabels rewrites named symbol layers only", () => {
  const set: Record<string, unknown> = {};
  const fields: Record<string, unknown> = {
    "place-city": "{name:latin}\n{name:nonlatin}",
    "road-label": ["coalesce", ["get", "name_en"], ["get", "name"]],
    "highway-shield": "{ref}",
    housenumber: "{housenumber}",
    "poi-icon": undefined,
  };
  const map = {
    getStyle: () => ({
      layers: [...Object.keys(fields).map((id) => ({ id, type: "symbol" })), { id: "road-line", type: "line" }],
    }),
    getLayoutProperty: (id: string) => fields[id],
    setLayoutProperty: (id: string, _prop: string, value: unknown) => void (set[id] = value),
  } as unknown as MapLibreMap;
  localizeLabels(map, "mk");
  expect(Object.keys(set).sort()).toEqual(["place-city", "road-label"]);
  expect(set["place-city"]).toEqual(labelField("mk"));
});
