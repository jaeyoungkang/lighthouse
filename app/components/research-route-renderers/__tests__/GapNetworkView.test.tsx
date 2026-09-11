import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GapNetworkResearchRoutePayload,
  GapNetworkMetadata,
} from "@/app/domain/research-route-payload";
import { GapNetworkView } from "@/app/components/research-route-renderers/GapNetworkView";
import {
  RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS,
  GAP_VIEW_CONTENT_SHELL_CLASS,
} from "@/app/components/research/research-route-layout.shared";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import type { FollowupActivationEvent } from "@/app/components/research-route-renderers/search-view.helpers";

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const trackGapLedNextSearchClickedMock = vi.hoisted(() => vi.fn());
const trackGapViewMarginViewedOnceMock = vi.hoisted(() => vi.fn());
const trackGapViewPreparedReactionViewedOnceMock = vi.hoisted(() => vi.fn());
const trackGapReportViewedOnceMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/track", () => ({
  track: vi.fn(),
  trackGapReportViewedOnce: trackGapReportViewedOnceMock,
  trackGapViewMarginViewedOnce: trackGapViewMarginViewedOnceMock,
  trackGapViewPreparedReactionViewedOnce: trackGapViewPreparedReactionViewedOnceMock,
  trackGapLedNextSearchClicked: trackGapLedNextSearchClickedMock,
}));

vi.mock("@/app/components/research-route-renderers/knowledge-map/GapNetworkReport", () => ({
  GapNetworkReport: ({
    query,
    clusterReactions,
    gapReactions,
    onBackgroundReset,
    onClusterSelect,
    onGapSelect,
    onUseSeedAsSearch,
  }: {
    query: string;
    clusterReactions?: { clusterId: string; reaction: { body: string } }[];
    gapReactions?: { gapPairId: string; reaction: { body: string } }[];
    onBackgroundReset?: () => void;
    onClusterSelect?: (clusterId: string) => void;
    onGapSelect?: (gapPairId: string) => void;
    onUseSeedAsSearch?: (
      seed: string,
      seedKind: "cluster" | "concept" | "gap",
      event?: FollowupActivationEvent,
    ) => void;
  }) => (
    <div data-testid="gap-network-report">
      <span>{query}</span>
      <span data-testid="cluster-reaction-count">{clusterReactions?.length ?? 0}</span>
      <span data-testid="gap-reaction-count">{gapReactions?.length ?? 0}</span>
      <button type="button" onClick={() => onClusterSelect?.("cluster-0")}>
        cluster
      </button>
      <button type="button" onClick={() => onGapSelect?.("gap-0")}>
        gap
      </button>
      <button type="button" onClick={() => onBackgroundReset?.()}>
        reset
      </button>
      <button
        type="button"
        onClick={(event) => onUseSeedAsSearch?.("Workflow Memory", "concept", event)}
        onAuxClick={(event) => {
          if (event.button === 1) onUseSeedAsSearch?.("Workflow Memory", "concept", event);
        }}
      >
        seed search
      </button>
    </div>
  ),
}));

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

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
      version: 1 as const,
      query: "AI for Science",
      sourceSnapshotId: "search-1",
      papers: [],
      gapNetworkReport: {
        clusters: [
          {
            id: "cluster-0",
            label: "Agents",
            color: "oklch(0.6 0.1 200)",
            paperCount: 2,
            concepts: [],
          },
        ],
        conceptEdges: [
          {
            source: "agent memory",
            target: "planning",
            clusterId: "cluster-0",
            weight: 1,
          },
        ],
        gapPairs: [
          {
            id: "gap-0",
            leftClusterId: "cluster-0",
            rightClusterId: "cluster-1",
            leftLabel: "Agents",
            rightLabel: "Memory",
            displayLabel: "Agents-Memory",
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
          totalPaperCount: 2,
          totalEdgeCount: 1,
          gapPairCount: 1,
        },
        insight: {
          hypotheses: [],
        },
      },
      reactionPreparation: {
        overviewReaction: {
          id: "gap-network-overview",
          title: "연구 공백 리포트 요약",
          body: "대표 공백을 요약한다.",
          chips: [],
          timestamp: "2026-04-09T00:00:00.000Z",
        },
        clusterReactions: [
          {
            clusterId: "cluster-0",
            reaction: {
              id: "gap-network-cluster-cluster-0",
              title: "Agents 클러스터",
              body: "Agents 군집 코멘트다.",
              chips: [],
              timestamp: "2026-04-09T00:00:00.000Z",
            },
          },
        ],
        gapReactions: [
          {
            gapPairId: "gap-0",
            reaction: {
              id: "gap-network-gap-gap-0",
              title: "Agents-Memory 가설",
              body: "Agents와 Memory 사이 가설이다.",
              chips: [],
              timestamp: "2026-04-09T00:00:00.000Z",
            },
          },
        ],
        preparedAt: "2026-04-09T00:00:00.000Z",
      },
    },
    reaction: null,
  };
}

