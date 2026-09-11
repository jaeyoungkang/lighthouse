import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createResearchRouteRuntimeTestHarness } from "@/app/components/research/__tests__/research-route-runtime-test-support";
import { routeAiCommentGenerateRoute } from "@/app/lib/api-routes";
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

function createGeneratedReaction(snapshotId: string) {
  return {
    id: `generated-${snapshotId}`,
    title: "생성된 AI comment",
    body: "route-owned AI comment endpoint가 만든 코멘트입니다.",
    chips: [],
    timestamp: "2026-06-01T00:00:00.000Z",
  };
}

type FetchCall = Parameters<typeof fetch>;

function getFetchInputUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function getGenerationCallBody(call: FetchCall): unknown {
  const body = call[1]?.body;
  if (typeof body !== "string") return null;
  return JSON.parse(body) as unknown;
}

function parseJsonBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== "string") return {};
  return JSON.parse(body) as unknown;
}

function stubRouteAiCommentGenerationFetch() {
  const fetchMock = vi.fn<typeof fetch>((input, init) => {
    const url = getFetchInputUrl(input);
    if (!url.includes("/route-ai-comments/generate")) {
      return Promise.resolve(new Response(null, { status: 404 }));
    }
    const snapshotId = decodeURIComponent(url.split("/api/route-ai-comments/generate/")[1] ?? "");
    const body = parseJsonBody(init?.body) as {
      viewSnapshot?: { snapshotKind?: string };
    };
    return Promise.resolve(
      new Response(
        JSON.stringify({
          snapshotId,
          snapshotKind: body.viewSnapshot?.snapshotKind ?? "search",
          reaction: createGeneratedReaction(snapshotId),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
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

function requireGenerationFetchCall(
  fetchMock: ReturnType<typeof stubRouteAiCommentGenerationFetch>,
  index = 0,
): FetchCall {
  const call = getGenerationFetchCalls(fetchMock).at(index);
  if (!call) {
    throw new Error(`Expected route AI comment generation fetch call at index ${String(index)}`);
  }
  return call;
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
      total: 2,
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

function createHydratedCitationLineageView() {
  return {
    status: "ready" as const,
    version: 0,
    reactionVersion: 0,
    id: "citation-1",
    type: "citation_lineage" as const,
    title: "인용 계보: Attention Is All You Need",
    content: "citation content",
    createdBy: "user" as const,
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-09T00:00:10.000Z",
    updatedAt: "2026-04-09T00:00:10.000Z",
    metadata: {
      type: "citation_lineage" as const,
      seedPaper: {
        paperId: "seed-1",
        title: "Attention Is All You Need",
        abstract: "seed abstract",
        year: 2017,
        citationCount: 1000,
        url: "https://example.com/seed-1",
        authors: [{ name: "Vaswani" }],
      },
      referenceIds: ["paper-1"],
      citationIds: [],
      papers: [],
      total: 1,
    },
    reaction: null,
  };
}

function createHydratedGraphNeighborsView() {
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
    reaction: null,
  };
}

describe("ResearchRouteRuntime search bootstrap reactions", () => {
  beforeEach(() => {
    runtimeHarness.setup();
    stubRouteAiCommentGenerationFetch();
  });

  afterEach(() => {
    runtimeHarness.cleanup();
  });

  it("bootstraps search route AI comment generation for a hydrated result ResearchRoutePayload with no reaction block", async () => {
    runtimeHarness.mount(createHydratedSearchView());

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const fetchMock = vi.mocked(globalThis.fetch);
    const generationCalls = getGenerationFetchCalls(fetchMock);

    expect(generationCalls).toHaveLength(1);
    const generationCall = requireGenerationFetchCall(fetchMock);
    expect(getFetchInputUrl(generationCall[0])).toContain(routeAiCommentGenerateRoute("search-1"));
    expect(getGenerationCallBody(generationCall)).toMatchObject({
      trigger: "user_search",
      reactionGeneration: 0,
    });
  });

  it("drops queued regeneration for the old execution while the new execution remains pending", async () => {
    const existingReaction = {
      id: "search-existing-reaction",
      title: "기존 AI comment",
      body: "이미 생성된 코멘트입니다.",
      chips: [],
      timestamp: "2026-06-01T00:00:00.000Z",
    };
    const searchDocument = {
      ...createHydratedSearchView(),
      reaction: existingReaction,
      reactionHistory: [existingReaction],
    };
    runtimeHarness.mount(searchDocument);

    act(() => {
      useResearchRouteStore
        .getState()
        .requestRouteAiCommentRegeneration(
          "search-1",
          useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
        );
      useReactionActionStore.getState().emitSystemEvent("user_search", "", "search-1");
    });

    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(true);

    runtimeHarness.rerender(createHydratedGraphNeighborsView());

    await act(async () => {
      await Promise.resolve();
    });

    expect(useResearchRouteStore.getState().currentView?.id).toBe("graph-1");
    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const generationUrls = getGenerationFetchCalls(vi.mocked(globalThis.fetch)).map(([input]) =>
      getFetchInputUrl(input),
    );
    expect(generationUrls).not.toContain(routeAiCommentGenerateRoute("search-1"));
  });

  it("re-fires one route AI comment generation when a query transition clears the reaction and commits a new result", async () => {
    const initialDoc = createHydratedSearchView();
    runtimeHarness.mount(initialDoc);

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const fetchMock = vi.mocked(globalThis.fetch);
    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(1);

    // Query-transition hygiene: executeSearch clears the reaction inline (reaction
    // generation advances), then the background task commits the new result
    // into the same route payload id.
    act(() => {
      useResearchRouteStore
        .getState()
        .setRouteAiComment(
          "search-1",
          null,
          useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
        );
      useResearchRouteStore.getState().patchCurrentView(
        {
          ...initialDoc,
          updatedAt: "2026-04-09T00:02:00.000Z",
          metadata: {
            ...initialDoc.metadata,
            query: "llm agents",
            total: 1,
          },
        },
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );
    });

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const generationCalls = getGenerationFetchCalls(fetchMock);
    expect(generationCalls).toHaveLength(2);
    const body = getGenerationCallBody(requireGenerationFetchCall(fetchMock, 1)) as {
      trigger: string;
      reactionGeneration: number;
    };
    expect(body).toMatchObject({
      trigger: "user_search",
    });
    expect(body.reactionGeneration).toBeGreaterThan(0);
  });

  it("drops a queued compatibility reaction command when a query transition advances reaction generation before flush", () => {
    const initialDoc = createHydratedSearchView();
    runtimeHarness.mount(initialDoc);

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    const fetchMock = vi.mocked(globalThis.fetch);
    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(1);

    act(() => {
      useReactionActionStore
        .getState()
        .emitSystemEvent("search_failed", '[system] "llm agents" 검색 실패', "search-1");
      useResearchRouteStore
        .getState()
        .setRouteAiComment(
          "search-1",
          null,
          useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
        );
    });

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(1);
  });

  it("drops a queued route AI comment generation when a query transition advances the reaction generation before flush", async () => {
    const initialDoc = createHydratedSearchView();
    runtimeHarness.mount(initialDoc);

    // The first reaction generation command is queued (coalesce window pending). Before it
    // flushes, a query transition clears the reaction — the queued command now describes
    // a result set the user already replaced.
    act(() => {
      useResearchRouteStore
        .getState()
        .setRouteAiComment(
          "search-1",
          null,
          useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
        );
    });

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    const fetchMock = vi.mocked(globalThis.fetch);
    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(0);

    // The query-transition result commit enqueues the current-generation command.
    act(() => {
      useResearchRouteStore.getState().patchCurrentView(
        {
          ...initialDoc,
          updatedAt: "2026-04-09T00:04:00.000Z",
          metadata: { ...initialDoc.metadata, query: "llm agents" },
        },
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );
    });

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const generationCalls = getGenerationFetchCalls(fetchMock);
    expect(generationCalls).toHaveLength(1);
    const body = getGenerationCallBody(requireGenerationFetchCall(fetchMock)) as {
      trigger: string;
      reactionGeneration: number;
    };
    expect(body).toMatchObject({
      trigger: "user_search",
    });
    expect(body.reactionGeneration).toBeGreaterThan(0);
  });

  it("fires route AI comment generation at commit for a pending search with no library signal instead of waiting for hydration", async () => {
    const baseDoc = createHydratedSearchView();
    const pendingDoc = {
      ...baseDoc,
      metadata: {
        ...baseDoc.metadata,
        abstractHydration: { status: "pending" as const, personalize: false },
      },
    };

    runtimeHarness.mount(pendingDoc);

    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    // No library blend will run during hydration (personalize off), so the
    // reaction cannot gain a library grounding line by waiting. Fire at commit on
    // the title/year/citation terrain instead of blocking on the hydrate round-trip.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const generationCalls = getGenerationFetchCalls(vi.mocked(globalThis.fetch));
    expect(generationCalls).toHaveLength(1);
    expect(
      getGenerationCallBody(requireGenerationFetchCall(vi.mocked(globalThis.fetch))),
    ).toMatchObject({
      trigger: "user_search",
    });
  });

  it("fires at commit for a personalized pending search without waiting for card hydration", async () => {
    const baseDoc = createHydratedSearchView();
    const pendingDoc = {
      ...baseDoc,
      metadata: {
        ...baseDoc.metadata,
        abstractHydration: { status: "pending" as const, personalize: true },
      },
    };

    runtimeHarness.mount(pendingDoc);

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    const fetchMock = vi.mocked(globalThis.fetch);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const generationCalls = getGenerationFetchCalls(fetchMock);
    expect(generationCalls).toHaveLength(1);
    expect(getGenerationCallBody(requireGenerationFetchCall(fetchMock))).toMatchObject({
      trigger: "user_search",
    });
  });

  it("fires route AI comment generation at commit for a first-reveal-locked personalized search", async () => {
    const baseDoc = createHydratedSearchView();
    const pendingDoc = {
      ...baseDoc,
      metadata: {
        ...baseDoc.metadata,
        abstractHydration: {
          status: "pending" as const,
          personalize: true,
          libraryBlendPolicy: "first_reveal_only" as const,
        },
      },
    };

    runtimeHarness.mount(pendingDoc);

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const generationCalls = getGenerationFetchCalls(vi.mocked(globalThis.fetch));
    expect(generationCalls).toHaveLength(1);
    expect(
      getGenerationCallBody(requireGenerationFetchCall(vi.mocked(globalThis.fetch))),
    ).toMatchObject({
      trigger: "user_search",
    });
  });
});

describe("ResearchRouteRuntime relationship bootstrap reactions", () => {
  beforeEach(() => {
    runtimeHarness.setup();
    stubRouteAiCommentGenerationFetch();
  });

  afterEach(() => {
    runtimeHarness.cleanup();
  });

  it("bootstraps citation-lineage route AI comment generation for a hydrated citation ResearchRoutePayload with no reaction block", async () => {
    runtimeHarness.mount(createHydratedCitationLineageView());

    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const generationCalls = getGenerationFetchCalls(vi.mocked(globalThis.fetch));
    expect(generationCalls).toHaveLength(1);
    const generationCall = requireGenerationFetchCall(vi.mocked(globalThis.fetch));
    expect(getFetchInputUrl(generationCall[0])).toContain(
      routeAiCommentGenerateRoute("citation-1"),
    );
    expect(getGenerationCallBody(generationCall)).toMatchObject({
      trigger: "citation_lineage_opened",
    });
  });

  it("bootstraps graph-neighbor route AI comment generation for a hydrated similar-paper ResearchRoutePayload with no reaction block", async () => {
    runtimeHarness.mount(createHydratedGraphNeighborsView());

    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const generationCalls = getGenerationFetchCalls(vi.mocked(globalThis.fetch));
    expect(generationCalls).toHaveLength(1);
    const generationCall = requireGenerationFetchCall(vi.mocked(globalThis.fetch));
    expect(getFetchInputUrl(generationCall[0])).toContain(routeAiCommentGenerateRoute("graph-1"));
    expect(getGenerationCallBody(generationCall)).toMatchObject({
      trigger: "graph_neighbors_opened",
    });
  });

  it("clears a failed automatic route AI comment generation without creating a fallback comment", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 500 }))),
    );
    const initialView = createHydratedGraphNeighborsView();

    await runtimeHarness.mountAndFlush(initialView);

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const reaction = useResearchRouteStore.getState().routeAiComment;
    expect(reaction).toBeNull();
    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(false);
  });

  it("clears automatic route AI comment generation when the endpoint returns no usable comment", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              snapshotId: "graph-1",
              snapshotKind: "graph_neighbors",
              reaction: null,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );
    await runtimeHarness.mountAndFlush(createHydratedGraphNeighborsView());

    act(() => {
      vi.advanceTimersByTime(1300);
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useResearchRouteStore.getState().routeAiComment).toBeNull();
    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(false);
  });

  it("clears regeneration loading when route AI comment generation fails while preserving an existing comment", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 500 }))),
    );
    const existingReaction = {
      id: "graph-existing-reaction",
      title: "기존 AI comment",
      body: "이미 생성된 코멘트입니다.",
      chips: [],
      timestamp: "2026-06-01T00:00:00.000Z",
    };
    const initialDocument = {
      ...createHydratedGraphNeighborsView(),
      reaction: existingReaction,
      reactionHistory: [existingReaction],
    };

    await runtimeHarness.mountAndFlush(initialDocument);

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
      await Promise.resolve();
    });

    expect(useResearchRouteStore.getState().routeAiComment).toEqual(existingReaction);
    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(false);
  });
});
