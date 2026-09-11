import path from "node:path";
import { defineConfig } from "vitest/config";

const targetRoot = process.env.AF_Q2_TARGET_ROOT;
const trustedHarnessRoot = process.env.AF_Q2_TRUSTED_HARNESS_ROOT;
if (!targetRoot || !trustedHarnessRoot) {
  throw new Error(
    "AF_Q2_TARGET_ROOT and AF_Q2_TRUSTED_HARNESS_ROOT are required for the trusted Q2 behavior harness.",
  );
}

export default defineConfig({
  root: trustedHarnessRoot,
  resolve: {
    alias: {
      "@": path.resolve(targetRoot),
    },
  },
  test: {
    clearMocks: true,
    environment: "node",
    restoreMocks: true,
    testTimeout: 10_000,
  },
});
