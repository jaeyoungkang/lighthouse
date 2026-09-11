import { describe, expect, it } from "vitest";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import {
  runSearchEnrichmentTask,
  shouldQueueSearchEnrichment,
} from "@/app/components/research/background-search-tasks";
import {
  buildRouteAiCommentGenerationCommand,
  isRouteAiCommentGenerationWaitingForHydration,
} from "@/app/components/research/research-route-runtime.helpers";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

const baseDocument: Extract<ResearchRoutePayload, { type: "search" }> = {
  status: "ready",
  version: 0,
  reactionVersion: 0,
  id: "doc-1",
  type: "search",
  title: "Search",
  content: "content",
  createdBy: "user",
  reaction: null,
  refs: [],
  ownerPrincipalId: "principal-1",
  createdAt: "2026-03-27T00:00:00.000Z",
  updatedAt: "2026-03-27T00:00:00.000Z",
  metadata: {
    type: "search",
    query: "llm",
    total: 2,
    papers: [
      {
        paperId: "paper-1",
        title: "Paper 1",
        abstract: "abstract",
        year: 2024,
        citationCount: 7,
        url: "https://example.com/1",
        authors: [{ name: "Alice" }, { name: "Bob" }, { name: "Carol" }],
      },
    ],
  },
};

function withoutOwnerIdentity(document: ResearchRoutePayload) {
  if (document.type === "gap_network") return document;
  const { ownerPrincipalId, ...view } = document;
  void ownerPrincipalId;
  return view;
}

