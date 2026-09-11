/**
 * Shared Stryker defaults for mutation slices.
 *
 * Keep slice config files small so each runtime surface can own its threshold
 * and report directory without duplicating runner wiring.
 */
export function createMutationSliceConfig({ mutate, reportName, thresholds }) {
  return {
    packageManager: "npm",
    testRunner: "vitest",
    vitest: {
      configFile: "vitest.config.mutation.mts",
    },
    mutate,
    // A prior slice can leave its own sandbox behind after an interrupted run.
    // Exclude every slice sandbox so the next slice never copies or discovers
    // stale test/source duplicates from a sibling temp directory.
    ignorePatterns: [".stryker-tmp/**"],
    coverageAnalysis: "perTest",
    ignoreStatic: true,
    reporters: ["clear-text", "html", "json"],
    htmlReporter: {
      fileName: `reports/mutation/${reportName}/index.html`,
    },
    jsonReporter: {
      fileName: `reports/mutation/${reportName}/mutation.json`,
    },
    thresholds,
    tempDirName: `.stryker-tmp/${reportName}`,
    cleanTempDir: true,
    timeoutMS: 60000,
    concurrency: 4,
  };
}
