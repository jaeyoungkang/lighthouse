import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GapNetworkView } from "@/app/components/research-route-renderers/GapNetworkView";
import type { GapNetworkResearchRoutePayload } from "@/app/domain/research-route-payload";
import { gapReportReactionRoute } from "@/app/lib/api-routes";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import {
  createGapNetworkView,
  createReactionReadyGapNetworkView,
} from "./gap-network-view-persistence.fixtures";

const trackGapViewMarginViewedOnceMock = vi.hoisted(() => vi.fn());
const trackGapViewPreparedReactionViewedOnceMock = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/track", () => ({
  track: vi.fn(),
  trackGapReportViewedOnce: vi.fn(),
  trackGapViewMarginViewedOnce: trackGapViewMarginViewedOnceMock,
  trackGapViewPreparedReactionViewedOnce: trackGapViewPreparedReactionViewedOnceMock,
  trackGapLedNextSearchClicked: vi.fn(),
}));

vi.mock("@/app/components/research-route-renderers/knowledge-map/GapNetworkReport", () => ({
  GapNetworkReport: ({
    query,
    clusterReactions,
    gapReactions,
    onBackgroundReset,
    onClusterSelect,
    onGapSelect,
  }: {
    query: string;
    clusterReactions?: { clusterId: string; reaction: { body: string } }[];
    gapReactions?: { gapPairId: string; reaction: { body: string } }[];
    onBackgroundReset?: () => void;
    onClusterSelect?: (clusterId: string) => void;
    onGapSelect?: (gapPairId: string) => void;
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
    </div>
  ),
}));

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

function registerGapNetworkViewTestHooks() {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
    trackGapViewMarginViewedOnceMock.mockClear();
    trackGapViewPreparedReactionViewedOnceMock.mockClear();
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
    vi.useRealTimers();
  });
}

