import { defineConfig } from "vitest/config";

const targetRoot = process.env.AF_Q4_TARGET_ROOT;
const trustedHarnessRoot = process.env.AF_Q4_TRUSTED_HARNESS_ROOT;
if (!targetRoot || !trustedHarnessRoot) {
  throw new Error(
    "AF_Q4_TARGET_ROOT and AF_Q4_TRUSTED_HARNESS_ROOT are required for the trusted Q4 behavior harness.",
  );
}

export default defineConfig({
  root: trustedHarnessRoot,
  test: {
    clearMocks: true,
    environment: "jsdom",
    restoreMocks: true,
    testTimeout: 15_000,
  },
});
