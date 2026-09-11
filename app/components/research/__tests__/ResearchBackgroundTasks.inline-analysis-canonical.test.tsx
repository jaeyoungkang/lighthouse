import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildInlineAnalysisCycleKey } from "@/app/lib/inline-analysis";
import { useInlineAnalysis } from "@/app/components/research-route-renderers/use-inline-analysis";
import { ResearchBackgroundTasks } from "@/app/components/research/ResearchBackgroundTasks";
import { runInlineAnalysisTask } from "@/app/components/research/background-inline-analysis";
import { INLINE_ANALYSIS_VERSION } from "@/app/domain/analysis";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { API_ROUTES } from "@/app/lib/api-routes";
import { BACKGROUND_REQUEST_SILENCE_TIMEOUT_MS } from "@/app/lib/background-request";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { flushTasks, getRequestUrl } from "./research-background-tasks-test-support";

function createSearchView(): Extract<ResearchRoutePayload, { type: "search" }> {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-1",
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
      total: 3,
      papers: [1, 2, 3].map((index) => ({
        paperId: `paper-${String(index)}`,
        title: `Research Agents ${String(index)}`,
        abstract: `abstract ${String(index)}`,
        year: 2025,
        citationCount: 12,
        url: `https://example.com/paper-${String(index)}`,
        authors: [{ name: `Author ${String(index)}`, authorId: `a${String(index)}` }],
      })),
    },
  };
}