describe("research-route-runtime route AI comment generation commands", () => {
  it("builds a search generation command for a hydrated result ResearchRoutePayload", () => {
    const command = buildRouteAiCommentGenerationCommand(baseDocument);

    expect(command).toMatchObject({
      trigger: "user_search",
      ownerPrincipalId: "principal-1",
      targetRoutePayloadId: "doc-1",
    });
    expect(command?.viewSnapshot.snapshotId).toBe("doc-1");
    expect(command?.viewSnapshot.snapshotKind).toBe("search");
    expect(command?.viewSnapshot.content).toMatchObject({
      kind: "search",
      query: "llm",
      results: [{ id: "paper-1", title: "Paper 1" }],
    });
  });

  it("builds a search generation command for ephemeral search ResearchRoutePayloads", () => {
    expect(
      buildRouteAiCommentGenerationCommand({
        ...baseDocument,
        id: "search-ephemeral-abc",
      }),
    ).toMatchObject({
      trigger: "user_search",
      ownerPrincipalId: "principal-1",
      targetRoutePayloadId: "search-ephemeral-abc",
      viewSnapshot: {
        snapshotId: "search-ephemeral-abc",
        snapshotKind: "search",
      },
    });
  });

  it("waits for hydration when an active search facet depends on card details", () => {
    const pendingFacetedView = {
      ...baseDocument,
      metadata: {
        ...baseDocument.metadata,
        abstractHydration: { status: "pending" as const },
        facetFilters: {
          fieldsOfStudy: [],
          authors: ["Alice"],
          venues: [],
          hasPdf: false,
        },
        papers: baseDocument.metadata.papers.map((paper) => ({
          ...paper,
          authors: [],
        })),
      },
    };

    expect(buildRouteAiCommentGenerationCommand(pendingFacetedView)).toBeNull();
    expect(
      buildRouteAiCommentGenerationCommand({
        ...pendingFacetedView,
        metadata: {
          ...pendingFacetedView.metadata,
          abstractHydration: { status: "ready" as const },
          papers: baseDocument.metadata.papers,
        },
      }),
    ).toMatchObject({
      trigger: "user_search",
      targetRoutePayloadId: "doc-1",
    });
  });

  it("waits for one-shot repair before generating from a ready faceted search", () => {
    const papers = ["101", "102"].map((paperId, index) => ({
      ...baseDocument.metadata.papers[0],
      paperId,
      title: `Paper ${paperId}`,
      abstract: null,
      authors: [],
      fieldsOfStudy: [index === 0 ? "Physics" : "Biology"],
    }));
    const repairableReadyView = {
      ...baseDocument,
      metadata: {
        ...baseDocument.metadata,
        papers,
        facetFilters: {
          fieldsOfStudy: ["Physics"],
          authors: [],
          venues: [],
          hasPdf: false,
        },
        abstractHydration: { status: "ready" as const },
      },
    };

    expect(buildRouteAiCommentGenerationCommand(repairableReadyView)).toBeNull();
    expect(
      buildRouteAiCommentGenerationCommand({
        ...repairableReadyView,
        metadata: {
          ...repairableReadyView.metadata,
          papers: papers.map((paper) => ({
            ...paper,
            abstract: "Hydrated abstract",
            authors: [{ name: "Hydrated Author" }],
            referenceCount: 3,
            fieldsOfStudy: paper.paperId === "102" ? ["Physics"] : ["Biology"],
          })),
          abstractHydration: { status: "ready" as const, repairAttempted: true },
        },
      })?.viewSnapshot.content,
    ).toMatchObject({ results: [{ id: "102" }] });
  });

  it("keeps an unfaceted pending search on the first-commit generation path", () => {
    expect(
      buildRouteAiCommentGenerationCommand({
        ...baseDocument,
        metadata: {
          ...baseDocument.metadata,
          abstractHydration: { status: "pending" as const },
        },
      }),
    ).toMatchObject({
      trigger: "user_search",
      targetRoutePayloadId: "doc-1",
    });
  });

  it("does not build generation commands for gap network ResearchRoutePayloads without an agent panel slot", () => {
    expect(
      buildRouteAiCommentGenerationCommand({
        ...withoutOwnerIdentity(baseDocument),
        viewerPrincipalId: "principal-1",
        id: "gap-1",
        type: "gap_network",
        title: "Gap map",
        metadata: {
          type: "gap_network",
          version: 1,
          sourceSnapshotId: "doc-1",
          query: "llm agents",
          papers: [
            {
              paperId: "paper-1",
              title: "Paper 1",
              abstract: "abstract",
              year: 2024,
              citationCount: 7,
              url: "https://example.com/1",
              authors: [{ name: "Alice" }],
            },
          ],
          gapNetworkReport: {
            clusters: [
              {
                id: "cluster-1",
                label: "Agents",
                color: "oklch(0.6 0.1 200)",
                paperCount: 1,
                concepts: [],
              },
            ],
            conceptEdges: [],
            gapPairs: [],
            metrics: {
              clusterCount: 1,
              totalPaperCount: 1,
              totalEdgeCount: 0,
              gapPairCount: 0,
            },
            insight: { hypotheses: [] },
          },
          gapNetworkBuild: {
            core: "ready",
            enrichment: "pending",
            updatedAt: "2026-03-27T00:00:00.000Z",
          },
        },
      }),
    ).toBeNull();
  });

  it("does not build gap-network generation commands before core settlement", () => {
    expect(
      buildRouteAiCommentGenerationCommand({
        ...withoutOwnerIdentity(baseDocument),
        viewerPrincipalId: "principal-1",
        id: "gap-blank",
        type: "gap_network",
        title: "Gap map",
        metadata: {
          type: "gap_network",
          version: 1,
          sourceSnapshotId: "doc-1",
          query: "llm agents",
          papers: [],
          gapNetworkReport: {
            clusters: [],
            conceptEdges: [],
            gapPairs: [],
            metrics: {
              clusterCount: 0,
              totalPaperCount: 0,
              totalEdgeCount: 0,
              gapPairCount: 0,
            },
            insight: { hypotheses: [] },
          },
        },
      }),
    ).toBeNull();
  });
});

