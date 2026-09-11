import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GapNetworkView } from "@/app/components/research-route-renderers/GapNetworkView";
import type { GapNetworkResearchRoutePayload } from "@/app/domain/research-route-payload";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { createReactionReadyGapNetworkView } from "./gap-network-view-persistence.fixtures";

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

describe("GapNetworkView ambiguous reaction read-back", () => {
  registerGapNetworkViewTestHooks();

  it("reads back the server commit after both PUT responses time out", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    root = createRoot(container);
    const gapView = createReactionReadyGapNetworkView();
    const metadata = gapView.metadata;
    const confirmedReaction = metadata.reactionPreparation?.overviewReaction;
    const selectedReaction = metadata.reactionPreparation?.gapReactions[0]?.reaction;
    if (!confirmedReaction || !selectedReaction) throw new Error("reaction fixtures are required");
    const historyReadyView: GapNetworkResearchRoutePayload = {
      ...gapView,
      version: 1,
      reactionVersion: 1,
      reaction: confirmedReaction,
      reactionHistory: [confirmedReaction],
    };
    const putSignals: AbortSignal[] = [];
    const requestedReactionRef: { current: typeof selectedReaction | null } = { current: null };
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === "GET") {
        if (!requestedReactionRef.current) throw new Error("requested reaction is required");
        return Promise.resolve(
          new Response(
            JSON.stringify({
              ...historyReadyView,
              version: 2,
              reactionVersion: 2,
              reaction: requestedReactionRef.current,
              reactionHistory: [confirmedReaction, requestedReactionRef.current],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (typeof init?.body !== "string") throw new Error("reaction body is required");
      requestedReactionRef.current = (
        JSON.parse(init.body) as { reaction: typeof selectedReaction }
      ).reaction;
      if (init.signal) putSignals.push(init.signal);
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener(
          "abort",
          () => {
            reject(new DOMException("timed out", "AbortError"));
          },
          { once: true },
        );
      });
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    useResearchRouteStore.getState().setCurrentView(historyReadyView, "timeout-execution");

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
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(fetchMock.mock.calls[0]?.[1]?.body);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
      await Promise.resolve();
    });

    expect(putSignals).toHaveLength(2);
    expect(putSignals.every((signal) => signal.aborted)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: "GET" });
    expect(useResearchRouteStore.getState().routeAiComment).toMatchObject({
      id: selectedReaction.id,
    });
    expect(useResearchRouteStore.getState().currentView).toMatchObject({
      reactionVersion: 2,
      reaction: { id: selectedReaction.id },
    });
  });

  it("keeps the optimistic reaction after a stale read-back until a late PUT commit appears", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    root = createRoot(container);
    const gapView = createReactionReadyGapNetworkView();
    const metadata = gapView.metadata;
    const confirmedReaction = metadata.reactionPreparation?.overviewReaction;
    const selectedReaction = metadata.reactionPreparation?.gapReactions[0]?.reaction;
    if (!confirmedReaction || !selectedReaction) throw new Error("reaction fixtures are required");
    const historyReadyView: GapNetworkResearchRoutePayload = {
      ...gapView,
      version: 1,
      reactionVersion: 1,
      reaction: confirmedReaction,
      reactionHistory: [confirmedReaction],
    };
    let readBackCount = 0;
    let requestedReaction: typeof selectedReaction | null = null;
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method !== "GET") {
        if (typeof init?.body === "string") {
          requestedReaction = (JSON.parse(init.body) as { reaction: typeof selectedReaction })
            .reaction;
        }
        return new Promise<Response>(() => undefined);
      }
      readBackCount += 1;
      const document =
        readBackCount === 1
          ? historyReadyView
          : {
              ...historyReadyView,
              version: 2,
              reactionVersion: 2,
              reaction: requestedReaction ?? selectedReaction,
              reactionHistory: [confirmedReaction, requestedReaction ?? selectedReaction],
            };
      return Promise.resolve(
        new Response(JSON.stringify(document), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    useResearchRouteStore.getState().setCurrentView(historyReadyView, "late-commit-execution");

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
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(readBackCount).toBe(1);
    expect(useResearchRouteStore.getState().routeAiComment).toMatchObject({
      id: selectedReaction.id,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(readBackCount).toBe(2);
    expect(useResearchRouteStore.getState().currentView).toMatchObject({
      reactionVersion: 2,
      reaction: { id: selectedReaction.id },
    });
  });

  it("adopts a newer canonical reaction when its own ambiguous write stays unconfirmed", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    root = createRoot(container);
    const gapView = createReactionReadyGapNetworkView();
    const metadata = gapView.metadata;
    const confirmedReaction = metadata.reactionPreparation?.overviewReaction;
    const selectedReaction = metadata.reactionPreparation?.gapReactions[0]?.reaction;
    const canonicalReaction = metadata.reactionPreparation?.clusterReactions[0]?.reaction;
    if (!confirmedReaction || !selectedReaction || !canonicalReaction) {
      throw new Error("reaction fixtures are required");
    }
    const historyReadyView: GapNetworkResearchRoutePayload = {
      ...gapView,
      version: 1,
      reactionVersion: 1,
      reaction: confirmedReaction,
      reactionHistory: [confirmedReaction],
    };
    const canonicalView: GapNetworkResearchRoutePayload = {
      ...historyReadyView,
      version: 2,
      reactionVersion: 2,
      reaction: canonicalReaction,
      reactionHistory: [confirmedReaction, canonicalReaction],
    };
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === "GET") {
        return Promise.resolve(
          new Response(JSON.stringify(canonicalView), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return new Promise<Response>(() => undefined);
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    useResearchRouteStore.getState().setCurrentView(historyReadyView, "foreign-commit-execution");

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
      await vi.advanceTimersByTimeAsync(31_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(useResearchRouteStore.getState()).toMatchObject({
      currentView: { reactionVersion: 2, reaction: { id: canonicalReaction.id } },
      routeAiComment: { id: canonicalReaction.id },
    });
  });
});

describe("GapNetworkView canonical reaction reconciliation", () => {
  registerGapNetworkViewTestHooks();

  it("rolls back to the live canonical reaction after a concurrent store update", async () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const gapView = createReactionReadyGapNetworkView();
    const metadata = gapView.metadata;
    const confirmedReaction = metadata.reactionPreparation?.overviewReaction;
    const canonicalReaction = metadata.reactionPreparation?.clusterReactions[0]?.reaction;
    if (!confirmedReaction || !canonicalReaction) throw new Error("reaction fixtures are required");
    const historyReadyView: GapNetworkResearchRoutePayload = {
      ...gapView,
      version: 1,
      reactionVersion: 1,
      reaction: confirmedReaction,
      reactionHistory: [confirmedReaction],
    };
    const resolveWriteRef: { current: ((response: Response) => void) | null } = { current: null };
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveWriteRef.current = resolve;
        }),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    useResearchRouteStore.getState().setCurrentView(historyReadyView, "concurrent-execution");

    await act(async () => {
      root?.render(<GapNetworkView document={historyReadyView} />);
      await Promise.resolve();
    });
    const gapButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "gap",
    );
    if (!gapButton) throw new Error("gap button is required");
    await act(async () => {
      gapButton.click();
      await Promise.resolve();
    });

    const canonicalView: GapNetworkResearchRoutePayload = {
      ...historyReadyView,
      version: 2,
      reactionVersion: 2,
      reaction: canonicalReaction,
      reactionHistory: [confirmedReaction, canonicalReaction],
    };
    useResearchRouteStore.getState().patchCurrentView(canonicalView, "concurrent-execution");
    resolveWriteRef.current?.(new Response(null, { status: 400 }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useResearchRouteStore.getState()).toMatchObject({
      currentView: { reactionVersion: 2, reaction: { id: canonicalReaction.id } },
      routeAiComment: { id: canonicalReaction.id },
    });
  });

  it("lets the queued newer choice replace an ambiguous older write", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    root = createRoot(container);
    const gapView = createReactionReadyGapNetworkView();
    const metadata = gapView.metadata;
    const confirmedReaction = metadata.reactionPreparation?.overviewReaction;
    const selectedReaction = metadata.reactionPreparation?.gapReactions[0]?.reaction;
    const nextReaction = metadata.reactionPreparation?.clusterReactions[0]?.reaction;
    if (!confirmedReaction || !selectedReaction || !nextReaction) {
      throw new Error("reaction fixtures are required");
    }
    const historyReadyView: GapNetworkResearchRoutePayload = {
      ...gapView,
      version: 1,
      reactionVersion: 1,
      reaction: confirmedReaction,
      reactionHistory: [confirmedReaction],
    };
    let readBackCount = 0;
    const persistedReactions = [confirmedReaction];
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === "GET") {
        readBackCount += 1;
        return Promise.resolve(
          new Response(JSON.stringify(historyReadyView), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (typeof init?.body !== "string") throw new Error("reaction body is required");
      const body = JSON.parse(init.body) as {
        reaction: typeof confirmedReaction;
        baseReactionVersion: number;
      };
      if (body.reaction.id !== nextReaction.id) {
        return new Promise<Response>(() => undefined);
      }
      persistedReactions.push(body.reaction);
      const reactionVersion = persistedReactions.length;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...historyReadyView,
            version: reactionVersion,
            reactionVersion,
            reaction: body.reaction,
            reactionHistory: persistedReactions,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    useResearchRouteStore.getState().setCurrentView(historyReadyView, "no-commit-execution");

    await act(async () => {
      root?.render(<GapNetworkView document={historyReadyView} />);
      await Promise.resolve();
    });
    const gapButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "gap",
    );
    const clusterButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "cluster",
    );
    if (!gapButton || !clusterButton) throw new Error("gap and cluster buttons are required");
    await act(async () => {
      gapButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      clusterButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(31_000);
    });

    expect(readBackCount).toBe(0);
    expect(useResearchRouteStore.getState().routeAiComment).toMatchObject({
      id: nextReaction.id,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const nextRequestBody = fetchMock.mock.calls[1]?.[1]?.body;
    if (typeof nextRequestBody !== "string") throw new Error("next reaction body is required");
    const nextBody = JSON.parse(nextRequestBody) as {
      reaction: typeof nextReaction;
      baseReactionVersion: number;
    };
    expect(nextBody).toMatchObject({
      reaction: { id: nextReaction.id },
      baseReactionVersion: 1,
    });
    expect(useResearchRouteStore.getState()).toMatchObject({
      currentView: { reactionVersion: 2, reaction: { id: nextReaction.id } },
      routeAiComment: { id: nextReaction.id },
    });
  });
});

