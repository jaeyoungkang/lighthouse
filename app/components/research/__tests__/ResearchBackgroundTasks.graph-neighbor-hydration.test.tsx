import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchBackgroundTasks } from "@/app/components/research/ResearchBackgroundTasks";
import {
  runGraphNeighborHydrationTask,
  shouldQueueGraphNeighborHydration,
} from "@/app/components/research/background-graph-neighbor-hydration";
import type {
  GraphNeighborsMetadata,
  ResearchRoutePayload,
} from "@/app/domain/research-route-payload";
import {
  flushTasks,
  getRequestUrl,
  runGraphTargetReplacementScenario,
} from "./research-background-tasks-test-support";
import { API_ROUTES } from "@/app/lib/api-routes";
import { BACKGROUND_REQUEST_SILENCE_TIMEOUT_MS } from "@/app/lib/background-request";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { INLINE_ANALYSIS_VERSION } from "@/app/domain/analysis";

const originalFetch = global.fetch;
let root: Root | null = null;

function createGraphNeighborDocument(): Extract<ResearchRoutePayload, { type: "graph_neighbors" }> {
  const paper = {
    paperId: "101",
    title: "Lightweight Neighbor",
    abstract: null,
    year: 2024,
    citationCount: 10,
    url: "https://example.com/101",
    authors: [],
    openAccessPdf: null,
    doi: null,
    reviewed: false,
  };
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "graph-neighbor-hydrate-1",
    type: "graph_neighbors",
    title: "비슷한 논문: Seed Paper",
    content: "",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-07-06T00:00:00.000Z",
    updatedAt: "2026-07-06T00:00:00.000Z",
    metadata: {
      type: "graph_neighbors",
      seedPaper: {
        paperId: "seed-1",
        title: "Seed Paper",
        abstract: null,
        year: 2023,
        citationCount: 100,
        url: "https://example.com/seed",
        authors: [],
      },
      papers: [paper],
      total: 1,
      coCited: [{ shared: 7, paper }],
      coupled: [],
      coCitedAvailability: {
        available: true,
        truncated: false,
        total: null,
        returned: 1,
        reason: null,
      },
      coupledAvailability: {
        available: false,
        truncated: false,
        total: null,
        returned: 0,
        reason: "no_graph_neighbors",
      },
      cardDataHydration: { status: "pending" },
    },
  };
}

function createHydratedMetadata(
  document: Extract<ResearchRoutePayload, { type: "graph_neighbors" }>,
): GraphNeighborsMetadata {
  const hydratedPaper = {
    ...document.metadata.papers[0],
    abstract: "Hydrated graph-neighbor abstract.",
    venue: "Hydrated Venue",
    fieldsOfStudy: ["Computer Science"],
    authors: [{ name: "Hydrated Author" }],
    openAccessPdf: { url: "https://example.com/101.pdf" },
  };
  return {
    ...document.metadata,
    papers: [hydratedPaper],
    coCited: [{ ...document.metadata.coCited[0], paper: hydratedPaper }],
    cardDataHydration: { status: "ready" },
  };
}

function setCurrentDocument(document: ResearchRoutePayload | null) {
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  useResearchRouteStore
    .getState()
    .setCurrentView(document, document ? `test:${document.id}` : "test:empty");
}

function getCurrentGraphMetadata(): GraphNeighborsMetadata | undefined {
  const document = useResearchRouteStore.getState().currentView;
  return document?.metadata.type === "graph_neighbors" ? document.metadata : undefined;
}

