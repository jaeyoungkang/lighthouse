import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildInlineAnalysisCycleKey } from "@/app/lib/inline-analysis";
import { INLINE_ANALYSIS_BATCH_SIZE } from "@/app/components/research-route-renderers/use-inline-analysis";
import { runInlineAnalysisTask } from "@/app/components/research/background-inline-analysis";
import { ResearchBackgroundTasks } from "@/app/components/research/ResearchBackgroundTasks";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import { API_ROUTES, researchRoutePageRoute } from "@/app/lib/api-routes";
import {
  useBackgroundTaskStore,
  type InlineAnalysisTask,
} from "@/app/stores/background-task-store";
import { flushTasks, getRequestUrl } from "./research-background-tasks-test-support";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

function createSearchResultDocument(
  paperCount = 25,
): Extract<ResearchRoutePayload, { type: "search" }> {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-result-many",
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
      total: paperCount,
      papers: Array.from({ length: paperCount }, (_, index) => ({
        paperId: `paper-${String(index + 1)}`,
        title: `Research Agents ${String(index + 1)}`,
        abstract: `abstract ${String(index + 1)}`,
        year: 2025,
        citationCount: 12,
        url: `https://example.com/paper-${String(index + 1)}`,
        authors: [{ name: `Author ${String(index + 1)}`, authorId: `a${String(index + 1)}` }],
        referenceIds: [],
        citationIds: [],
      })),
    },
  };
}

