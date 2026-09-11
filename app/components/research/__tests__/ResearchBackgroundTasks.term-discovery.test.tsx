import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INLINE_ANALYSIS_VERSION } from "@/app/domain/analysis";
import { ResearchBackgroundTasks } from "@/app/components/research/ResearchBackgroundTasks";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import {
  buildSearchBackgroundSnapshotTarget,
  SEARCH_BACKGROUND_COMMAND_VERSION,
} from "@/app/domain/search-background-transport";
import { API_ROUTES } from "@/app/lib/api-routes";
import { BACKGROUND_REQUEST_SILENCE_TIMEOUT_MS } from "@/app/lib/background-request";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import {
  buildTermDiscoveryTaskKey,
  useBackgroundTaskStore,
} from "@/app/stores/background-task-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { flushTasks, getRequestUrl } from "./research-background-tasks-test-support";

const { trackResearchTermsViewedOnceMock } = vi.hoisted(() => ({
  trackResearchTermsViewedOnceMock: vi.fn(),
}));

vi.mock("@/app/lib/track", () => ({
  trackResearchTermsViewedOnce: trackResearchTermsViewedOnceMock,
}));

function termDiscoveryDeltaResponse(metadata: SearchMetadata, updatedAt: string) {
  return {
    schemaVersion: SEARCH_BACKGROUND_COMMAND_VERSION,
    target: buildSearchBackgroundSnapshotTarget(metadata),
    delta: {
      englishTermCandidates: metadata.englishTermCandidates ?? [],
      englishTermDiscovery: {
        status: "ready" as const,
        source: "llm" as const,
        generatedAt: metadata.englishTermDiscovery?.generatedAt ?? updatedAt,
      },
    },
    updatedAt,
  };
}