describe("GapNetworkView reactions", () => {
  registerGapNetworkViewTestHooks();

  it("coalesces queued prepared reaction writes and keeps the latest optimistic reaction", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const gapView = createGapNetworkView();
    const baseMetadata = gapView.metadata;
    const baseReactionPreparation = baseMetadata.reactionPreparation;
    if (!baseReactionPreparation) {
      throw new Error("gap view fixture must include reactionPreparation");
    }
    const readyGapView: GapNetworkResearchRoutePayload = {
      ...gapView,
      metadata: {
        ...baseMetadata,
        gapNetworkBuild: {
          core: "ready",
          enrichment: "ready",
          updatedAt: "2026-04-09T00:01:00.000Z",
        },
        gapNetworkReport: {
          ...baseMetadata.gapNetworkReport,
          metrics: {
            clusterCount: 1,
            totalPaperCount: 2,
            totalEdgeCount: 1,
            gapPairCount: 1,
          },
          contentNarrative: {
            overview: "LLM이 정리한 분야 개요다.",
            clusterParagraphs: [
              {
                clusterId: "cluster-0",
                paragraph: "LLM이 정리한 Agents 클러스터 설명이다.",
              },
            ],
            gapInferenceParagraph: "LLM이 정리한 공백 추론 설명이다.",
          },
        },
        reactionPreparation: {
          ...baseReactionPreparation,
          clusterReactions: baseReactionPreparation.clusterReactions.map((entry) => ({
            ...entry,
            reaction: {
              ...entry.reaction,
              body: "LLM이 정리한 Agents 클러스터 설명이다.",
            },
            narrative: "LLM이 정리한 Agents 클러스터 설명이다.",
          })),
          gapReactions: baseReactionPreparation.gapReactions.map((entry) => ({
            ...entry,
            reaction: {
              ...entry.reaction,
              body: "LLM이 정리한 Agents-Memory 공백 가설이다.",
            },
            metaQualitative: "LLM이 정리한 Agents-Memory 공백 맥락이다.",
            proposals: [
              {
                hypothesis: "LLM이 정리한 Agents-Memory 공백 가설이다.",
                grounding: "LLM이 정리한 근거다.",
              },
            ],
          })),
        },
      },
    };
    const fetchMock = vi.mocked(fetch);
    const responseResolvers: Array<() => void> = [];
    let confirmedReactionVersion = 0;
    fetchMock.mockImplementation((_url, init) => {
      const rawBody = typeof init?.body === "string" ? init.body : "";
      const parsedBody = rawBody
        ? (JSON.parse(rawBody) as {
            reaction: { id: string; title: string; body: string; chips: string[] };
            baseReactionVersion: number;
          })
        : null;

      return new Promise<Response>((resolve) => {
        responseResolvers.push(() => {
          confirmedReactionVersion += 1;
          resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ...readyGapView,
                reaction: parsedBody?.reaction ?? null,
                version: confirmedReactionVersion,
                reactionVersion: confirmedReactionVersion,
                updatedAt: "2026-04-09T00:01:00.000Z",
              }),
          } as Response);
        });
      });
    });
    useResearchRouteStore.getState().setCurrentView(readyGapView, "test-execution:183");

    await act(async () => {
      root?.render(<GapNetworkView document={readyGapView} />);
      await Promise.resolve();
    });

    const buttons = container.querySelectorAll("button");
    const clusterButton = buttons[0];
    const gapButton = buttons[1];
    const resetButton = buttons[2];

    await act(async () => {
      clusterButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      gapButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      resetButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      gapReportReactionRoute(encodeURIComponent(gapView.id)),
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useResearchRouteStore.getState().routeAiComment).toMatchObject({
      id: "gap-network-overview",
      title: "연구 공백 리포트 요약",
      body: "대표 공백을 요약한다.",
    });

    await act(async () => {
      responseResolvers.shift()?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondRequestBody = fetchMock.mock.calls[1]?.[1]?.body;
    if (typeof secondRequestBody !== "string") {
      throw new Error("second reaction request body must be JSON text");
    }
    const secondBody = JSON.parse(secondRequestBody) as {
      baseReactionVersion: number;
    };
    expect(secondBody.baseReactionVersion).toBe(1);

    await act(async () => {
      responseResolvers.shift()?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useResearchRouteStore.getState().currentView?.reaction).toMatchObject({
      id: "gap-network-overview",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(
      (
        [useResearchRouteStore.getState().currentView].filter(Boolean) as NonNullable<
          ReturnType<typeof useResearchRouteStore.getState>["currentView"]
        >[]
      ).find((entry) => entry.id === gapView.id)?.reaction,
    ).toMatchObject({
      id: "gap-network-overview",
      title: "연구 공백 리포트 요약",
      body: "대표 공백을 요약한다.",
    });

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 400 }));
    await act(async () => {
      gapButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useResearchRouteStore.getState().routeAiComment).toMatchObject({
      id: "gap-network-overview",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[gap-reaction-persistence] write failed",
      expect.objectContaining({ documentId: gapView.id }),
    );
  });

  it("retries an ambiguous 5xx completion and reconciles the server-confirmed reaction", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const readyGapView = createReactionReadyGapNetworkView();
    const metadata = readyGapView.metadata;
    const displayReadyGapView = readyGapView;
    const confirmedReaction = metadata.reactionPreparation?.clusterReactions[0]?.reaction;
    if (!confirmedReaction) throw new Error("cluster reaction fixture is required");
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockImplementationOnce((_input, init) => {
        if (typeof init?.body !== "string") {
          throw new Error("retried reaction request body is required");
        }
        const body = JSON.parse(init.body) as { reaction: typeof confirmedReaction };
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...displayReadyGapView,
              version: 1,
              reactionVersion: 1,
              reaction: body.reaction,
              reactionHistory: [body.reaction],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      });
    useResearchRouteStore.getState().setCurrentView(displayReadyGapView, "test-execution:300");

    await act(async () => {
      root?.render(<GapNetworkView document={displayReadyGapView} />);
      await Promise.resolve();
    });
    const clusterButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "cluster",
    );
    if (!clusterButton) throw new Error("cluster button is required");

    await act(async () => {
      clusterButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useResearchRouteStore.getState().routeAiComment).toMatchObject({
      id: confirmedReaction.id,
    });
    expect(useResearchRouteStore.getState().currentView).toMatchObject({
      reactionVersion: 1,
      reaction: { id: confirmedReaction.id },
    });
  });
});

