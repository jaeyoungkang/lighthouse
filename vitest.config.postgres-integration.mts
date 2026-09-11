import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    fileParallelism: false,
    include: ["**/__tests__/**/*.postgres.integration.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
