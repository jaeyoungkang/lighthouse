import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertCommonFooter } from "@/app/__tests__/site-footer.assertions";
import { AnalyticsEventsDashboard } from "@/app/components/admin/AnalyticsEventsDashboard";
import type { AnalyticsEventDefinition } from "@/app/server/services/analytics/event-contract";

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

function createDefinition(
  overrides: Partial<AnalyticsEventDefinition> = {},
): AnalyticsEventDefinition {
  return {
    name: "product.search_submitted",
    version: 1,
    owner: "product",
    actor: "user",
    surface: "research-route",
    storyRefs: {
      experienceRef: "experience:research-discovery",
      momentRef: "moment:paper-search",
      promiseRef: "promise:search-results-grounded",
      relatedPromiseRefs: ["promise:search-route-entry"],
      aspectRefs: [],
      acceptanceCheckRefs: ["acceptance-check:search-results-grounded-source-links"],
      scenarioRefs: ["scenario:search-query-to-grounded-results"],
    },
    observability: {
      realitySignal: true,
      signalMeaning: "search query submitted",
      severity: "info",
      requiredForPromiseCoverage: false,
    },
    trigger: {
      source: "client",
      phase: "requested",
      timing: "when the user submits a search query",
    },
    emission: {
      boundary: "command_handler",
      cardinality: "every_action",
      identityKeys: ["subject.ownerPrincipalId"],
      emitter: "trackSearchSubmitted",
    },
    measurement: {
      purpose: "Measure submitted searches.",
      decisionUse: "Compare search starts with result engagement.",
      propertyPurposes: {
        ownerPrincipalId: "Scope searches to the route-owned research route payload.",
        queryHash: "Group searches without raw query text.",
        queryLength: "Understand query complexity.",
        yearFilter: "Compare filtered searches.",
      },
    },
    subject: { allowed: ["ownerPrincipalId"] },
    properties: {
      required: ["ownerPrincipalId", "queryHash", "queryLength"],
      optional: ["yearFilter"],
      forbidden: ["token"],
    },
    privacy: { level: "behavior_metadata", allowExternalSinks: true },
    sinks: { amplitude: "Search Requested" },
    ...overrides,
  };
}

function renderDashboard(eventDefinitions: AnalyticsEventDefinition[] = [createDefinition()]) {
  const container = document.createElement("div");
  root = createRoot(container);

  act(() => {
    root?.render(
      <AnalyticsEventsDashboard eventDefinitions={eventDefinitions} userEmail="admin@corca.ai" />,
    );
  });

  return container;
}

describe("AnalyticsEventsDashboard", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  it("renders declared canonical events with identity, trigger, story refs, payload allowlist, and per-vendor sink policy", () => {
    const container = renderDashboard();

    expect(container.querySelector('[data-testid="analytics-events-dashboard"]')).not.toBeNull();
    expect(container.textContent).toContain("product.search_submitted");
    expect(container.textContent).toContain("v1");
    expect(container.textContent).toContain("product");
    expect(container.textContent).toContain("research-route");
    expect(container.textContent).toContain("client/requested");
    expect(container.textContent).toContain("when the user submits a search query");
    expect(container.textContent).toContain("command_handler/every_action");
    expect(container.textContent).toContain("trackSearchSubmitted");
    expect(container.textContent).toContain("Measure submitted searches.");
    expect(container.textContent).toContain("Compare search starts with result engagement.");
    expect(container.textContent).toContain(
      "property purposes ownerPrincipalId, queryHash, queryLength, yearFilter",
    );
    expect(container.textContent).toContain("promise:search-results-grounded");
    expect(container.textContent).toContain("promise:search-route-entry");
    expect(container.textContent).toContain("required ownerPrincipalId, queryHash, queryLength");
    expect(container.textContent).toContain("optional yearFilter");
    expect(container.textContent).toContain("forbidden token");
    expect(container.textContent).toContain("subject ownerPrincipalId");
    expect(container.textContent).toContain("Amplitude Search Requested");
    expect(container.textContent).toContain("behavior_metadata");
    expect(container.textContent).not.toContain("LLM Usage");
    expect(container.querySelector('a[href="/admin/intent"]')).toBeNull();
    expect(container.querySelector('a[href="/admin/story-chain"]')).toBeNull();
    expect(container.querySelector('a[href="/admin/llm-usage"]')).toBeNull();
  });

  it("marks required events in the catalog", () => {
    const container = renderDashboard([createDefinition()]);

    act(() => {
      root?.render(
        <AnalyticsEventsDashboard
          eventDefinitions={[createDefinition()]}
          requiredEventNames={["product.search_submitted"]}
          userEmail="admin@corca.ai"
        />,
      );
    });

    expect(container.textContent).toContain("required event");
  });

  it("renders an empty-state message when no events are declared", () => {
    const container = renderDashboard([]);

    expect(container.textContent).toContain("No events declared in docs/analytics/events.yaml.");
    expect(container.textContent).toContain("Declared 0 canonical events");
  });

  it("renders the common footer on the analytics event catalog page", () => {
    const container = renderDashboard();

    assertCommonFooter(container, "admin-analytics-footer");
  });
});
