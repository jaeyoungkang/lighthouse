import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { ResearchRouteLayout } from "@/app/components/research/ResearchRouteLayout";
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

vi.mock("@/app/components/research-route-renderers/CitationLineageView", () => ({
  CitationLineageView: ({
    document,
    reactionSlot,
  }: {
    document: { id: string; title: string };
    reactionSlot?: ReactNode;
  }) => (
    <>
      <div data-testid={`citation-seed-${document.id}`}>{document.title}</div>
      {reactionSlot}
      <div data-testid={`citation-view-${document.id}`}>{document.title}</div>
    </>
  ),
}));

vi.mock("@/app/components/research-route-renderers/GraphNeighborsView", () => ({
  GraphNeighborsView: ({
    document,
    reactionSlot,
  }: {
    document: { id: string; title: string };
    reactionSlot?: ReactNode;
  }) => (
    <>
      <div data-testid={`graph-neighbors-seed-${document.id}`}>{document.title}</div>
      {reactionSlot}
      <div data-testid={`graph-neighbors-document-${document.id}`}>{document.title}</div>
    </>
  ),
}));

vi.mock("@/app/components/research/AgentPanel", () => ({
  AgentPanel: ({ documentId }: { documentId: string }) => (
    <div data-testid={`agent-panel-${documentId}`}>agent for {documentId}</div>
  ),
}));

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

function installMatchMedia(matches: boolean) {
  const mql: MediaQueryList = {
    matches,
    media: "(max-width: 1023px)",
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  };

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue(mql),
  });
}

function createSearchView(
  overrides?: Partial<Extract<ResearchRoutePayload, { type: "search" }>>,
): ResearchRoutePayload {
  const now = "2026-05-03T00:00:00.000Z";
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

function createCitationLineageView(
  overrides?: Partial<Extract<ResearchRoutePayload, { type: "citation_lineage" }>>,
): ResearchRoutePayload {
  const now = "2026-05-03T00:00:00.000Z";
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "citation-1",
    type: "citation_lineage",
    title: "인용 관계: 한 논문",
    content: "",
    createdBy: "agent",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: now,
    updatedAt: now,
    reaction: null,
    metadata: {
      type: "citation_lineage",
      seedPaper: {
        paperId: "paper-1",
        title: "한 논문",
        abstract: "abstract",
        year: 2024,
        citationCount: 5,
        url: "https://example.com/paper-1",
        authors: [{ name: "Alice" }],
      },
      referenceIds: [],
      citationIds: [],
      papers: [],
      total: 0,
    },
    ...overrides,
  };
}

async function flushDynamicRender() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderLayout() {
  const container = document.createElement("div");
  root = createRoot(container);
  act(() => {
    root?.render(
      <ResearchRouteLayout
        currentView={useResearchRouteStore.getState().currentView}
        renderViewBody={renderViewBody}
      />,
    );
  });
  await flushDynamicRender();
  return container;
}

function renderViewBody(view: ResearchRoutePayload, reactionSlot: ReactNode) {
  if (view.type === "citation_lineage") {
    return (
      <>
        <div data-testid={`citation-seed-${view.id}`}>{view.title}</div>
        {reactionSlot}
        <div data-testid={`citation-view-${view.id}`}>{view.title}</div>
      </>
    );
  }

  if (view.type === "graph_neighbors") {
    return (
      <>
        <div data-testid={`graph-neighbors-seed-${view.id}`}>{view.title}</div>
        {reactionSlot}
        <div data-testid={`graph-neighbors-document-${view.id}`}>{view.title}</div>
      </>
    );
  }

  return (
    <>
      {reactionSlot}
      <div data-testid={`${view.type}-document-${view.id}`}>{view.title}</div>
    </>
  );
}

function installReaction(documentId: string) {
  useResearchRouteStore.getState().setRouteAiComment(
    documentId,
    {
      id: `${documentId}-reaction`,
      title: "AI 반응",
      body: "문서 보조 설명",
      chips: [],
      timestamp: "2026-05-03T00:01:00.000Z",
    },
    useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
  );
}

