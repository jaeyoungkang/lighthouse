import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GapNetworkResearchRoutePayload,
  GapNetworkMetadata,
} from "@/app/domain/research-route-payload";
import { GapNetworkView } from "@/app/components/research-route-renderers/GapNetworkView";
import { API_ROUTES } from "@/app/lib/api-routes";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

const { mockPush, trackGapAnalysisRetryClicked } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  trackGapAnalysisRetryClicked: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/app/lib/track", () => ({
  track: vi.fn(),
  trackGapAnalysisRetryClicked,
  trackGapReportViewedOnce: vi.fn(),
  trackGapViewMarginViewedOnce: vi.fn(),
  trackGapViewPreparedReactionViewedOnce: vi.fn(),
  trackGapLedNextSearchClicked: vi.fn(),
}));

vi.mock("@/app/components/research-route-renderers/knowledge-map/GapNetworkReport", () => ({
  GapNetworkReport: ({ query }: { query: string }) => (
    <div data-testid="gap-network-report">{query}</div>
  ),
}));

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

function flushPromises() {
  return Promise.resolve().then(() => Promise.resolve());
}

function getRequestUrl(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

function StoreBoundGapNetworkView() {
  const document = useResearchRouteStore((state) => state.currentView);
  return document?.type === "gap_network" ? <GapNetworkView document={document} /> : null;
}

function createGapNetworkView(): GapNetworkResearchRoutePayload {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "gap-1",
    type: "gap_network",
    title: "연구 공백: AI for Science",
    content: "gap content",
    createdBy: "agent",
    refs: [],
    viewerPrincipalId: "principal-1",
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt: "2026-04-09T00:00:00.000Z",
    metadata: {
      type: "gap_network",
      version: 1,
      query: "AI for Science",
      sourceSnapshotId: "search-1",
      papers: [],
      gapNetworkReport: {
        clusters: [
          {
            id: "cluster-0",
            label: "Simulation-based Inference",
            color: "oklch(0.6 0.1 200)",
            paperCount: 12,
            concepts: [
              {
                id: "concept-0",
                label: "Amortized Bayesian Inference",
                clusterId: "cluster-0",
                score: 9,
              },
            ],
            topPaperIds: ["paper-1"],
          },
        ],
        conceptEdges: [
          { source: "concept-0", target: "concept-1", clusterId: "cluster-0", weight: 1 },
        ],
        gapPairs: [
          {
            id: "gap-0",
            leftClusterId: "cluster-0",
            rightClusterId: "cluster-1",
            leftLabel: "Simulation-based Inference",
            rightLabel: "LLM Experiment Planning",
            displayLabel: "Inference-Planning Gap",
            observed: 0,
            expected: 2,
            gapScore: 1,
            rank: 1,
            bridgeConcepts: [],
            leftConcepts: [],
            rightConcepts: [],
          },
        ],
        metrics: {
          clusterCount: 1,
          totalPaperCount: 12,
          totalEdgeCount: 1,
          gapPairCount: 1,
        },
        insight: {
          hypotheses: [],
        },
      },
      gapNetworkBuild: {
        core: "ready",
        enrichment: "pending",
        coreEvidence: "citation-semantic-graph-v2",
        updatedAt: "2026-04-09T00:00:00.000Z",
      },
    },
    reaction: null,
  };
}

function setupGapNetworkEnrichmentTest() {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  mockPush.mockClear();
  vi.stubGlobal("fetch", vi.fn());
}

function cleanupGapNetworkEnrichmentTest() {
  act(() => {
    root?.unmount();
  });
  root = null;
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}

