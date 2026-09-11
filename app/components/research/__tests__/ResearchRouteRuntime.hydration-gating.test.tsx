import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createResearchRouteRuntimeTestHarness } from "@/app/components/research/__tests__/research-route-runtime-test-support";
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

const runtimeHarness = createResearchRouteRuntimeTestHarness();

function getFetchInputUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function stubRouteAiCommentGenerationFetch() {
  const fetchMock = vi.fn<typeof fetch>((input, init) => {
    const url = getFetchInputUrl(input);
    if (!url.includes("/route-ai-comments/generate")) {
      return Promise.resolve(new Response(null, { status: 404 }));
    }
    const snapshotId = decodeURIComponent(url.split("/api/route-ai-comments/generate/")[1] ?? "");
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : {};
    const snapshotKind =
      typeof body === "object" &&
      body !== null &&
      "viewSnapshot" in body &&
      typeof body.viewSnapshot === "object" &&
      body.viewSnapshot !== null &&
      "snapshotKind" in body.viewSnapshot
        ? body.viewSnapshot.snapshotKind
        : "search";
    return Promise.resolve(
      Response.json({
        snapshotId,
        snapshotKind,
        reaction: {
          id: `generated-${snapshotId}`,
          title: "생성된 AI comment",
          body: "route-owned AI comment endpoint가 만든 코멘트입니다.",
          chips: [],
          timestamp: "2026-06-01T00:00:00.000Z",
        },
      }),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function getGenerationFetchCalls(fetchMock: ReturnType<typeof stubRouteAiCommentGenerationFetch>) {
  return fetchMock.mock.calls.filter(([input]) =>
    getFetchInputUrl(input).includes("/route-ai-comments/generate"),
  );
}

function getGenerationCallBody(call: Parameters<typeof fetch>): {
  viewSnapshot?: { content?: { coCited?: Array<{ authors?: string[] }> } };
} {
  const body = call[1]?.body;
  if (typeof body !== "string") return {};
  return JSON.parse(body) as {
    viewSnapshot?: { content?: { coCited?: Array<{ authors?: string[] }> } };
  };
}

function createHydratedSearchView() {
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
    },
    reaction: null,
  };
}

function createHydratedGraphNeighborsView() {
  const graphPaper = {
    paperId: "paper-1",
    title: "Graph Paper",
    abstract: "abstract",
    year: 2024,
    citationCount: 7,
    url: "https://example.com/graph-paper",
    authors: [{ name: "Graph Author" }],
  };
  return {
    status: "ready" as const,
    version: 0,
    reactionVersion: 0,
    id: "graph-1",
    type: "graph_neighbors" as const,
    title: "비슷한 논문: Graph Paper",
    content: "graph neighbors content",
    createdBy: "user" as const,
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-09T00:00:20.000Z",
    updatedAt: "2026-04-09T00:00:20.000Z",
    metadata: {
      type: "graph_neighbors" as const,
      seedPaper: graphPaper,
      papers: [graphPaper],
      total: 1,
      coCited: [{ paper: graphPaper, shared: 4 }],
      coupled: [],
      cardDataHydration: { status: "ready" as const },
    },
    reaction: null,
  };
}

function createFacetedReadySearchView() {
  const baseDoc = createHydratedSearchView();
  return {
    ...baseDoc,
    metadata: {
      ...baseDoc.metadata,
      facetFilters: {
        fieldsOfStudy: [],
        authors: ["Alice"],
        venues: [],
        hasPdf: false,
      },
      abstractHydration: { status: "ready" as const },
    },
  };
}

async function flushGeneration() {
  act(() => {
    vi.advanceTimersByTime(1300);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("ResearchRouteRuntime hydration-gated reactions", () => {
  beforeEach(() => {
    runtimeHarness.setup();
    stubRouteAiCommentGenerationFetch();
  });

  afterEach(() => {
    runtimeHarness.cleanup();
  });

  it("keeps one generation when a lightweight search card hydrates after the comment settles", async () => {
    const hydratedDoc = createHydratedSearchView();
    const initialDoc = {
      ...hydratedDoc,
      metadata: {
        ...hydratedDoc.metadata,
        abstractHydration: { status: "pending" as const },
        papers: hydratedDoc.metadata.papers.map((paper) => ({
          ...paper,
          abstract: null,
          authors: [],
          venue: null,
          fieldsOfStudy: null,
          openAccessPdf: null,
        })),
      },
    };
    runtimeHarness.mount(initialDoc);
    await flushGeneration();

    const fetchMock = vi.mocked(globalThis.fetch);
    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(1);
    expect(useResearchRouteStore.getState()).toMatchObject({
      routeAiComment: { id: "generated-search-1" },
      reactionGeneration: 0,
    });

    act(() => {
      useResearchRouteStore.getState().patchCurrentView(
        {
          ...hydratedDoc,
          updatedAt: "2026-04-09T00:01:00.000Z",
          metadata: {
            ...hydratedDoc.metadata,
            abstractHydration: { status: "ready" as const },
          },
        },
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );
    });
    await flushGeneration();

    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(1);
    expect(useResearchRouteStore.getState()).toMatchObject({
      routeAiComment: { id: "generated-search-1" },
      reactionGeneration: 0,
    });
  });

  it("waits for a hydration-dependent search facet and generates once from the stable result set", async () => {
    const baseDoc = createHydratedSearchView();
    const hydratedPapers = [
      baseDoc.metadata.papers[0],
      {
        ...baseDoc.metadata.papers[0],
        paperId: "paper-2",
        title: "Paper 2",
        url: "https://example.com/2",
      },
    ];
    const hydratedDoc = {
      ...baseDoc,
      metadata: {
        ...baseDoc.metadata,
        total: hydratedPapers.length,
        papers: hydratedPapers,
        facetFilters: {
          fieldsOfStudy: [],
          authors: ["Alice"],
          venues: [],
          hasPdf: false,
        },
        abstractHydration: { status: "ready" as const },
      },
    };
    const pendingDoc = {
      ...hydratedDoc,
      metadata: {
        ...hydratedDoc.metadata,
        abstractHydration: { status: "pending" as const },
        papers: hydratedPapers.map((paper, index) =>
          index === 0 ? paper : { ...paper, authors: [] },
        ),
      },
    };

    runtimeHarness.mount(pendingDoc);
    const fetchMock = vi.mocked(globalThis.fetch);
    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(true);
    act(() => {
      useReactionActionStore.getState().emitSystemEvent("user_search", "", pendingDoc.id);
    });
    await flushGeneration();
    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(0);

    act(() => {
      useResearchRouteStore.getState().patchCurrentView(
        {
          ...hydratedDoc,
          updatedAt: "2026-04-09T00:01:00.000Z",
        },
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );
    });
    await flushGeneration();

    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(1);
    expect(useResearchRouteStore.getState()).toMatchObject({
      routeAiComment: { id: "generated-search-1" },
      pendingRouteAiCommentRegeneration: false,
    });
  });

  it("rechecks hydration readiness when a queued command becomes gated before flush", async () => {
    const hydratedDoc = {
      ...createHydratedSearchView(),
      metadata: {
        ...createHydratedSearchView().metadata,
        facetFilters: {
          fieldsOfStudy: [],
          authors: ["Alice"],
          venues: [],
          hasPdf: false,
        },
        abstractHydration: { status: "ready" as const },
      },
    };
    runtimeHarness.mount(hydratedDoc);
    const fetchMock = vi.mocked(globalThis.fetch);

    act(() => {
      useResearchRouteStore.getState().patchCurrentView(
        {
          ...hydratedDoc,
          metadata: {
            ...hydratedDoc.metadata,
            abstractHydration: { status: "pending" as const },
          },
          updatedAt: "2026-04-09T00:00:30.000Z",
        },
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );
    });
    await flushGeneration();
    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(0);
    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(true);

    act(() => {
      useResearchRouteStore.getState().patchCurrentView(
        {
          ...hydratedDoc,
          updatedAt: "2026-04-09T00:01:00.000Z",
        },
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );
    });
    await flushGeneration();

    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(1);
    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(false);
  });

  it("clears pending when hydration settles with an empty facet projection", async () => {
    const baseDoc = createHydratedSearchView();
    const pendingDoc = {
      ...baseDoc,
      metadata: {
        ...baseDoc.metadata,
        papers: baseDoc.metadata.papers.map((paper) => ({ ...paper, authors: [] })),
        facetFilters: {
          fieldsOfStudy: [],
          authors: ["Missing Author"],
          venues: [],
          hasPdf: false,
        },
        abstractHydration: { status: "pending" as const },
      },
    };
    runtimeHarness.mount(pendingDoc);
    const fetchMock = vi.mocked(globalThis.fetch);
    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(true);
    await flushGeneration();

    act(() => {
      useResearchRouteStore.getState().patchCurrentView(
        {
          ...pendingDoc,
          metadata: {
            ...pendingDoc.metadata,
            abstractHydration: { status: "ready" as const },
          },
          updatedAt: "2026-04-09T00:01:00.000Z",
        },
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );
    });
    await flushGeneration();

    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(0);
    expect(useResearchRouteStore.getState()).toMatchObject({
      routeAiComment: null,
      pendingRouteAiCommentRegeneration: false,
      routeAiCommentGenerationStarted: false,
    });
  });
});

describe("ResearchRouteRuntime active hydration-gated reactions", () => {
  beforeEach(() => {
    runtimeHarness.setup();
    stubRouteAiCommentGenerationFetch();
  });

  afterEach(() => {
    runtimeHarness.cleanup();
  });

  it("reopens bootstrap when an active same-projection request becomes hydration-gated", async () => {
    const readyDoc = createFacetedReadySearchView();
    const firstRequest = { signal: null as AbortSignal | null };
    let resolveFirstRequest: (response: Response) => void = () => {
      throw new Error("first generation request must be active");
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        (_input, init) =>
          new Promise<Response>((resolve) => {
            firstRequest.signal = init?.signal ?? null;
            resolveFirstRequest = resolve;
          }),
      )
      .mockImplementation((input) => {
        const url = getFetchInputUrl(input);
        const snapshotId = decodeURIComponent(
          url.split("/api/route-ai-comments/generate/")[1] ?? "",
        );
        return Promise.resolve(
          Response.json({
            snapshotId,
            snapshotKind: "search",
            reaction: {
              id: "generated-ready-search",
              title: "생성된 AI comment",
              body: "terminal ready projection comment",
              chips: [],
              timestamp: "2026-06-01T00:00:00.000Z",
            },
          }),
        );
      });
    vi.stubGlobal("fetch", fetchMock);

    runtimeHarness.mount(readyDoc);
    act(() => {
      vi.advanceTimersByTime(240);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(1);

    act(() => {
      useResearchRouteStore.getState().patchCurrentView(
        {
          ...readyDoc,
          metadata: {
            ...readyDoc.metadata,
            abstractHydration: { status: "pending" as const },
          },
          updatedAt: "2026-04-09T00:00:30.000Z",
        },
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );
    });
    expect(firstRequest.signal?.aborted).toBe(true);

    act(() => {
      useResearchRouteStore.getState().patchCurrentView(
        {
          ...readyDoc,
          updatedAt: "2026-04-09T00:01:00.000Z",
        },
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );
    });
    resolveFirstRequest(
      Response.json({
        snapshotId: readyDoc.id,
        snapshotKind: "search",
        reaction: {
          id: "stale-pre-ready-comment",
          title: "stale",
          body: "must not commit",
          chips: [],
          timestamp: "2026-06-01T00:00:00.000Z",
        },
      }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(2);
    expect(useResearchRouteStore.getState()).toMatchObject({
      routeAiComment: { id: "generated-ready-search" },
      pendingRouteAiCommentRegeneration: false,
      routeAiCommentGenerationStarted: false,
    });
  });

  it("resumes a settled-card regeneration after an active hydration gate closes", async () => {
    const readyDoc = createFacetedReadySearchView();
    const existingReaction = {
      id: "settled-search-comment",
      title: "기존 AI comment",
      body: "기존 comment를 재생성합니다.",
      chips: [],
      timestamp: "2026-06-01T00:00:00.000Z",
    };
    const firstRequest = { signal: null as AbortSignal | null };
    let resolveFirstRequest: (response: Response) => void = () => {
      throw new Error("first regeneration request must be active");
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        (_input, init) =>
          new Promise<Response>((resolve) => {
            firstRequest.signal = init?.signal ?? null;
            resolveFirstRequest = resolve;
          }),
      )
      .mockImplementation((input) => {
        const url = getFetchInputUrl(input);
        const snapshotId = decodeURIComponent(
          url.split("/api/route-ai-comments/generate/")[1] ?? "",
        );
        return Promise.resolve(
          Response.json({
            snapshotId,
            snapshotKind: "search",
            reaction: {
              id: "regenerated-ready-search",
              title: "새 AI comment",
              body: "terminal ready projection regeneration",
              chips: [],
              timestamp: "2026-06-01T00:01:00.000Z",
            },
          }),
        );
      });
    vi.stubGlobal("fetch", fetchMock);

    runtimeHarness.mount({
      ...readyDoc,
      reaction: existingReaction,
      reactionHistory: [existingReaction],
    });
    const executionId = useResearchRouteStore.getState().activeExecutionId;
    if (!executionId) throw new Error("active execution is required");
    act(() => {
      useResearchRouteStore.getState().requestRouteAiCommentRegeneration(readyDoc.id, executionId);
      useReactionActionStore.getState().emitSystemEvent("user_search", "", readyDoc.id);
      vi.advanceTimersByTime(240);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(1);

    act(() => {
      useResearchRouteStore.getState().patchCurrentView(
        {
          ...readyDoc,
          reaction: existingReaction,
          reactionHistory: [existingReaction],
          metadata: {
            ...readyDoc.metadata,
            abstractHydration: { status: "pending" as const },
          },
          updatedAt: "2026-04-09T00:00:30.000Z",
        },
        executionId,
      );
    });
    expect(firstRequest.signal?.aborted).toBe(true);

    act(() => {
      useResearchRouteStore.getState().patchCurrentView(
        {
          ...readyDoc,
          reaction: existingReaction,
          reactionHistory: [existingReaction],
          updatedAt: "2026-04-09T00:01:00.000Z",
        },
        executionId,
      );
    });
    resolveFirstRequest(
      Response.json({
        snapshotId: readyDoc.id,
        snapshotKind: "search",
        reaction: {
          id: "stale-regeneration",
          title: "stale",
          body: "must not replace the settled comment",
          chips: [],
          timestamp: "2026-06-01T00:00:30.000Z",
        },
      }),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(2);
    expect(useResearchRouteStore.getState()).toMatchObject({
      routeAiComment: { id: "regenerated-ready-search" },
      pendingRouteAiCommentRegeneration: false,
      routeAiCommentGenerationStarted: false,
    });
  });

  it("waits for graph-neighbor card hydration and generates once with relationship authors", async () => {
    const hydratedDoc = createHydratedGraphNeighborsView();
    const hydratedPaper = hydratedDoc.metadata.papers[0];
    const lightweightPaper = { ...hydratedPaper, abstract: null, authors: [] };
    const pendingDoc = {
      ...hydratedDoc,
      metadata: {
        ...hydratedDoc.metadata,
        papers: [lightweightPaper],
        coCited: [{ paper: lightweightPaper, shared: 4 }],
        cardDataHydration: { status: "pending" as const },
      },
    };

    runtimeHarness.mount(pendingDoc);
    const fetchMock = vi.mocked(globalThis.fetch);
    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(true);
    await flushGeneration();
    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(0);

    act(() => {
      useResearchRouteStore.getState().patchCurrentView(
        {
          ...hydratedDoc,
          updatedAt: "2026-04-09T00:01:00.000Z",
        },
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );
    });
    await flushGeneration();

    const generationCalls = getGenerationFetchCalls(fetchMock);
    expect(generationCalls).toHaveLength(1);
    expect(
      getGenerationCallBody(generationCalls[0]).viewSnapshot?.content?.coCited?.[0]?.authors,
    ).toEqual(["Graph Author"]);
  });
});
