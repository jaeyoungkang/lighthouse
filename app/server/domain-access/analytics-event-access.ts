import { createAnalyticsEventRouter } from "@/app/server/services/analytics/event-router";
import { createAmplitudeAnalyticsSink } from "@/app/server/services/analytics/amplitude-sink";
import { createLocalJsonlAnalyticsEventStore } from "@/app/server/repository/analytics-events";
import { loadEventContract } from "@/app/server/services/analytics/event-contract";

let analyticsEventRouter: ReturnType<typeof createAnalyticsEventRouter> | null = null;
let eventContract: ReturnType<typeof loadEventContract> | null = null;

function getAnalyticsEventContractForTrustedServer(): ReturnType<typeof loadEventContract> {
  if (!eventContract) {
    eventContract = loadEventContract(process.cwd());
  }
  return eventContract;
}

export function getAnalyticsEventRouterForTrustedServer() {
  if (!analyticsEventRouter) {
    analyticsEventRouter = createAnalyticsEventRouter({
      contract: getAnalyticsEventContractForTrustedServer(),
      store: createLocalJsonlAnalyticsEventStore(),
      sinks: [createAmplitudeAnalyticsSink()],
    });
  }
  return analyticsEventRouter;
}

export function isPublicClientAnalyticsEventNameAllowed(name: string): boolean {
  return getAnalyticsEventContractForTrustedServer().events.some(
    (event) => event.name === name && event.actor === "user" && event.trigger.source === "client",
  );
}
