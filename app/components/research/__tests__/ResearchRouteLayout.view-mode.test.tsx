import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { ResearchRouteLayout } from "@/app/components/research/ResearchRouteLayout";
import {
  RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS,
  RESEARCH_ROUTE_ROUTE_PANEL_MAX_WIDTH_CLASS,
} from "@/app/components/research/research-route-layout.shared";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

vi.mock("@/app/components/research-route-renderers/SearchView", () => ({
  SearchView: ({
    document,
    reactionSlot,
  }: {
    document: { id: string; title: string };
    reactionSlot?: ReactNode;
  }) => (
    <>
      {reactionSlot}
      <div data-testid={`search-view-${document.id}`}>{document.title}</div>
    </>
  ),
}));

vi.mock("@/app/components/research-route-renderers/GapNetworkView", () => ({
  GapNetworkView: ({ document }: { document: { id: string; title: string } }) => (
    <div data-testid={`gap-view-${document.id}`}>{document.title}</div>
  ),
}));

vi.mock("@/app/components/research/AgentPanel", () => ({
  AgentPanel: ({ documentId, layout }: { documentId: string; layout?: string }) => (
    <div
      className="w-full max-w-full min-w-0 overflow-hidden"
      data-testid={`agent-panel-${documentId}`}
      data-layout={layout ?? "default"}
    >
      <article
        className="bg-surface-muted/80 w-full max-w-full min-w-0 overflow-hidden"
        data-testid="agent-panel-reaction-card"
        data-layout={layout ?? "default"}
      />
      agent for {documentId}
    </div>
  ),
}));

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

function createSearchView(
  overrides?: Partial<Extract<ResearchRoutePayload, { type: "search" }>>,
): ResearchRoutePayload {
  const now = "2026-04-11T00:00:00.000Z";
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-1",
    type: "search",
    title: "검색: AI for Science",
    content: "",
    createdBy: "user",
    metadata: { type: "search", query: "AI for Science", papers: [], total: 1 },
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: now,
    updatedAt: now,
    reaction: null,
    ...overrides,
  };
}

async function flushDynamicRender() {
  await act(async () => {
    await Promise.resolve();
  });
}

function renderTestDocumentBody(document: ResearchRoutePayload, reactionSlot: ReactNode) {
  const prefix = document.type === "gap_network" ? "gap-view" : "search-view";
  return (
    <>
      {reactionSlot}
      <div data-testid={`${prefix}-${document.id}`}>{document.title}</div>
    </>
  );
}

async function renderLayout() {
  const container = document.createElement("div");
  root = createRoot(container);

  act(() => {
    root?.render(
      <ResearchRouteLayout
        currentView={useResearchRouteStore.getState().currentView}
        renderViewBody={renderTestDocumentBody}
      />,
    );
  });
  await flushDynamicRender();

  return container;
}

describe("ResearchRouteLayout single-document path", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    if (!("scrollIntoView" in HTMLElement.prototype)) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        writable: true,
        value: vi.fn(),
      });
    }
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  });

  it("renders only the current route panel and never the retired desktop scroller or add-page button", async () => {
    const search = createSearchView();
    useResearchRouteStore.getState().setCurrentView(search, "test-layout-execution");

    const container = await renderLayout();

    expect(container.querySelectorAll('[data-testid="document-panel-layout"]')).toHaveLength(1);
    expect(container.textContent).toContain("검색: AI for Science");
  });

  it("replaces the rendered document when currentView changes", async () => {
    const search = createSearchView();
    const nextSearch = createSearchView({
      id: "search-2",
      title: "검색: The AI Scientist",
    });
    useResearchRouteStore.getState().setCurrentView(search, "test-layout-execution");

    const container = await renderLayout();
    const initialNode = container.querySelector('[data-testid="search-view-search-1"]');

    expect(initialNode).not.toBeNull();

    act(() => {
      useResearchRouteStore.getState().setCurrentView(nextSearch, "test-execution:156");
      root?.render(
        <ResearchRouteLayout currentView={nextSearch} renderViewBody={renderTestDocumentBody} />,
      );
    });
    await flushDynamicRender();

    expect(container.querySelector('[data-testid="search-view-search-1"]')).toBeNull();
    expect(container.querySelector('[data-testid="search-view-search-2"]')).not.toBeNull();
  });

  it("centers the bounded panel rail for initial and later content", async () => {
    const initialSearch = createSearchView({
      id: "search-initial",
      title: "논문 검색",
      metadata: { type: "search", query: "", papers: [], total: 0 },
    });
    useResearchRouteStore.getState().setCurrentView(initialSearch, "test-layout-execution");

    const container = await renderLayout();
    const initialLayout = container.querySelector('[data-testid="document-panel-layout"]');
    expect(initialLayout?.className).toContain("mx-auto");

    act(() => {});
    await flushDynamicRender();

    const completedLayout = container.querySelector('[data-testid="document-panel-layout"]');
    expect(completedLayout?.className).toContain("mx-auto");
    expect(completedLayout?.className).toContain(RESEARCH_ROUTE_ROUTE_PANEL_MAX_WIDTH_CLASS);
  });

  it("keeps the same post-search panel width before and after an AI comment appears", async () => {
    const search = createSearchView();
    useResearchRouteStore.getState().setCurrentView(search, "test-layout-execution");

    const container = await renderLayout();
    const beforeReactionLayout = container.querySelector('[data-testid="document-panel-layout"]');
    expect(beforeReactionLayout?.className).toContain(RESEARCH_ROUTE_ROUTE_PANEL_MAX_WIDTH_CLASS);

    act(() => {
      useResearchRouteStore.getState().setRouteAiComment(
        search.id,
        {
          id: "search-reaction-width",
          title: "검색 반응",
          body: "검색 결과의 흐름을 설명하는 긴 AI comment 본문",
          chips: [],
          timestamp: "2026-06-23T00:00:00.000Z",
        },
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );
    });
    await flushDynamicRender();

    const afterReactionLayout = container.querySelector('[data-testid="document-panel-layout"]');
    const reactionCard = container.querySelector('[data-testid="agent-panel-reaction-card"]');
    expect(afterReactionLayout?.className).toContain(RESEARCH_ROUTE_ROUTE_PANEL_MAX_WIDTH_CLASS);
    expect(afterReactionLayout?.className).toBe(beforeReactionLayout?.className);
    expect(reactionCard?.className).toContain("w-full");
    expect(reactionCard?.className).toContain("max-w-full");
    expect(reactionCard?.className).toContain("overflow-hidden");
  });

  it("does not add a second horizontal padding rail inside post-search content", async () => {
    const search = createSearchView();
    useResearchRouteStore.getState().setCurrentView(search, "test-layout-execution");

    const container = await renderLayout();
    const main = container.querySelector('[data-testid="document-panel-main"]');

    expect(main?.innerHTML).toContain("검색: AI for Science");
    expect(container.innerHTML).not.toContain("px-5");
    expect(RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS).toContain("mx-auto");
    expect(RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS).not.toContain("max-w-[1060px]");
    expect(RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS).not.toContain("max-w-none");
    expect(RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS).not.toContain("px-");
  });
});
