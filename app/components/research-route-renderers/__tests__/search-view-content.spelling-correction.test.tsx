import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import { SEARCH_BACKGROUND_COMMAND_VERSION } from "@/app/domain/search-background-transport";
import {
  SearchViewResultsState,
  __resetSpellingCorrectionRequestTrackingForTests,
} from "@/app/components/research-route-renderers/search-view-content";
import { createMetadata } from "./search-view-content.fixtures";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { mergeSearchBackgroundMetadata } from "@/app/components/research/background-search-tasks";

const { mockPush, mockSearchParams } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSearchParams: { value: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams.value,
}));

const mountedRoots = new Set<Root>();

function spellingDeltaResponse(correctedQuery: string | null, updatedAt: string) {
  return {
    schemaVersion: SEARCH_BACKGROUND_COMMAND_VERSION,
    target: { query: "ai for sceince" },
    delta: {
      spellingCorrection: correctedQuery
        ? {
            originalQuery: "ai for sceince",
            correctedQuery,
          }
        : null,
    },
    updatedAt,
  };
}

function unmountMountedRoots() {
  act(() => {
    for (const mountedRoot of mountedRoots) mountedRoot.unmount();
  });
  mountedRoots.clear();
}

function createSearchView(metadata: SearchMetadata): ResearchRoutePayload {
  return {
    id: "search-ephemeral-1",
    type: "search",
    title: "검색: ai for sceince",
    content: "",
    createdBy: "user",
    metadata,
    reaction: null,
    refs: [],
    ownerPrincipalId: "principal-1",
    status: "ready",
    version: 0,
    reactionVersion: 0,
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
  };
}