function inlineAnalysisResult() {
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

function InlineAnalysisProgressProbe({
  document,
}: {
  document: ReturnType<typeof createSearchView>;
}) {
  const { analysisProgressMap } = useInlineAnalysis({
    documentId: document.id,
    ownerPrincipalId: document.ownerPrincipalId,
    metadata: document.metadata,
    visibleCount: 1,
  });
  return <div data-testid="paper-1-progress">{analysisProgressMap.get("paper-1")}</div>;
}

const originalFetch = global.fetch;
let root: Root | null = null;

beforeEach(() => {
  vi.useFakeTimers();
  useResearchRouteStore.setState({
    currentView: null,
  });
  useBackgroundTaskStore.setState({
    inlineAnalysisTasks: {},
  });
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  global.fetch = originalFetch;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ResearchBackgroundTasks inline analysis canonical persistence", () => {
  it("does not project a prior execution task into a replacement route render", async () => {
    const searchDocument = createSearchView();
    const cycleKey = buildInlineAnalysisCycleKey(searchDocument.id, searchDocument.metadata);
    useBackgroundTaskStore.getState().enqueueInlineAnalysisTask({
      executionId: "test:search-1:old",
      documentId: searchDocument.id,
      ownerPrincipalId: searchDocument.ownerPrincipalId,
      cycleKey,
      metadata: searchDocument.metadata,
      visibleCount: 1,
      progressMap: new Map([["paper-1", "error"]]),
    });
    useResearchRouteStore.getState().setCurrentView(searchDocument, "test:search-1:new");

    const container = document.createElement("div");
    root = createRoot(container);
    await act(async () => {
      root?.render(<InlineAnalysisProgressProbe document={searchDocument} />);
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="paper-1-progress"]')?.textContent).toBe("queued");
    expect(
      useBackgroundTaskStore.getState().inlineAnalysisTasks[searchDocument.id]?.executionId,
    ).toBe("test:search-1:new");
  });

  it("resets settled-error retry state when paper input changes", async () => {
    const searchDocument = createSearchView();
    const executionId = "test:search-1:corrected-input";
    const staleCycleKey = buildInlineAnalysisCycleKey(searchDocument.id, searchDocument.metadata);
    useResearchRouteStore.getState().setCurrentView(searchDocument, executionId);
    useBackgroundTaskStore.getState().enqueueInlineAnalysisTask({
      executionId,
      documentId: searchDocument.id,
      ownerPrincipalId: searchDocument.ownerPrincipalId,
      cycleKey: staleCycleKey,
      metadata: searchDocument.metadata,
      visibleCount: 1,
      progressMap: new Map([["paper-1", "error"]]),
    });
    useBackgroundTaskStore
      .getState()
      .setInlineAnalysisTaskState(
        searchDocument.id,
        { retryCountMap: new Map([["paper-1", 2]]), status: "settled" },
        staleCycleKey,
      );

    const correctedDocument = {
      ...searchDocument,
      metadata: {
        ...searchDocument.metadata,
        papers: searchDocument.metadata.papers.map((paper, index) =>
          index === 0 ? { ...paper, abstract: `${paper.abstract ?? ""} corrected` } : paper,
        ),
      },
    };
    useResearchRouteStore.getState().patchCurrentView(correctedDocument, executionId);

    const container = document.createElement("div");
    root = createRoot(container);
    await act(async () => {
      root?.render(<InlineAnalysisProgressProbe document={correctedDocument} />);
      await Promise.resolve();
    });

    const replacementTask =
      useBackgroundTaskStore.getState().inlineAnalysisTasks[searchDocument.id];
    expect(container.querySelector('[data-testid="paper-1-progress"]')?.textContent).toBe("queued");
    expect(replacementTask?.cycleKey).toBe(staleCycleKey);
    expect(replacementTask?.progressMap.get("paper-1")).toBe("queued");
    expect(replacementTask?.retryCountMap.size).toBe(0);
  });

  it("persists inline analysis into the canonical paper list when analyzing a sorted subset", async () => {
    const searchDocument = createSearchView();
    const searchMetadata = searchDocument.metadata;
    const thirdPaper = searchMetadata.papers[2];

    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = getRequestUrl(input);
      if (url === API_ROUTES.PAPERS_ANALYZE_INLINE) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                paperId: "paper-3",
                inputFingerprint: "a".repeat(64),
                source: "abstract",
                analysis: inlineAnalysisResult(),
              },
            ]),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });

    useResearchRouteStore.getState().setCurrentView(searchDocument, `test:${searchDocument.id}`);

    root = createRoot(document.createElement("div"));
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
        analysisPapers: [thirdPaper],
        visibleCount: 1,
        progressMap: new Map([["paper-3", "queued"]]),
      });
    });

    await flushTasks();
    await act(async () => {
      vi.advanceTimersByTime(350);
      await Promise.resolve();
      await Promise.resolve();
    });
    await flushTasks();

    const updatedDocument = useResearchRouteStore.getState().currentView;
    const updatedMetadata =
      updatedDocument?.metadata.type === "search" ? updatedDocument.metadata : null;

    expect(updatedMetadata?.papers.map((paper) => paper.paperId)).toEqual([
      "paper-1",
      "paper-2",
      "paper-3",
    ]);
    expect(updatedMetadata?.papers[2]).toMatchObject({
      paperId: "paper-3",
      inlineAnalysis: {
        version: INLINE_ANALYSIS_VERSION,
        source: "abstract",
      },
    });
  });

  it("does not let a prior execution mutate a replacement task with the same cycle key", async () => {
    const searchDocument = createSearchView();
    const cycleKey = buildInlineAnalysisCycleKey(searchDocument.id, searchDocument.metadata);
    useResearchRouteStore.getState().setCurrentView(searchDocument, "test:search-1:old");
    const oldTask = {
      executionId: "test:search-1:old",
      documentId: searchDocument.id,
      ownerPrincipalId: searchDocument.ownerPrincipalId,
      cycleKey,
      metadata: searchDocument.metadata,
      visibleCount: 1,
      progressMap: new Map([["paper-1", "queued" as const]]),
      retryCountMap: new Map<string, number>(),
      status: "queued" as const,
    };
    useBackgroundTaskStore.getState().enqueueInlineAnalysisTask(oldTask);

    let resolveFetch: ((response: Response) => void) | null = null;
    global.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const store = useBackgroundTaskStore.getState();
    const runPromise = runInlineAnalysisTask({
      task: oldTask,
      batch: [searchDocument.metadata.papers[0]],
      controller: new AbortController(),
      clearInlineAnalysisTask: store.clearInlineAnalysisTask,
      setInlineAnalysisTaskState: store.setInlineAnalysisTaskState,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
      await Promise.resolve();
    });

    useResearchRouteStore.getState().setCurrentView(searchDocument, "test:search-1:new");
    useBackgroundTaskStore.getState().enqueueInlineAnalysisTask({
      ...oldTask,
      executionId: "test:search-1:new",
    });

    await act(async () => {
      resolveFetch?.(
        new Response(
          JSON.stringify([
            {
              paperId: "paper-1",
              inputFingerprint: "a".repeat(64),
              source: "abstract",
              analysis: inlineAnalysisResult(),
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      await runPromise;
    });

    const replacementTask =
      useBackgroundTaskStore.getState().inlineAnalysisTasks[searchDocument.id];
    expect(replacementTask?.executionId).toBe("test:search-1:new");
    expect(replacementTask?.progressMap.get("paper-1")).toBe("queued");
    const currentMetadata = useResearchRouteStore.getState().currentView?.metadata;
    expect(
      currentMetadata?.type === "search" && "inlineAnalysis" in currentMetadata.papers[0],
    ).toBe(false);
  });
});

describe("ResearchBackgroundTasks inline analysis input continuity", () => {
  it("ignores an in-flight result when the same paper id receives new prompt input", async () => {
    const searchDocument = createSearchView();
    const executionId = "test:search-1:input-change";
    const cycleKey = buildInlineAnalysisCycleKey(searchDocument.id, searchDocument.metadata);
    useResearchRouteStore.getState().setCurrentView(searchDocument, executionId);
    const originalTask = {
      executionId,
      documentId: searchDocument.id,
      ownerPrincipalId: searchDocument.ownerPrincipalId,
      cycleKey,
      metadata: searchDocument.metadata,
      visibleCount: 1,
      progressMap: new Map([["paper-1", "running" as const]]),
      retryCountMap: new Map<string, number>(),
      status: "running" as const,
    };
    useBackgroundTaskStore.getState().enqueueInlineAnalysisTask(originalTask);
    useBackgroundTaskStore
      .getState()
      .setInlineAnalysisTaskState(searchDocument.id, { status: "running" }, cycleKey);

    let resolveFetch: ((response: Response) => void) | null = null;
    global.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const taskStore = useBackgroundTaskStore.getState();
    const runPromise = runInlineAnalysisTask({
      task: originalTask,
      batch: [searchDocument.metadata.papers[0]],
      controller: new AbortController(),
      clearInlineAnalysisTask: taskStore.clearInlineAnalysisTask,
      setInlineAnalysisTaskState: taskStore.setInlineAnalysisTaskState,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
      await Promise.resolve();
    });

    const correctedMetadata = {
      ...searchDocument.metadata,
      papers: searchDocument.metadata.papers.map((paper, index) =>
        index === 0 ? { ...paper, abstract: `${paper.abstract ?? ""} corrected` } : paper,
      ),
    };
    useResearchRouteStore
      .getState()
      .patchCurrentView({ ...searchDocument, metadata: correctedMetadata }, executionId);
    taskStore.setInlineAnalysisTaskState(
      searchDocument.id,
      { metadata: correctedMetadata },
      cycleKey,
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await act(async () => {
      resolveFetch?.(
        new Response(
          JSON.stringify([
            {
              paperId: "paper-1",
              inputFingerprint: "a".repeat(64),
              source: "abstract",
              analysis: inlineAnalysisResult(),
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      await runPromise;
    });

    const currentTask = useBackgroundTaskStore.getState().inlineAnalysisTasks[searchDocument.id];
    const currentMetadata = useResearchRouteStore.getState().currentView?.metadata;
    expect(currentTask?.progressMap.get("paper-1")).toBe("queued");
    expect(currentTask?.retryCountMap.get("paper-1")).toBeUndefined();
    expect(currentMetadata?.type).toBe("search");
    expect(
      currentMetadata?.type === "search" && "inlineAnalysis" in currentMetadata.papers[0],
    ).toBe(false);
  });

  it("aborts the prior inline-analysis transport when a replacement task reuses the document id", async () => {
    const searchDocument = createSearchView();
    const cycleKey = buildInlineAnalysisCycleKey(searchDocument.id, searchDocument.metadata);
    const requestSignals: AbortSignal[] = [];
    global.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal) requestSignals.push(init.signal);
      return new Promise<Response>(() => undefined);
    });

    useResearchRouteStore.getState().setCurrentView(searchDocument, "test:search-1:old");
    root = createRoot(document.createElement("div"));
    act(() => {
      root?.render(<ResearchBackgroundTasks />);
      useBackgroundTaskStore.getState().enqueueInlineAnalysisTask({
        executionId: "test:search-1:old",
        documentId: searchDocument.id,
        ownerPrincipalId: searchDocument.ownerPrincipalId,
        cycleKey,
        metadata: searchDocument.metadata,
        visibleCount: 1,
        progressMap: new Map([["paper-1", "queued"]]),
      });
    });
    await flushTasks();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    expect(requestSignals[0]?.aborted).toBe(false);

    act(() => {
      useResearchRouteStore.getState().setCurrentView(searchDocument, "test:search-1:new");
      useBackgroundTaskStore.getState().enqueueInlineAnalysisTask({
        executionId: "test:search-1:new",
        documentId: searchDocument.id,
        ownerPrincipalId: searchDocument.ownerPrincipalId,
        cycleKey,
        metadata: searchDocument.metadata,
        visibleCount: 1,
        progressMap: new Map([["paper-1", "queued"]]),
      });
    });
    await flushTasks();

    expect(requestSignals[0]?.aborted).toBe(true);
    expect(
      useBackgroundTaskStore.getState().inlineAnalysisTasks[searchDocument.id]?.executionId,
    ).toBe("test:search-1:new");
  });

  it("requeues an inline-analysis batch when an abort-ignoring request times out", async () => {
    const searchDocument = createSearchView();
    const executionId = "test:search-1:timeout";
    const cycleKey = buildInlineAnalysisCycleKey(searchDocument.id, searchDocument.metadata);
    useResearchRouteStore.getState().setCurrentView(searchDocument, executionId);
    useBackgroundTaskStore.getState().enqueueInlineAnalysisTask({
      executionId,
      documentId: searchDocument.id,
      ownerPrincipalId: searchDocument.ownerPrincipalId,
      cycleKey,
      metadata: searchDocument.metadata,
      visibleCount: 1,
      progressMap: new Map([["paper-1", "running"]]),
    });
    useBackgroundTaskStore
      .getState()
      .setInlineAnalysisTaskState(searchDocument.id, { status: "running" }, cycleKey);
    const task = useBackgroundTaskStore.getState().inlineAnalysisTasks[searchDocument.id];
    if (!task) throw new Error("inline task is required");
    const requestSignals: AbortSignal[] = [];
    global.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal) requestSignals.push(init.signal);
      return new Promise<Response>(() => undefined);
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const taskStore = useBackgroundTaskStore.getState();

    const runPromise = runInlineAnalysisTask({
      task,
      batch: [searchDocument.metadata.papers[0]],
      controller: new AbortController(),
      clearInlineAnalysisTask: taskStore.clearInlineAnalysisTask,
      setInlineAnalysisTaskState: taskStore.setInlineAnalysisTaskState,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
      await vi.advanceTimersByTimeAsync(BACKGROUND_REQUEST_SILENCE_TIMEOUT_MS);
      await runPromise;
    });

    const retryableTask = useBackgroundTaskStore.getState().inlineAnalysisTasks[searchDocument.id];
    expect(requestSignals[0]?.aborted).toBe(true);
    expect(retryableTask?.progressMap.get("paper-1")).toBe("error");
    expect(retryableTask?.retryCountMap.get("paper-1")).toBeUndefined();
    expect(retryableTask?.status).toBe("settled");
    expect(requestSignals).toHaveLength(1);
  });

  it("requeues a current inline batch when a same-execution unmount aborts transport", async () => {
    const searchDocument = createSearchView();
    const executionId = "test:search-1:same-execution";
    const cycleKey = buildInlineAnalysisCycleKey(searchDocument.id, searchDocument.metadata);
    useResearchRouteStore.getState().setCurrentView(searchDocument, executionId);
    useBackgroundTaskStore.getState().enqueueInlineAnalysisTask({
      executionId,
      documentId: searchDocument.id,
      ownerPrincipalId: searchDocument.ownerPrincipalId,
      cycleKey,
      metadata: searchDocument.metadata,
      visibleCount: 1,
      progressMap: new Map([["paper-1", "running"]]),
    });
    useBackgroundTaskStore
      .getState()
      .setInlineAnalysisTaskState(searchDocument.id, { status: "running" }, cycleKey);
    const task = useBackgroundTaskStore.getState().inlineAnalysisTasks[searchDocument.id];
    if (!task) throw new Error("inline task is required");
    global.fetch = vi.fn(() => new Promise<Response>(() => undefined));
    const controller = new AbortController();
    const taskStore = useBackgroundTaskStore.getState();

    const runPromise = runInlineAnalysisTask({
      task,
      batch: [searchDocument.metadata.papers[0]],
      controller,
      clearInlineAnalysisTask: taskStore.clearInlineAnalysisTask,
      setInlineAnalysisTaskState: taskStore.setInlineAnalysisTaskState,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
      controller.abort();
      await runPromise;
    });

    const requeuedTask = useBackgroundTaskStore.getState().inlineAnalysisTasks[searchDocument.id];
    expect(requeuedTask?.progressMap.get("paper-1")).toBe("error");
    expect(requeuedTask?.status).toBe("settled");
  });
});
