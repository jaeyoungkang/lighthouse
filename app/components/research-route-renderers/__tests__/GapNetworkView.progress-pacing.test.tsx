import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GapNetworkResearchRoutePayload } from "@/app/domain/research-route-payload";
import { GapNetworkView } from "@/app/components/research-route-renderers/GapNetworkView";
import {
  GAP_NETWORK_MIN_VISIBLE_EMPTY_PROGRESS_MS,
  GAP_NETWORK_MIN_VISIBLE_PROGRESS_MS,
} from "@/app/components/research-route-renderers/gap-network-view.helpers";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { API_ROUTES } from "@/app/lib/api-routes";
import {
  GAP_NETWORK_BUILD_RECOVERY_GRACE_MS,
  shouldRequestGapNetworkBuildRecovery,
} from "@/app/components/research-route-renderers/gap-network-report-status-polling";

const { mockPush, trackGapReportViewedOnceMock } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  trackGapReportViewedOnceMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/app/lib/track", () => ({
  track: vi.fn(),
  trackGapReportViewedOnce: trackGapReportViewedOnceMock,
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

function baseGapNetworkView(): GapNetworkResearchRoutePayload {
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
        conceptEdges: [],
        gapPairs: [],
        metrics: {
          clusterCount: 1,
          totalPaperCount: 12,
          totalEdgeCount: 0,
          gapPairCount: 0,
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

// A reserved report that has not settled its deterministic core yet — the state
// the /gap/:id page first mounts into after POST reserves it.
function createCorePendingView(): GapNetworkResearchRoutePayload {
  const base = baseGapNetworkView();
  const baseMetadata = base.metadata;
  return {
    ...base,
    status: "pending",
    metadata: {
      ...baseMetadata,
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
        insight: { hypotheses: [] },
      },
      gapNetworkBuild: {
        core: "pending",
        enrichment: "pending",
        phase: "graph-support",
        attempt: 1,
        updatedAt: "2026-04-09T00:00:00.000Z",
      },
    },
  };
}

// A settled terminal empty-state (no meaningful gap) — display-ready with no
// enrichment wait, i.e. the fast completion that used to flash straight to the
// result after only the first progress stage.
function createReadyEmptyStateView(): GapNetworkResearchRoutePayload {
  return baseGapNetworkView();
}

// Core settled with meaningful gaps but narrative enrichment still pending — the
// state a user lands in when opening /gap/:id mid-enrichment.
function createEnrichmentPendingWithGapsView(): GapNetworkResearchRoutePayload {
  const base = baseGapNetworkView();
  const baseMetadata = base.metadata;
  return {
    ...base,
    metadata: {
      ...baseMetadata,
      gapNetworkReport: {
        ...baseMetadata.gapNetworkReport,
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
          totalEdgeCount: 3,
          gapPairCount: 1,
        },
      },
      gapNetworkBuild: {
        core: "ready",
        enrichment: "pending",
        coreEvidence: "citation-semantic-graph-v2",
        updatedAt: "2026-04-09T00:00:00.000Z",
      },
    },
  };
}

// A terminal-failed build: core failed, row failed.
function createFailedView(): GapNetworkResearchRoutePayload {
  const base = baseGapNetworkView();
  const baseMetadata = base.metadata;
  return {
    ...base,
    status: "failed",
    metadata: {
      ...baseMetadata,
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
        insight: { hypotheses: [] },
      },
      gapNetworkBuild: {
        core: "failed",
        enrichment: "failed",
        phase: "failed",
        attempt: 1,
        updatedAt: "2026-04-09T00:00:00.000Z",
      },
    },
  };
}

function setupTest() {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  mockPush.mockClear();
  trackGapReportViewedOnceMock.mockClear();
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn());
}