describe("ResearchRouteLayout — aspect:document-content-width-governance", () => {
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
    vi.restoreAllMocks();
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  });

  it("keeps route AI comments inline on narrow viewports", async () => {
    installMatchMedia(true);
    const doc = createSearchView();
    useResearchRouteStore.getState().setCurrentView(doc, "test-layout-execution");
    installReaction(doc.id);

    const container = await renderLayout();

    expect(container.querySelector('[data-testid="document-panel-layout"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="document-panel-aside"]')).toBeNull();
    const panelLayout = container.querySelector('[data-testid="document-panel-layout"]');
    const mainPanel = container.querySelector('[data-testid="document-panel-main"]');
    const inline = container.querySelector('[data-testid="research-route-inline-reaction"]');
    expect(panelLayout?.getAttribute("data-narrow")).toBeNull();
    expect(panelLayout?.getAttribute("data-scroll-containment")).toBeNull();
    expect(container.querySelector('[data-testid="document-panel-agent-overlay"]')).toBeNull();
    expect(mainPanel?.className).not.toContain("overflow-y-auto");
    expect(inline).not.toBeNull();
    expect(inline ? mainPanel?.contains(inline) : false).toBe(true);
    expect(mainPanel?.parentElement).toBe(panelLayout);
    expect(inline?.querySelector(`[data-testid="agent-panel-${doc.id}"]`)).not.toBeNull();
  });

  it("keeps relationship route AI comments inline below the seed context on narrow viewports", async () => {
    installMatchMedia(true);
    const citation = createCitationLineageView();
    useResearchRouteStore.getState().setCurrentView(citation, "test-layout-execution");
    installReaction(citation.id);

    const container = await renderLayout();

    const mainPanel = container.querySelector('[data-testid="document-panel-main"]');
    const inline = container.querySelector('[data-testid="research-route-inline-reaction"]');
    const seedContext = container.querySelector('[data-testid="citation-seed-citation-1"]');
    const citationBody = container.querySelector('[data-testid="citation-view-citation-1"]');
    expect(container.querySelector('[data-testid="document-panel-agent-overlay"]')).toBeNull();
    expect(inline).not.toBeNull();
    expect(inline ? mainPanel?.contains(inline) : false).toBe(true);
    expect(seedContext?.compareDocumentPosition(inline as Node) ?? 0).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(inline?.compareDocumentPosition(citationBody as Node) ?? 0).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("keeps route AI comments inline on wide viewports", async () => {
    installMatchMedia(false);
    const doc = createSearchView();
    useResearchRouteStore.getState().setCurrentView(doc, "test-layout-execution");
    installReaction(doc.id);

    const container = await renderLayout();

    expect(
      container.querySelector('[data-testid="research-route-inline-reaction"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="document-panel-aside"]')).toBeNull();
    expect(container.querySelector('[data-testid="document-panel-agent-overlay"]')).toBeNull();
    expect(
      container
        .querySelector('[data-testid="research-route-inline-reaction"]')
        ?.querySelector(`[data-testid="agent-panel-${doc.id}"]`),
    ).not.toBeNull();
  });

  it.each([["search results", () => createSearchView()]])(
    "keeps route AI comments inline when the %s panel is narrow",
    async (_label, createDocument) => {
      installMatchMedia(false);
      const doc = createDocument();
      useResearchRouteStore.getState().setCurrentView(doc, "test-layout-execution");
      installReaction(doc.id);

      const container = await renderLayout();

      const panelLayout = container.querySelector('[data-testid="document-panel-layout"]');
      expect(panelLayout?.getAttribute("data-panel-width-mode")).toBe("inline");
      expect(panelLayout?.getAttribute("data-scroll-containment")).toBeNull();
      expect(container.querySelector('[data-testid="document-panel-aside"]')).toBeNull();
      const mainPanel = container.querySelector('[data-testid="document-panel-main"]');
      const inline = container.querySelector('[data-testid="research-route-inline-reaction"]');
      expect(container.querySelector('[data-testid="document-panel-agent-overlay"]')).toBeNull();
      expect(inline).not.toBeNull();
      expect(mainPanel?.className).not.toContain("overflow-y-auto");
      expect(inline ? mainPanel?.contains(inline) : false).toBe(true);
      expect(mainPanel?.parentElement).toBe(panelLayout);
      expect(inline?.querySelector(`[data-testid="agent-panel-${doc.id}"]`)).not.toBeNull();
    },
  );
});
