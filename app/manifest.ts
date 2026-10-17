import type { MetadataRoute } from "next";

// Colours are the light-theme --bg token (app/globals.css) and the iOS system blue accent of the icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Мое Скопје",
    short_name: "Мое Скопје",
    description: "Воздух, прекини, автобуси и градски податоци за Скопје на една карта.",
    lang: "mk",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f2f7",
    theme_color: "#f2f2f7",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