function registerGapNetworkViewTestHooks() {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
    trackGapViewMarginViewedOnceMock.mockClear();
    trackGapViewPreparedReactionViewedOnceMock.mockClear();
    trackGapReportViewedOnceMock.mockClear();
    trackGapLedNextSearchClickedMock.mockClear();
    mockPush.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
}

describe("GapNetworkView", () => {
  registerGapNetworkViewTestHooks();

  it("renders hydrated gap views with the shared visual ResearchRoutePayload rail", () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const gapView = createGapNetworkView();
    useResearchRouteStore.getState().setCurrentView(gapView, "test-execution:212");

    act(() => {
      root?.render(<GapNetworkView document={gapView} />);
    });

    const shell = container.querySelector('[data-testid="gap-network-content-shell"]');

    expect(shell?.className).toBe(GAP_VIEW_CONTENT_SHELL_CLASS);
    expect(shell?.className).not.toBe(RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS);
    expect(container.querySelector('[data-testid="cluster-reaction-count"]')?.textContent).toBe(
      "1",
    );
    expect(container.querySelector('[data-testid="gap-reaction-count"]')?.textContent).toBe("1");
    expect(trackGapReportViewedOnceMock).toHaveBeenCalledWith({
      type: "gap_network_viewed",
      data: {
        viewerPrincipalId: gapView.viewerPrincipalId,
        documentId: gapView.id,
      },
    });
  });

  it("renders the gap report building state from the real report route", () => {
    const container = document.createElement("div");
    root = createRoot(container);
    vi.mocked(fetch).mockReturnValue(new Promise(() => undefined) as never);
    const pendingDocument = createGapNetworkView();
    const metadata = pendingDocument.metadata;
    const buildingDocument: GapNetworkResearchRoutePayload = {
      ...pendingDocument,
      metadata: {
        ...metadata,
        gapNetworkBuild: undefined,
        gapNetworkReport: {
          ...metadata.gapNetworkReport,
          clusters: [],
          conceptEdges: [],
          gapPairs: [],
          metrics: {
            clusterCount: 0,
            totalPaperCount: 0,
            totalEdgeCount: 0,
            gapPairCount: 0,
          },
        },
      },
    };

    act(() => {
      root?.render(<GapNetworkView document={buildingDocument} />);
    });

    expect(container.querySelector('[data-testid="gap-network-view-core-pending"]')).toBeNull();
    expect(container.textContent).toContain("연구 공백 리포트 생성 중");
    expect(container.textContent).toContain("논문 정리 중");
    expect(container.textContent).toContain("입력 논문 표본과 분석 입력 상태를 확인");
    expect(container.textContent).not.toContain("gap-network-pending");
  });

  it("keeps unresolved blank reports in a pending state instead of showing terminal insufficient evidence", () => {
    const container = document.createElement("div");
    root = createRoot(container);
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => undefined));
    const gapView = createGapNetworkView();
    const baseMetadata = gapView.metadata;
    const unresolvedDocument: GapNetworkResearchRoutePayload = {
      ...gapView,
      metadata: {
        ...baseMetadata,
        gapNetworkBuild: undefined,
        papers: [
          {
            paperId: "p1",
            title: "Paper one",
            abstract: "abstract",
            year: 2026,
            citationCount: 1,
            url: "https://example.com/p1",
            authors: [],
            referenceIds: [],
            citationIds: [],
          },
        ],
        gapNetworkReport: {
          clusters: [],
          conceptEdges: [],
          gapPairs: [],
          metrics: {
            clusterCount: 0,
            totalPaperCount: 0,
            totalEdgeCount: 0,
            gapPairCount: 0,
          },
          insight: {
            hypotheses: [],
          },
        },
      },
    };
    useResearchRouteStore.getState().setCurrentView(unresolvedDocument, "test-execution:304");

    act(() => {
      root?.render(<GapNetworkView document={unresolvedDocument} />);
    });

    expect(container.querySelector('[data-testid="gap-network-report"]')).toBeNull();
    expect(container.querySelector('[data-testid="gap-network-view-core-pending"]')).toBeNull();
    expect(container.textContent).toContain("연구 공백 리포트 생성 중");
    expect(container.textContent).toContain("논문 정리 중");
    expect(container.textContent).not.toContain("연결 근거 부족");
    expect(container.textContent).not.toContain("관계 근거가 0건");
    expect(trackGapViewMarginViewedOnceMock).not.toHaveBeenCalled();
    expect(trackGapViewPreparedReactionViewedOnceMock).not.toHaveBeenCalled();
    expect(trackGapReportViewedOnceMock).not.toHaveBeenCalled();
  });

  it("does not track viewed analytics while narrative enrichment is still pending", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const gapView = createGapNetworkView();
    const baseMetadata = gapView.metadata;
    const enrichmentPendingDocument: GapNetworkResearchRoutePayload = {
      ...gapView,
      metadata: {
        ...baseMetadata,
        gapNetworkBuild: {
          core: "ready",
          enrichment: "pending",
          updatedAt: "2026-04-09T00:00:00.000Z",
        },
      },
    };
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => undefined));
    useResearchRouteStore
      .getState()
      .setCurrentView(enrichmentPendingDocument, "test-execution:337");

    await act(async () => {
      root?.render(<GapNetworkView document={enrichmentPendingDocument} />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("연구 공백 리포트 생성 중");
    expect(container.querySelector('[data-testid="gap-network-report"]')).toBeNull();
    expect(trackGapViewMarginViewedOnceMock).not.toHaveBeenCalled();
    expect(trackGapViewPreparedReactionViewedOnceMock).not.toHaveBeenCalled();
  });

  it("tracks the prepared reaction view only after reaction preparation metadata exists", () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const gapView = createGapNetworkView();
    const baseMetadata = gapView.metadata;
    const metadataWithoutPreparation: GapNetworkMetadata = { ...baseMetadata };
    delete metadataWithoutPreparation.reactionPreparation;
    const readyWithoutPreparation: GapNetworkResearchRoutePayload = {
      ...gapView,
      metadata: metadataWithoutPreparation,
    };
    useResearchRouteStore.getState().setCurrentView(readyWithoutPreparation, "test-execution:361");

    act(() => {
      root?.render(<GapNetworkView document={readyWithoutPreparation} />);
    });

    expect(trackGapViewMarginViewedOnceMock).toHaveBeenCalledTimes(1);
    expect(trackGapViewPreparedReactionViewedOnceMock).not.toHaveBeenCalled();

    act(() => {
      useResearchRouteStore.getState().setCurrentView(gapView, "test-execution:370");
      root?.render(<GapNetworkView document={gapView} />);
    });

    expect(trackGapViewMarginViewedOnceMock).toHaveBeenCalledTimes(1);
    expect(trackGapViewPreparedReactionViewedOnceMock).toHaveBeenCalledTimes(1);
    expect(trackGapViewPreparedReactionViewedOnceMock).toHaveBeenCalledWith({
      type: "gap_view_prepared_reaction_viewed",
      data: {
        viewerPrincipalId: "principal-1",
        researchRoutePayloadId: "gap-1",
        preparedReactionCount: 3,
      },
    });
  });

  it("composes a vertical stack with graph and content report without sticky overlap", () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const gapView = createGapNetworkView();
    const baseMetadata = gapView.metadata;
    const enrichedDocument: GapNetworkResearchRoutePayload = {
      ...gapView,
      title: "연구 공백 리포트: 자율 LLM 에이전트와 메모리/검색 보강",
      metadata: {
        ...baseMetadata,
        gapNetworkReport: {
          ...baseMetadata.gapNetworkReport,
          clusters: [
            {
              id: "c0",
              label: "Memory Systems",
              color: "oklch(0.6 0.1 200)",
              paperCount: 2,
              concepts: [{ id: "k0", label: "Long Context", clusterId: "c0", score: 8 }],
              topPaperIds: ["p1"],
            },
          ],
          metrics: {
            clusterCount: 1,
            totalPaperCount: 2,
            totalEdgeCount: 1,
            gapPairCount: 0,
          },
          domainLabel: "자율 LLM 에이전트와 메모리/검색 보강",
          contentNarrative: {
            overview: "분야 안에서 묶음이 한 축을 이룬다.",
            clusterParagraphs: [
              {
                clusterId: "c0",
                paragraph:
                  "Memory Systems는 장기 문맥 기억에 집중하며, 다른 클러스터와 다르게 정보 보존 결을 본다.",
              },
            ],
            gapInferenceParagraph: "클러스터 크기로 기대 교차 연결 수를 추정해 공백을 계산했다.",
          },
        },
      },
    };
    useResearchRouteStore.getState().setCurrentView(enrichedDocument, "test-execution:430");

    act(() => {
      root?.render(<GapNetworkView document={enrichedDocument} />);
    });

    const shell = container.querySelector('[data-testid="gap-network-content-shell"]');
    const header = container.querySelector('[data-testid="gap-network-view-header"]');
    const sticky = container.querySelector('[data-testid="gap-network-view-graph-sticky"]');
    const scroll = container.querySelector('[data-testid="gap-network-view-content-scroll"]');
    const graph = container.querySelector('[data-testid="gap-network-report"]');
    const reportBody = container.querySelector('[data-testid="gap-network-content-report"]');

    expect(shell).not.toBeNull();
    expect(header?.textContent).toContain("연구 공백 리포트");
    expect(header?.textContent).toContain("자율 LLM 에이전트와 메모리/검색 보강");

    // Graph section above body section without sticky overlap.
    expect(sticky?.className).not.toContain("sticky");
    expect(sticky?.className).not.toContain("top-0");
    expect(sticky?.className).toContain("w-full");
    expect(sticky?.contains(graph)).toBe(true);
    expect(scroll?.contains(reportBody)).toBe(true);

    // sticky comes before scroll in DOM order — vertical stack.
    const children = Array.from(shell?.children ?? []);
    const stickyIndex = children.indexOf(sticky as Element);
    const scrollIndex = children.indexOf(scroll as Element);
    expect(stickyIndex).toBeGreaterThanOrEqual(0);
    expect(scrollIndex).toBeGreaterThan(stickyIndex);

    // Body content carries the three sections produced by the narrative.
    expect(reportBody?.textContent).toContain("자율 LLM 에이전트와 메모리/검색 보강");
    expect(reportBody?.textContent).toContain("분야 안에서 묶음이 한 축을 이룬다");
    expect(reportBody?.textContent).toContain("Memory Systems");
    expect(reportBody?.textContent).toContain("(2편)");
    expect(reportBody?.textContent).toContain("정보 보존 결을 본다");
    expect(reportBody?.textContent).toContain("기대 교차 연결 수");
  });

  it("omits the detailed content report when paper-paper edge evidence is missing", () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const gapView = createGapNetworkView();
    const baseMetadata = gapView.metadata;
    const edgeInsufficientDocument: GapNetworkResearchRoutePayload = {
      ...gapView,
      metadata: {
        ...baseMetadata,
        gapNetworkReport: {
          ...baseMetadata.gapNetworkReport,
          clusters: [
            {
              id: "c0",
              label: "Lung Cancer Screening",
              color: "oklch(0.6 0.1 200)",
              paperCount: 10,
              concepts: [{ id: "k0", label: "CT Screening", clusterId: "c0", score: 8 }],
              topPaperIds: ["p1"],
            },
            {
              id: "c1",
              label: "Zero Error Tolerance Model",
              color: "oklch(0.6 0.1 60)",
              paperCount: 10,
              concepts: [{ id: "k1", label: "Safety", clusterId: "c1", score: 7 }],
              topPaperIds: ["p2"],
            },
          ],
          metrics: {
            clusterCount: 4,
            totalPaperCount: 40,
            totalEdgeCount: 0,
            gapPairCount: 0,
          },
          domainLabel: "의료 영상 진단 자동화",
          contentNarrative: {
            overview: "이 문장은 edge가 없을 때 노출되면 안 된다.",
            clusterParagraphs: [
              {
                clusterId: "c0",
                paragraph: "이 클러스터 설명은 edge가 없을 때 노출되면 안 된다.",
              },
            ],
            gapInferenceParagraph: "이 공백 추론 설명은 edge가 없을 때 노출되면 안 된다.",
          },
        },
      },
    };
    useResearchRouteStore.getState().setCurrentView(edgeInsufficientDocument, "test-execution:519");

    act(() => {
      root?.render(<GapNetworkView document={edgeInsufficientDocument} />);
    });

    expect(container.querySelector('[data-testid="gap-network-report"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="gap-network-content-scroll"]')).toBeNull();
    expect(container.querySelector('[data-testid="gap-network-content-report"]')).toBeNull();
    expect(container.textContent).not.toContain("클러스터 배경과 차이");
    expect(container.textContent).not.toContain("Lung Cancer Screening");
    expect(container.textContent).not.toContain("10편");
    expect(container.textContent).not.toContain("이 문장은 edge가 없을 때 노출되면 안 된다");
  });

  it("tracks seed-as-search clicks from the focused explanation card", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const gapView = createGapNetworkView();
    useResearchRouteStore.getState().setCurrentView(gapView, "test-execution:538");

    act(() => {
      root?.render(<GapNetworkView document={gapView} />);
    });

    const seedSearchButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "seed search",
    );
    expect(seedSearchButton).not.toBeNull();

    await act(async () => {
      seedSearchButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(trackGapLedNextSearchClickedMock).toHaveBeenCalledWith({
      type: "gap_led_next_search_clicked",
      data: {
        viewerPrincipalId: "principal-1",
        documentId: "gap-1",
        seedKind: "concept",
      },
    });
    // 즉시-이동: 명시적 seed 버튼은 서버 왕복 없이 `/search?q=` entry URL로
    // 바로 이동한다. 목적지 route가 URL 조건에서 검색을 실행한다.
    expect(fetch).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/search?q=Workflow+Memory&entry=term");
  });

  it(
    "opens modified and middle-click gap seed searches without changing the current route",
    verifyDetachedGapSeedSearch,
  );
});

function verifyDetachedGapSeedSearch() {
  const container = document.createElement("div");
  root = createRoot(container);
  const gapView = createGapNetworkView();
  const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
  useResearchRouteStore.getState().setCurrentView(gapView, "test-execution:detached-seed");

  act(() => {
    root?.render(<GapNetworkView document={gapView} />);
  });

  const seedSearchButton = Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "seed search",
  );
  act(() => {
    seedSearchButton?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true }),
    );
    seedSearchButton?.dispatchEvent(
      new MouseEvent("auxclick", { bubbles: true, button: 1, cancelable: true }),
    );
  });

  expect(mockPush).not.toHaveBeenCalled();
  expect(openSpy).toHaveBeenCalledTimes(2);
  expect(openSpy).toHaveBeenNthCalledWith(
    1,
    "/search?q=Workflow+Memory&entry=term",
    "_blank",
    "noopener,noreferrer",
  );
  expect(openSpy).toHaveBeenNthCalledWith(
    2,
    "/search?q=Workflow+Memory&entry=term",
    "_blank",
    "noopener,noreferrer",
  );
}