function cleanupTest() {
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

function graphReport(container: HTMLElement): Element | null {
  return container.querySelector('[data-testid="gap-network-report"]');
}

describe("GapNetworkView progress pacing", () => {
  beforeEach(setupTest);
  afterEach(cleanupTest);

  it("holds a fast empty-state build briefly, then reveals it before the meaningful-gap floor", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const pendingView = createCorePendingView();
    const readyView = createReadyEmptyStateView();
    // Status polling stays unresolved; the parent applies the settled report by
    // re-rendering, exactly as patchCurrentView drives the /gap/:id page.
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => undefined));
    useResearchRouteStore.getState().setCurrentView(pendingView, "test-execution:256");

    await act(async () => {
      root?.render(<GapNetworkView document={pendingView} />);
      await Promise.resolve();
    });

    // Mounts pending: the animated progress screen is up, the graph is not.
    expect(container.textContent).toContain("연구 공백 리포트 생성 중");
    expect(graphReport(container)).toBeNull();
    expect(trackGapReportViewedOnceMock).not.toHaveBeenCalled();

    // The runner finishes almost immediately and the settled empty-state report
    // is applied. It is display-ready, yet the animation must not flash to it.
    await act(async () => {
      root?.render(<GapNetworkView document={readyView} />);
      await Promise.resolve();
    });
    expect(graphReport(container)).toBeNull();
    expect(trackGapReportViewedOnceMock).not.toHaveBeenCalled();

    // Below the empty-state floor, still held.
    await act(async () => {
      vi.advanceTimersByTime(GAP_NETWORK_MIN_VISIBLE_EMPTY_PROGRESS_MS - 900);
      await Promise.resolve();
    });
    expect(graphReport(container)).toBeNull();

    // Past the shorter empty-state floor but still below the meaningful-gap
    // floor: the empty result is revealed sooner than a meaningful-gap report.
    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });
    expect(GAP_NETWORK_MIN_VISIBLE_EMPTY_PROGRESS_MS).toBeLessThan(
      GAP_NETWORK_MIN_VISIBLE_PROGRESS_MS,
    );
    expect(graphReport(container)).not.toBeNull();
    expect(trackGapReportViewedOnceMock).toHaveBeenCalledTimes(1);
  });

  it("reveals a reopened already-ready report immediately without the minimum-visible hold", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const readyView = createReadyEmptyStateView();
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => undefined));
    useResearchRouteStore.getState().setCurrentView(readyView, "test-execution:299");

    await act(async () => {
      root?.render(<GapNetworkView document={readyView} />);
      await Promise.resolve();
    });

    // Started non-pending (display-ready at mount) → no artificial hold.
    expect(graphReport(container)).not.toBeNull();
    expect(trackGapReportViewedOnceMock).toHaveBeenCalledTimes(1);
  });

  it("re-enters the authenticated build POST when a queued artifact lost its runner", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const pendingView = createCorePendingView();
    vi.mocked(fetch).mockImplementation((input, init) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith(API_ROUTES.GAP_REPORTS_STATUS)) {
        return Promise.resolve(
          new Response(JSON.stringify({ status: "pending", document: pendingView }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (url === API_ROUTES.GAP_REPORTS && init?.method === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({ status: "pending" }), { status: 202 }),
        );
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    useResearchRouteStore.getState().setCurrentView(pendingView, "test-execution:recovery");

    await act(async () => {
      root?.render(<GapNetworkView document={pendingView} />);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      API_ROUTES.GAP_REPORTS,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ gapReportId: pendingView.id }),
      }),
    );
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(
      1,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(
      1,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(
      2,
    );
  });

  it("recovers a lost runner after core persistence while narrative enrichment is pending", () => {
    const view = createEnrichmentPendingWithGapsView();
    const build = view.metadata.gapNetworkBuild;
    const updatedAt = Date.parse(build?.updatedAt ?? "");

    expect(
      shouldRequestGapNetworkBuildRecovery(view, updatedAt + GAP_NETWORK_BUILD_RECOVERY_GRACE_MS),
    ).toBe(true);
  });

  it("starts a report opened mid-enrichment on the interpretation stage instead of replaying early stages", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const view = createEnrichmentPendingWithGapsView();
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => undefined));
    useResearchRouteStore.getState().setCurrentView(view, "test-execution:315");

    await act(async () => {
      root?.render(<GapNetworkView document={view} />);
      await Promise.resolve();
    });

    // Core is already settled at mount, so the clock seeds at interpret (83%),
    // not collect (17%); the graph stays hidden until enrichment finishes.
    expect(container.textContent).toContain("83%");
    expect(container.textContent).not.toContain("17%");
    expect(graphReport(container)).toBeNull();
  });

  it("freezes the progress bar for a terminal-failed build instead of animating toward completion", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const failedView = createFailedView();
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(() => undefined));
    useResearchRouteStore.getState().setCurrentView(failedView, "test-execution:334");

    await act(async () => {
      root?.render(<GapNetworkView document={failedView} />);
      await Promise.resolve();
    });

    // Advancing well past the full animation window must not climb the bar: a
    // failed build surfaces the error and freezes the clock at the first stage
    // rather than faking progress toward interpret (83%).
    await act(async () => {
      vi.advanceTimersByTime(GAP_NETWORK_MIN_VISIBLE_PROGRESS_MS * 3);
      await Promise.resolve();
    });
    expect(container.textContent).toContain("17%");
    expect(container.textContent).not.toContain("83%");
    expect(graphReport(container)).toBeNull();
  });
});
