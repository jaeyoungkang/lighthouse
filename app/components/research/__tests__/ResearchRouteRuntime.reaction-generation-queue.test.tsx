import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchRouteRuntime } from "@/app/components/research/ResearchRouteRuntime";
import {
  getResearchRouteViewerPrincipalId,
  type ResearchRoutePayload,
} from "@/app/domain/research-route-payload";
import type { RouteAiComment } from "@/app/domain/route-ai-comment";
import { routeAiCommentGenerateRoute } from "@/app/lib/api-routes";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { advanceUpdatedAtAfterCurrent } from "@/app/stores/research-route-store-internals";

vi.mock("@/app/components/research/ResearchRouteLayout", () => ({
  ResearchRouteLayout: () => <div data-testid="research-route-layout" />,
}));

vi.mock("@/app/lib/track", () => ({
  track: () => undefined,
}));

let root: Root | null = null;

function resetRuntimeTestState() {
  useReactionActionStore.getState().unregisterSendMessage();
  useResearchRouteStore.setState({
    currentView: null,
    routeAiComment: null,
    reactionGeneration: 0,
    pendingRouteAiCommentRegeneration: false,
    reactionCardHistory: [],
    searchVisibleWindow: null,
  });
}

function cleanupRuntimeTestState() {
  act(() => {
    root?.unmount();
  });
  root = null;
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  resetRuntimeTestState();
}

function createGeneratedReaction(snapshotId: string): RouteAiComment {
  return {
    id: `generated-${snapshotId}`,
    title: "Generated AI comment",
    body: "route AI comment generation completed.",
    chips: [],
    timestamp: "2026-06-01T00:00:00.000Z",
  };
}

function createPaper(id: string) {
  return {
    paperId: id,
    title: `Paper ${id}`,
    abstract: "abstract",
    year: 2024,
    citationCount: 7,
    url: `https://example.com/${id}`,
    authors: [{ name: "Alice" }],
  };
}

function createSearchView(
  overrides: Partial<Extract<ResearchRoutePayload, { type: "search" }>> = {},
): Extract<ResearchRoutePayload, { type: "search" }> {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-1",
    type: "search",
    title: "Search",
    content: "",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt: "2026-04-09T00:00:00.000Z",
    reaction: null,
    metadata: {
      type: "search",
      query: "llm",
      total: 1,
      papers: [createPaper("paper-1")],
    },
    ...overrides,
  };
}

function getFetchInputUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function getGenerationFetchCalls(fetchMock: typeof fetch) {
  return vi
    .mocked(fetchMock)
    .mock.calls.filter(([input]) =>
      getFetchInputUrl(input).includes("/route-ai-comments/generate"),
    );
}

function parseJsonBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== "string") return {};
  return JSON.parse(body) as unknown;
}