describe("GapNetworkView reaction reconciliation", () => {
  registerGapNetworkViewTestHooks();

  it("restores the persisted history tail when a terminal write fails", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const gapView = createReactionReadyGapNetworkView();
    const metadata = gapView.metadata;
    const confirmedReaction = metadata.reactionPreparation?.overviewReaction;
    if (!confirmedReaction) throw new Error("overview reaction fixture is required");
    const historyReadyView: GapNetworkResearchRoutePayload = {
      ...gapView,
      version: 1,
      reactionVersion: 1,
      reaction: null,
      reactionHistory: [confirmedReaction],
    };
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 400 }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    useResearchRouteStore.getState().setCurrentView(historyReadyView, "history-execution");

    await act(async () => {
      root?.render(<GapNetworkView document={historyReadyView} />);
      await Promise.resolve();
    });
    const gapButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "gap",
    );
    if (!gapButton) throw new Error("gap button is required");
    await act(async () => {
      gapButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useResearchRouteStore.getState().routeAiComment).toMatchObject({
      id: confirmedReaction.id,
    });
  });

  it("rebases the queued latest choice after a stale-base response", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const gapView = createReactionReadyGapNetworkView();
    const metadata = gapView.metadata;
    const serverReactionTemplate = metadata.reactionPreparation?.overviewReaction;
    const queuedReactionTemplate = metadata.reactionPreparation?.gapReactions[0]?.reaction;
    if (!serverReactionTemplate || !queuedReactionTemplate) {
      throw new Error("reaction fixtures are required");
    }
    let serverReaction = serverReactionTemplate;
    let requestCount = 0;
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((_input, init) => {
      if (typeof init?.body !== "string") throw new Error("reaction request body is required");
      const body = JSON.parse(init.body) as {
        reaction: typeof serverReactionTemplate;
        baseReactionVersion: number;
      };
      requestCount += 1;
      const reactionVersion = requestCount;
      serverReaction =
        requestCount === 1
          ? {
              ...body.reaction,
              body: "같은 id와 timestamp를 가진 다른 writer의 본문",
            }
          : body.reaction;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...gapView,
            version: reactionVersion,
            reactionVersion,
            reaction: serverReaction,
            reactionHistory: [serverReaction],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    useResearchRouteStore.getState().setCurrentView(gapView, "test-execution:412");

    await act(async () => {
      root?.render(<GapNetworkView document={gapView} />);
      await Promise.resolve();
    });
    const buttons = Array.from(container.querySelectorAll("button"));
    const clusterButton = buttons.find((button) => button.textContent === "cluster");
    const gapButton = buttons.find((button) => button.textContent === "gap");
    if (!clusterButton || !gapButton) throw new Error("cluster and gap buttons are required");
    await act(async () => {
      clusterButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      gapButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const rebasedRequestBody = fetchMock.mock.calls[1]?.[1]?.body;
    if (typeof rebasedRequestBody !== "string") {
      throw new Error("rebased reaction request body is required");
    }
    expect(JSON.parse(rebasedRequestBody)).toMatchObject({
      reaction: { id: queuedReactionTemplate.id },
      baseReactionVersion: 1,
    });
    expect(useResearchRouteStore.getState().routeAiComment).toMatchObject({
      id: queuedReactionTemplate.id,
    });
    expect(useResearchRouteStore.getState().currentView).toMatchObject({
      reactionVersion: 2,
      reaction: { id: queuedReactionTemplate.id },
    });
  });
});

describe("GapNetworkView reaction execution reconciliation", () => {
  registerGapNetworkViewTestHooks();

  it("keeps a newer same-execution server projection over an older write response", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const gapView = createReactionReadyGapNetworkView();
    const metadata = gapView.metadata;
    const newerReaction = metadata.reactionPreparation?.overviewReaction;
    if (!newerReaction) throw new Error("overview reaction fixture is required");
    let resolveWrite: ((response: Response) => void) | null = null;
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((_input, init) => {
      if (typeof init?.body !== "string") throw new Error("reaction request body is required");
      return new Promise<Response>((resolve) => {
        resolveWrite = resolve;
      });
    });
    useResearchRouteStore.getState().setCurrentView(gapView, "same-execution");

    await act(async () => {
      root?.render(<GapNetworkView document={gapView} />);
      await Promise.resolve();
    });
    const clusterButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "cluster",
    );
    if (!clusterButton) throw new Error("cluster button is required");
    await act(async () => {
      clusterButton.click();
      await Promise.resolve();
    });
    const requestBody = fetchMock.mock.calls[0]?.[1]?.body;
    if (typeof requestBody !== "string") throw new Error("reaction request body is required");
    const requestedReaction = (JSON.parse(requestBody) as { reaction: typeof newerReaction })
      .reaction;

    const newerDocument: GapNetworkResearchRoutePayload = {
      ...gapView,
      version: 2,
      reactionVersion: 2,
      reaction: newerReaction,
      reactionHistory: [newerReaction],
    };
    await act(async () => {
      useResearchRouteStore.getState().patchCurrentView(newerDocument, "same-execution");
      useResearchRouteStore
        .getState()
        .setRouteAiComment(gapView.id, newerReaction, "same-execution");
      resolveWrite?.(
        new Response(
          JSON.stringify({
            ...gapView,
            version: 1,
            reactionVersion: 1,
            reaction: requestedReaction,
            reactionHistory: [requestedReaction],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useResearchRouteStore.getState()).toMatchObject({
      activeExecutionId: "same-execution",
      currentView: { reactionVersion: 2, reaction: { id: newerReaction.id } },
      routeAiComment: { id: newerReaction.id },
    });
  });

  it("drops queued writes after the route execution is replaced", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const gapView = createReactionReadyGapNetworkView();
    const metadata = gapView.metadata;
    const replacementReaction = metadata.reactionPreparation?.overviewReaction;
    if (!replacementReaction) throw new Error("overview reaction fixture is required");
    let resolveWrite: ((response: Response) => void) | null = null;
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveWrite = resolve;
        }),
    );
    useResearchRouteStore.getState().setCurrentView(gapView, "old-execution");

    await act(async () => {
      root?.render(<GapNetworkView document={gapView} />);
      await Promise.resolve();
    });
    const buttons = Array.from(container.querySelectorAll("button"));
    const clusterButton = buttons.find((button) => button.textContent === "cluster");
    const gapButton = buttons.find((button) => button.textContent === "gap");
    if (!clusterButton || !gapButton) throw new Error("cluster and gap buttons are required");
    await act(async () => {
      clusterButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      gapButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const replacementDocument: GapNetworkResearchRoutePayload = {
      ...gapView,
      version: 8,
      reactionVersion: 8,
      reaction: replacementReaction,
      reactionHistory: [replacementReaction],
      updatedAt: "2026-04-09T00:08:00.000Z",
    };
    await act(async () => {
      useResearchRouteStore.getState().setCurrentView(replacementDocument, "new-execution");
      resolveWrite?.(
        new Response(
          JSON.stringify({
            ...gapView,
            version: 1,
            reactionVersion: 1,
            reaction: replacementReaction,
            reactionHistory: [replacementReaction],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useResearchRouteStore.getState()).toMatchObject({
      activeExecutionId: "new-execution",
      currentView: { reactionVersion: 8, reaction: { id: replacementReaction.id } },
      routeAiComment: { id: replacementReaction.id },
    });
  });

  it("keeps a new-execution choice independent from the previous execution response", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const gapView = createReactionReadyGapNetworkView();
    const metadata = gapView.metadata;
    const replacementReaction = metadata.reactionPreparation?.overviewReaction;
    if (!replacementReaction) throw new Error("overview reaction fixture is required");
    const otherWriterReaction = {
      ...replacementReaction,
      id: "other-writer-reaction",
      body: "다른 writer가 먼저 확정한 반응이다.",
      timestamp: "2026-04-09T00:00:02.000Z",
    };
    let resolveOldWrite: ((response: Response) => void) | null = null;
    let resolveNewWrite: ((response: Response) => void) | null = null;
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockImplementationOnce((_input, init) => {
        if (typeof init?.body !== "string") throw new Error("old request body is required");
        return new Promise<Response>((resolve) => {
          resolveOldWrite = resolve;
        });
      })
      .mockImplementationOnce((_input, init) => {
        if (typeof init?.body !== "string") throw new Error("new request body is required");
        return new Promise<Response>((resolve) => {
          resolveNewWrite = resolve;
        });
      });
    useResearchRouteStore.getState().setCurrentView(gapView, "old-execution");

    await act(async () => {
      root?.render(<GapNetworkView document={gapView} />);
      await Promise.resolve();
    });
    const clusterButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "cluster",
    );
    const gapButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "gap",
    );
    if (!clusterButton || !gapButton) throw new Error("cluster and gap buttons are required");
    await act(async () => {
      clusterButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    const replacementDocument: GapNetworkResearchRoutePayload = {
      ...gapView,
      title: "replacement execution title",
      status: "pending",
      metadata: {
        ...metadata,
        query: "replacement execution query",
        sourceSnapshotId: "replacement-source-snapshot",
      },
      reaction: replacementReaction,
      reactionHistory: [replacementReaction],
    };
    await act(async () => {
      root?.unmount();
      root = createRoot(container);
      useResearchRouteStore.getState().setCurrentView(replacementDocument, "new-execution");
      root.render(<GapNetworkView document={replacementDocument} />);
      await Promise.resolve();
    });
    const newGapButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "gap",
    );
    if (!newGapButton) throw new Error("new execution gap button is required");
    await act(async () => {
      newGapButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const newRequestBody = fetchMock.mock.calls[1]?.[1]?.body;
    if (typeof newRequestBody !== "string") throw new Error("new request body must be JSON text");
    const newRequestedReaction = (
      JSON.parse(newRequestBody) as { reaction: typeof replacementReaction }
    ).reaction;
    expect(JSON.parse(newRequestBody)).toMatchObject({
      baseReactionVersion: 0,
      reaction: { id: "gap-network-gap-gap-0" },
    });

    await act(async () => {
      resolveOldWrite?.(
        new Response(
          JSON.stringify({
            ...gapView,
            version: 1,
            reactionVersion: 1,
            reaction: otherWriterReaction,
            reactionHistory: [otherWriterReaction],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useResearchRouteStore.getState()).toMatchObject({
      activeExecutionId: "new-execution",
      routeAiComment: { id: newRequestedReaction.id },
    });

    await act(async () => {
      resolveNewWrite?.(
        new Response(
          JSON.stringify({
            ...replacementDocument,
            version: 2,
            reactionVersion: 2,
            reaction: newRequestedReaction,
            reactionHistory: [otherWriterReaction, newRequestedReaction],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useResearchRouteStore.getState()).toMatchObject({
      activeExecutionId: "new-execution",
      currentView: {
        title: "replacement execution title",
        status: "pending",
        metadata: {
          query: "replacement execution query",
          sourceSnapshotId: "replacement-source-snapshot",
        },
        reactionVersion: 2,
        reaction: { id: newRequestedReaction.id },
      },
      routeAiComment: { id: newRequestedReaction.id },
    });
  });
});
