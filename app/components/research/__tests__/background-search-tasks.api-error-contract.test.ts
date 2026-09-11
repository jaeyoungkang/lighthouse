import { afterEach, describe, expect, it, vi } from "vitest";
import { runSearchEnrichmentTask } from "@/app/components/research/background-search-tasks";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("search enrichment API error contract", () => {
  it("does not retry a correctable 400 with the same search payload", async () => {
    const pendingDocument = createSearchResultDocument();
    useResearchRouteStore.getState().setCurrentView(pendingDocument, `test:${pendingDocument.id}`);
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        Response.json(
          {
            error: "invalid search enrichment payload",
            code: "SEARCH_ENRICHMENT_INVALID",
            action: "correct-request",
            retryable: false,
          },
          { status: 400 },
        ),
      ),
    );
    global.fetch = fetchMock;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      runSearchEnrichmentTask({
        task: {
          executionId: useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
          documentId: pendingDocument.id,
          ownerPrincipalId: pendingDocument.ownerPrincipalId,
          query: pendingDocument.metadata.query,
          metadata: pendingDocument.metadata,
        },
        controller: new AbortController(),
      }),
    ).resolves.toMatchObject({
      metadata: {
        abstractHydration: { status: "ready", repairAttempted: true },
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function createSearchResultDocument(): Extract<ResearchRoutePayload, { type: "search" }> {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-api-error-contract",
    type: "search",
    title: "검색: research agents",
    content: "",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-07-31T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
    metadata: {
      type: "search",
      query: "research agents",
      total: 1,
      abstractHydration: { status: "pending" },
      papers: [
        {
          paperId: "paper-1",
          title: "Research Agents",
          abstract: "abstract",
          year: 2025,
          citationCount: 12,
          url: "https://example.com/paper-1",
          authors: [{ name: "Author 1", authorId: "a1" }],
          referenceIds: [],
          citationIds: [],
        },
      ],
    },
  };
}