function installImmediateGenerationFetch() {
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = getFetchInputUrl(input);
    const snapshotId = decodeURIComponent(url.split("/api/route-ai-comments/generate/")[1] ?? "");
    const document =
      useResearchRouteStore.getState().currentView?.id === snapshotId
        ? useResearchRouteStore.getState().currentView
        : undefined;
    const body = parseJsonBody(init?.body) as {
      viewSnapshot?: { snapshotId?: string; snapshotKind?: string };
    };
    return Promise.resolve(
      new Response(
        JSON.stringify({
          snapshotId,
          snapshotKind: body.viewSnapshot?.snapshotKind ?? document?.type ?? "search",
          reaction: createGeneratedReaction(snapshotId),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderRuntime(
  initialView: ComponentProps<typeof ResearchRouteRuntime>["initialView"],
  runtimeId = "principal-1",
) {
  const container = document.createElement("div");
  root = createRoot(container);
  act(() => {
    root?.render(
      <ResearchRouteRuntime
        renderViewBody={() => null}
        runtimeId={runtimeId}
        initialView={initialView}
      />,
    );
  });
}

function rerenderRuntime(
  initialView: ComponentProps<typeof ResearchRouteRuntime>["initialView"],
  runtimeId: string,
) {
  act(() => {
    root?.render(
      <ResearchRouteRuntime
        renderViewBody={() => null}
        runtimeId={runtimeId}
        initialView={initialView}
      />,
    );
  });
}

async function flushMicrotasks(count = 10) {
  await act(async () => {
    for (let index = 0; index < count; index++) {
      await Promise.resolve();
    }
  });
}

async function verifyBasisRegeneration() {
  const existingReaction = createGeneratedReaction("search-existing");
  const searchView = createSearchView({
    reaction: existingReaction,
    reactionHistory: [existingReaction],
  });
  let resolveFirstRequest: (response: Response) => void = () => {
    throw new Error("first generation request must be pending");
  };
  let resolveSecondRequest: (response: Response) => void = () => {
    throw new Error("second generation request must be pending");
  };
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFirstRequest = resolve;
        }),
    )
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveSecondRequest = resolve;
        }),
    );
  vi.stubGlobal("fetch", fetchMock);
  renderRuntime(searchView);
  const executionId = useResearchRouteStore.getState().activeExecutionId;
  if (!executionId) throw new Error("active execution is required");

  act(() => {
    useResearchRouteStore.getState().requestRouteAiCommentRegeneration(searchView.id, executionId);
    useReactionActionStore.getState().emitSystemEvent("user_search", "", searchView.id);
    vi.advanceTimersByTime(240);
  });
  await flushMicrotasks(2);
  expect(getGenerationFetchCalls(fetchMock)).toHaveLength(1);

  act(() => {
    useResearchRouteStore.getState().patchCurrentView(
      {
        ...searchView,
        version: 1,
        updatedAt: "2026-04-09T00:00:01.000Z",
        metadata: {
          ...searchView.metadata,
          sortOption: "interest",
        },
      },
      executionId,
    );
  });
  await flushMicrotasks(2);
  expect(useResearchRouteStore.getState().routeAiComment).toBeNull();
  expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(true);

  act(() => {
    vi.advanceTimersByTime(240);
  });
  await flushMicrotasks(2);
  const generationCalls = getGenerationFetchCalls(fetchMock);
  expect(generationCalls).toHaveLength(2);

  resolveFirstRequest(
    new Response(
      JSON.stringify({
        snapshotId: searchView.id,
        snapshotKind: searchView.type,
        reaction: createGeneratedReaction("search-stale"),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
  await flushMicrotasks();

  const secondBody = parseJsonBody(generationCalls[1]?.[1]?.body) as {
    viewSnapshot?: { content?: { sort?: string } };
  };
  expect(secondBody.viewSnapshot?.content?.sort).toBe("interest");
  expect(useResearchRouteStore.getState().routeAiComment).toBeNull();

  resolveSecondRequest(
    new Response(
      JSON.stringify({
        snapshotId: searchView.id,
        snapshotKind: searchView.type,
        reaction: createGeneratedReaction("search-current"),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
  await flushMicrotasks();

  expect(useResearchRouteStore.getState().routeAiComment).toMatchObject({
    id: "generated-search-current",
  });
  expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(false);
}

const ACTIVE_BASIS_REGENERATION_TEST_NAME =
  "drops an active result and regenerates from the current ViewSnapshot projection after the basis changes";

describe("ResearchRouteRuntime route AI comment generation queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRuntimeTestState();
  });

  afterEach(() => {
    cleanupRuntimeTestState();
  });

  it("flushes route AI comment generation for the route-owned current ResearchRoutePayload", async () => {
    const fetchMock = installImmediateGenerationFetch();
    renderRuntime(createSearchView());

    act(() => {
      vi.advanceTimersByTime(1300);
    });
    await flushMicrotasks();

    expect(getGenerationFetchCalls(fetchMock).map(([input]) => getFetchInputUrl(input))).toEqual([
      routeAiCommentGenerateRoute("search-1"),
    ]);
    expect(
      getGenerationFetchCalls(fetchMock).map(([, init]) => {
        const body = parseJsonBody(init?.body) as {
          viewSnapshot?: { snapshotId?: string; snapshotKind?: string };
        };
        return body.viewSnapshot;
      }),
    ).toEqual([expect.objectContaining({ snapshotId: "search-1", snapshotKind: "search" })]);
    expect(useResearchRouteStore.getState().routeAiComment).toMatchObject({
      id: "generated-search-1",
    });
  });

  it("keeps the 240ms coalescing window after pending state rerenders", async () => {
    const fetchMock = installImmediateGenerationFetch();
    renderRuntime(createSearchView());

    act(() => {
      vi.advanceTimersByTime(239);
    });
    await flushMicrotasks(2);
    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    await flushMicrotasks();
    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(1);
  });

  it("does not shorten a queued command's coalescing window when the active request settles", async () => {
    const existingReaction = createGeneratedReaction("search-existing");
    const searchView = createSearchView({
      reaction: existingReaction,
      reactionHistory: [existingReaction],
    });
    let resolveFirstRequest: (response: Response) => void = () => {
      throw new Error("first generation request must be pending");
    };
    let resolveSecondRequest: (response: Response) => void = () => {
      throw new Error("second generation request must be pending");
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFirstRequest = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveSecondRequest = resolve;
          }),
      );
    vi.stubGlobal("fetch", fetchMock);
    renderRuntime(searchView);
    const executionId = useResearchRouteStore.getState().activeExecutionId;
    if (!executionId) throw new Error("active execution is required");

    act(() => {
      useResearchRouteStore
        .getState()
        .requestRouteAiCommentRegeneration(searchView.id, executionId);
      useReactionActionStore.getState().emitSystemEvent("user_search", "", searchView.id);
      vi.advanceTimersByTime(240);
    });
    await flushMicrotasks(2);
    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(1);

    act(() => {
      useResearchRouteStore
        .getState()
        .requestRouteAiCommentRegeneration(searchView.id, executionId);
      useReactionActionStore.getState().emitSystemEvent("user_search", "", searchView.id);
      vi.advanceTimersByTime(100);
    });
    resolveFirstRequest(
      new Response(
        JSON.stringify({
          snapshotId: searchView.id,
          snapshotKind: searchView.type,
          reaction: createGeneratedReaction("search-first"),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await flushMicrotasks();
    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(139);
    });
    await flushMicrotasks(2);
    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    await flushMicrotasks();
    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(2);
    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(true);
    expect(useResearchRouteStore.getState().routeAiCommentGenerationStarted).toBe(true);

    resolveSecondRequest(
      new Response(
        JSON.stringify({
          snapshotId: searchView.id,
          snapshotKind: searchView.type,
          reaction: createGeneratedReaction("search-second"),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await flushMicrotasks();
    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(false);
  });

  it("drops an exact active generation command instead of replaying it after settle", async () => {
    const existingReaction = createGeneratedReaction("search-existing");
    const searchView = createSearchView({
      reaction: existingReaction,
      reactionHistory: [existingReaction],
    });
    let resolveGeneration: (response: Response) => void = () => {
      throw new Error("generation request must be pending");
    };
    const fetchMock = vi.fn<typeof fetch>(
      () =>
        new Promise<Response>((resolve) => {
          resolveGeneration = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderRuntime(searchView);
    const executionId = useResearchRouteStore.getState().activeExecutionId;
    if (!executionId) throw new Error("active execution is required");

    act(() => {
      useResearchRouteStore
        .getState()
        .requestRouteAiCommentRegeneration(searchView.id, executionId);
      useReactionActionStore.getState().emitSystemEvent("user_search", "", searchView.id);
      vi.advanceTimersByTime(240);
    });
    await flushMicrotasks(2);
    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(1);

    act(() => {
      useReactionActionStore.getState().emitSystemEvent("user_search", "", searchView.id);
      vi.advanceTimersByTime(240);
    });
    await flushMicrotasks(2);
    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(1);

    resolveGeneration(
      new Response(
        JSON.stringify({
          snapshotId: searchView.id,
          snapshotKind: searchView.type,
          reaction: createGeneratedReaction("search-regenerated"),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await flushMicrotasks();
    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(1);
  });

  it("settles pending generation when a schema-valid response targets a different snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              snapshotId: "search-other",
              snapshotKind: "search",
              reaction: createGeneratedReaction("search-other"),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );
    renderRuntime(createSearchView());

    act(() => {
      vi.advanceTimersByTime(1300);
    });
    await flushMicrotasks();

    expect(useResearchRouteStore.getState().routeAiComment).toBeNull();
    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(false);
    expect(useResearchRouteStore.getState().routeAiCommentGenerationStarted).toBe(false);
  });

  it("rebases a queued regeneration command when the ViewSnapshot projection changes before flush", async () => {
    const existingReaction = createGeneratedReaction("search-existing");
    const searchView = createSearchView({
      reaction: existingReaction,
      reactionHistory: [existingReaction],
    });
    const fetchMock = installImmediateGenerationFetch();
    renderRuntime(searchView);
    const executionId = useResearchRouteStore.getState().activeExecutionId;
    if (!executionId) throw new Error("active execution is required");

    act(() => {
      useResearchRouteStore
        .getState()
        .requestRouteAiCommentRegeneration(searchView.id, executionId);
      useReactionActionStore.getState().emitSystemEvent("user_search", "", searchView.id);
      useResearchRouteStore.getState().patchCurrentView(
        {
          ...searchView,
          metadata: { ...searchView.metadata, sortOption: "interest" },
          version: 1,
          updatedAt: advanceUpdatedAtAfterCurrent(searchView.updatedAt, searchView.updatedAt),
        },
        executionId,
      );
    });
    await flushMicrotasks(2);
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    await flushMicrotasks();

    const generationCalls = getGenerationFetchCalls(fetchMock);
    expect(generationCalls).toHaveLength(1);
    const body = parseJsonBody(generationCalls[0]?.[1]?.body) as {
      viewSnapshot?: { content?: { sort?: string } };
    };
    expect(body.viewSnapshot?.content?.sort).toBe("interest");
    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(false);
  });

  it("does not re-fire an active regeneration for a metadata-only freshness change", async () => {
    const existingReaction = createGeneratedReaction("search-existing");
    const searchView = createSearchView({
      reaction: existingReaction,
      reactionHistory: [existingReaction],
    });
    let resolveFirstRequest: (response: Response) => void = () => {
      throw new Error("first generation request must be pending");
    };
    const fetchMock = vi.fn<typeof fetch>(
      () =>
        new Promise<Response>((resolve) => {
          resolveFirstRequest = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderRuntime(searchView);
    const executionId = useResearchRouteStore.getState().activeExecutionId;
    if (!executionId) throw new Error("active execution is required");

    act(() => {
      useResearchRouteStore
        .getState()
        .requestRouteAiCommentRegeneration(searchView.id, executionId);
      useReactionActionStore.getState().emitSystemEvent("user_search", "", searchView.id);
      vi.advanceTimersByTime(1300);
    });
    await flushMicrotasks(2);
    expect(getGenerationFetchCalls(fetchMock)).toHaveLength(1);

    act(() => {
      useResearchRouteStore.getState().patchCurrentView(
        {
          ...searchView,
          version: 1,
          updatedAt: "2026-04-09T00:00:01.000Z",
        },
        executionId,
      );
    });
    resolveFirstRequest(
      new Response(
        JSON.stringify({
          snapshotId: searchView.id,
          snapshotKind: searchView.type,
          reaction: createGeneratedReaction("search-stale"),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await flushMicrotasks();

    const generationCalls = getGenerationFetchCalls(fetchMock);
    expect(generationCalls).toHaveLength(1);
    expect(useResearchRouteStore.getState().routeAiComment).toMatchObject({
      id: "generated-search-stale",
    });
    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(false);
  });

  it(ACTIVE_BASIS_REGENERATION_TEST_NAME, verifyBasisRegeneration);

  it("drops late route-view reaction responses after the route view changes", async () => {
    const oldDocument = createSearchView();
    const newDocument = createSearchView({
      title: "New collection search",
      ownerPrincipalId: "principal-2",
    });
    let resolveGeneration: (response: Response) => void = () => {
      throw new Error("Expected a pending route AI comment generation request");
    };
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(
        () =>
          new Promise<Response>((resolve) => {
            resolveGeneration = resolve;
          }),
      ),
    );

    renderRuntime(oldDocument);
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    await flushMicrotasks();
    expect(getGenerationFetchCalls(globalThis.fetch)).toHaveLength(1);

    rerenderRuntime(newDocument, "principal-2");
    await flushMicrotasks(2);

    const delayedReaction = createGeneratedReaction(oldDocument.id);
    resolveGeneration(
      new Response(
        JSON.stringify({
          snapshotId: oldDocument.id,
          snapshotKind: oldDocument.type,
          reaction: delayedReaction,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await flushMicrotasks(5);

    const currentView = useResearchRouteStore.getState().currentView;
    expect(currentView && getResearchRouteViewerPrincipalId(currentView)).toBe("principal-2");
    expect(
      (
        [useResearchRouteStore.getState().currentView].filter(Boolean) as NonNullable<
          ReturnType<typeof useResearchRouteStore.getState>["currentView"]
        >[]
      )[0],
    ).toMatchObject({
      title: "New collection search",
      ownerPrincipalId: "principal-2",
    });
    expect(useResearchRouteStore.getState().routeAiComment).toBeNull();
  });
});
