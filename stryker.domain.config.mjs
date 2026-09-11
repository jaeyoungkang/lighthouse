import { createMutationSliceConfig } from "./stryker.base.mjs";

/**
 * Domain access mutation slice.
 *
 * Scope: server-side ResearchRoutePayload access policies that bridge authenticated
 * route-view actions and repository writes.
 */
export default createMutationSliceConfig({
  reportName: "domain",
  mutate: [
    "app/server/domain-access/gap-report-access.ts",
    "app/server/domain-access/gap-network-view-access.ts",
  ],
  thresholds: {
    high: 85,
    low: 60,
    break: 60,
  },
});
