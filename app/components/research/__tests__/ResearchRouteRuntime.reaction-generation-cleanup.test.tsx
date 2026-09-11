import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchRouteRuntime } from "@/app/components/research/ResearchRouteRuntime";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

vi.mock("@/app/components/research/ResearchRouteLayout", () => ({
  ResearchRouteLayout: () => <div data-testid="research-route-layout" />,
}));

vi.mock("@/app/components/research-route-renderers/SearchView", () => ({
  SearchView: () => null,
}));

vi.mock("@/app/lib/track", () => ({
  track: () => undefined,
}));

let root: Root | null = null;

function createGraphDocument() {
  const existingReaction = {
    id: "graph-existing-reaction",
    title: "기존 AI comment",
    body: "이미 생성된 코멘트입니다.",
    chips: [],
    timestamp: "2026-06-01T00:00:00.000Z",
  };

  return {
    status: "ready" as const,
    version: 0,
    reactionVersion: 0,
    id: "graph-1",
    type: "graph_neighbors" as const,
    title: "비슷한 논문: Attention Is All You Need",
    content: "graph neighbors content",
    createdBy: "user" as const,
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-09T00:00:20.000Z",
    updatedAt: "2026-04-09T00:00:20.000Z",
    metadata: {
      type: "graph_neighbors" as const,
      seedPaper: {
        paperId: "seed-1",
        title: "Attention Is All You Need",
        abstract: "seed abstract",
        year: 2017,
        citationCount: 1000,
        url: "https://example.com/seed-1",
        authors: [{ name: "Vaswani" }],
        openAccessPdf: null,
        doi: null,
      },
      papers: [],
      total: 0,
      coCited: [],
      coupled: [],
    },
    reaction: existingReaction,
    reactionHistory: [existingReaction],
  };
}

function createSearchViewWithReaction() {
  const existingReaction = {
    id: "search-existing-reaction",
    title: "기존 AI comment",
    body: "이미 생성된 코멘트입니다.",
    chips: [],
    timestamp: "2026-06-01T00:00:00.000Z",
  };

  return {
    status: "ready" as const,
    version: 0,
    reactionVersion: 0,
    id: "search-1",
    type: "search" as const,
    title: "검색: llm",
    content: "search content",
    createdBy: "user" as const,
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt: "2026-04-09T00:00:00.000Z",
    metadata: {
      type: "search" as const,
      query: "llm",
      total: 1,
      papers: [],
    },
    reaction: existingReaction,
    reactionHistory: [existingReaction],
  };
}

function resetRuntimeState() {
  useReactionActionStore.getState().unregisterSendMessage();
  useResearchRouteStore.setState({
    currentView: null,
    pendingRouteAiCommentRegeneration: false,
    routeAiComment: null,
  });
}

