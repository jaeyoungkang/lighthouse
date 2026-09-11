import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchBackgroundTasks } from "@/app/components/research/ResearchBackgroundTasks";
import { buildInlineAnalysisCycleKey } from "@/app/lib/inline-analysis";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { API_ROUTES } from "@/app/lib/api-routes";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { flushTasks, getRequestUrl } from "./research-background-tasks-test-support";

function createSearchResultDocument(): Extract<ResearchRoutePayload, { type: "search" }> {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-result-order",
    type: "search",
    title: "검색: research agents",
    content: "",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-07T00:00:01.000Z",
    updatedAt: "2026-04-07T00:00:01.000Z",
    metadata: {
      type: "search",
      query: "research agents",
      total: 1,
      papers: [
        {
          paperId: "paper-1",
          title: "Research Agents 1",
          abstract: "abstract 1",
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

describe("ResearchBackgroundTasks inline analysis ordering", () => {
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    useBackgroundTaskStore.setState({
      inlineAnalysisTasks: {},
      termDiscoveryTasks: {},
    });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
      root = null;
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
  });

  it("starts route AI comment generation before inline analysis batches", async () => {
    const searchDocument = createSearchResultDocument();
    const searchMetadata = searchDocument.metadata;
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = getRequestUrl(input);
      if (url === API_ROUTES.PAPERS_ANALYZE_INLINE) {
        return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:92");
    useResearchRouteStore
      .getState()
      .markRouteAiCommentGenerationPending(
        searchDocument.id,
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );

    root = createRoot(document.createElement("div"));
    act(() => {
      root?.render(<ResearchBackgroundTasks />);
      useBackgroundTaskStore.getState().enqueueInlineAnalysisTask({
        executionId: useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
        documentId: searchDocument.id,
        ownerPrincipalId: searchDocument.ownerPrincipalId,
        cycleKey: buildInlineAnalysisCycleKey(searchDocument.id, searchMetadata),
        metadata: searchMetadata,
        visibleCount: 1,
        visiblePaperIds: ["paper-1"],
        progressMap: new Map([["paper-1", "queued"]]),
      });
    });

    await flushTasks();
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
    });
    expect(global.fetch).not.toHaveBeenCalled();

    act(() => {
      useResearchRouteStore
        .getState()
        .markRouteAiCommentGenerationStarted(
          searchDocument.id,
          useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
        );
    });
    await flushTasks();
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.all([Promise.resolve(), Promise.resolve()]);
    });

    expect(
      vi.mocked(global.fetch).mock.calls.some(([input]) => {
        return getRequestUrl(input) === API_ROUTES.PAPERS_ANALYZE_INLINE;
      }),
    ).toBe(true);
  });
});
