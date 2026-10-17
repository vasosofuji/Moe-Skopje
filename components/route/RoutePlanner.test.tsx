import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { RoutePlanner } from "./RoutePlanner";

test("the planner renders both fields, the three travel modes and the submit button", () => {
  const html = renderToStaticMarkup(<RoutePlanner variant="floating" onClose={() => {}} />);
  for (const text of ["Рута", "Од", "До", "Кола", "Велосипед", "Пешки", "Најди рута"]) expect(html).toContain(text);
  expect(html).not.toContain("Заобиколува"); // no result yet
});

test("inline (sheet) and floating (desktop) differ only in the surface", () => {
  const inline = renderToStaticMarkup(<RoutePlanner variant="inline" onClose={() => {}} />);
  expect(inline).not.toContain("glass-strong");
  expect(renderToStaticMarkup(<RoutePlanner variant="floating" onClose={() => {}} />)).toContain("glass-strong");
});
