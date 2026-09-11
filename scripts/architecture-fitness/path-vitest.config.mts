import path from "node:path";

import { defineConfig } from "vitest/config";

import { ARCHITECTURE_FITNESS_PATH_TEST_SETUP_REF } from "./path-test-command.mjs";

const targetRoot = process.env.AF_PATH_TEST_TARGET_ROOT;
const collectorRoot = process.env.AF_PATH_TEST_COLLECTOR_ROOT;

if (!targetRoot || !collectorRoot) {
  throw new Error(
    "AF_PATH_TEST_TARGET_ROOT and AF_PATH_TEST_COLLECTOR_ROOT are required for exact-revision path tests.",
  );
}

export default defineConfig({
  root: targetRoot,
  resolve: {
    alias: {
      "@": path.resolve(targetRoot),
    },
  },
  server: {
    fs: {
      allow: [targetRoot, collectorRoot],
    },
  },
  test: {
    clearMocks: true,
    environment: "jsdom",
    restoreMocks: true,
    setupFiles: [path.join(collectorRoot, ARCHITECTURE_FITNESS_PATH_TEST_SETUP_REF)],
    testTimeout: 10_000,
  },
});
