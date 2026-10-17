import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { coords, RoutePlanner, toPlace } from "./RoutePlanner";

test("the planner renders both fields in one card, a swap button and the three travel modes, with no submit button", () => {
  const html = renderToStaticMarkup(<RoutePlanner variant="panel" onClose={() => {}} />);
  for (const text of ["Рута", "Од", "До", "Замени почеток и крај", "Кола", "Велосипед", "Пешки", "Моја локација"]) expect(html).toContain(text);
  expect(html.match(/role="combobox"/g)).toHaveLength(2);
  expect(html).not.toContain('type="submit"');
  expect(html).not.toContain("Заобиколува"); // no result yet
});

test("toPlace checks a /api/places row, keys it by id and picks the second line", () => {
  expect(toPlace({ id: "osm:N1", name: "Рамстор", kind: "poi", category: "mall", address: "Мито Хаџивасилев 2", lng: 21.4, lat: 42 }, "mk")).toEqual({
    id: "osm:N1",
    name: "Рамстор",
    kind: "poi",
    sub: "Мито Хаџивасилев 2",
    lng: 21.4,
    lat: 42,
  });
  expect(toPlace({ id: "local:3", name: "Карпош", nameEn: "Karpoš", kind: "area", lng: 21.39, lat: 42 }, "en")?.name).toBe("Karpoš");
  expect(toPlace({ name: "x", kind: "settlement", lng: 1, lat: 2 }, "mk")?.kind).toBe("area");
  expect(toPlace({ name: "x", lng: "1", lat: 2 }, "mk")).toBeNull();
  expect(coords([21.4254, 41.9981])).toBe("41.99810, 21.42540");
});
