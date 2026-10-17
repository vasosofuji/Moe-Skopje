import { expect, test } from "vitest";
import { parseReply, type Citation } from "./Citation";

const cite: Citation = {
  layer: "air",
  featureId: "air-1000",
  lng: 21.39,
  lat: 42.0,
  source: "Pulse.eco",
  ageMin: 3,
  title: "Карпош",
  status: "live",
};
const raw = `PM10 во Карпош е 45 µg/m³.\n[[cite:${JSON.stringify([cite])}]]`;

test("parseReply strips the citation trailer even when it arrives split across chunks", () => {
  // Every prefix of the stream is what the client holds after some chunk: the marker never shows as text.
  for (let i = 0; i <= raw.length; i++) {
    const { text } = parseReply(raw.slice(0, i));
    expect(text).not.toContain("[");
    expect(raw.startsWith(text)).toBe(true);
  }
  expect(parseReply(raw)).toEqual({ text: "PM10 во Карпош е 45 µg/m³.", citations: [cite] });
});

test("parseReply drops a citation of a hidden layer", () => {
  const waste = `Hi\n[[cite:${JSON.stringify([{ ...cite, layer: "waste" }, cite])}]]`;
  expect(parseReply(waste)).toEqual({ text: "Hi", citations: [cite] });
});

test("parseReply keeps plain text and drops malformed citations", () => {
  expect(parseReply("Hello [world]")).toEqual({ text: "Hello [world]", citations: [] });
  const bad = `Hi\n[[cite:${JSON.stringify([{ ...cite, lng: "x" }, { ...cite, layer: "nope" }, cite])}]]`;
  expect(parseReply(bad)).toEqual({ text: "Hi", citations: [cite] });
});
