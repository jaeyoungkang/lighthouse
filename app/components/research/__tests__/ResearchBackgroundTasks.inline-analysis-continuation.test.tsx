import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildInlineAnalysisCycleKey } from "@/app/lib/inline-analysis";
import { INLINE_ANALYSIS_BATCH_SIZE } from "@/app/components/research-route-renderers/use-inline-analysis";
import { ResearchBackgroundTasks } from "@/app/components/research/ResearchBackgroundTasks";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import { API_ROUTES, researchRoutePageRoute } from "@/app/lib/api-routes";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { flushTasks, getRequestUrl } from "./research-background-tasks-test-support";

function createSearchResultView(
  paperCount = 20,
): Extract<ResearchRoutePayload, { type: "search" }> {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-result-continuation",
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

function inlineAnalysisResponseFor(papers: SearchMetadata["papers"]): Response {
  return new Response(
    JSON.stringify(
      papers.map((paper) => ({
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
  );
}

describe("ResearchBackgroundTasks inline analysis continuation", () => {
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

  it("continues queued relationship visible ids through the mounted runner after controller cleanup", async () => {
    const searchDocument = createSearchResultView(20);
    const searchMetadata = searchDocument.metadata;
    const batches = Array.from(
      { length: Math.ceil(searchMetadata.papers.length / INLINE_ANALYSIS_BATCH_SIZE) },
      (_, index) =>
        searchMetadata.papers.slice(
          index * INLINE_ANALYSIS_BATCH_SIZE,
          (index + 1) * INLINE_ANALYSIS_BATCH_SIZE,
        ),
    );
    const visiblePaperIds = searchMetadata.papers.map((paper) => paper.paperId);
    const analyzeRequests: string[][] = [];

    global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (url === API_ROUTES.PAPERS_ANALYZE_INLINE) {
        if (typeof init?.body !== "string") {
          throw new Error("expected inline analysis request body");
        }
        const body = JSON.parse(init.body) as { papers: Array<{ paperId: string }> };
        const requestedIds = body.papers.map((paper) => paper.paperId);
        analyzeRequests.push(requestedIds);
        const requestedIdSet = new Set(requestedIds);
        const responsePapers = searchMetadata.papers.filter((paper) =>
          requestedIdSet.has(paper.paperId),
        );
        return Promise.resolve(inlineAnalysisResponseFor(responsePapers));
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

    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:138");

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
        analysisPapers: searchMetadata.papers,
        visiblePaperIds,
        visibleCount: 20,
        progressMap: new Map(searchMetadata.papers.map((paper) => [paper.paperId, "queued"])),
      });
    });

    for (let index = 0; index < batches.length; index += 1) {
      await flushTasks();
      await act(async () => {
        vi.advanceTimersByTime(350);
        await Promise.all([Promise.resolve(), Promise.resolve()]);
      });
    }

    expect(analyzeRequests).toEqual(batches.map((batch) => batch.map((paper) => paper.paperId)));
    expect(
      useBackgroundTaskStore.getState().inlineAnalysisTasks[searchDocument.id],
    ).toBeUndefined();
  });

  it("hands corrected paper input to the next batch without inheriting stale recovery", async () => {
    const searchDocument = createSearchResultView(1);
    const executionId = "test-execution:corrected-input";
    const [originalPaper] = searchDocument.metadata.papers;
    const correctedPaper = {
      ...originalPaper,
      abstract: `${originalPaper.abstract ?? ""} corrected`,
    };
    const correctedDocument = {
      ...searchDocument,
      metadata: { ...searchDocument.metadata, papers: [correctedPaper] },
    };
    const requestedAbstracts: Array<string | null> = [];
    let resolveFirstRequest: ((response: Response) => void) | null = null;
    global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (url !== API_ROUTES.PAPERS_ANALYZE_INLINE || typeof init?.body !== "string") {
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }
      const body = JSON.parse(init.body) as { papers: Array<{ abstract: string | null }> };
      requestedAbstracts.push(body.papers[0]?.abstract ?? null);
      if (requestedAbstracts.length === 1) {
        return new Promise<Response>((resolve) => {
          resolveFirstRequest = resolve;
        });
      }
      return Promise.resolve(inlineAnalysisResponseFor([correctedPaper]));
    });

    useResearchRouteStore.getState().setCurrentView(searchDocument, executionId);
    root = createRoot(document.createElement("div"));
    act(() => {
      root?.render(<ResearchBackgroundTasks />);
      useBackgroundTaskStore.getState().enqueueInlineAnalysisTask({
        executionId,
        documentId: searchDocument.id,
        ownerPrincipalId: searchDocument.ownerPrincipalId,
        cycleKey: buildInlineAnalysisCycleKey(searchDocument.id, searchDocument.metadata),
        metadata: searchDocument.metadata,
        analysisPapers: searchDocument.metadata.papers,
        visiblePaperIds: [originalPaper.paperId],
        visibleCount: 1,
        progressMap: new Map([[originalPaper.paperId, "queued"]]),
      });
    });
    await flushTasks();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(requestedAbstracts).toEqual([originalPaper.abstract]);

    act(() => {
      useResearchRouteStore.getState().patchCurrentView(correctedDocument, executionId);
      useBackgroundTaskStore.getState().setInlineAnalysisTaskState(searchDocument.id, {
        metadata: correctedDocument.metadata,
        analysisPapers: correctedDocument.metadata.papers,
        progressMap: new Map([[originalPaper.paperId, "queued"]]),
        retryCountMap: new Map(),
        status: "queued",
      });
    });
    await act(async () => {
      resolveFirstRequest?.(new Response(null, { status: 500 }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      useBackgroundTaskStore.getState().inlineAnalysisTasks[searchDocument.id]?.retryNotBeforeAt,
    ).toBeUndefined();
    await flushTasks();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
      await Promise.resolve();
      await Promise.resolve();
    });
    await flushTasks();

    expect(requestedAbstracts).toEqual([originalPaper.abstract, correctedPaper.abstract]);
    expect(
      useBackgroundTaskStore.getState().inlineAnalysisTasks[searchDocument.id],
    ).toBeUndefined();
  });

  it("starts the replacement cycle after the previous controller settles", async () => {
    const originalDocument = createSearchResultView(1);
    const appendedDocument = createSearchResultView(2);
    const executionId = "test-execution:replacement-cycle";
    const [firstPaper, secondPaper] = appendedDocument.metadata.papers;
    const requestedPaperIds: string[][] = [];
    let resolveFirstRequest: ((response: Response) => void) | null = null;
    global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (url !== API_ROUTES.PAPERS_ANALYZE_INLINE || typeof init?.body !== "string") {
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }
      const body = JSON.parse(init.body) as { papers: Array<{ paperId: string }> };
      const requestedIds = body.papers.map((paper) => paper.paperId);
      requestedPaperIds.push(requestedIds);
      if (requestedPaperIds.length === 1) {
        return new Promise<Response>((resolve) => {
          resolveFirstRequest = resolve;
        });
      }
      return Promise.resolve(inlineAnalysisResponseFor([secondPaper]));
    });

    useResearchRouteStore.getState().setCurrentView(originalDocument, executionId);
    root = createRoot(document.createElement("div"));
    act(() => {
      root?.render(<ResearchBackgroundTasks />);
      useBackgroundTaskStore.getState().enqueueInlineAnalysisTask({
        executionId,
        documentId: originalDocument.id,
        ownerPrincipalId: originalDocument.ownerPrincipalId,
        cycleKey: buildInlineAnalysisCycleKey(originalDocument.id, originalDocument.metadata),
        metadata: originalDocument.metadata,
        analysisPapers: originalDocument.metadata.papers,
        visiblePaperIds: [firstPaper.paperId],
        visibleCount: 1,
        progressMap: new Map([[firstPaper.paperId, "queued"]]),
      });
    });
    await flushTasks();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(requestedPaperIds).toEqual([[firstPaper.paperId]]);

    act(() => {
      useResearchRouteStore.getState().patchCurrentView(appendedDocument, executionId);
      useBackgroundTaskStore.getState().enqueueInlineAnalysisTask({
        executionId,
        documentId: appendedDocument.id,
        ownerPrincipalId: appendedDocument.ownerPrincipalId,
        cycleKey: buildInlineAnalysisCycleKey(appendedDocument.id, appendedDocument.metadata),
        metadata: appendedDocument.metadata,
        analysisPapers: appendedDocument.metadata.papers,
        visiblePaperIds: [firstPaper.paperId, secondPaper.paperId],
        visibleCount: 2,
        progressMap: new Map([
          [firstPaper.paperId, "done"],
          [secondPaper.paperId, "queued"],
        ]),
      });
    });
    await act(async () => {
      resolveFirstRequest?.(inlineAnalysisResponseFor([firstPaper]));
      await Promise.resolve();
      await Promise.resolve();
    });
    await flushTasks();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    await flushTasks();

    expect(requestedPaperIds).toEqual([[firstPaper.paperId], [secondPaper.paperId]]);
    expect(
      useBackgroundTaskStore.getState().inlineAnalysisTasks[appendedDocument.id],
    ).toBeUndefined();
  });
});