describe("ResearchBackgroundTasks inline analysis window", () => {
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
  });

  it("runs inline analysis for rendered expanded-window cards without queueing hidden cards", async () => {
    const searchDocument = createSearchResultDocument();
    const searchMetadata = searchDocument.metadata;

    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = getRequestUrl(input);
      if (url === API_ROUTES.PAPERS_ANALYZE_INLINE) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (url === researchRoutePageRoute(searchDocument.id, "gap_network")) {
        return Promise.resolve(
          new Response(JSON.stringify(searchDocument), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:108");

    const container = document.createElement("div");
    root = createRoot(container);

    act(() => {
      root?.render(<ResearchBackgroundTasks />);
    });

    act(() => {
      useBackgroundTaskStore.getState().enqueueInlineAnalysisTask({
        executionId: useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
        documentId: searchDocument.id,
        ownerPrincipalId: searchDocument.ownerPrincipalId,
        cycleKey: buildInlineAnalysisCycleKey(searchDocument.id, searchMetadata),
        metadata: searchMetadata,
        visiblePaperIds: ["paper-11"],
        visibleCount: searchMetadata.papers.length,
        progressMap: new Map(searchMetadata.papers.map((paper) => [paper.paperId, "queued"])),
      });
    });

    await flushTasks();
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.all([Promise.resolve(), Promise.resolve()]);
    });

    const analyzeCall = vi
      .mocked(global.fetch)
      .mock.calls.find(([input]) => getRequestUrl(input) === API_ROUTES.PAPERS_ANALYZE_INLINE);
    const requestBody = analyzeCall?.[1]?.body;
    expect(typeof requestBody).toBe("string");

    const body = JSON.parse(requestBody as string) as { papers: Array<{ paperId: string }> };
    const paperIds = body.papers.map((paper) => paper.paperId);

    expect(paperIds).toEqual(["paper-11"]);
    expect(paperIds).not.toContain("paper-12");
  });

  it("runs inline analysis only for task visible paper ids", async () => {
    const searchDocument = createSearchResultDocument();
    const searchMetadata = searchDocument.metadata;

    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = getRequestUrl(input);
      if (url === API_ROUTES.PAPERS_ANALYZE_INLINE) {
        return Promise.resolve(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (url === researchRoutePageRoute(searchDocument.id, "gap_network")) {
        return Promise.resolve(
          new Response(JSON.stringify(searchDocument), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:174");

    const container = document.createElement("div");
    root = createRoot(container);

    act(() => {
      root?.render(<ResearchBackgroundTasks />);
    });

    act(() => {
      useBackgroundTaskStore.getState().enqueueInlineAnalysisTask({
        executionId: useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
        documentId: searchDocument.id,
        ownerPrincipalId: searchDocument.ownerPrincipalId,
        cycleKey: buildInlineAnalysisCycleKey(searchDocument.id, searchMetadata),
        metadata: searchMetadata,
        visibleCount: searchMetadata.papers.length,
        visiblePaperIds: ["paper-3", "paper-8"],
        progressMap: new Map(searchMetadata.papers.map((paper) => [paper.paperId, "queued"])),
      });
    });

    await flushTasks();
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.all([Promise.resolve(), Promise.resolve()]);
    });

    const analyzeCall = vi
      .mocked(global.fetch)
      .mock.calls.find(([input]) => getRequestUrl(input) === API_ROUTES.PAPERS_ANALYZE_INLINE);
    const requestBody = analyzeCall?.[1]?.body;
    expect(typeof requestBody).toBe("string");

    const body = JSON.parse(requestBody as string) as { papers: Array<{ paperId: string }> };
    expect(body.papers.map((paper) => paper.paperId)).toEqual(["paper-3", "paper-8"]);
  });

  it("keeps expanded relationship visible ids queued after the first running batch completes", async () => {
    const searchDocument = createSearchResultDocument(20);
    const searchMetadata = searchDocument.metadata;
    const firstBatch = searchMetadata.papers.slice(0, INLINE_ANALYSIS_BATCH_SIZE);
    const visiblePaperIds = searchMetadata.papers.map((paper) => paper.paperId);
    const cycleKey = buildInlineAnalysisCycleKey(searchDocument.id, searchMetadata);
    const expandedProgressMap = new Map(
      searchMetadata.papers.map((paper, index) => [
        paper.paperId,
        index < INLINE_ANALYSIS_BATCH_SIZE ? "running" : "queued",
      ]),
    ) as InlineAnalysisTask["progressMap"];
    const staleProgressMap = new Map(
      firstBatch.map((paper) => [paper.paperId, "running"]),
    ) as InlineAnalysisTask["progressMap"];
    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:227");
    const executionId = useResearchRouteStore.getState().activeExecutionId ?? "test-execution";
    const staleTask: InlineAnalysisTask = {
      executionId,
      documentId: searchDocument.id,
      ownerPrincipalId: searchDocument.ownerPrincipalId,
      cycleKey,
      metadata: searchMetadata,
      analysisPapers: searchMetadata.papers,
      visiblePaperIds: visiblePaperIds.slice(0, INLINE_ANALYSIS_BATCH_SIZE),
      visibleCount: INLINE_ANALYSIS_BATCH_SIZE,
      progressMap: staleProgressMap,
      retryCountMap: new Map(),
      status: "running",
    };

    useBackgroundTaskStore.getState().enqueueInlineAnalysisTask({
      executionId,
      documentId: searchDocument.id,
      ownerPrincipalId: searchDocument.ownerPrincipalId,
      cycleKey,
      metadata: searchMetadata,
      analysisPapers: searchMetadata.papers,
      visiblePaperIds,
      visibleCount: 20,
      progressMap: expandedProgressMap,
    });
    useBackgroundTaskStore.getState().setInlineAnalysisTaskState(searchDocument.id, {
      status: "running",
      progressMap: expandedProgressMap,
    });

    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = getRequestUrl(input);
      if (url === API_ROUTES.PAPERS_ANALYZE_INLINE) {
        return Promise.resolve(
          new Response(
            JSON.stringify(
              firstBatch.map((paper) => ({
                paperId: paper.paperId,
                analysis: {
                  summary: `summary ${paper.paperId}`,
                  objective: null,
                  methodology: null,
                  results: null,
                  keywords: [],
                  semanticProfile: {
                    claim: null,
                    topics: [],
                    method: null,
                    finding: null,
                    quotedBasis: {},
                  },
                  confidence: "medium",
                  evidenceMap: {},
                },
                source: "abstract",
              })),
            ),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    const controller = new AbortController();
    const taskPromise = runInlineAnalysisTask({
      task: staleTask,
      batch: firstBatch,
      controller,
      clearInlineAnalysisTask: useBackgroundTaskStore.getState().clearInlineAnalysisTask,
      setInlineAnalysisTaskState: useBackgroundTaskStore.getState().setInlineAnalysisTaskState,
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
      await taskPromise;
    });

    const task = useBackgroundTaskStore.getState().inlineAnalysisTasks[searchDocument.id];
    expect(task).toBeDefined();
    expect(task?.status).toBe("queued");
    expect(task?.visibleCount).toBe(20);
    expect(task?.visiblePaperIds).toEqual(visiblePaperIds);
    expect(task?.progressMap.get("paper-1")).toBe("done");
    expect(task?.progressMap.get("paper-5")).toBe("done");
    expect(task?.progressMap.get("paper-6")).toBe("queued");
    expect(task?.progressMap.get("paper-20")).toBe("queued");
  });

  it("ignores stale in-flight inline-analysis results after the same document id moves to a new cycle", async () => {
    const staleDocument = createSearchResultDocument(10);
    const staleMetadata = staleDocument.metadata;
    const latestMetadata: SearchMetadata = {
      ...staleMetadata,
      papers: staleMetadata.papers.map((paper, index) => ({
        ...paper,
        paperId: `new-paper-${String(index + 1)}`,
        title: `New Paper ${String(index + 1)}`,
      })),
    };
    const latestDocument: Extract<ResearchRoutePayload, { type: "search" }> = {
      ...staleDocument,
      metadata: latestMetadata,
    };
    const staleCycleKey = buildInlineAnalysisCycleKey(staleDocument.id, staleMetadata);
    const latestCycleKey = buildInlineAnalysisCycleKey(latestDocument.id, latestMetadata);
    const staleBatch = staleMetadata.papers.slice(0, INLINE_ANALYSIS_BATCH_SIZE);
    const latestProgressMap = new Map(
      latestMetadata.papers.map((paper) => [paper.paperId, "queued"]),
    ) as InlineAnalysisTask["progressMap"];
    const staleTask: InlineAnalysisTask = {
      executionId: useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      documentId: staleDocument.id,
      ownerPrincipalId: staleDocument.ownerPrincipalId,
      cycleKey: staleCycleKey,
      metadata: staleMetadata,
      analysisPapers: staleMetadata.papers,
      visiblePaperIds: staleMetadata.papers.map((paper) => paper.paperId),
      visibleCount: 10,
      progressMap: new Map(
        staleMetadata.papers.map((paper) => [paper.paperId, "running"]),
      ) as InlineAnalysisTask["progressMap"],
      retryCountMap: new Map(),
      status: "running",
    };

    useResearchRouteStore.getState().setCurrentView(latestDocument, "test-execution:355");
    useBackgroundTaskStore.getState().enqueueInlineAnalysisTask({
      executionId: useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      documentId: latestDocument.id,
      ownerPrincipalId: latestDocument.ownerPrincipalId,
      cycleKey: latestCycleKey,
      metadata: latestMetadata,
      analysisPapers: latestMetadata.papers,
      visiblePaperIds: latestMetadata.papers.map((paper) => paper.paperId),
      visibleCount: 10,
      progressMap: latestProgressMap,
    });

    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = getRequestUrl(input);
      if (url === API_ROUTES.PAPERS_ANALYZE_INLINE) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                paperId: "paper-1",
                analysis: {
                  summary: "stale summary",
                  objective: null,
                  methodology: null,
                  results: null,
                  keywords: [],
                  semanticProfile: {
                    claim: null,
                    topics: [],
                    method: null,
                    finding: null,
                    quotedBasis: {},
                  },
                  confidence: "medium",
                  evidenceMap: {},
                },
                source: "abstract",
              },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    const taskPromise = runInlineAnalysisTask({
      task: staleTask,
      batch: staleBatch,
      controller: new AbortController(),
      clearInlineAnalysisTask: useBackgroundTaskStore.getState().clearInlineAnalysisTask,
      setInlineAnalysisTaskState: useBackgroundTaskStore.getState().setInlineAnalysisTaskState,
    });

    await act(async () => {
      vi.advanceTimersByTime(350);
      await taskPromise;
    });

    const task = useBackgroundTaskStore.getState().inlineAnalysisTasks[latestDocument.id];
    const currentDocument = useResearchRouteStore.getState().currentView;
    expect(task?.cycleKey).toBe(latestCycleKey);
    expect(task?.progressMap.get("new-paper-1")).toBe("queued");
    expect(task?.progressMap.has("paper-1")).toBe(false);
    expect(currentDocument?.metadata.type).toBe("search");
    if (currentDocument?.metadata.type !== "search") {
      throw new Error("expected search metadata");
    }
    const firstPaper = currentDocument.metadata.papers[0];
    expect(firstPaper.paperId).toBe("new-paper-1");
    expect("inlineAnalysis" in firstPaper).toBe(false);
  });
});
