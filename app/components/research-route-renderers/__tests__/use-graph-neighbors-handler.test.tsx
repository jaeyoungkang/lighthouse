import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";
import { useGraphNeighborsHandler } from "@/app/components/research-route-renderers/use-graph-neighbors-handler";
import { buildSimilarSeedPageRoute } from "@/app/lib/api-routes";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import type { FollowupActivationEvent } from "@/app/components/research-route-renderers/search-view.helpers";

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

const SOURCE_DOCUMENT_ID = "search-source-1";

function nonAnalyticsFetchCalls(fetchMock: ReturnType<typeof vi.mocked<typeof fetch>>) {
  return fetchMock.mock.calls.filter(([url]) => url !== "/api/analytics-events");
}

function createSeedPaper(): PaperCore {
  return {
    paperId: "seed-1",
    title: "Attention Is All You Need",
    abstract: "seed abstract",
    year: 2017,
    citationCount: 1000,
    url: "https://sah.borca.ai/papers/seed-1",
    authors: [{ name: "Vaswani" }],
    openAccessPdf: null,
    doi: null,
  };
}

function similarSeedRoute(seedPaper: PaperCore): string {
  const result = buildSimilarSeedPageRoute(seedPaper);
  if (!result.ok) throw new Error("similar seed fixture must be valid");
  return result.route;
}

function createGraphNeighborsView(
  id: string,
  seedPaper: PaperCore,
  overrides: Partial<Extract<ResearchRoutePayload["metadata"], { type: "graph_neighbors" }>> = {},
): ResearchRoutePayload {
  const now = "2026-06-08T00:00:00.000Z";
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id,
    type: "graph_neighbors",
    title: `비슷한 논문: ${seedPaper.title}`,
    content: "",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: now,
    updatedAt: now,
    metadata: {
      type: "graph_neighbors",
      seedPaper,
      papers: [],
      total: 0,
      coCited: [],
      coupled: [],
      ...overrides,
    },
  };
}

interface HookHarnessParams {
  emitSystemEvent: (eventType: string, description: string, targetRoutePayloadId?: string) => void;
  onHandler: (
    handler: (
      paper: PaperCore,
      opts?: { forceRefetch?: boolean } | FollowupActivationEvent,
    ) => void,
  ) => void;
}

function HookHarness(props: HookHarnessParams) {
  const { handleOpenGraphNeighbors } = useGraphNeighborsHandler({
    sourceDocumentId: SOURCE_DOCUMENT_ID,
    emitSystemEvent: props.emitSystemEvent,
  });
  props.onHandler(handleOpenGraphNeighbors);
  return null;
}

function mountHandler(params: {
  emitSystemEvent: (eventType: string, description: string, targetRoutePayloadId?: string) => void;
}): (paper: PaperCore, opts?: { forceRefetch?: boolean } | FollowupActivationEvent) => void {
  let handler:
    | ((paper: PaperCore, opts?: { forceRefetch?: boolean } | FollowupActivationEvent) => void)
    | null = null;
  const container = document.createElement("div");
  root = createRoot(container);
  act(() => {
    root?.render(
      <HookHarness
        emitSystemEvent={params.emitSystemEvent}
        onHandler={(next) => {
          handler = next;
        }}
      />,
    );
  });
  expect(handler).not.toBeNull();
  return handler as unknown as (
    paper: PaperCore,
    opts?: { forceRefetch?: boolean } | FollowupActivationEvent,
  ) => void;
}

describe("useGraphNeighborsHandler immediate navigation", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    mockPush.mockClear();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  });

  it("navigates to the similar seed route and leaves execution to the destination", () => {
    const seedPaper = createSeedPaper();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const emitSystemEvent = vi.fn();
    const handler = mountHandler({ emitSystemEvent });

    act(() => {
      handler(seedPaper);
    });

    // 클릭 즉시 seed route로 이동한다. 생성/dedup/route AI comment generation은
    // 목적지 Search-first route가 소유하므로 클릭 핸들러는 fetch, origin
    // currentView merge, origin execution emit을 하지 않는다.
    expect(mockPush).toHaveBeenCalledWith(similarSeedRoute(seedPaper));
    expect(nonAnalyticsFetchCalls(vi.mocked(fetchMock))).toHaveLength(0);
    expect(emitSystemEvent).not.toHaveBeenCalled();
    expect(
      [useResearchRouteStore.getState().currentView].filter(Boolean) as NonNullable<
        ReturnType<typeof useResearchRouteStore.getState>["currentView"]
      >[],
    ).toHaveLength(0);
  });

  it("navigates to the seed route even when a doc for the same seed already exists", () => {
    const seedPaper = createSeedPaper();
    const existingDoc = createGraphNeighborsView("graph-existing", seedPaper);
    useResearchRouteStore.setState({ currentView: existingDoc });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const emitSystemEvent = vi.fn();
    const handler = mountHandler({ emitSystemEvent });

    act(() => {
      handler(seedPaper);
    });

    // 클라이언트는 dedup하지 않고 seed route로 이동한다. 현재 tab state는 불변.
    expect(mockPush).toHaveBeenCalledWith(similarSeedRoute(seedPaper));
    expect(nonAnalyticsFetchCalls(vi.mocked(fetchMock))).toHaveLength(0);
    expect(emitSystemEvent).not.toHaveBeenCalled();
    expect(useResearchRouteStore.getState().currentView?.id ?? null).toBe("graph-existing");
  });

  it("opens the similar seed route in a new window for detached clicks", () => {
    const seedPaper = createSeedPaper();
    const openWindow = vi.fn();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("open", openWindow);

    const emitSystemEvent = vi.fn();
    const handler = mountHandler({ emitSystemEvent });

    act(() => {
      handler(seedPaper, { ctrlKey: true });
    });

    expect(openWindow).toHaveBeenCalledWith(
      similarSeedRoute(seedPaper),
      "_blank",
      "noopener,noreferrer",
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(
      [useResearchRouteStore.getState().currentView].filter(Boolean) as NonNullable<
        ReturnType<typeof useResearchRouteStore.getState>["currentView"]
      >[],
    ).toHaveLength(0);
    expect(useResearchRouteStore.getState().currentView?.id ?? null).toBeNull();
    expect(emitSystemEvent).not.toHaveBeenCalled();
    expect(nonAnalyticsFetchCalls(vi.mocked(fetchMock))).toHaveLength(0);
  });

  it("with forceRefetch re-runs the same seed route through route-owned replacement", () => {
    const seedPaper = createSeedPaper();
    const degradedDoc = createGraphNeighborsView("graph-degraded", seedPaper, {
      graphLoadFailed: true,
    });
    useResearchRouteStore.setState({ currentView: degradedDoc });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const emitSystemEvent = vi.fn();
    const handler = mountHandler({ emitSystemEvent });

    act(() => {
      handler(seedPaper, { forceRefetch: true });
    });

    expect(mockPush).toHaveBeenCalledWith(similarSeedRoute(seedPaper));
    expect(nonAnalyticsFetchCalls(vi.mocked(fetchMock))).toHaveLength(0);
    expect(useResearchRouteStore.getState().currentView?.id ?? null).toBe("graph-degraded");
    expect(emitSystemEvent).not.toHaveBeenCalled();
  });
});
