import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CitationLineageMetadata,
  ResearchRoutePayload,
} from "@/app/domain/research-route-payload";
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
      {reactionSlot}
      <div data-testid={`citation-view-${document.id}`}>{document.title}</div>
    </>
  ),
}));

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

function createSearchView() {
  return {
    status: "ready" as const,
    version: 0,
    reactionVersion: 0,
    id: "search-1",
    type: "search" as const,
    title: "검색: AI for Science",
    content: "search content",
    createdBy: "user" as const,
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt: "2026-04-09T00:00:00.000Z",
    metadata: {
      type: "search" as const,
      query: "AI for Science",
      total: 1,
      papers: [],
    },
    reaction: null,
  };
}

function createCompletedSearchView() {
  const document = createSearchView();
  return {
    ...document,
    metadata: {
      ...document.metadata,
      papers: [
        {
          paperId: "paper-1",
          title: "The AI Scientist",
          abstract: "abstract",
          year: 2024,
          citationCount: 12,
          url: "https://example.com/paper-1",
          authors: [{ name: "Alice" }],
        },
      ],
      total: 1,
    },
  };
}

function createGapNetworkView() {
  return {
    status: "ready" as const,
    version: 0,
    reactionVersion: 0,
    id: "gap-1",
    type: "gap_network" as const,
    title: "연구 공백: AI for Science",
    content: "gap content",
    createdBy: "agent" as const,
    refs: [],
    viewerPrincipalId: "principal-1",
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt: "2026-04-09T00:00:00.000Z",
    metadata: {
      type: "gap_network" as const,
      version: 1 as const,
      query: "AI for Science",
      sourceSnapshotId: "search-1",
      papers: [],
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
    reaction: null,
  };
}

function createCitationLineageView(): ResearchRoutePayload & { metadata: CitationLineageMetadata } {
  const seedPaper = {
    paperId: "paper-1",
    title: "The AI Scientist",
    abstract: "abstract",
    year: 2024,
    citationCount: 12,
    url: "https://example.com/paper-1",
    authors: [{ name: "Alice" }],
  };
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "citation-1",
    type: "citation_lineage",
    title: "인용 관계: The AI Scientist",
    content: "citation content",
    createdBy: "agent",
    refs: ["search-1"],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt: "2026-04-09T00:00:00.000Z",
    metadata: {
      type: "citation_lineage",
      seedPaper,
      referenceIds: ["ref-1"],
      citationIds: [],
      papers: [{ ...seedPaper, paperId: "ref-1", title: "Reference Work" }],
      total: 1,
    },
    reaction: null,
  };
}

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

async function flushDynamicRender() {
  await act(async () => {
    await Promise.resolve();
  });
}

function renderTestDocumentBody(document: ResearchRoutePayload, reactionSlot: ReactNode) {
  if (document.type === "gap_network") {
    return <div data-testid={`gap-view-${document.id}`}>{document.title}</div>;
  }
  const prefix = document.type === "citation_lineage" ? "citation-view" : "search-view";
  return (
    <>
      {reactionSlot}
      <div data-testid={`${prefix}-${document.id}`}>{document.title}</div>
    </>
  );
}

function renderLayoutBeforeDynamicFlush() {
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

  return container;
}

async function renderLayout() {
  const container = renderLayoutBeforeDynamicFlush();
  await flushDynamicRender();

  return container;
}