function searchPaper(paperId: string, withInlineAnalysis: boolean) {
  return {
    paperId,
    title: `Slide Accessibility ${paperId}`,
    abstract: "Highlighting visualization supports non-visual slide access.",
    year: 2024,
    citationCount: 12,
    url: `https://example.com/${paperId}`,
    authors: [{ name: `Author ${paperId}` }],
    referenceIds: [],
    citationIds: [],
    ...(withInlineAnalysis
      ? {
          inlineAnalysis: {
            version: INLINE_ANALYSIS_VERSION,
            source: "abstract" as const,
            analysis: {
              summary: "summary",
              objective: "objective",
              methodology: "highlighting visualization",
              results: "results",
              keywords: ["slide accessibility"],
              semanticProfile: {
                claim: "claim",
                topics: ["slide accessibility"],
                method: "highlighting visualization",
                finding: "finding",
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
        }
      : {}),
  };
}

function searchDocument(
  overrides: Partial<SearchMetadata> & { id?: string },
): Extract<ResearchRoutePayload, { type: "search" }> {
  const { id = "search-1", ...metadataOverrides } = overrides;
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id,
    type: "search",
    title: "검색: slide accessibility",
    content: "",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-07T00:00:00.000Z",
    updatedAt: "2026-04-07T00:00:00.000Z",
    metadata: {
      type: "search",
      query: "slide accessibility",
      total: 2,
      papers: [searchPaper("101", false), searchPaper("202", false)],
      ...metadataOverrides,
    },
  };
}

function setDocumentStoreDocuments(documents: ResearchRoutePayload[]) {
  const view = documents.at(0) ?? null;
  useResearchRouteStore.getState().setCurrentView(view, view ? `test:${view.id}` : "test:empty");
}

const originalFetch = global.fetch;
let root: Root | null = null;

function renderBackgroundTasks() {
  const container = document.createElement("div");
  root = createRoot(container);
  act(() => {
    root?.render(<ResearchBackgroundTasks />);
  });
}

async function verifyPriorExecutionCompletionIsRejected() {
  const pendingDocument = searchDocument({ englishTermDiscovery: { status: "pending" } });
  setDocumentStoreDocuments([pendingDocument]);
  const responseResolvers: Array<(response: Response) => void> = [];
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    if (getRequestUrl(input) === API_ROUTES.SEARCH_TERM_DISCOVERY) {
      return new Promise<Response>((resolve) => {
        responseResolvers.push(resolve);
      });
    }
    return Promise.resolve(
      new Response(
        JSON.stringify(
          termDiscoveryDeltaResponse(pendingDocument.metadata, pendingDocument.updatedAt),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
  });

  renderBackgroundTasks();
  await vi.waitFor(() => {
    expect(responseResolvers).toHaveLength(1);
  });

  act(() => {
    useResearchRouteStore.getState().setCurrentView(pendingDocument, "test:search-1:new-execution");
  });
  await flushTasks();

  await act(async () => {
    responseResolvers[0]?.(
      new Response(
        JSON.stringify(
          termDiscoveryDeltaResponse(
            {
              ...pendingDocument.metadata,
              englishTermDiscovery: { status: "ready", source: "llm" },
              englishTermCandidates: [
                {
                  term: "stale term",
                  type: "narrower",
                  confidence: "high",
                  supportCount: 1,
                  samplePaperIds: ["101"],
                  basis: "stale",
                },
              ],
            },
            "2026-04-07T00:00:05.000Z",
          ),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await flushTasks();
  });

  const current = useResearchRouteStore.getState();
  expect(current.activeExecutionId).toBe("test:search-1:new-execution");
  expect(
    current.currentView?.metadata.type === "search"
      ? current.currentView.metadata.englishTermDiscovery?.status
      : null,
  ).toBe("pending");
  expect(
    current.currentView?.metadata.type === "search"
      ? current.currentView.metadata.englishTermCandidates
      : null,
  ).toBeUndefined();
  expect(trackResearchTermsViewedOnceMock).not.toHaveBeenCalled();
}

function registerTermDiscoveryTestHooks() {
  beforeEach(() => {
    trackResearchTermsViewedOnceMock.mockReset();
    useResearchRouteStore.setState({
      ...useResearchRouteStore.getInitialState(),
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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
}

describe("ResearchBackgroundTasks term discovery", () => {
  registerTermDiscoveryTestHooks();

  it("queues an initial term-discovery request for a pending route view and replaces it with the result", async () => {
    const pendingDocument = searchDocument({ englishTermDiscovery: { status: "pending" } });
    const readyDocument: Extract<ResearchRoutePayload, { type: "search" }> = {
      ...pendingDocument,
      updatedAt: "2026-04-07T00:00:05.000Z",
      metadata: {
        ...pendingDocument.metadata,
        englishTermDiscovery: { status: "ready", source: "llm" },
        englishTermCandidates: [
          {
            term: "highlighting visualization",
            type: "narrower",
            confidence: "high",
            supportCount: 2,
            samplePaperIds: ["101", "202"],
            basis: "llm basis",
          },
        ],
      },
    };
    setDocumentStoreDocuments([pendingDocument]);

    const requests: { url: string; schemaVersion?: number; hasMetadata: boolean }[] = [];
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (url === API_ROUTES.SEARCH_TERM_DISCOVERY) {
        const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
          schemaVersion?: number;
          metadata?: unknown;
        };
        requests.push({ url, schemaVersion: body.schemaVersion, hasMetadata: "metadata" in body });
        return Promise.resolve(
          new Response(
            JSON.stringify(
              termDiscoveryDeltaResponse(readyDocument.metadata, readyDocument.updatedAt),
            ),
            { status: 200 },
          ),
        );
      }
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });
    global.fetch = fetchMock;

    renderBackgroundTasks();
    await vi.waitFor(() => {
      expect(requests).toHaveLength(1);
    });

    expect(requests).toEqual([
      {
        url: API_ROUTES.SEARCH_TERM_DISCOVERY,
        schemaVersion: 1,
        hasMetadata: false,
      },
    ]);
    await vi.waitFor(() => {
      const replaced = useResearchRouteStore.getState().currentView;
      expect(
        replaced?.id === "search-1" &&
          replaced.metadata.type === "search" &&
          replaced.metadata.englishTermDiscovery,
      ).toMatchObject({
        status: "ready",
        source: "llm",
      });
    });
    expect(trackResearchTermsViewedOnceMock).toHaveBeenCalledWith({
      ownerPrincipalId: "principal-1",
      documentId: "search-1",
      phase: "initial",
      source: "llm",
      candidateCount: 1,
    });
  });

  it("does not queue another term-discovery request once discovery is ready", async () => {
    const readyDocument = searchDocument({
      englishTermDiscovery: { status: "ready", source: "llm" },
      papers: [searchPaper("101", true), searchPaper("202", true)],
    });
    setDocumentStoreDocuments([readyDocument]);

    const requests: { phase?: string; hasDocumentId: boolean }[] = [];
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = getRequestUrl(input);
      if (url === API_ROUTES.SEARCH_TERM_DISCOVERY) {
        const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
          documentId?: unknown;
          phase?: string;
        };
        requests.push({ phase: body.phase, hasDocumentId: "documentId" in body });
        return Promise.resolve(new Response(JSON.stringify(readyDocument), { status: 200 }));
      }
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });
    global.fetch = fetchMock;

    renderBackgroundTasks();
    await flushTasks();

    expect(requests).toEqual([]);
    expect(trackResearchTermsViewedOnceMock).not.toHaveBeenCalled();
  });

  it("preserves graph support when a stale term-discovery response arrives later", async () => {
    const lightweightPapers = [searchPaper("101", false), searchPaper("202", false)].map(
      (paper) => ({
        ...paper,
        abstract: null,
        authors: [],
        openAccessPdf: null,
        referenceCount: null,
        ...(paper.paperId === "202"
          ? { reviewed: true, reviewedAt: "2026-04-07T00:00:01.000Z" }
          : {}),
      }),
    );
    const hydratedPapers = [
      {
        ...searchPaper("101", true),
        abstract: "Hydrated abstract for slide accessibility.",
        authors: [{ authorId: "a101", name: "Hydrated Author" }],
        openAccessPdf: { url: "https://example.com/101.pdf" },
        referenceCount: 7,
        reviewed: true,
        reviewedAt: "2026-04-07T00:00:04.000Z",
      },
      {
        ...searchPaper("202", false),
        reviewed: false,
      },
    ];
    const pendingDocument = searchDocument({
      englishTermDiscovery: { status: "pending" },
      papers: lightweightPapers,
    });
    const readyMetadata: SearchMetadata = {
      ...pendingDocument.metadata,
      englishTermDiscovery: { status: "ready", source: "llm" },
      graphSupport: {
        version: 1,
        source: "episteme-paper-neighborhood",
        basis: "loaded_result_sample",
        status: "empty",
        samplePaperIds: ["101", "202"],
        generatedAt: "2026-06-01T00:00:00.000Z",
        paperScores: {},
      },
      englishTermCandidates: [
        {
          term: "highlighting visualization",
          type: "narrower",
          confidence: "high",
          supportCount: 2,
          supportPaperIds: ["101", "202"],
          samplePaperIds: ["101", "202"],
          basis: "llm basis",
        },
      ],
    };
    const graphSupport: NonNullable<SearchMetadata["graphSupport"]> = {
      version: 1,
      source: "episteme-paper-neighborhood",
      basis: "loaded_result_sample",
      status: "ready",
      samplePaperIds: ["101", "202"],
      generatedAt: "2026-06-01T00:00:00.000Z",
      paperScores: {
        "101": {
          defaultScore: 0.9,
          graphScore: 0.8,
          semanticScore: 0.1,
          sharedCiters: 2,
          sharedRefs: 1,
          seedCount: 1,
          sources: ["co_cited"],
        },
      },
    };
    setDocumentStoreDocuments([pendingDocument]);

    let resolveFetch: ((response: Response) => void) | null = null;
    const fetchMock = vi.fn(
      (input: RequestInfo | URL) =>
        new Promise<Response>((resolve, reject) => {
          if (getRequestUrl(input) !== API_ROUTES.SEARCH_TERM_DISCOVERY) {
            reject(new Error(`unexpected fetch ${getRequestUrl(input)}`));
            return;
          }
          resolveFetch = resolve;
        }),
    );
    global.fetch = fetchMock;

    renderBackgroundTasks();
    await vi.waitFor(() => {
      expect(resolveFetch).not.toBeNull();
    });

    act(() => {
      useResearchRouteStore.getState().patchCurrentView(
        {
          ...pendingDocument,
          metadata: {
            ...pendingDocument.metadata,
            papers: hydratedPapers,
            graphSupport,
            sortOption: "yearAsc",
            yearFilter: "2024-2026",
            facetFilters: {
              fieldsOfStudy: [],
              authors: ["Hydrated Author"],
              venues: [],
              hasPdf: true,
            },
          },
          updatedAt: "2026-04-07T00:00:06.000Z",
        },
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );
    });

    await act(async () => {
      resolveFetch?.(
        new Response(
          JSON.stringify({
            ...termDiscoveryDeltaResponse(readyMetadata, "2026-04-07T00:00:05.000Z"),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
      await flushTasks();
    });

    const metadata = useResearchRouteStore.getState().currentView?.metadata;
    expect(metadata?.type === "search" ? metadata.graphSupport : undefined).toEqual(graphSupport);
    const candidate = metadata?.type === "search" ? metadata.englishTermCandidates?.[0] : undefined;
    expect(candidate).toMatchObject({
      term: "highlighting visualization",
      graphSupportCount: 1,
    });
    expect(candidate?.basis).toContain("첫 검색 결과의 라이브러리 그래프 근거");
    const firstPaper = metadata?.type === "search" ? metadata.papers[0] : undefined;
    const expectedPaper = searchPaper("101", true);
    expect(
      firstPaper && "inlineAnalysis" in firstPaper ? firstPaper.inlineAnalysis : undefined,
    ).toEqual("inlineAnalysis" in expectedPaper ? expectedPaper.inlineAnalysis : undefined);
    expect(firstPaper).toMatchObject({
      abstract: "Hydrated abstract for slide accessibility.",
      authors: [{ authorId: "a101", name: "Hydrated Author" }],
      openAccessPdf: { url: "https://example.com/101.pdf" },
      referenceCount: 7,
      reviewed: true,
      reviewedAt: "2026-04-07T00:00:04.000Z",
    });
    const secondPaper = metadata?.type === "search" ? metadata.papers[1] : undefined;
    expect(secondPaper).toMatchObject({
      paperId: "202",
      abstract: "Highlighting visualization supports non-visual slide access.",
      authors: [{ name: "Author 202" }],
      reviewed: false,
    });
    expect(secondPaper && "reviewedAt" in secondPaper ? secondPaper.reviewedAt : undefined).toBe(
      undefined,
    );
    expect(metadata?.type === "search" ? metadata : null).toMatchObject({
      sortOption: "yearAsc",
      yearFilter: "2024-2026",
      facetFilters: { authors: ["Hydrated Author"], hasPdf: true },
    });
    expect(useResearchRouteStore.getState().currentView?.updatedAt).toBe(
      "2026-04-07T00:00:06.001Z",
    );
  });
});

describe("ResearchBackgroundTasks term discovery execution isolation", () => {
  registerTermDiscoveryTestHooks();

  it("does not start a queued task from a replaced execution", async () => {
    const currentDocument = searchDocument({
      query: "current execution query",
      englishTermDiscovery: { status: "pending" },
    });
    useResearchRouteStore.getState().setCurrentView(currentDocument, "test:search-1:new-execution");
    const staleMetadata: SearchMetadata = {
      ...currentDocument.metadata,
      query: "replaced execution query",
    };
    useBackgroundTaskStore.getState().enqueueTermDiscoveryTask({
      executionId: "test:search-1:old-execution",
      documentId: currentDocument.id,
      ownerPrincipalId: currentDocument.ownerPrincipalId,
      query: staleMetadata.query,
      metadata: staleMetadata,
      phase: "initial",
    });

    const requestedQueries: string[] = [];
    global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
        target?: { query?: string };
      };
      if (getRequestUrl(input) === API_ROUTES.SEARCH_TERM_DISCOVERY && body.target?.query) {
        requestedQueries.push(body.target.query);
      }
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => {
            reject(new DOMException("aborted", "AbortError"));
          },
          { once: true },
        );
      });
    });

    renderBackgroundTasks();
    await vi.waitFor(() => {
      expect(requestedQueries).toHaveLength(1);
    });

    expect(requestedQueries).toEqual(["current execution query"]);
    expect(
      useBackgroundTaskStore.getState().termDiscoveryTasks[
        buildTermDiscoveryTaskKey("test:search-1:old-execution", currentDocument.id, "initial")
      ],
    ).toBeUndefined();

    act(() => {
      root?.unmount();
    });
    root = null;
    await flushTasks();
  });

  it(
    "rejects a prior execution completion without patching or emitting viewed analytics",
    verifyPriorExecutionCompletionIsRejected,
  );

  it("records an error entry instead of re-queueing the same task forever on failure", async () => {
    const pendingDocument = searchDocument({ englishTermDiscovery: { status: "pending" } });
    setDocumentStoreDocuments([pendingDocument]);

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = getRequestUrl(input);
      if (url === API_ROUTES.SEARCH_TERM_DISCOVERY) {
        return Promise.resolve(new Response("nope", { status: 500 }));
      }
      return Promise.reject(new Error(`unexpected fetch ${url}`));
    });
    global.fetch = fetchMock;

    renderBackgroundTasks();

    const taskKey = buildTermDiscoveryTaskKey(
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      "search-1",
      "initial",
    );
    await vi.waitFor(() => {
      expect(useBackgroundTaskStore.getState().termDiscoveryTasks[taskKey]?.status).toBe("error");
    });
    expect(
      fetchMock.mock.calls.filter(
        (call) => getRequestUrl(call[0]) === API_ROUTES.SEARCH_TERM_DISCOVERY,
      ).length,
    ).toBe(1);
  });

  it("records an error when an abort-ignoring term request reaches the deadline", async () => {
    vi.useFakeTimers();
    const pendingDocument = searchDocument({ englishTermDiscovery: { status: "pending" } });
    setDocumentStoreDocuments([pendingDocument]);
    const termRequestSignals: AbortSignal[] = [];
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (getRequestUrl(input) === API_ROUTES.SEARCH_TERM_DISCOVERY && init?.signal) {
        termRequestSignals.push(init.signal);
      }
      return new Promise<Response>(() => undefined);
    });
    global.fetch = fetchMock;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    renderBackgroundTasks();
    await flushTasks();
    await flushTasks();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(BACKGROUND_REQUEST_SILENCE_TIMEOUT_MS);
    });
    await flushTasks();

    const taskKey = buildTermDiscoveryTaskKey(
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      pendingDocument.id,
      "initial",
    );
    expect(
      fetchMock.mock.calls.filter(
        ([input]) => getRequestUrl(input) === API_ROUTES.SEARCH_TERM_DISCOVERY,
      ),
    ).toHaveLength(1);
    expect(termRequestSignals[0]?.aborted).toBe(true);
    expect(useBackgroundTaskStore.getState().termDiscoveryTasks[taskKey]?.status).toBe("error");
  });

  it("clears the task entry on abort so a later mount can re-queue the same key", async () => {
    const pendingDocument = searchDocument({ englishTermDiscovery: { status: "pending" } });
    setDocumentStoreDocuments([pendingDocument]);

    let releaseFetch: (() => void) | null = null;
    const fetchMock = vi.fn(
      (input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          releaseFetch = () => {
            reject(new DOMException("aborted", "AbortError"));
          };
          init?.signal?.addEventListener("abort", () => {
            releaseFetch?.();
          });
          void input;
        }),
    );
    global.fetch = fetchMock;

    renderBackgroundTasks();
    await flushTasks();

    const taskKey = buildTermDiscoveryTaskKey(
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      "search-1",
      "initial",
    );
    expect(useBackgroundTaskStore.getState().termDiscoveryTasks[taskKey]?.status).toBe("running");

    // unmount aborts the in-flight controller
    act(() => {
      root?.unmount();
    });
    root = null;
    await flushTasks();

    expect(useBackgroundTaskStore.getState().termDiscoveryTasks[taskKey]).toBeUndefined();
  });

  it("does not queue term discovery for current views without discovery state", async () => {
    const documentWithoutDiscoveryState = searchDocument({
      graphSupport: {
        version: 1,
        source: "episteme-paper-neighborhood",
        basis: "loaded_result_sample",
        status: "empty",
        samplePaperIds: ["101", "202"],
        generatedAt: "2026-04-07T00:00:00.000Z",
        paperScores: {},
      },
    });
    delete documentWithoutDiscoveryState.metadata.englishTermDiscovery;
    setDocumentStoreDocuments([documentWithoutDiscoveryState]);

    const fetchMock = vi.fn(() => Promise.reject(new Error("should not fetch")));
    global.fetch = fetchMock;

    renderBackgroundTasks();
    await flushTasks();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(Object.keys(useBackgroundTaskStore.getState().termDiscoveryTasks)).toHaveLength(0);
  });
});
