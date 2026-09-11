import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchRouteRuntime } from "@/app/components/research/ResearchRouteRuntime";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

// @promise promise:search-query-route-transition
// @aspect aspect:search-first-url-model
// @check acceptance-check:search-query-route-transition-route-owned-render
//
// route 전환 직후의 첫 렌더 프레임을 포함해, 이 route가 주입하지 않은 view가
// renderer에 도달하지 않고, route가 끝나면 store 뷰도 함께 끝남을 잠근다.
// 회귀 사례: /similar의 graph_neighbors 문서가 store에 남은 채 /search?q=로
// 전환하면 SearchView가 query 없는 metadata를 받아 crash했다.

const layoutRenderedDocumentIds: Array<string | null> = [];

vi.mock("@/app/components/research/ResearchRouteLayout", () => ({
  ResearchRouteLayout: (props: { currentView?: ResearchRoutePayload | null }) => {
    layoutRenderedDocumentIds.push(props.currentView?.id ?? null);
    return <div data-testid="research-route-layout" />;
  },
}));

vi.mock("@/app/lib/track", () => ({
  track: () => undefined,
}));

function createSearchRouteDocument(): ResearchRoutePayload {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-ephemeral-route-owned",
    type: "search",
    title: "검색: route ownership",
    content: "",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "owner-1",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z",
    metadata: {
      type: "search",
      query: "route ownership",
      total: 1,
      papers: [
        {
          paperId: "paper-1",
          title: "Route Ownership",
          abstract: "abstract",
          year: 2025,
          citationCount: 1,
          url: "https://example.com/paper-1",
          authors: [{ name: "Author" }],
        },
      ],
    },
    reaction: null,
  };
}

function createForeignGraphNeighborsView(): ResearchRoutePayload {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "graph-foreign-1",
    type: "graph_neighbors",
    title: "비슷한 논문: Foreign",
    content: "",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "owner-1",
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z",
    metadata: {
      type: "graph_neighbors",
      seedPaper: {
        paperId: "seed-1",
        title: "Foreign Seed",
        abstract: "seed abstract",
        year: 2020,
        citationCount: 10,
        url: "https://example.com/seed-1",
        authors: [{ name: "Seed Author" }],
        openAccessPdf: null,
        doi: null,
      },
      papers: [],
      total: 0,
      coCited: [],
      coupled: [],
    },
    reaction: null,
  };
}

let root: Root | null = null;

function renderRuntime(options: {
  initialView?: ResearchRoutePayload;
  initialSearchEntry?: boolean;
}) {
  const container = document.createElement("div");
  root = createRoot(container);
  act(() => {
    root?.render(
      <ResearchRouteRuntime
        renderViewBody={() => null}
        runtimeId="owner-1"
        initialView={options.initialView}
        initialSearchEntry={options.initialSearchEntry ?? false}
      />,
    );
  });
}

describe("ResearchRouteRuntime route-owned rendering", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    layoutRenderedDocumentIds.length = 0;
    useReactionActionStore.getState().unregisterSendMessage();
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))),
    );
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  });

  it("never renders another route's store document, including the first frame", () => {
    const foreignDocument = createForeignGraphNeighborsView();
    const routeDocument = createSearchRouteDocument();

    act(() => {
      useResearchRouteStore.getState().setCurrentView(foreignDocument, "test-execution:148");
    });

    renderRuntime({ initialView: routeDocument });

    expect(layoutRenderedDocumentIds).not.toContain(foreignDocument.id);
    expect(layoutRenderedDocumentIds.at(-1)).toBe(routeDocument.id);
    expect(useResearchRouteStore.getState().currentView?.id).toBe(routeDocument.id);
  });

  it("renders the route-owned initial search entry instead of a foreign store document", () => {
    const foreignDocument = createForeignGraphNeighborsView();

    act(() => {
      useResearchRouteStore.getState().setCurrentView(foreignDocument, "test-execution:162");
    });

    renderRuntime({ initialSearchEntry: true });

    expect(layoutRenderedDocumentIds).not.toContain(foreignDocument.id);
    expect(layoutRenderedDocumentIds.at(-1)).toBeNull();
    expect(useResearchRouteStore.getState().currentView).toBeNull();
  });

  it("clears the store view when the route unmounts", () => {
    const routeDocument = createSearchRouteDocument();

    renderRuntime({ initialView: routeDocument });
    expect(useResearchRouteStore.getState().currentView?.id).toBe(routeDocument.id);

    act(() => {
      root?.unmount();
    });
    root = null;

    expect(useResearchRouteStore.getState().currentView).toBeNull();
  });
});
