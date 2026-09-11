import { describe, expect, it, vi } from "vitest";

import {
  loadEventContract,
  type AnalyticsEventContract,
} from "@/app/server/services/analytics/event-contract";

import type {
  AnalyticsEventStore,
  AnalyticsSink,
  CanonicalEvent,
} from "@/app/lib/analytics/canonical-event";
import { buildExternalAnalyticsPayload } from "@/app/lib/analytics/privacy-filter";
import { createAnalyticsEventRouter } from "@/app/server/services/analytics/event-router";

const contract: AnalyticsEventContract = {
  events: [
    {
      name: "product.search_submitted",
      version: 1,
      owner: "product",
      actor: "user",
      surface: "research-route",
      storyRefs: {
        experienceRef: "experience:search-paper-flow",
        momentRef: "moment:search-results-appear",
        promiseRef: "promise:search-reaction-summarizes-terrain",
        relatedPromiseRefs: ["promise:search-route-entry"],
        aspectRefs: ["aspect:visible-explanation-sufficiency"],
        acceptanceCheckRefs: ["acceptance-check:search-reaction-summarizes-terrain-ac1"],
        scenarioRefs: ["scenario:search-reaction"],
      },
      observability: {
        realitySignal: true,
        signalMeaning: "search flow reached by user",
        severity: "info",
        requiredForPromiseCoverage: false,
      },
      trigger: {
        source: "server",
        phase: "committed",
        timing: "test search view commit",
      },
      subject: { allowed: ["ownerPrincipalId", "documentId"] },
      properties: {
        required: ["ownerPrincipalId", "documentId", "queryHash", "queryLength", "sort"],
        optional: ["resultCount"],
        forbidden: ["token"],
      },
      privacy: {
        level: "behavior_metadata",
        allowExternalSinks: true,
      },
      sinks: { amplitude: "search_submitted" },
    },
    {
      name: "test.internal_only",
      version: 1,
      owner: "governance",
      actor: "system",
      surface: "cli",
      storyRefs: {
        promiseRef: "promise:story-chain-event-contract",
        aspectRefs: [],
        acceptanceCheckRefs: [],
        scenarioRefs: [],
      },
      observability: {
        realitySignal: true,
        signalMeaning: "internal-only event used for router boundary tests",
        severity: "warning",
        requiredForPromiseCoverage: true,
      },
      trigger: {
        source: "cli",
        phase: "failed",
        timing: "test internal-only event",
      },
      subject: { allowed: ["gate"] },
      properties: {
        required: ["gate", "command", "exitCode", "durationMs"],
        optional: [],
        forbidden: ["stdout", "stderr", "env", "token"],
      },
      privacy: {
        level: "public_contract",
        allowExternalSinks: false,
      },
      sinks: {},
    },
  ],
};

function createStore(): AnalyticsEventStore & { events: CanonicalEvent[] } {
  const events: CanonicalEvent[] = [];
  return {
    events,
    insert(event: CanonicalEvent) {
      events.push(event);
      return Promise.resolve();
    },
  };
}

describe("analytics event router", () => {
  it("composes canonical events from the contract and sends privacy-filtered sink payloads", async () => {
    const store = createStore();
    const sinkCapture = vi.fn<AnalyticsSink["capture"]>().mockResolvedValue(undefined);
    const router = createAnalyticsEventRouter({
      contract,
      store,
      now: () => new Date("2026-05-10T00:00:00.000Z"),
      sinks: [{ name: "amplitude", capture: sinkCapture }],
    });

    const result = await router.trackCanonicalEvent("product.search_submitted", {
      actor: { type: "user", id: "user-1" },
      subject: { ownerPrincipalId: "principal-1", documentId: "doc-1" },
      properties: {
        ownerPrincipalId: "principal-1",
        documentId: "doc-1",
        queryHash: "fnv1a32:test",
        queryLength: 12,
        sort: "relevance",
        resultCount: 10,
      },
    });

    expect(result.ok).toBe(true);
    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({
      name: "product.search_submitted",
      version: 1,
      occurredAt: "2026-05-10T00:00:00.000Z",
      storyRefs: {
        promiseRef: "promise:search-reaction-summarizes-terrain",
      },
    });
    expect(sinkCapture).toHaveBeenCalledWith(
      "search_submitted",
      expect.any(Object),
      expect.objectContaining({
        event_name: "product.search_submitted",
        experience_ref: "experience:search-paper-flow",
        moment_ref: "moment:search-results-appear",
        promise_ref: "promise:search-reaction-summarizes-terrain",
        related_promise_refs: ["promise:search-route-entry"],
        aspect_refs: ["aspect:visible-explanation-sufficiency"],
        acceptance_check_refs: ["acceptance-check:search-reaction-summarizes-terrain-ac1"],
        scenario_refs: ["scenario:search-reaction"],
        owner_principal_id: "principal-1",
        document_id: "doc-1",
        query_hash: "fnv1a32:test",
        query_length: 12,
        result_count: 10,
      }),
    );
  });
});

