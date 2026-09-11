import { createMutationSliceConfig } from "./stryker.base.mjs";

/**
 * Agent runtime mutation slice.
 *
 * Scope: route-view AI comment generation plus deterministic agent runtime
 * guards. Legacy interactive respond streaming was removed; this slice now
 * mutates the route-owned structured generation service and gateway paths that
 * decide whether visible AI comments are emitted, deduped, or degraded to null.
 */
export default createMutationSliceConfig({
  reportName: "agent",
  mutate: [
    "app/server/agent/route-ai-comment-generation.ts",
    "app/server/ai-generation/gateway.ts",
    "app/components/research/route-ai-comment-generation-client.ts",
    "app/components/research/route-ai-comment-generation-scheduler.ts",
  ],
  thresholds: {
    high: 85,
    low: 50,
    break: 50,
  },
});