describe("ResearchBackgroundTasks graph-neighbor hydration", () => {
  beforeEach(() => {
    useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
    setCurrentDocument(null);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    global.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
    useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
    setCurrentDocument(null);
  });

  it("replaces a same-execution hydration attempt when a graph axis target changes", async () => {
    const scenario = await runGraphTargetReplacementScenario(createGraphNeighborDocument());

    expect(scenario).toMatchObject({
      initialRequestCount: 1,
      replacementRequestCount: 2,
      stableTargetRequestCount: 2,
      postLoserRequestCount: 2,
      firstRequestAborted: true,
    });
    expect(
      scenario.currentViewAfterLoser?.metadata.type === "graph_neighbors"
        ? scenario.currentViewAfterLoser.metadata.cardDataHydration
        : null,
    ).toEqual({ status: "pending" });
    const winnerMetadata =
      scenario.currentViewAfterWinner?.metadata.type === "graph_neighbors"
        ? scenario.currentViewAfterWinner.metadata
        : undefined;
    expect(winnerMetadata?.coCited[0]?.paper).toMatchObject({
      paperId: "202",
      abstract: "Hydrated replacement axis abstract.",
    });
    expect(winnerMetadata?.cardDataHydration).toEqual({ status: "ready" });
  });

  it("hydrates pending graph-neighbor card data from the background runner", async () => {
    const graphDocument = createGraphNeighborDocument();
    const hydratedMetadata = createHydratedMetadata(graphDocument);
    setCurrentDocument(graphDocument);
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = getRequestUrl(input);
      if (url === API_ROUTES.GRAPH_NEIGHBORS_HYDRATION) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              metadata: hydratedMetadata,
              updatedAt: "2026-07-06T00:00:02.000Z",
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });
    global.fetch = fetchMock;

    const container = document.createElement("div");
    root = createRoot(container);
    act(() => {
      root?.render(<ResearchBackgroundTasks />);
    });

    await flushTasks();
    await flushTasks();

    expect(fetchMock).toHaveBeenCalledWith(
      API_ROUTES.GRAPH_NEIGHBORS_HYDRATION,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ metadata: graphDocument.metadata }),
      }),
    );
    expect(getCurrentGraphMetadata()?.cardDataHydration).toEqual({ status: "ready" });
    expect(getCurrentGraphMetadata()?.papers[0]?.abstract).toBe(
      "Hydrated graph-neighbor abstract.",
    );
    expect(getCurrentGraphMetadata()?.coCited[0]?.paper.openAccessPdf?.url).toBe(
      "https://example.com/101.pdf",
    );
  });

  it("settles pending graph-neighbor card data when hydration keeps failing", async () => {
    vi.useFakeTimers();
    const graphDocument = createGraphNeighborDocument();
    setCurrentDocument(graphDocument);
    const fetchMock = vi.fn(() => Promise.reject(new Error("temporary provider failure")));
    global.fetch = fetchMock;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const hydratePromise = runGraphNeighborHydrationTask({
      task: {
        executionId: useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
        documentId: graphDocument.id,
        ownerPrincipalId: graphDocument.ownerPrincipalId,
        metadata: graphDocument.metadata,
      },
      controller: new AbortController(),
    });

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(500);
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(500);
      await hydratePromise;
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const settledDocument = useResearchRouteStore.getState().currentView;
    if (!settledDocument) {
      throw new Error("expected settled current document");
    }
    expect(shouldQueueGraphNeighborHydration(settledDocument)).toBe(false);
    expect(getCurrentGraphMetadata()?.cardDataHydration).toEqual({ status: "ready" });
    expect(getCurrentGraphMetadata()?.papers[0]?.abstract).toBeNull();
  });

  it("does not retry a correctable 400 with the same graph snapshot", async () => {
    const graphDocument = createGraphNeighborDocument();
    setCurrentDocument(graphDocument);
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        Response.json(
          {
            error: "invalid graph-neighbor hydration payload",
            code: "GRAPH_NEIGHBOR_HYDRATION_INVALID",
            action: "correct-request",
            retryable: false,
          },
          { status: 400 },
        ),
      ),
    );
    global.fetch = fetchMock;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      runGraphNeighborHydrationTask({
        task: {
          executionId: useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
          documentId: graphDocument.id,
          ownerPrincipalId: graphDocument.ownerPrincipalId,
          metadata: graphDocument.metadata,
        },
        controller: new AbortController(),
      }),
    ).resolves.toMatchObject({
      metadata: {
        cardDataHydration: { status: "ready" },
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("settles graph hydration after abort-ignoring transports hit the bounded deadline", async () => {
    vi.useFakeTimers();
    const graphDocument = createGraphNeighborDocument();
    setCurrentDocument(graphDocument);
    const requestSignals: AbortSignal[] = [];
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal) requestSignals.push(init.signal);
      return new Promise<Response>(() => undefined);
    });
    global.fetch = fetchMock;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const hydratePromise = runGraphNeighborHydrationTask({
      task: {
        executionId: useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
        documentId: graphDocument.id,
        ownerPrincipalId: graphDocument.ownerPrincipalId,
        metadata: graphDocument.metadata,
      },
      controller: new AbortController(),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BACKGROUND_REQUEST_SILENCE_TIMEOUT_MS);
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(BACKGROUND_REQUEST_SILENCE_TIMEOUT_MS);
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(BACKGROUND_REQUEST_SILENCE_TIMEOUT_MS);
      await hydratePromise;
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(requestSignals.every((signal) => signal.aborted)).toBe(true);
    expect(getCurrentGraphMetadata()?.cardDataHydration).toEqual({ status: "ready" });
  });

  it("rejects graph hydration from a prior execution that reused the same view snapshot", async () => {
    const graphDocument = createGraphNeighborDocument();
    const hydratedMetadata = createHydratedMetadata(graphDocument);
    setCurrentDocument(graphDocument);
    const priorExecutionId = useResearchRouteStore.getState().activeExecutionId;
    if (!priorExecutionId) {
      throw new Error("expected active execution");
    }

    let resolveFetch: ((response: Response) => void) | null = null;
    global.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const hydratePromise = runGraphNeighborHydrationTask({
      task: {
        executionId: priorExecutionId,
        documentId: graphDocument.id,
        ownerPrincipalId: graphDocument.ownerPrincipalId,
        metadata: graphDocument.metadata,
      },
      controller: new AbortController(),
    });
    await act(async () => {
      await Promise.resolve();
    });

    useResearchRouteStore
      .getState()
      .setCurrentView(graphDocument, "test:graph-neighbor-hydrate-1:new-execution");

    await act(async () => {
      resolveFetch?.(
        new Response(
          JSON.stringify({
            metadata: hydratedMetadata,
            updatedAt: "2026-07-06T00:00:00.000Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      expect(await hydratePromise).toBeNull();
    });

    expect(useResearchRouteStore.getState().activeExecutionId).toBe(
      "test:graph-neighbor-hydrate-1:new-execution",
    );
    expect(getCurrentGraphMetadata()?.cardDataHydration).toEqual({ status: "pending" });
    expect(getCurrentGraphMetadata()?.papers[0]?.abstract).toBeNull();
  });

  it("preserves concurrent review state but drops analysis when hydration changes its input", async () => {
    const graphDocument = createGraphNeighborDocument();
    const hydratedMetadata = createHydratedMetadata(graphDocument);
    setCurrentDocument(graphDocument);
    const executionId = useResearchRouteStore.getState().activeExecutionId;
    if (!executionId) throw new Error("expected active execution");
    let resolveFetch: ((response: Response) => void) | null = null;
    global.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const hydrationPromise = runGraphNeighborHydrationTask({
      task: {
        executionId,
        documentId: graphDocument.id,
        ownerPrincipalId: graphDocument.ownerPrincipalId,
        metadata: graphDocument.metadata,
      },
      controller: new AbortController(),
    });
    await act(async () => {
      await Promise.resolve();
    });

    const analyzedPaper = {
      ...graphDocument.metadata.papers[0],
      reviewed: true,
      reviewedAt: "2026-07-06T00:00:01.000Z",
      inlineAnalysis: {
        version: INLINE_ANALYSIS_VERSION,
        inputFingerprint: "a".repeat(64),
        source: "abstract" as const,
        analysis: {
          summary: "concurrent summary",
          objective: "concurrent objective",
          methodology: "concurrent method",
          results: "concurrent result",
          keywords: ["concurrency"],
          semanticProfile: {
            claim: "concurrent claim",
            topics: ["concurrency"],
            method: "concurrent method",
            finding: "concurrent finding",
            conclusion: null,
            quotedBasis: { claim: null, topics: [], method: null, finding: null },
          },
          stanceProfile: {
            mainPosition: null,
            debateAxis: null,
            limitations: null,
            counterSearchQueries: [],
          },
          confidence: "medium" as const,
          evidenceMap: {},
        },
      },
    };
    useResearchRouteStore.getState().patchCurrentView(
      {
        ...graphDocument,
        metadata: {
          ...graphDocument.metadata,
          graphLoadFailed: true,
          papers: [analyzedPaper],
          coCited: [{ ...graphDocument.metadata.coCited[0], paper: analyzedPaper }],
        },
        updatedAt: "2026-07-06T00:00:01.000Z",
      },
      executionId,
    );

    await act(async () => {
      resolveFetch?.(
        new Response(
          JSON.stringify({
            metadata: hydratedMetadata,
            updatedAt: "2026-07-06T00:00:00.000Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      await hydrationPromise;
    });

    expect(getCurrentGraphMetadata()?.papers[0]).toMatchObject({
      abstract: "Hydrated graph-neighbor abstract.",
      reviewed: true,
      reviewedAt: "2026-07-06T00:00:01.000Z",
    });
    const currentPaper = getCurrentGraphMetadata()?.papers[0];
    expect(
      currentPaper && "inlineAnalysis" in currentPaper ? currentPaper.inlineAnalysis : undefined,
    ).toBeUndefined();
    expect(getCurrentGraphMetadata()?.coCited[0]?.paper).toMatchObject({
      abstract: "Hydrated graph-neighbor abstract.",
      reviewed: true,
    });
    const currentCoCitedPaper = getCurrentGraphMetadata()?.coCited[0]?.paper;
    expect(
      currentCoCitedPaper && "inlineAnalysis" in currentCoCitedPaper
        ? currentCoCitedPaper.inlineAnalysis
        : undefined,
    ).toBeUndefined();
    expect(getCurrentGraphMetadata()?.graphLoadFailed).toBe(true);
    expect(useResearchRouteStore.getState().currentView?.updatedAt).toBe(
      "2026-07-06T00:00:01.001Z",
    );
  });
});
