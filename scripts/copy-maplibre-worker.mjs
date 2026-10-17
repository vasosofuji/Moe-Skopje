// maplibre-gl 6 is ESM-only and looks for its worker next to its own module URL, which Turbopack's chunks don't have.
// So the worker is served from public/ and MapView points setWorkerUrl at it. Runs after install, before dev and before build (package.json), so it is there however the app starts.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";

const from = new URL("../node_modules/maplibre-gl/dist/", import.meta.url);
const to = new URL("../public/maplibre/", import.meta.url);
mkdirSync(to, { recursive: true });
copyFileSync(new URL("maplibre-gl-worker.mjs", from), new URL("maplibre-gl-worker.mjs", to)); // throws if missing: no map without it
for (const file of ["maplibre-gl-worker.mjs.map", "maplibre-gl-shared.mjs"]) {
  if (existsSync(new URL(file, from))) copyFileSync(new URL(file, from), new URL(file, to));
}
