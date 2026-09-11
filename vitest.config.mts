import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    clearMocks: true,
    coverage: {
      exclude: ["**/__tests__/**", "vitest.setup.ts"],
      // Risk-based cohort, not repository-global coverage. Scope and quarterly
      // maintain/expand/retire ownership live in docs/ci-structure.md and
      // quality-gate-steward.
      include: [
        "app/components/**/*.helpers.ts",
        "app/components/workspace/system-event-scheduler.ts",
        "app/domain/view-snapshot.ts",
        "app/lib/chat-message-helpers.ts",
        "app/lib/supabase/auth-helpers.ts",
        "app/lib/turn-state.ts",
        "app/lib/view-snapshot.ts",
      ],
      provider: "v8",
      reporter: ["text", "html", "json-summary", "lcov"],
      reportsDirectory: "coverage/unit",
      thresholds: {
        branches: 90,
        functions: 95,
        lines: 97,
        statements: 97,
      },
    },
    environment: "jsdom",
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.git/**", ".claude/worktrees/**", ".stryker-tmp/**"],
    restoreMocks: true,
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 10000,
  },
});