// Regression: SearchViewView remounts on every post-search background
// enrichment because its React `key` (controllerKey in SearchView.tsx)
// includes document.updatedAt / papers.length. The post-result
// spelling-correction request must survive those remounts, otherwise a
// correction already present on the current metadata is silently dropped and the
// suggestion never renders. See promise:search-spelling-correction +
// acceptance-check:search-spelling-correction-spelling-correction-metadata-recorded.
describe("search-view-content post-result spelling correction request", () => {
  function renderResultsState(
    container: HTMLDivElement,
    overrides?: { metadata?: SearchMetadata; sourceSnapshotId?: string },
  ) {
    const currentView = useResearchRouteStore.getState().currentView;
    const currentMetadata =
      currentView?.metadata.type === "search" ? currentView.metadata : undefined;
    const metadata = overrides?.metadata ??
      currentMetadata ?? { ...createMetadata(1), query: "ai for sceince" };
    const root = createRoot(container);
    mountedRoots.add(root);
    act(() => {
      root.render(
        <SearchViewResultsState
          ownerPrincipalId="principal-1"
          sourceSnapshotId={overrides?.sourceSnapshotId ?? "search-ephemeral-1"}
          documentTitle="검색: ai for sceince"
          metadata={metadata}
          query={metadata.query}
          sortOption="relevance"
          yearFilter=""
          isSearching={false}
          isError={false}
          analyzedCount={0}
          runningCount={0}
          queuedCount={0}
          isAnalyzing={false}
          isCreatingGapNetwork={false}
          visiblePapers={metadata.papers}
          hasMorePapers={false}
          analysisProgressMap={new Map()}
          analysisMap={new Map()}
          onQueryChange={vi.fn()}
          onSortChange={vi.fn()}
          personalize={true}
          libraryContextAvailable={false}
          onPersonalizeChange={vi.fn()}
          onYearRangeApply={vi.fn()}
          onOpenGapNetwork={vi.fn()}
          onOpenCitationLineage={vi.fn()}
          onFindSimilar={vi.fn()}
          onLoadMore={vi.fn()}
          citationLineageLoadingPaperId={null}
        />,
      );
    });
    return root;
  }

  const spellingCalls = (mock: ReturnType<typeof vi.fn>) =>
    mock.mock.calls.filter((call) => String(call[0]).includes("spelling-correction"));

  let resolveSpelling: ((value: unknown) => void) | null = null;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetSpellingCorrectionRequestTrackingForTests();
    resolveSpelling = null;
    fetchMock = vi.fn((url: unknown) => {
      if (String(url).includes("spelling-correction")) {
        return new Promise((resolve) => {
          resolveSpelling = resolve;
        });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
    });
    vi.stubGlobal("fetch", fetchMock);
    const metadata = { ...createMetadata(1), query: "ai for sceince" };
    useResearchRouteStore
      .getState()
      .setCurrentView(createSearchView(metadata), "test:spelling:execution-1");
  });

  afterEach(() => {
    unmountMountedRoots();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  });

  it("issues a bounded correction request whose signal survives a same-execution remount", () => {
    const container = document.createElement("div");
    renderResultsState(container);

    const calls = spellingCalls(fetchMock);
    expect(calls).toHaveLength(1);
    const init = calls[0][1] as RequestInit | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.signal?.aborted).toBe(false);
    const rawBody = typeof init?.body === "string" ? init.body : "{}";
    const body = JSON.parse(rawBody) as { documentId?: unknown };
    expect("documentId" in body).toBe(false);
  });

  it("does not re-fire a duplicate request when the view remounts mid-flight", () => {
    const firstContainer = document.createElement("div");
    const firstRoot = renderResultsState(firstContainer);
    expect(spellingCalls(fetchMock)).toHaveLength(1);

    // Simulate the controllerKey-driven remount (unmount + fresh mount) that a
    // background enrichment triggers while the request is still pending.
    act(() => {
      firstRoot.unmount();
      mountedRoots.delete(firstRoot);
    });
    const firstSignal = (spellingCalls(fetchMock)[0]?.[1] as RequestInit | undefined)?.signal;
    const secondContainer = document.createElement("div");
    renderResultsState(secondContainer);

    expect(spellingCalls(fetchMock)).toHaveLength(1);
    expect(firstSignal?.aborted).toBe(false);
  });

  it("times out an abort-ignoring transport and releases the request key for retry", async () => {
    vi.useFakeTimers();
    const firstContainer = document.createElement("div");
    const firstRoot = renderResultsState(firstContainer);
    const firstSignal = (spellingCalls(fetchMock)[0]?.[1] as RequestInit | undefined)?.signal;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000);
      await Promise.resolve();
    });
    expect(firstSignal?.aborted).toBe(true);

    act(() => {
      firstRoot.unmount();
      mountedRoots.delete(firstRoot);
    });
    renderResultsState(document.createElement("div"));
    expect(spellingCalls(fetchMock)).toHaveLength(2);
  });

  it("does not apply a prior execution spelling completion to a reused view id", async () => {
    const container = document.createElement("div");
    renderResultsState(container);
    const resolvePriorExecution = resolveSpelling;
    const currentView = useResearchRouteStore.getState().currentView;
    if (!currentView || currentView.metadata.type !== "search") {
      throw new Error("expected active search view");
    }

    act(() => {
      useResearchRouteStore.getState().setCurrentView(currentView, "test:spelling:execution-2");
    });
    expect((spellingCalls(fetchMock)[0]?.[1] as RequestInit | undefined)?.signal?.aborted).toBe(
      true,
    );

    await act(async () => {
      resolvePriorExecution?.({
        ok: true,
        json: () =>
          Promise.resolve(spellingDeltaResponse("ai for science", "2026-07-10T00:00:05.000Z")),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    const state = useResearchRouteStore.getState();
    expect(state.activeExecutionId).toBe("test:spelling:execution-2");
    expect(
      state.currentView?.metadata.type === "search"
        ? state.currentView.metadata.spellingCorrection
        : null,
    ).toBeUndefined();
  });

  it("starts only the hydrated execution's spelling request during replacement", () => {
    const replacementMetadata = { ...createMetadata(1), query: "ai for sceince" };
    const container = document.createElement("div");
    renderResultsState(container, {
      metadata: replacementMetadata,
      sourceSnapshotId: "search-ephemeral-2",
    });
    expect(spellingCalls(fetchMock)).toHaveLength(0);

    act(() => {
      useResearchRouteStore.getState().setCurrentView(
        {
          ...createSearchView(replacementMetadata),
          id: "search-ephemeral-2",
        },
        "test:spelling:execution-2",
      );
    });

    expect(spellingCalls(fetchMock)).toHaveLength(1);
  });

  it("merges a delayed correction without erasing newer search enrichment", async () => {
    const container = document.createElement("div");
    renderResultsState(container);
    const requestMetadata = useResearchRouteStore.getState().currentView?.metadata;
    if (requestMetadata?.type !== "search") throw new Error("expected search metadata");
    const currentView = useResearchRouteStore.getState().currentView;
    if (currentView?.type !== "search") throw new Error("expected search view");
    const graphSupport: SearchMetadata["graphSupport"] = {
      version: 1,
      source: "episteme-paper-neighborhood",
      basis: "loaded_result_sample",
      status: "empty",
      samplePaperIds: requestMetadata.papers.map((paper) => paper.paperId),
      generatedAt: "2026-07-10T00:00:01.000Z",
      paperScores: {},
    };
    act(() => {
      useResearchRouteStore.getState().patchCurrentView(
        {
          ...currentView,
          metadata: {
            ...requestMetadata,
            graphSupport,
            englishTermDiscovery: { status: "ready", source: "llm" },
            englishTermCandidates: [],
            papers: requestMetadata.papers.map((paper, index) =>
              index === 0
                ? { ...paper, reviewed: true, reviewedAt: "2026-07-10T00:00:01.000Z" }
                : paper,
            ),
          },
          updatedAt: "2026-07-10T00:00:01.000Z",
        },
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );
    });

    await act(async () => {
      resolveSpelling?.({
        ok: true,
        json: () =>
          Promise.resolve(spellingDeltaResponse("ai for science", "2026-07-10T00:00:00.000Z")),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    const result = useResearchRouteStore.getState().currentView;
    expect(result?.metadata.type === "search" ? result.metadata.graphSupport : null).toEqual(
      graphSupport,
    );
    expect(result?.metadata.type === "search" ? result.metadata.papers[0] : null).toMatchObject({
      reviewed: true,
      reviewedAt: "2026-07-10T00:00:01.000Z",
    });
    expect(result?.metadata.type === "search" ? result.metadata.spellingCorrection : null).toEqual({
      originalQuery: "ai for sceince",
      correctedQuery: "ai for science",
    });
    expect(result?.updatedAt).toBe("2026-07-10T00:00:01.001Z");
  });

  it("keeps an existing correction when later background metadata merges", () => {
    const incoming = { ...createMetadata(1), query: "ai for sceince" };
    const existing: SearchMetadata = {
      ...incoming,
      spellingCorrection: {
        originalQuery: "ai for sceince",
        correctedQuery: "ai for science",
      },
    };

    expect(mergeSearchBackgroundMetadata(incoming, existing).spellingCorrection).toEqual(
      existing.spellingCorrection,
    );
  });

  it("does not re-request after the route has answered (correction or confident null)", async () => {
    const firstContainer = document.createElement("div");
    const firstRoot = renderResultsState(firstContainer);
    expect(spellingCalls(fetchMock)).toHaveLength(1);

    await act(async () => {
      resolveSpelling?.({
        ok: true,
        json: () => Promise.resolve(spellingDeltaResponse(null, "2026-07-10T00:00:00.000Z")),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      firstRoot.unmount();
      mountedRoots.delete(firstRoot);
    });
    const secondContainer = document.createElement("div");
    renderResultsState(secondContainer);

    expect(spellingCalls(fetchMock)).toHaveLength(1);
  });

  it("retries on a later mount when the request fails at the transport layer", async () => {
    const firstContainer = document.createElement("div");
    const firstRoot = renderResultsState(firstContainer);
    expect(spellingCalls(fetchMock)).toHaveLength(1);

    await act(async () => {
      resolveSpelling?.({ ok: false, json: () => Promise.resolve({}) });
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      firstRoot.unmount();
      mountedRoots.delete(firstRoot);
    });
    const secondContainer = document.createElement("div");
    renderResultsState(secondContainer);

    expect(spellingCalls(fetchMock)).toHaveLength(2);
  });

  it("does not re-request a terminal 400 on a later mount", async () => {
    const firstContainer = document.createElement("div");
    const firstRoot = renderResultsState(firstContainer);
    expect(spellingCalls(fetchMock)).toHaveLength(1);

    await act(async () => {
      resolveSpelling?.(
        Response.json(
          {
            error: "invalid spelling correction payload",
            code: "SEARCH_SPELLING_CORRECTION_INVALID",
            action: "correct-request",
            retryable: false,
          },
          { status: 400 },
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      firstRoot.unmount();
      mountedRoots.delete(firstRoot);
    });
    renderResultsState(document.createElement("div"));

    expect(spellingCalls(fetchMock)).toHaveLength(1);
  });

  it("retries on a later mount when a successful response has malformed JSON", async () => {
    const firstContainer = document.createElement("div");
    const firstRoot = renderResultsState(firstContainer);
    expect(spellingCalls(fetchMock)).toHaveLength(1);

    await act(async () => {
      resolveSpelling?.({
        ok: true,
        json: () => Promise.reject(new SyntaxError("malformed spelling response")),
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      firstRoot.unmount();
      mountedRoots.delete(firstRoot);
    });
    const secondContainer = document.createElement("div");
    renderResultsState(secondContainer);

    expect(spellingCalls(fetchMock)).toHaveLength(2);
  });
});
