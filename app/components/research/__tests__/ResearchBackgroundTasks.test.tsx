import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildInlineAnalysisCycleKey } from "@/app/lib/inline-analysis";
import { ResearchBackgroundTasks } from "@/app/components/research/ResearchBackgroundTasks";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { API_ROUTES } from "@/app/lib/api-routes";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { flushTasks, getRequestUrl } from "./research-background-tasks-test-support";

function createSearchResultDocument(params?: {
  id?: string;
  query?: string;
  paperCount?: number;
}): Extract<ResearchRoutePayload, { type: "search" }> {
  const query = params?.query ?? "research agents";
  const paperCount = params?.paperCount ?? 1;

  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: params?.id ?? "search-result-1",
    type: "search",
    title: `검색: ${query}`,
    content: "",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-07T00:00:01.000Z",
    updatedAt: "2026-04-07T00:00:01.000Z",
    metadata: {
      type: "search",
      query,
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

function createInlineAnalysisResult() {
  return {
    summary: "핵심 요약",
    objective: "핵심 주장",
    methodology: "핵심 방법",
    results: "주요 결과",
    keywords: ["research agents"],
    semanticProfile: {
      claim: "핵심 주장",
      method: "핵심 방법",
      topics: ["research agents"],
      finding: "주요 결과",
      quotedBasis: {
        claim: "Research Agents",
        method: "abstract",
        topics: ["research agents"],
        finding: null,
      },
    },
    confidence: "high" as const,
    evidenceMap: {},
  };
}

function buildInlineAnalysisResponse(): Response {
  return new Response(
    JSON.stringify([
      {
        paperId: "paper-1",
        source: "abstract",
        analysis: createInlineAnalysisResult(),
      },
    ]),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function createAbortablePendingResponse(signal?: AbortSignal | null): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    signal?.addEventListener(
      "abort",
      () => {
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function setDocumentStoreDocuments(documents: ResearchRoutePayload[]) {
  const view = documents.at(0) ?? null;
  useResearchRouteStore.getState().setCurrentView(view, view ? `test:${view.id}` : "test:empty");
}

const originalFetch = global.fetch;
let root: Root | null = null;

function registerResearchBackgroundTaskHooks() {
  beforeEach(() => {
    window.history.pushState({}, "", "/search?q=research+agents");
    useResearchRouteStore.setState({
      currentView: null,
    });
    useBackgroundTaskStore.setState({
      inlineAnalysisTasks: {},
      termDiscoveryTasks: {},
    });
    useReactionActionStore.setState({ sendMessageImpl: null });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    global.fetch = originalFetch;
    window.history.pushState({}, "", "/");
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
}

describe("ResearchBackgroundTasks inline analysis", () => {
  registerResearchBackgroundTaskHooks();

  // Background 작업 수명은 현재 route 뷰에 귀속된다: 뷰가 떠나면 in-flight
  // inline 분석은 중단되고 task는 폐기된다.
  // @check acceptance-check:search-query-route-transition-route-owned-render
  it("aborts and discards a running inline analysis when the view leaves the route", async () => {
    vi.useFakeTimers();
    const searchDocument = createSearchResultDocument();
    const searchMetadata = searchDocument.metadata;

    let analyzeSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (url === API_ROUTES.PAPERS_ANALYZE_INLINE) {
        analyzeSignal = init?.signal ?? undefined;
        return createAbortablePendingResponse(init?.signal ?? null);
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    global.fetch = fetchMock;

    setDocumentStoreDocuments([searchDocument]);

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
        progressMap: new Map([["paper-1", "queued"]]),
      });
    });

    await flushTasks();
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.all([Promise.resolve(), Promise.resolve()]);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      API_ROUTES.PAPERS_ANALYZE_INLINE,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(analyzeSignal?.aborted).toBe(false);

    act(() => {
      setDocumentStoreDocuments([]);
    });

    await flushTasks();

    expect(analyzeSignal?.aborted).toBe(true);
    expect(
      useBackgroundTaskStore.getState().inlineAnalysisTasks[searchDocument.id],
    ).toBeUndefined();
  });

  // enrichment도 같은 수명 규칙을 따른다: 뷰가 떠나면 in-flight 요청이 중단된다.
  // @check acceptance-check:search-query-route-transition-route-owned-render
  it("aborts an in-flight search enrichment when the view leaves the route", async () => {
    const searchDocument = createSearchResultDocument();
    searchDocument.metadata.papers = searchDocument.metadata.papers.map((paper) => ({
      ...paper,
      paperId: "12345",
    }));
    searchDocument.metadata.abstractHydration = { status: "pending" };

    let enrichmentSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (url === API_ROUTES.SEARCH_ENRICHMENT) {
        enrichmentSignal = init?.signal ?? undefined;
        return createAbortablePendingResponse(init?.signal ?? null);
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    global.fetch = fetchMock;

    setDocumentStoreDocuments([searchDocument]);

    const container = document.createElement("div");
    root = createRoot(container);

    act(() => {
      root?.render(<ResearchBackgroundTasks />);
    });

    await flushTasks();

    expect(fetchMock).toHaveBeenCalledWith(
      API_ROUTES.SEARCH_ENRICHMENT,
      expect.objectContaining({ method: "POST" }),
    );
    expect(enrichmentSignal?.aborted).toBe(false);

    act(() => {
      setDocumentStoreDocuments([]);
    });

    await flushTasks();

    expect(enrichmentSignal?.aborted).toBe(true);
  });

  it("does not emit a follow-up reaction generation command after inline analysis persists", async () => {
    vi.useFakeTimers();
    const searchDocument = createSearchResultDocument();
    const searchMetadata = searchDocument.metadata;
    const sendMessageImpl = vi.fn();
    useReactionActionStore.setState({ sendMessageImpl });

    let resolveAnalyzeResponse!: (value: Response) => void;
    const analyzeResponsePromise = new Promise<Response>((resolve) => {
      resolveAnalyzeResponse = resolve;
    });
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = getRequestUrl(input);
      if (url === API_ROUTES.PAPERS_ANALYZE_INLINE) {
        return analyzeResponsePromise;
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    setDocumentStoreDocuments([searchDocument]);

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
        progressMap: new Map([["paper-1", "queued"]]),
      });
    });

    await flushTasks();
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
      await Promise.resolve();
    });

    resolveAnalyzeResponse(buildInlineAnalysisResponse());

    await flushTasks();

    expect(sendMessageImpl).not.toHaveBeenCalled();
  });
});
