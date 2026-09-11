import { createMutationSliceConfig } from "./stryker.base.mjs";

/**
 * Story/analytics contract mutation slice.
 *
 * Scope: analytics event validation, client-side analytics routing/privacy
 * filtering, and Mission Control's event contract loader/validator.
 */
export default createMutationSliceConfig({
  reportName: "contracts",
  mutate: [
    "app/server/services/analytics/event-contract.ts",
    "app/server/services/analytics/event-router.ts",
    "app/lib/analytics/privacy-filter.ts",
    "scripts/mission-control/mc-validate-events.ts",
    "scripts/mission-control/mc-event-impact.ts",
  ],
  thresholds: {
    high: 85,
    low: 60,
    break: 60,
  },
});