describe("analytics event router identity forwarding", () => {
  it("passes deviceId and sessionId from payload into the stored canonical event so vendor sinks can forward replay identity", async () => {
    const store = createStore();
    const router = createAnalyticsEventRouter({ contract, store });
    const result = await router.trackCanonicalEvent("product.search_submitted", {
      actor: { type: "user", id: "user-1@example.com" },
      deviceId: "device-abc",
      sessionId: 1770000000000,
      subject: { ownerPrincipalId: "principal-1", documentId: "doc-1" },
      properties: {
        ownerPrincipalId: "principal-1",
        documentId: "doc-1",
        queryHash: "fnv1a32:test",
        queryLength: 12,
        sort: "relevance",
      },
    });

    expect(result.ok).toBe(true);
    expect(store.events[0]).toMatchObject({ deviceId: "device-abc", sessionId: 1770000000000 });
    expect(store.events[0]?.actor).toEqual({ type: "user", id: "user-1@example.com" });
  });
});

describe("analytics event router validation", () => {
  it("stores query metadata without allowing raw query text", async () => {
    const store = createStore();
    const router = createAnalyticsEventRouter({ contract, store });

    const result = await router.trackCanonicalEvent("product.search_submitted", {
      actor: { type: "user", id: "user-1" },
      subject: { ownerPrincipalId: "principal-1", documentId: "doc-1" },
      properties: {
        ownerPrincipalId: "principal-1",
        documentId: "doc-1",
        queryHash: "fnv1a32:test",
        queryLength: 12,
        sort: "relevance",
      },
    });

    expect(result.ok).toBe(true);
    expect(store.events[0]?.properties).toMatchObject({
      queryHash: "fnv1a32:test",
      queryLength: 12,
    });
    expect(store.events[0]?.properties).not.toHaveProperty("query");
  });

  it("rejects forbidden payload properties before store writes", async () => {
    const store = createStore();
    const router = createAnalyticsEventRouter({ contract, store });

    const result = await router.trackCanonicalEvent("product.search_submitted", {
      actor: { type: "user", id: "user-1" },
      subject: { ownerPrincipalId: "principal-1", documentId: "doc-1" },
      properties: {
        ownerPrincipalId: "principal-1",
        documentId: "doc-1",
        queryHash: "fnv1a32:test",
        queryLength: 12,
        sort: "relevance",
        token: "secret-token",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe(
      'product.search_submitted: property "token" is not declared in contract',
    );
    expect(store.events).toHaveLength(0);
  });

  it("rejects undeclared payload properties before store writes", async () => {
    const store = createStore();
    const router = createAnalyticsEventRouter({ contract, store });

    const result = await router.trackCanonicalEvent("product.search_submitted", {
      actor: { type: "user", id: "user-1" },
      subject: { ownerPrincipalId: "principal-1", documentId: "doc-1" },
      properties: {
        ownerPrincipalId: "principal-1",
        documentId: "doc-1",
        queryHash: "fnv1a32:test",
        queryLength: 12,
        sort: "relevance",
        query: "raw text",
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe(
      'product.search_submitted: property "query" is not declared in contract',
    );
    expect(store.events).toHaveLength(0);
  });

  it("keeps internal-only events away from external sinks", async () => {
    const store = createStore();
    const sinkCapture = vi.fn<AnalyticsSink["capture"]>().mockResolvedValue(undefined);
    const router = createAnalyticsEventRouter({
      contract,
      store,
      sinks: [{ name: "amplitude", capture: sinkCapture }],
    });

    await router.trackCanonicalEvent("test.internal_only", {
      actor: { type: "system" },
      subject: { gate: "mc:validate-events" },
      properties: {
        gate: "mc:validate-events",
        command: "npm run mc:validate-events",
        exitCode: 1,
        durationMs: 25,
      },
    });

    expect(store.events).toHaveLength(1);
    expect(sinkCapture).not.toHaveBeenCalled();
  });

  it("ignores sinks that are not mapped by the event definition", async () => {
    const store = createStore();
    const sinkCapture = vi.fn<AnalyticsSink["capture"]>().mockResolvedValue(undefined);
    const router = createAnalyticsEventRouter({
      contract,
      store,
      sinks: [{ name: "unknown", capture: sinkCapture }],
    });

    const result = await router.trackCanonicalEvent("product.search_submitted", {
      actor: { type: "user", id: "user-1" },
      subject: { ownerPrincipalId: "principal-1" },
      properties: {
        ownerPrincipalId: "principal-1",
        documentId: "doc-1",
        queryHash: "fnv1a32:test",
        queryLength: 12,
        sort: "relevance",
      },
    });

    expect(result.ok).toBe(true);
    expect(store.events).toHaveLength(1);
    expect(sinkCapture).not.toHaveBeenCalled();
  });

  it("preserves the store write when a sink fails", async () => {
    const store = createStore();
    const sinkCapture = vi.fn<AnalyticsSink["capture"]>().mockRejectedValue(new Error("sink down"));
    const router = createAnalyticsEventRouter({
      contract,
      store,
      sinks: [{ name: "amplitude", capture: sinkCapture }],
    });

    const result = await router.trackCanonicalEvent("product.search_submitted", {
      actor: { type: "user", id: "user-1" },
      subject: { ownerPrincipalId: "principal-1", documentId: "doc-1" },
      properties: {
        ownerPrincipalId: "principal-1",
        documentId: "doc-1",
        queryHash: "fnv1a32:test",
        queryLength: 12,
        sort: "relevance",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.sinkErrors?.map((error) => error.message)).toEqual(["sink down"]);
    expect(store.events).toHaveLength(1);
    expect(store.events[0]?.name).toBe("product.search_submitted");
  });

  it("continues external sink delivery when the local store write fails", async () => {
    const store: AnalyticsEventStore = {
      insert: vi.fn(() => Promise.reject(new Error("readonly filesystem"))),
    };
    const sinkCapture = vi.fn<AnalyticsSink["capture"]>().mockResolvedValue(undefined);
    const router = createAnalyticsEventRouter({
      contract,
      store,
      sinks: [{ name: "amplitude", capture: sinkCapture }],
    });

    const result = await router.trackCanonicalEvent("product.search_submitted", {
      actor: { type: "user", id: "user-1" },
      subject: { ownerPrincipalId: "principal-1", documentId: "doc-1" },
      properties: {
        ownerPrincipalId: "principal-1",
        documentId: "doc-1",
        queryHash: "fnv1a32:test",
        queryLength: 12,
        sort: "relevance",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.storeError?.message).toBe("readonly filesystem");
    expect(sinkCapture).toHaveBeenCalledTimes(1);
    expect(sinkCapture).toHaveBeenCalledWith(
      "search_submitted",
      expect.objectContaining({ name: "product.search_submitted" }),
      expect.objectContaining({ event_name: "product.search_submitted" }),
    );
  });

  it("returns validation errors without throwing", async () => {
    const store = createStore();
    const router = createAnalyticsEventRouter({ contract, store });

    const result = await router.trackCanonicalEvent("product.search_submitted", {
      actor: { type: "user" },
      properties: {
        ownerPrincipalId: "principal-1",
        documentId: "doc-1",
        queryHash: "fnv1a32:test",
        queryLength: 12,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe(
      'product.search_submitted: missing required property "sort"',
    );
    expect(store.events).toHaveLength(0);
  });
});

describe("analytics event router contract validation", () => {
  it("rejects undeclared events, wrong actors, and unexpected subject keys before storing", async () => {
    const store = createStore();
    const router = createAnalyticsEventRouter({ contract, store });

    const undeclared = await router.trackCanonicalEvent("product.unknown", {
      actor: { type: "user" },
      properties: {},
    });
    expect(undeclared.ok).toBe(false);
    expect(undeclared.error?.message).toBe(
      "product.unknown: event is not declared in analytics contract",
    );

    const wrongActor = await router.trackCanonicalEvent("product.search_submitted", {
      actor: { type: "system" },
      subject: { ownerPrincipalId: "principal-1" },
      properties: {
        ownerPrincipalId: "principal-1",
        documentId: "doc-1",
        queryHash: "fnv1a32:test",
        queryLength: 12,
        sort: "relevance",
      },
    });
    expect(wrongActor.ok).toBe(false);
    expect(wrongActor.error?.message).toBe(
      'product.search_submitted: actor type "system" does not match contract actor "user"',
    );

    const unexpectedSubject = await router.trackCanonicalEvent("product.search_submitted", {
      actor: { type: "user" },
      subject: { rawQuery: "private" },
      properties: {
        ownerPrincipalId: "principal-1",
        documentId: "doc-1",
        queryHash: "fnv1a32:test",
        queryLength: 12,
        sort: "relevance",
      },
    });
    expect(unexpectedSubject.ok).toBe(false);
    expect(unexpectedSubject.error?.message).toBe(
      'product.search_submitted: subject key "rawQuery" is not allowed',
    );

    expect(store.events).toHaveLength(0);
  });

  it("builds a minimal external payload when optional story refs and optional fields are absent", () => {
    const definition = contract.events[1];

    const payload = buildExternalAnalyticsPayload(definition, {
      name: definition.name,
      version: definition.version,
      occurredAt: "2026-05-10T00:00:00.000Z",
      actor: { type: "system" },
      surface: definition.surface,
      storyRefs: definition.storyRefs,
      trigger: definition.trigger,
      subject: { gate: "mc:validate-events", ignored: "drop" },
      properties: {
        gate: "mc:validate-events",
        command: "npm run mc:validate-events",
        exitCode: 1,
        durationMs: 25,
        stdout: "drop",
      },
      privacy: definition.privacy,
    });

    expect(payload).toEqual({
      event_name: "test.internal_only",
      event_version: 1,
      surface: "cli",
      trigger_source: "cli",
      trigger_phase: "failed",
      promise_ref: "promise:story-chain-event-contract",
      gate: "mc:validate-events",
      command: "npm run mc:validate-events",
      exit_code: 1,
      duration_ms: 25,
    });
  });
});

describe("analytics event router with canonical search-journey events", () => {
  const context = {
    journey_context_id: "search-1",
    search_context_id: "search-1",
  };
  const paper = {
    ...context,
    paper_id: "paper-1",
    result_rank: 1,
    source_surface: "search_results",
    has_pdf: true,
    evidence_availability: "available",
  };

  it("accepts the rebuilt journey events against the real semantic property schema", async () => {
    const store = createStore();
    const router = createAnalyticsEventRouter({
      contract: loadEventContract(process.cwd()),
      store,
    });

    const payloads = [
      [
        "search_submitted",
        {
          actor: { type: "user" as const },
          subject: { search_context_id: "search-1" },
          properties: {
            ...context,
            entry_source: "route_bar",
            query_length: 12,
            sort: "relevance",
          },
        },
      ],
      [
        "search_results_viewed",
        {
          actor: { type: "user" as const },
          subject: { search_context_id: "search-1" },
          properties: {
            ...context,
            sort: "relevance",
            result_count: 12,
            visible_result_count: 10,
            library_grounding_applied: true,
            library_anchor_paper_count: 3,
            source_surface: "search_results",
          },
        },
      ],
      [
        "search_result_inspected",
        {
          actor: { type: "user" as const },
          subject: { search_context_id: "search-1", paper_id: "paper-1" },
          properties: paper,
        },
      ],
      [
        "paper_saved",
        {
          actor: { type: "user" as const },
          subject: { search_context_id: "search-1", paper_id: "paper-1" },
          properties: paper,
        },
      ],
      [
        "paper_unsaved",
        {
          actor: { type: "user" as const },
          subject: { search_context_id: "search-1", paper_id: "paper-1" },
          properties: paper,
        },
      ],
      [
        "pdf_opened",
        {
          actor: { type: "user" as const },
          subject: { search_context_id: "search-1", paper_id: "paper-1" },
          properties: { ...paper, open_target: "moonlight_external", open_element: "pdf_button" },
        },
      ],
      [
        "citation_lineage_opened",
        {
          actor: { type: "user" as const },
          subject: { search_context_id: "search-1", paper_id: "paper-1" },
          properties: { ...paper, reference_count: 4, citation_count: 8 },
        },
      ],
      [
        "similar_papers_opened",
        {
          actor: { type: "user" as const },
          subject: { search_context_id: "search-1", paper_id: "paper-1" },
          properties: paper,
        },
      ],
    ] as const;

    for (const [name, payload] of payloads) {
      const result = await router.trackCanonicalEvent(name, payload);
      expect(result.ok, result.error?.message).toBe(true);
    }
    expect(store.events.map((event) => event.name)).toEqual(payloads.map(([name]) => name));
  });

  it("accepts the production PDF payload shape without title metadata", async () => {
    const store = createStore();
    const router = createAnalyticsEventRouter({
      contract: loadEventContract(process.cwd()),
      store,
    });
    const payload = {
      actor: { type: "user" as const },
      subject: { search_context_id: "search-1", paper_id: "paper-1" },
      properties: {
        journey_context_id: "journey-1",
        search_context_id: "search-1",
        paper_id: "paper-1",
        open_element: "pdf_button",
        open_target: "moonlight_external",
        result_rank: 1,
        has_pdf: true,
        source_surface: "search_results",
        evidence_availability: "available",
      },
    };

    expect(payload.properties).not.toHaveProperty("title");
    const result = await router.trackCanonicalEvent("pdf_opened", payload);
    expect(result.ok, result.error?.message).toBe(true);
    expect(store.events[0]?.properties).not.toHaveProperty("title");
  });

  it("rejects missing and conflicting journey identity at the real router boundary", async () => {
    const router = createAnalyticsEventRouter({
      contract: loadEventContract(process.cwd()),
      store: createStore(),
    });
    const properties = {
      journey_context_id: "journey-1",
      search_context_id: "search-1",
      paper_id: "paper-1",
      result_rank: 1,
      source_surface: "search_results",
      has_pdf: true,
      evidence_availability: "available",
    };

    const missing = await router.trackCanonicalEvent("search_result_inspected", {
      actor: { type: "user" },
      subject: { paper_id: "paper-1" },
      properties,
    });
    expect(missing.ok).toBe(false);
    expect(missing.error?.message).toContain(
      'missing emission identity key "subject.search_context_id"',
    );

    const conflicting = await router.trackCanonicalEvent("search_result_inspected", {
      actor: { type: "user" },
      subject: { search_context_id: "search-other", paper_id: "paper-1" },
      properties,
    });
    expect(conflicting.ok).toBe(false);
    expect(conflicting.error?.message).toContain(
      'subject and properties disagree for identity field "search_context_id"',
    );
  });

  it("rejects wrong types, free-form enum values, and raw query content", async () => {
    const invalidCases = [
      { field: "result_rank", value: "first", message: "must be integer" },
      { field: "source_surface", value: "sidebar", message: "outside the declared enum" },
      { field: "query", value: "raw query", message: "is not declared in contract" },
    ] as const;

    for (const testCase of invalidCases) {
      const router = createAnalyticsEventRouter({
        contract: loadEventContract(process.cwd()),
        store: createStore(),
      });
      const result = await router.trackCanonicalEvent("paper_saved", {
        actor: { type: "user" },
        subject: { search_context_id: "search-1", paper_id: "paper-1" },
        properties: { ...paper, [testCase.field]: testCase.value },
      });
      expect(result.ok).toBe(false);
      expect(result.error?.message).toContain(testCase.message);
    }
  });
});

describe("analytics event router canonical event validation", () => {
  it("rejects legacy gap report owner and source fields from the v2 event", async () => {
    const invalidPayloads: Array<{
      subject: Record<string, string>;
      properties: Record<string, string>;
      error: string;
    }> = [
      {
        subject: {
          viewerPrincipalId: "viewer-1",
          documentId: "gap-report-1",
          ownerPrincipalId: "viewer-1",
        },
        properties: {
          viewerPrincipalId: "viewer-1",
          documentId: "gap-report-1",
        },
        error: 'product.gap_report.viewed: subject key "ownerPrincipalId" is not allowed',
      },
      {
        subject: {
          viewerPrincipalId: "viewer-1",
          documentId: "gap-report-1",
        },
        properties: {
          viewerPrincipalId: "viewer-1",
          documentId: "gap-report-1",
          sourceSnapshotId: "first-source-only",
        },
        error: 'product.gap_report.viewed: property "sourceSnapshotId" is not declared in contract',
      },
    ];

    for (const invalidPayload of invalidPayloads) {
      const store = createStore();
      const router = createAnalyticsEventRouter({
        contract: loadEventContract(process.cwd()),
        store,
      });
      const result = await router.trackCanonicalEvent("product.gap_report.viewed", {
        actor: { type: "user", id: "researcher@example.com" },
        subject: invalidPayload.subject,
        properties: invalidPayload.properties,
      });

      expect(result.ok).toBe(false);
      expect(result.error?.message).toBe(invalidPayload.error);
      expect(store.events).toHaveLength(0);
    }
  });
});
