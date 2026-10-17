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
    // Agent worktrees live under .claude/; never test them from the main checkout.
    exclude: ["**/node_modules/**", ".claude/**", ".superpowers/**"],
    maxWorkers: 4,
  },
});