describe("ResearchRouteRuntime route AI comment generation cleanup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRuntimeState();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetRuntimeState();
  });

  it("ignores stale route AI comment generation events for missing target route payloads", async () => {
    const fetchMock = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response(null, { status: 500 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    root = createRoot(container);
    act(() => {
      root?.render(
        <ResearchRouteRuntime
          renderViewBody={() => null}
          runtimeId="principal-1"
          initialView={createSearchViewWithReaction()}
        />,
      );
    });

    act(() => {
      useReactionActionStore.getState().emitSystemEvent("user_search", "", "missing-search");
      vi.advanceTimersByTime(1300);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps generation single-flight and aborts the active transport when the runtime changes", async () => {
    const initialDocument = createGraphDocument();
    let resolveGenerationFetch: (response: Response) => void = () => {
      throw new Error("expected a pending generation fetch");
    };
    const requestSignals: AbortSignal[] = [];
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((resolve, reject) => {
            if (init?.signal) requestSignals.push(init.signal);
            init?.signal?.addEventListener(
              "abort",
              () => {
                reject(new DOMException("aborted", "AbortError"));
              },
              { once: true },
            );
            resolveGenerationFetch = resolve;
          }),
      ),
    );

    const container = document.createElement("div");
    root = createRoot(container);
    act(() => {
      root?.render(
        <ResearchRouteRuntime
          renderViewBody={() => null}
          runtimeId="principal-1"
          initialView={initialDocument}
        />,
      );
    });

    act(() => {
      useResearchRouteStore
        .getState()
        .requestRouteAiCommentRegeneration(
          "graph-1",
          useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
        );
      useReactionActionStore
        .getState()
        .emitSystemEvent(
          "graph_neighbors_opened",
          '[system] "Attention Is All You Need" 비슷한 논문을 열었다',
          "graph-1",
        );
      vi.advanceTimersByTime(1300);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(true);
    const activeExecutionId = useResearchRouteStore.getState().activeExecutionId;
    if (!activeExecutionId) throw new Error("active execution is required");
    act(() => {
      useResearchRouteStore.getState().patchCurrentView(
        {
          ...initialDocument,
          version: 1,
          updatedAt: "2026-04-09T00:00:21.000Z",
        },
        activeExecutionId,
      );
      useResearchRouteStore
        .getState()
        .requestRouteAiCommentRegeneration("graph-1", activeExecutionId);
      useReactionActionStore
        .getState()
        .emitSystemEvent(
          "graph_neighbors_opened",
          '[system] refreshed "Attention Is All You Need" similar papers',
          "graph-1",
        );
      vi.advanceTimersByTime(1300);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // A newer explicit reaction generation waits for the scalar active owner
    // instead of replacing its controller.
    expect(requestSignals).toHaveLength(1);

    act(() => {
      root?.render(<ResearchRouteRuntime renderViewBody={() => null} runtimeId="principal-2" />);
    });

    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(false);
    expect(requestSignals[0]?.aborted).toBe(true);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      consoleError.mock.calls.some(
        ([message]) => message === "[route-ai-comment-generation] request failed",
      ),
    ).toBe(false);

    resolveGenerationFetch(
      new Response(
        JSON.stringify({
          snapshotId: initialDocument.id,
          snapshotKind: initialDocument.type,
          reaction: {
            id: "generated-graph-1",
            title: "생성된 AI comment",
            body: "늦게 도착한 결과입니다.",
            chips: [],
            timestamp: "2026-06-01T00:00:00.000Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useResearchRouteStore.getState().routeAiComment).toBeNull();
  });

  it("releases single-flight generation when an abort-ignoring transport reaches the deadline", async () => {
    const initialDocument = createGraphDocument();
    const requestSignals: AbortSignal[] = [];
    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      if (init?.signal) requestSignals.push(init.signal);
      return Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>(
            {
              async pull(controller) {
                await new Promise((resolve) => setTimeout(resolve, 10_000));
                controller.enqueue(new TextEncoder().encode(" "));
              },
            },
            { highWaterMark: 0 },
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const container = document.createElement("div");
    root = createRoot(container);
    act(() => {
      root?.render(
        <ResearchRouteRuntime
          renderViewBody={() => null}
          runtimeId="principal-1"
          initialView={initialDocument}
        />,
      );
    });
    const executionId = useResearchRouteStore.getState().activeExecutionId;
    if (!executionId) throw new Error("active execution is required");

    act(() => {
      useResearchRouteStore
        .getState()
        .requestRouteAiCommentRegeneration(initialDocument.id, executionId);
      useReactionActionStore
        .getState()
        .emitSystemEvent("graph_neighbors_opened", "[system] first generation", initialDocument.id);
      vi.advanceTimersByTime(1_300);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      useResearchRouteStore
        .getState()
        .requestRouteAiCommentRegeneration(initialDocument.id, executionId);
      useReactionActionStore
        .getState()
        .emitSystemEvent(
          "graph_neighbors_opened",
          "[system] second generation",
          initialDocument.id,
        );
      vi.advanceTimersByTime(240);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(requestSignals[0]?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(true);
  });
});