describe("ResearchRouteLayout reaction visibility", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    installMatchMedia(false);
    if (!("scrollIntoView" in HTMLElement.prototype)) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        writable: true,
        value: vi.fn(),
      });
    }
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    const searchDocument = createSearchView();
    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-layout-execution");
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  });

  it("keeps the pending AI comment visible while the route renderer chunk is loading", async () => {
    const searchDocument = createCompletedSearchView();
    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-layout-execution");
    act(() => {
      useResearchRouteStore
        .getState()
        .markRouteAiCommentGenerationPending(
          searchDocument.id,
          useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
        );
    });

    const container = renderLayoutBeforeDynamicFlush();

    expect(
      container.querySelector('[data-testid="research-route-inline-reaction"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="agent-panel-inline-pending"]')).not.toBeNull();
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(container.textContent).toContain("AI comment를 생성하고 있습니다.");

    await flushDynamicRender();
  });

  it("renders only the current route panel reaction as a child of that panel", async () => {
    useResearchRouteStore.getState().setRouteAiComment(
      "search-1",
      {
        id: "search-reaction-1",
        title: "검색 반응",
        body: "검색 패널 하위에만 붙어야 한다",
        chips: [],
        timestamp: "2026-04-09T00:01:00.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    const container = await renderLayout();

    expect(container.textContent).toContain("검색: AI for Science");
    expect(container.textContent).not.toContain("검색 반응");

    act(() => {});
    await flushDynamicRender();

    expect(container.textContent).toContain("검색 패널 하위에만 붙어야 한다");
  });

  it("does not reserve the inline reaction surface before a block or loading state exists", async () => {
    const container = await renderLayout();

    expect(container.textContent).toContain("검색: AI for Science");
    expect(container.textContent).not.toContain("AI 반응 대기 중");
    expect(container.querySelector('[data-testid="research-route-inline-reaction"]')).toBeNull();
    expect(container.querySelector('[data-testid="document-panel-aside"]')).toBeNull();
    expect(container.querySelector('[data-testid="document-panel-agent-overlay"]')).toBeNull();
    expect(container.textContent).not.toContain("Light House");
    expect(container.textContent).not.toContain("이 view의 AI comment는 항상 이 영역에 표시된다.");
  });

  it("shows a pending inline reaction for automatic generation before content arrives", async () => {
    const searchDocument = createCompletedSearchView();
    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-layout-execution");
    act(() => {
      useResearchRouteStore
        .getState()
        .markRouteAiCommentGenerationPending(
          searchDocument.id,
          useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
        );
    });

    const container = await renderLayout();

    expect(
      container.querySelector('[data-testid="research-route-inline-reaction"]'),
    ).not.toBeNull();
    const pending = container.querySelector('[data-testid="agent-panel-inline-pending"]');
    expect(pending).not.toBeNull();
    expect(pending?.getAttribute("role")).toBe("status");
    expect(pending?.getAttribute("data-state")).toBe("loading");
    expect(container.textContent).toContain("AI comment를 생성하고 있습니다.");
  });

  it("shows a pending inline reaction for a queued citation-lineage ResearchRoutePayload", async () => {
    const citationDocument = createCitationLineageView();
    useResearchRouteStore.getState().setCurrentView(citationDocument, "test-layout-execution");
    act(() => {
      useResearchRouteStore
        .getState()
        .markRouteAiCommentGenerationPending(
          citationDocument.id,
          useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
        );
    });

    const container = await renderLayout();

    expect(container.querySelector('[data-testid="citation-view-citation-1"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="research-route-inline-reaction"]'),
    ).not.toBeNull();
    const pending = container.querySelector('[data-testid="agent-panel-inline-pending"]');
    expect(pending).not.toBeNull();
    expect(pending?.getAttribute("role")).toBe("status");
    expect(pending?.getAttribute("data-state")).toBe("loading");
    expect(container.textContent).toContain("AI comment를 생성하고 있습니다.");
  });

  it("shows a pending inline reaction for explicit regeneration while preserving the settled card", async () => {
    const searchDocument = createCompletedSearchView();
    const existingReaction = {
      id: "search-existing-reaction",
      title: "기존 AI comment",
      body: "이미 생성된 코멘트입니다.",
      chips: [],
      timestamp: "2026-06-01T00:00:00.000Z",
    };
    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-layout-execution");
    act(() => {
      useResearchRouteStore
        .getState()
        .setRouteAiComment(
          searchDocument.id,
          existingReaction,
          useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
        );
      useResearchRouteStore
        .getState()
        .requestRouteAiCommentRegeneration(
          searchDocument.id,
          useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
        );
    });

    const container = await renderLayout();

    expect(
      container.querySelector('[data-testid="research-route-inline-reaction"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="agent-panel-regenerate-pending"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("다시 생성 중...");
    expect(container.textContent).toContain("이미 생성된 코멘트입니다.");
  });

  it("renders search reactions at the top of the main content", async () => {
    act(() => {
      useResearchRouteStore.getState().setRouteAiComment(
        "search-1",
        {
          id: "search-reaction-layout",
          title: "검색 반응",
          body: "검색 결과의 보조 설명",
          chips: [],
          timestamp: "2026-04-09T00:04:00.000Z",
        },
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );
    });

    const container = await renderLayout();
    const layout = container.querySelector('[data-testid="document-panel-layout"]');
    const main = container.querySelector('[data-testid="document-panel-main"]');
    const inline = container.querySelector('[data-testid="research-route-inline-reaction"]');
    const agent = inline?.querySelector('[data-testid="research-route-inline-reaction-content"]');
    const searchBody = container.querySelector('[data-testid="search-view-search-1"]');

    expect(layout?.className).toContain("lg:grid-cols-[minmax(0,1fr)]");
    expect(layout?.className).not.toContain("lg:grid-cols-[minmax(0,1fr)_32rem]");
    expect(layout?.className).toContain("mx-auto");
    expect(main?.className).not.toContain("lg:col-start-2");
    expect(container.querySelector('[data-testid="document-panel-aside"]')).toBeNull();
    expect(container.querySelector('[data-testid="document-panel-agent-overlay"]')).toBeNull();
    expect(inline).toBeTruthy();
    expect(agent).toBeTruthy();
    expect(agent?.textContent).not.toContain("AI COMMENT");
    expect(inline?.compareDocumentPosition(searchBody as Node) ?? 0).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("renders inline reaction text without chip-derived button surfaces", async () => {
    installMatchMedia(true);
    act(() => {
      useResearchRouteStore.getState().setRouteAiComment(
        "search-1",
        {
          id: "search-inline-surface",
          title: "검색 반응",
          body: "검색 inline 본문",
          chips: ["첫 번째 후속", "두 번째 후속"],
          timestamp: "2026-04-09T00:04:00.000Z",
        },
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );
    });

    const container = await renderLayout();

    const searchPanel = container.querySelector<HTMLElement>(
      '[data-testid="document-panel-layout"][data-doc-id="search-1"]',
    );
    const reactionCard = searchPanel?.querySelector<HTMLElement>(
      '[data-testid="agent-panel-reaction-card"]',
    );
    expect(reactionCard).not.toBeNull();
    expect(reactionCard?.getAttribute("data-layout")).toBe("inline");
    expect(searchPanel?.querySelector('[data-testid="document-panel-agent-overlay"]')).toBeNull();
    expect(searchPanel?.querySelector('[data-testid="agent-panel-overlay-toggle"]')).toBeNull();

    expect(searchPanel?.textContent).toContain("검색 inline 본문");
    expect(searchPanel?.textContent).not.toContain("첫 번째 후속");
    expect(searchPanel?.textContent).not.toContain("두 번째 후속");
    expect(
      Array.from(searchPanel?.querySelectorAll("button") ?? []).some((button) => {
        const buttonText = button.textContent;
        const ariaLabel = button.getAttribute("aria-label") ?? "";
        return (
          buttonText.includes("첫 번째 후속") ||
          ariaLabel.includes("첫 번째 후속") ||
          buttonText.includes("두 번째 후속") ||
          ariaLabel.includes("두 번째 후속")
        );
      }),
    ).toBe(false);
  });

  it("hides the inline reaction surface for gap ResearchRoutePayloads", async () => {
    const gapView = createGapNetworkView();
    useResearchRouteStore.getState().setCurrentView(gapView, "test-layout-execution");

    const container = await renderLayout();
    const layout = container.querySelector('[data-testid="document-panel-layout"]');
    const main = container.querySelector('[data-testid="document-panel-main"]');

    expect(container.textContent).toContain("연구 공백: AI for Science");
    expect(layout?.className).toContain("lg:grid-cols-[minmax(0,1fr)]");
    expect(layout?.className).not.toContain("lg:grid-cols-[minmax(0,1fr)_26rem]");
    expect(main?.className).not.toContain("lg:col-start-2");
    expect(container.querySelector('[data-testid="research-route-inline-reaction"]')).toBeNull();
    expect(container.querySelector('[data-testid="document-panel-aside"]')).toBeNull();
  });
});
