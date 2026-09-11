import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GapNetworkView } from "@/app/components/research-route-renderers/GapNetworkView";
import type { GapNetworkResearchRoutePayload } from "@/app/domain/research-route-payload";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

import { createGapNetworkView } from "./gap-network-view-persistence.fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/app/lib/track", () => ({
  track: vi.fn(),
  trackGapAnalysisRetryClicked: vi.fn(),
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

function StoreBoundGapNetworkView({
  gapAdmissionBlocked = false,
}: {
  gapAdmissionBlocked?: boolean;
}) {
  const document = useResearchRouteStore((state) => state.currentView);
  return document?.type === "gap_network" ? (
    <GapNetworkView document={document} gapAdmissionBlocked={gapAdmissionBlocked} />
  ) : null;
}

describe("GapNetworkView retry response", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-09T00:01:00.000Z"));
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("applies 429 Retry-After without hiding the graph or automatically posting", async () => {
    const base = createGapNetworkView();
    const failedDocument: GapNetworkResearchRoutePayload = {
      ...base,
      metadata: {
        ...base.metadata,
        gapNetworkBuild: {
          core: "ready",
          enrichment: "failed",
          phase: "failed",
          attempt: 1,
          coreEvidence: "citation-semantic-graph-v2",
          updatedAt: "2026-04-09T00:00:00.000Z",
        },
      },
    };
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "GAP_ENRICHMENT_RETRY_COOLDOWN",
          error: "gap enrichment retry is cooling down",
          action: "wait-and-retry",
          retryable: true,
          retryAfterSeconds: 37,
        }),
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "37" } },
      ),
    );
    useResearchRouteStore.getState().setCurrentView(failedDocument, "429-cooldown-execution");
    const container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root?.render(<StoreBoundGapNetworkView />);
      await flushPromises();
    });
    const button = [...container.querySelectorAll("button")].find((candidate) =>
      candidate.textContent.includes("분석 다시 시도"),
    );
    if (button === undefined) throw new Error("retry button was not rendered");
    await act(async () => {
      button.click();
      await flushPromises();
    });

    expect(container.querySelector('[data-testid="gap-network-report"]')).not.toBeNull();
    expect(button.textContent).toBe("37초 뒤 다시 시도");
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
    await act(async () => vi.advanceTimersByTimeAsync(36_000));
    expect(fetch).toHaveBeenCalledOnce();
    expect(button.hasAttribute("disabled")).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(1_000));
    expect(button.textContent).toBe("분석 다시 시도");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("keeps the graph readable and distinguishes principal admission rejection", async () => {
    const base = createGapNetworkView();
    const failedDocument: GapNetworkResearchRoutePayload = {
      ...base,
      metadata: {
        ...base.metadata,
        gapNetworkBuild: {
          core: "ready",
          enrichment: "failed",
          phase: "failed",
          attempt: 1,
          coreEvidence: "citation-semantic-graph-v2",
          updatedAt: "2026-04-09T00:00:00.000Z",
        },
      },
    };
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "GAP_BUILD_PRINCIPAL_ADMISSION_LIMIT",
          error: "another gap build is active",
          action: "wait-and-retry",
          retryable: true,
          retryAfterSeconds: 70,
        }),
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "70" } },
      ),
    );
    useResearchRouteStore.getState().setCurrentView(failedDocument, "429-admission-execution");
    const container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root?.render(<StoreBoundGapNetworkView gapAdmissionBlocked />);
      await flushPromises();
    });
    const button = [...container.querySelectorAll("button")].find((candidate) =>
      candidate.textContent.includes("분석 다시 시도"),
    );
    if (button === undefined) throw new Error("retry button was not rendered");
    await act(async () => {
      button.click();
      await flushPromises();
    });

    expect(container.querySelector('[data-testid="gap-network-report"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="gap-build-principal-admission-notice"]'),
    ).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      "다른 연구 공백 계산이 진행 중입니다",
    );
    expect(button.textContent).toBe("70초 뒤 다시 시도");
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(button.textContent).toBe("10초 뒤 다시 시도");
    expect(button.hasAttribute("disabled")).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(button.textContent).toBe("분석 다시 시도");
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("keeps the active pending report progress visible with the admission notice", async () => {
    const base = createGapNetworkView();
    const pendingDocument: GapNetworkResearchRoutePayload = {
      ...base,
      status: "pending",
      metadata: {
        ...base.metadata,
        gapNetworkBuild: {
          core: "pending",
          enrichment: "pending",
          phase: "queued",
          attempt: 0,
          updatedAt: "2026-04-09T00:00:00.000Z",
        },
      },
    };
    useResearchRouteStore.getState().setCurrentView(pendingDocument, "pending-admission-execution");
    const container = document.createElement("div");
    root = createRoot(container);

    await act(async () => {
      root?.render(<StoreBoundGapNetworkView gapAdmissionBlocked />);
      await flushPromises();
    });

    expect(
      container.querySelector('[data-testid="gap-build-principal-admission-notice"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("리포트 생성 중");
    expect(container.textContent).toContain(
      "계산이 끝나거나 중단되면 원래 검색 결과에서 다시 시도해 주세요",
    );
    expect(fetch).toHaveBeenCalledOnce();
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toContain("/api/gap-reports/status?");
    expect(
      vi
        .mocked(fetch)
        .mock.calls.some(
          ([input, init]) =>
            typeof input === "string" &&
            input.includes("/enrichment-retry") &&
            init?.method === "POST",
        ),
    ).toBe(false);
  });
});