describe("GapNetworkView ambiguous reaction route lifetime", () => {
  registerGapNetworkViewTestHooks();

  it("discards an unconfirmed write when the mounted route changes execution", async () => {
    vi.useFakeTimers();
    const container = document.createElement("div");
    root = createRoot(container);
    const gapView = createReactionReadyGapNetworkView();
    const metadata = gapView.metadata;
    const confirmedReaction = metadata.reactionPreparation?.overviewReaction;
    const nextReaction = metadata.reactionPreparation?.clusterReactions[0]?.reaction;
    if (!confirmedReaction || !nextReaction) throw new Error("reaction fixtures are required");
    const historyReadyView: GapNetworkResearchRoutePayload = {
      ...gapView,
      version: 1,
      reactionVersion: 1,
      reaction: confirmedReaction,
      reactionHistory: [confirmedReaction],
    };
    let allowWrites = false;
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === "GET") {
        return Promise.resolve(
          new Response(JSON.stringify(historyReadyView), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (!allowWrites) return new Promise<Response>(() => undefined);
      if (typeof init?.body !== "string") throw new Error("reaction body is required");
      const body = JSON.parse(init.body) as { reaction: typeof nextReaction };
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ...historyReadyView,
            version: 2,
            reactionVersion: 2,
            reaction: body.reaction,
            reactionHistory: [confirmedReaction, body.reaction],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    useResearchRouteStore.getState().setCurrentView(historyReadyView, "old-execution");

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
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(7);

    await act(async () => {
      useResearchRouteStore.getState().setCurrentView(historyReadyView, "new-execution");
      await Promise.resolve();
    });
    allowWrites = true;
    const clusterButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "cluster",
    );
    if (!clusterButton) throw new Error("cluster button is required");
    await act(async () => {
      clusterButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const requestBody = fetchMock.mock.calls[7]?.[1]?.body;
    if (typeof requestBody !== "string") {
      throw new Error("new execution reaction request body is required");
    }
    expect(JSON.parse(requestBody)).toMatchObject({
      reaction: { id: nextReaction.id },
      baseReactionVersion: 1,
    });
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });

  it("rebases a new execution choice after an old detached write commits late", async () => {
    vi.useFakeTimers();
    const firstContainer = document.createElement("div");
    root = createRoot(firstContainer);
    const gapView = createReactionReadyGapNetworkView();
    const metadata = gapView.metadata;
    const confirmedReaction = metadata.reactionPreparation?.overviewReaction;
    const nextReaction = metadata.reactionPreparation?.clusterReactions[0]?.reaction;
    if (!confirmedReaction || !nextReaction) throw new Error("reaction fixtures are required");
    const historyReadyView: GapNetworkResearchRoutePayload = {
      ...gapView,
      version: 1,
      reactionVersion: 1,
      reaction: confirmedReaction,
      reactionHistory: [confirmedReaction],
    };
    let allowWrites = false;
    const lateReactionRef: { current: typeof nextReaction | null } = { current: null };
    let serverDocument = historyReadyView;
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((_input, init) => {
      if (init?.method === "GET") {
        return Promise.resolve(
          new Response(JSON.stringify(serverDocument), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (typeof init?.body !== "string") throw new Error("reaction body is required");
      const body = JSON.parse(init.body) as {
        reaction: typeof nextReaction;
        baseReactionVersion: number;
      };
      if (!allowWrites) {
        lateReactionRef.current = body.reaction;
        return new Promise<Response>(() => undefined);
      }
      if (body.baseReactionVersion >= serverDocument.reactionVersion) {
        serverDocument = {
          ...serverDocument,
          version: serverDocument.version + 1,
          reactionVersion: serverDocument.reactionVersion + 1,
          reaction: body.reaction,
          reactionHistory: [...(serverDocument.reactionHistory ?? []), body.reaction],
        };
      }
      return Promise.resolve(
        new Response(JSON.stringify(serverDocument), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    useResearchRouteStore.getState().setCurrentView(historyReadyView, "old-execution");

    await act(async () => {
      root?.render(<GapNetworkView document={historyReadyView} />);
      await Promise.resolve();
    });
    const oldGapButton = Array.from(firstContainer.querySelectorAll("button")).find(
      (button) => button.textContent === "gap",
    );
    if (!oldGapButton) throw new Error("gap button is required");
    await act(async () => {
      oldGapButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(7);

    act(() => {
      root?.unmount();
    });
    root = null;
    if (!lateReactionRef.current) throw new Error("late old-execution reaction is required");
    serverDocument = {
      ...historyReadyView,
      version: 2,
      reactionVersion: 2,
      reaction: lateReactionRef.current,
      reactionHistory: [confirmedReaction, lateReactionRef.current],
    };
    useResearchRouteStore.getState().setCurrentView(historyReadyView, "new-execution");
    allowWrites = true;
    const secondContainer = document.createElement("div");
    root = createRoot(secondContainer);
    await act(async () => {
      root?.render(<GapNetworkView document={historyReadyView} />);
      await Promise.resolve();
    });
    const newClusterButton = Array.from(secondContainer.querySelectorAll("button")).find(
      (button) => button.textContent === "cluster",
    );
    if (!newClusterButton) throw new Error("cluster button is required");
    await act(async () => {
      newClusterButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    const firstNewExecutionRequestBody = fetchMock.mock.calls[7]?.[1]?.body;
    const rebasedNewExecutionRequestBody = fetchMock.mock.calls[8]?.[1]?.body;
    if (
      typeof firstNewExecutionRequestBody !== "string" ||
      typeof rebasedNewExecutionRequestBody !== "string"
    ) {
      throw new Error("new execution reaction request bodies are required");
    }
    const firstNewExecutionBody = JSON.parse(firstNewExecutionRequestBody) as {
      reaction: typeof nextReaction;
      baseReactionVersion: number;
    };
    const rebasedNewExecutionBody = JSON.parse(rebasedNewExecutionRequestBody) as {
      reaction: typeof nextReaction;
      baseReactionVersion: number;
    };
    expect(firstNewExecutionBody).toMatchObject({
      reaction: { id: nextReaction.id },
      baseReactionVersion: 1,
    });
    expect(rebasedNewExecutionBody).toMatchObject({
      reaction: { id: nextReaction.id },
      baseReactionVersion: 2,
    });
    expect(rebasedNewExecutionBody.reaction.timestamp).toBe(
      firstNewExecutionBody.reaction.timestamp,
    );
    expect(fetchMock).toHaveBeenCalledTimes(9);
    expect(useResearchRouteStore.getState()).toMatchObject({
      currentView: { reactionVersion: 3, reaction: { id: nextReaction.id } },
      routeAiComment: { id: nextReaction.id },
    });
  });
});