async function assertPendingStatusPollingKeepsItsInterval() {
  vi.useFakeTimers();
  const container = document.createElement("div");
  root = createRoot(container);
  const coreDocument = createGapNetworkView();
  const pendingDocument: GapNetworkResearchRoutePayload = {
    ...coreDocument,
    version: 1,
    updatedAt: "2026-04-09T00:00:01.000Z",
  };
  vi.mocked(fetch).mockResolvedValue(
    new Response(JSON.stringify({ status: "pending", document: pendingDocument, view: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  useResearchRouteStore.getState().setCurrentView(coreDocument, "pending-status-execution");
  const statusFetchCount = () =>
    vi.mocked(fetch).mock.calls.filter(([input]) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      return url.startsWith(API_ROUTES.GAP_REPORTS_STATUS);
    }).length;

  await act(async () => {
    root?.render(<StoreBoundGapNetworkView />);
    await flushPromises();
  });
  expect(statusFetchCount()).toBe(1);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1_199);
    await flushPromises();
  });
  expect(statusFetchCount()).toBe(1);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
    await flushPromises();
  });
  expect(statusFetchCount()).toBe(2);
}

describe("GapNetworkView enrichment", () => {
  beforeEach(setupGapNetworkEnrichmentTest);

  afterEach(cleanupGapNetworkEnrichmentTest);

  it("keeps the core graph visible while an explicit enrichment retry is pending", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const base = createGapNetworkView();
    const failedDocument: GapNetworkResearchRoutePayload = {
      ...base,
      version: 4,
      metadata: {
        ...base.metadata,
        gapNetworkBuild: {
          core: "ready",
          enrichment: "failed",
          phase: "failed",
          attempt: 1,
          coreEvidence: "citation-semantic-graph-v2",
          updatedAt: "2026-04-09T00:01:00.000Z",
        },
      },
    };
    const pendingDocument: GapNetworkResearchRoutePayload = {
      ...failedDocument,
      version: 5,
      metadata: {
        ...failedDocument.metadata,
        gapNetworkBuild: {
          core: "ready",
          enrichment: "pending",
          phase: "queued",
          attempt: 1,
          enrichmentRetryCount: 1,
          coreEvidence: "citation-semantic-graph-v2",
          updatedAt: "2026-04-09T00:01:01.000Z",
        },
      },
    };
    vi.mocked(fetch).mockImplementation((input) => {
      const url = getRequestUrl(input);
      if (url.endsWith("/enrichment-retry")) {
        return Promise.resolve(
          new Response(JSON.stringify({ status: "pending", document: pendingDocument }), {
            status: 202,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return new Promise<Response>(() => undefined);
    });
    useResearchRouteStore.getState().setCurrentView(failedDocument, "retry-execution");

    await act(async () => {
      root?.render(<StoreBoundGapNetworkView />);
      await flushPromises();
    });
    expect(container.querySelector('[data-testid="gap-network-report"]')).not.toBeNull();
    const button = [...container.querySelectorAll("button")].find((candidate) =>
      candidate.textContent.includes("분석 다시 시도"),
    );
    expect(button).toBeDefined();
    if (button === undefined) throw new Error("retry button was not rendered");

    await act(async () => {
      button.click();
      await flushPromises();
    });

    expect(trackGapAnalysisRetryClicked).toHaveBeenCalledWith({
      gapReportId: "gap-1",
      retryCount: 1,
    });
    expect(trackGapAnalysisRetryClicked).toHaveBeenCalledOnce();
    const retryFetchCall = vi
      .mocked(fetch)
      .mock.calls.find(([input]) =>
        getRequestUrl(input).endsWith("/api/gap-reports/gap-1/enrichment-retry"),
      );
    expect(retryFetchCall).toBeDefined();
    const retryFetchIndex = vi
      .mocked(fetch)
      .mock.calls.findIndex(([input]) =>
        getRequestUrl(input).endsWith("/api/gap-reports/gap-1/enrichment-retry"),
      );
    expect(retryFetchIndex).toBeGreaterThanOrEqual(0);
    expect(
      vi
        .mocked(fetch)
        .mock.calls.filter(([input]) => getRequestUrl(input).endsWith("/enrichment-retry")),
    ).toHaveLength(1);
    expect(trackGapAnalysisRetryClicked.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(fetch).mock.invocationCallOrder[retryFetchIndex] ?? Number.POSITIVE_INFINITY,
    );
    expect(container.querySelector('[data-testid="gap-network-report"]')).not.toBeNull();
    expect(container.textContent).toContain("분석 다시 시도 중");
    expect(container.textContent).not.toContain("연구 공백 리포트 생성 중");
  });

  it("disables retry for the same 60 second report cooldown after a retry failure", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-09T00:01:00.000Z"));
    const container = document.createElement("div");
    root = createRoot(container);
    const base = createGapNetworkView();
    const failedAgain: GapNetworkResearchRoutePayload = {
      ...base,
      metadata: {
        ...base.metadata,
        gapNetworkBuild: {
          core: "ready",
          enrichment: "failed",
          phase: "failed",
          attempt: 2,
          enrichmentRetryCount: 1,
          coreEvidence: "citation-semantic-graph-v2",
          updatedAt: "2026-04-09T00:01:00.000Z",
        },
      },
    };
    useResearchRouteStore.getState().setCurrentView(failedAgain, "cooldown-execution");

    await act(async () => {
      root?.render(<StoreBoundGapNetworkView />);
      await flushPromises();
    });
    const button = [...container.querySelectorAll("button")].find((candidate) =>
      candidate.textContent.includes("초 뒤 다시 시도"),
    );
    expect(button).toBeDefined();
    if (button === undefined) throw new Error("cooldown button was not rendered");
    expect(button.textContent).toBe("60초 뒤 다시 시도");
    expect(button.hasAttribute("disabled")).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
      await flushPromises();
    });
    expect(container.textContent).toContain("분석 다시 시도");
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("polls status for runner-persisted enrichment instead of posting enrich", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const coreDocument = createGapNetworkView();
    const baseMetadata = coreDocument.metadata;
    const enrichedMetadata: GapNetworkMetadata = {
      ...baseMetadata,
      gapNetworkBuild: {
        core: "ready",
        enrichment: "ready",
        updatedAt: "2026-04-09T00:01:00.000Z",
      },
      gapNetworkReport: {
        ...baseMetadata.gapNetworkReport,
        domainLabel: "자율 LLM 에이전트와 메모리/검색 보강",
      },
    };
    const enrichedDocument: GapNetworkResearchRoutePayload = {
      ...coreDocument,
      version: 1,
      title: "연구 공백: 자율 LLM 에이전트와 메모리/검색 보강",
      metadata: enrichedMetadata,
      updatedAt: "2026-04-09T00:01:00.000Z",
    };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ status: "completed", document: enrichedDocument, view: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    useResearchRouteStore.getState().setCurrentView(coreDocument, "test-execution:219");

    await act(async () => {
      root?.render(<GapNetworkView document={coreDocument} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      vi.mocked(fetch).mock.calls.some(([input]) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        return url.startsWith(API_ROUTES.GAP_REPORTS_STATUS);
      }),
    ).toBe(true);
    expect(
      vi.mocked(fetch).mock.calls.some(([input]) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        return url === "/api/gap-reports/enrich";
      }),
    ).toBe(false);
    expect(
      (
        [useResearchRouteStore.getState().currentView].filter(Boolean) as NonNullable<
          ReturnType<typeof useResearchRouteStore.getState>["currentView"]
        >[]
      ).find((entry) => entry.id === "gap-1"),
    ).toEqual(enrichedDocument);
  });

  it("starts one status poll only after a replacement execution hydrates", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const oldDocument = createGapNetworkView();
    const replacementDocument: GapNetworkResearchRoutePayload = {
      ...createGapNetworkView(),
      id: "gap-2",
      title: "연구 공백: replacement",
    };
    useResearchRouteStore.getState().setCurrentView(oldDocument, "old-execution");
    vi.mocked(fetch).mockImplementation(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => {
              reject(new DOMException("aborted", "AbortError"));
            },
            { once: true },
          );
        }),
    );

    await act(async () => {
      root?.render(<GapNetworkView document={replacementDocument} />);
      await Promise.resolve();
    });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    await act(async () => {
      useResearchRouteStore.getState().setCurrentView(replacementDocument, "new-execution");
      await Promise.resolve();
      await Promise.resolve();
    });

    const statusCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([input]) =>
        getRequestUrl(input).startsWith(API_ROUTES.GAP_REPORTS_STATUS),
      );
    expect(statusCalls).toHaveLength(1);
    const statusInput = statusCalls[0]?.[0];
    if (!statusInput) throw new Error("status request is required");
    expect(getRequestUrl(statusInput)).toContain("gapReportId=gap-2");
  });

  it("times out an abort-ignoring status poll and schedules the next observation", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    root = createRoot(container);
    const coreDocument = createGapNetworkView();
    const requestSignals: AbortSignal[] = [];
    vi.mocked(fetch).mockImplementation((_input, init) => {
      if (init?.signal) requestSignals.push(init.signal);
      return new Promise<Response>(() => undefined);
    });
    useResearchRouteStore.getState().setCurrentView(coreDocument, "status-timeout-execution");

    await act(async () => {
      root?.render(<GapNetworkView document={coreDocument} />);
      await flushPromises();
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(65_000);
      await flushPromises();
    });
    expect(requestSignals[0]?.aborted).toBe(true);
    expect(container.textContent).toContain("상태 응답이 올바르지 않습니다");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_800);
      await flushPromises();
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("GapNetworkView enrichment terminal states", () => {
  beforeEach(setupGapNetworkEnrichmentTest);

  afterEach(cleanupGapNetworkEnrichmentTest);

  it(
    "waits for the polling interval after applying a pending status document",
    assertPendingStatusPollingKeepsItsInterval,
  );

  it("stops status polling when the report is no longer available", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    root = createRoot(container);
    const coreDocument = createGapNetworkView();
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
    useResearchRouteStore.getState().setCurrentView(coreDocument, "missing-report-execution");

    await act(async () => {
      root?.render(<GapNetworkView document={coreDocument} />);
      await flushPromises();
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("상태 응답이 올바르지 않습니다");
    expect(container.textContent).toContain("연구 공백 리포트 생성 실패");
    expect(container.textContent).not.toContain("연구 공백 리포트 생성 중");
    expect(container.querySelector(".animate-spin")).toBeNull();
    expect(container.querySelector("button")).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
      await flushPromises();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps the loading screen visible while core-ready ResearchRoutePayloads still lack enrichment prose", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const coreDocument = createGapNetworkView();
    const baseMetadata = coreDocument.metadata;
    const coreDocumentWithEdges: GapNetworkResearchRoutePayload = {
      ...coreDocument,
      metadata: {
        ...baseMetadata,
        gapNetworkReport: {
          ...baseMetadata.gapNetworkReport,
          clusters: [
            {
              id: "cluster-0",
              label: "Simulation-based Inference",
              color: "oklch(0.6 0.1 200)",
              paperCount: 24,
              concepts: [
                {
                  id: "concept-0",
                  label: "Amortized Bayesian Inference",
                  clusterId: "cluster-0",
                  score: 9,
                },
              ],
              topPaperIds: ["paper-1"],
            },
          ],
          metrics: {
            clusterCount: 1,
            totalPaperCount: 24,
            totalEdgeCount: 3,
            gapPairCount: 1,
          },
          contentNarrative: {
            overview: "",
            clusterParagraphs: [],
            gapInferenceParagraph: "",
          },
        },
      },
    };
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => undefined));
    useResearchRouteStore.getState().setCurrentView(coreDocumentWithEdges, "test-execution:403");

    await act(async () => {
      root?.render(<GapNetworkView document={coreDocumentWithEdges} />);
      await flushPromises();
    });

    expect(container.textContent).toContain("연구 공백 리포트 생성 중");
    expect(container.textContent).toContain("해석 리포트 정리 중");
    expect(
      container.querySelector('[data-testid="gap-network-view-enrichment-status"]'),
    ).toBeNull();
    expect(container.querySelector('[data-testid="gap-network-report"]')).toBeNull();
    expect(container.querySelector('[data-testid="gap-network-content-report"]')).toBeNull();
    expect(container.querySelector('[data-testid="gap-network-content-scroll"]')).toBeNull();
    expect(container.querySelector('[data-testid="gap-network-view-content-pending"]')).toBeNull();
    expect(container.textContent).not.toContain("클러스터 크기로 기대 교차 연결 수");

    expect(
      vi.mocked(fetch).mock.calls.some(([input]) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        return url.includes("/reaction");
      }),
    ).toBe(false);
  });

  it("does not restart status polling after a terminal failed marker is applied", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const coreDocument = createGapNetworkView();
    const failedDocument: GapNetworkResearchRoutePayload = {
      ...coreDocument,
      status: "failed",
      version: 1,
      metadata: {
        ...coreDocument.metadata,
        gapNetworkBuild: {
          core: "failed",
          enrichment: "failed",
          phase: "failed",
          attempt: 1,
          updatedAt: "2026-04-09T00:01:00.000Z",
        },
      },
    };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ status: "failed", document: failedDocument, view: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    useResearchRouteStore.getState().setCurrentView(coreDocument, "test-execution:455");

    await act(async () => {
      root?.render(<GapNetworkView document={coreDocument} />);
      await flushPromises();
    });

    await act(async () => {
      root?.render(<GapNetworkView document={failedDocument} />);
      await flushPromises();
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(useResearchRouteStore.getState().currentView).toEqual(failedDocument);
    expect(container.textContent).toContain("연구 공백 리포트 생성 실패");
    expect(container.textContent).not.toContain("연구 공백 리포트 생성 중");
    expect(container.querySelector(".animate-spin")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });

  it("does not show or request enrichment while an edge-insufficient core report is terminal", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const coreDocument = createGapNetworkView();
    const baseMetadata = coreDocument.metadata;
    const edgeInsufficientDocument: GapNetworkResearchRoutePayload = {
      ...coreDocument,
      metadata: {
        ...baseMetadata,
        gapNetworkReport: {
          ...baseMetadata.gapNetworkReport,
          conceptEdges: [],
          gapPairs: [],
          metrics: {
            ...baseMetadata.gapNetworkReport.metrics,
            totalEdgeCount: 0,
            gapPairCount: 0,
          },
        },
      },
    };
    useResearchRouteStore.getState().setCurrentView(edgeInsufficientDocument, "test-execution:496");

    await act(async () => {
      root?.render(<GapNetworkView document={edgeInsufficientDocument} />);
      await flushPromises();
    });

    expect(
      container.querySelector('[data-testid="gap-network-view-enrichment-status"]'),
    ).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="gap-network-report"]')).not.toBeNull();
  });

  it("does not show or request enrichment while a no-meaningful-gap core report is terminal", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const coreDocument = createGapNetworkView();
    const baseMetadata = coreDocument.metadata;
    const noMeaningfulGapDocument: GapNetworkResearchRoutePayload = {
      ...coreDocument,
      metadata: {
        ...baseMetadata,
        gapNetworkReport: {
          ...baseMetadata.gapNetworkReport,
          gapPairs: [],
          metrics: {
            ...baseMetadata.gapNetworkReport.metrics,
            gapPairCount: 0,
          },
        },
      },
    };
    useResearchRouteStore.getState().setCurrentView(noMeaningfulGapDocument, "test-execution:529");

    await act(async () => {
      root?.render(<GapNetworkView document={noMeaningfulGapDocument} />);
      await flushPromises();
    });

    expect(
      container.querySelector('[data-testid="gap-network-view-enrichment-status"]'),
    ).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="gap-network-report"]')).not.toBeNull();
  });
});
