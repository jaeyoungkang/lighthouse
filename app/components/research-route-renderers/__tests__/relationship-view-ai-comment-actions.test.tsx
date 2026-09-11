import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CitationLineageView } from "@/app/components/research-route-renderers/CitationLineageView";
import { GraphNeighborsView } from "@/app/components/research-route-renderers/GraphNeighborsView";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

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

function paper(overrides: Partial<PaperCore> = {}): PaperCore {
  return {
    paperId: "paper-1",
    title: "The AI Scientist-v2",
    abstract: null,
    year: 2025,
    citationCount: 142,
    url: "https://example.com/paper-1",
    authors: [{ name: "Yutaro Yamada" }],
    openAccessPdf: null,
    doi: null,
    ...overrides,
  };
}

function createCitationLineageView(): ResearchRoutePayload {
  const sourcePaper = paper({ paperId: "ref-1", title: "Agent Laboratory" });
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "citation-1",
    type: "citation_lineage",
    title: "인용 계보: The AI Scientist-v2",
    content: "citation lineage content",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-06-23T00:00:00.000Z",
    updatedAt: "2026-06-23T00:00:00.000Z",
    metadata: {
      type: "citation_lineage",
      seedPaper: paper({ paperId: "seed-1" }),
      referenceIds: [sourcePaper.paperId],
      citationIds: [],
      papers: [sourcePaper],
      total: 1,
    },
    reaction: null,
  };
}

function createGraphNeighborsView(): ResearchRoutePayload {
  const neighborPaper = paper({ paperId: "cc-1", title: "Graph Attention Networks" });
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "graph-1",
    type: "graph_neighbors",
    title: "비슷한 논문: The AI Scientist-v2",
    content: "graph neighbors content",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-06-23T00:00:00.000Z",
    updatedAt: "2026-06-23T00:00:00.000Z",
    metadata: {
      type: "graph_neighbors",
      seedPaper: paper({ paperId: "seed-1" }),
      papers: [neighborPaper],
      total: 1,
      coCited: [{ shared: 49, paper: neighborPaper }],
      coupled: [],
    },
    reaction: null,
  };
}

function createDetachedWindowMock() {
  return {
    close: vi.fn(),
    location: { assign: vi.fn() },
    opener: window,
  } as unknown as Window & {
    location: { assign: ReturnType<typeof vi.fn> };
  };
}

beforeEach(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
  useReactionActionStore.getState().registerSendMessage(vi.fn());
  mockPush.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ gapReportId: "gap-report-1", status: "pending" }), {
          status: 202,
        }),
      ),
    ),
  );
  vi.spyOn(window, "open").mockReturnValue(createDetachedWindowMock());
  Object.defineProperty(globalThis.navigator, "sendBeacon", {
    configurable: true,
    value: vi.fn(() => true),
  });
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
  useReactionActionStore.getState().unregisterSendMessage();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("relationship ResearchRoutePayload inline AI comment actions", () => {
  it("shows the owned research-gap map action above the citation-lineage AI comment frame", async () => {
    const doc = createCitationLineageView();
    const container = document.createElement("div");
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(doc, "test-execution:144");

    await act(async () => {
      root?.render(
        <CitationLineageView
          document={doc}
          reactionSlot={<div data-testid="mock-reaction-slot">인용 관계 comment</div>}
        />,
      );
      await Promise.resolve();
    });

    const frame = container.querySelector('[data-testid="relationship-view-ai-comment-frame"]');
    const action = container.querySelector<HTMLButtonElement>(
      '[data-testid="relationship-view-gap-network-action"]',
    );
    if (!frame || !action) throw new Error("citation-lineage gap action fixture missing");
    expect(frame.contains(action)).toBe(false);
    expect(action.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(action.textContent).toContain("현재 논문 묶음의 관계를 분석하여 연구 공백 찾아보기 >");

    await act(async () => {
      action.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(window.open).toHaveBeenCalledWith("/gap?opening=1", "_blank");
    const detachedWindow = vi.mocked(window.open).mock.results[0]?.value as
      | (Window & {
          location: { assign: ReturnType<typeof vi.fn> };
        })
      | null;
    expect(detachedWindow?.location.assign).toHaveBeenCalledWith("/gap/gap-report-1");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows the owned research-gap map action above the graph-neighbor AI comment frame", async () => {
    const doc = createGraphNeighborsView();
    const container = document.createElement("div");
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(doc, "test-execution:187");

    await act(async () => {
      root?.render(
        <GraphNeighborsView
          document={doc}
          reactionSlot={<div data-testid="mock-reaction-slot">비슷한 논문 comment</div>}
        />,
      );
      await Promise.resolve();
    });

    const frame = container.querySelector('[data-testid="relationship-view-ai-comment-frame"]');
    const action = container.querySelector<HTMLButtonElement>(
      '[data-testid="relationship-view-gap-network-action"]',
    );
    if (!frame || !action) throw new Error("graph-neighbor gap action fixture missing");
    expect(frame.contains(action)).toBe(false);
    expect(action.compareDocumentPosition(frame) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(action.textContent).toContain("현재 논문 묶음의 관계를 분석하여 연구 공백 찾아보기 >");

    await act(async () => {
      action.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(window.open).toHaveBeenCalledWith("/gap?opening=1", "_blank");
    const detachedWindow = vi.mocked(window.open).mock.results[0]?.value as
      | (Window & {
          location: { assign: ReturnType<typeof vi.fn> };
        })
      | null;
    expect(detachedWindow?.location.assign).toHaveBeenCalledWith("/gap/gap-report-1");
    expect(fetch).toHaveBeenCalled();
    const gapReportFetchCall = vi
      .mocked(fetch)
      .mock.calls.find(([input]) => input === "/api/gap-reports");
    const requestBody = gapReportFetchCall?.[1]?.body;
    if (typeof requestBody !== "string")
      throw new Error("expected graph-neighbor gap request body");
    expect(requestBody).toContain('"graphSupport"');
    const body = JSON.parse(requestBody) as {
      graphSupport?: SearchMetadata["graphSupport"];
    };
    expect(body.graphSupport).toMatchObject({
      status: "ready",
      samplePaperIds: ["cc-1"],
      paperScores: {
        "cc-1": {
          sharedCiters: 49,
          sharedRefs: null,
          sources: ["__gap_source_1"],
        },
      },
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
