import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Vitest config for the manually dispatched Stryker mutation slice.
 *
 * `@stryker-mutator/vitest-runner` defaults to `vitest related <mutated-file>`,
 * which transitively pulls in `*.live.test.*` files (real Gemini calls) when
 * the mutated source is imported by them. Those files require
 * `GEMINI_API_KEY`; the manual mutation workflow does not provide one and
 * each mutant would multiply live-call cost. This config narrows the test
 * surface to deterministic tests only.
 *
 * Mirrors `vitest.config.mts` but adds `**\/*.live.test.*` to `test.exclude`.
 * If the main config diverges, port the relevant fields here.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    clearMocks: true,
    environment: "jsdom",
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      ".claude/worktrees/**",
      ".stryker-tmp/**",
      "**/*.live.test.*",
    ],
    restoreMocks: true,
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 10000,
  },
});
