import { createMutationSliceConfig } from "./stryker.base.mjs";

/**
 * Research route state mutation slice.
 *
 * Scope: route-owned research route payload state helpers and visible-window
 * bookkeeping that keep search-first interactions stable.
 */
export default createMutationSliceConfig({
  reportName: "research-route",
  mutate: [
    "app/stores/research-route-store-internals.ts",
    "app/stores/research-route-store-search-visible-window.ts",
  ],
  thresholds: {
    high: 85,
    low: 60,
    break: 60,
  },
});