describe("research-route-runtime successful empty repair", () => {
  it("closes AI comment hydration waiting after a successful empty repair", async () => {
    const repairableDocument: Extract<ResearchRoutePayload, { type: "search" }> = {
      ...baseDocument,
      metadata: {
        ...baseDocument.metadata,
        abstractHydration: { status: "ready" },
        facetFilters: {
          fieldsOfStudy: ["Computer Science"],
          authors: [],
          venues: [],
          hasPdf: false,
        },
        papers: baseDocument.metadata.papers.map((paper) => ({
          ...paper,
          paperId: "101",
          abstract: null,
          authors: [],
          fieldsOfStudy: null,
          referenceCount: null,
        })),
      },
    };
    const executionId = "test:successful-empty-repair";
    useResearchRouteStore.getState().setCurrentView(repairableDocument, executionId);
    expect(buildRouteAiCommentGenerationCommand(repairableDocument)).toBeNull();

    const originalFetch = global.fetch;
    global.fetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            metadata: {
              ...repairableDocument.metadata,
              abstractHydration: { status: "ready", repairAttempted: true },
            },
            updatedAt: "2026-07-18T00:00:01.000Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    try {
      const result = await runSearchEnrichmentTask({
        task: {
          executionId,
          documentId: repairableDocument.id,
          ownerPrincipalId: repairableDocument.ownerPrincipalId,
          query: repairableDocument.metadata.query,
          metadata: repairableDocument.metadata,
        },
        controller: new AbortController(),
      });

      expect(result?.metadata.type).toBe("search");
      expect(result?.metadata.type === "search" ? result.metadata.abstractHydration : null).toEqual(
        {
          status: "ready",
          repairAttempted: true,
        },
      );
      expect(result && isRouteAiCommentGenerationWaitingForHydration(result)).toBe(false);
      expect(result && buildRouteAiCommentGenerationCommand(result)).toBeNull();
      expect(result && shouldQueueSearchEnrichment(result)).toBe(false);
    } finally {
      global.fetch = originalFetch;
      useResearchRouteStore.getState().setCurrentView(null, "test:empty");
    }
  });
});

describe("research-route-runtime relationship and empty generation commands", () => {
  it("builds generation commands for relationship ResearchRoutePayloads with an agent panel slot", () => {
    const command = buildRouteAiCommentGenerationCommand({
      ...baseDocument,
      id: "citation-1",
      type: "citation_lineage",
      title: "인용 계보: Paper 1",
      metadata: {
        type: "citation_lineage",
        seedPaper: {
          paperId: "seed-1",
          title: "Paper 1",
          abstract: "abstract",
          year: 2024,
          citationCount: 10,
          url: "https://example.com/paper-1",
          authors: [{ name: "Alice" }],
        },
        referenceIds: ["paper-1"],
        citationIds: ["paper-2"],
        papers: [],
        total: 0,
      },
    });

    expect(command).toMatchObject({
      trigger: "citation_lineage_opened",
      ownerPrincipalId: "principal-1",
      targetRoutePayloadId: "citation-1",
    });
    expect(command?.viewSnapshot).toMatchObject({
      snapshotId: "citation-1",
      snapshotKind: "citation_lineage",
    });
  });

  it("waits for graph-neighbor card hydration before building its generation command", () => {
    const graphView = {
      ...baseDocument,
      id: "graph-1",
      type: "graph_neighbors" as const,
      metadata: {
        type: "graph_neighbors" as const,
        seedPaper: baseDocument.metadata.papers[0],
        papers: [baseDocument.metadata.papers[0]],
        total: 1,
        coCited: [
          {
            paper: baseDocument.metadata.papers[0],
            shared: 3,
          },
        ],
        coupled: [],
        cardDataHydration: { status: "pending" as const },
      },
    };

    expect(buildRouteAiCommentGenerationCommand(graphView)).toBeNull();
    expect(
      buildRouteAiCommentGenerationCommand({
        ...graphView,
        metadata: {
          ...graphView.metadata,
          cardDataHydration: { status: "ready" as const },
        },
      }),
    ).toMatchObject({
      trigger: "graph_neighbors_opened",
      targetRoutePayloadId: "graph-1",
    });
  });

  it("skips empty search ResearchRoutePayloads when building generation commands", () => {
    expect(
      buildRouteAiCommentGenerationCommand({
        ...baseDocument,
        metadata: {
          type: "search",
          query: "",
          total: 0,
          papers: [],
        },
      }),
    ).toBeNull();

    expect(
      buildRouteAiCommentGenerationCommand({
        ...baseDocument,
        metadata: {
          type: "search",
          query: "llm",
          total: 0,
          papers: [],
        },
      }),
    ).toBeNull();

    expect(
      buildRouteAiCommentGenerationCommand({
        ...baseDocument,
        metadata: {
          ...baseDocument.metadata,
          facetFilters: {
            fieldsOfStudy: [],
            authors: ["Missing Author"],
            venues: [],
            hasPdf: false,
          },
        },
      }),
    ).toBeNull();
  });
});
