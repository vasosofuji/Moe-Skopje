import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": fromRoot("./"),
      // "server-only" throws outside Next's react-server condition.
      "server-only": fromRoot("./test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    passWithNoTests: true,
    exclude: ["**/node_modules/**", "ad/**"],
    maxWorkers: 4,
  },
});
