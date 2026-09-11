import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INLINE_ANALYSIS_VERSION, type AIAnalysis } from "@/app/domain/analysis";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import { CitationLineageView } from "@/app/components/research-route-renderers/CitationLineageView";
import { GraphNeighborsView } from "@/app/components/research-route-renderers/GraphNeighborsView";
import { SearchResultItem } from "@/app/components/research-route-renderers/search-result-item";
import { RESEARCH_ROUTE_BODY_RAIL_CLASS } from "@/app/components/research/research-route-layout.shared";
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

const analysis: AIAnalysis = {
  summary: "이 논문은 그래프 어텐션으로 이웃 정보를 가중 집계한다.",
  objective: "그래프 구조에서 노드 표현을 더 잘 학습한다.",
  methodology: "이웃 노드에 attention weight를 부여하는 message passing을 사용한다.",
  results: "여러 그래프 벤치마크에서 경쟁력 있는 성능을 보인다.",
  keywords: ["graph attention", "message passing"],
  semanticProfile: {
    claim: "그래프 어텐션으로 이웃 정보를 가중 집계한다.",
    topics: ["graph attention", "message passing"],
    method: "attention weight 기반 message passing",
    finding: "그래프 벤치마크에서 경쟁력 있는 성능",
    quotedBasis: {
      claim: "graph attention",
      topics: ["graph attention", "message passing"],
      method: "attention weight",
      finding: "benchmark performance",
    },
  },
  confidence: "high",
  evidenceMap: {},
};

function extractPaperCardSignature(container: ParentNode, paperId: string) {
  const card = container.querySelector(`[data-paper-id="${paperId}"]`);
  if (!card?.firstElementChild) {
    throw new Error(`expected paper card for ${paperId}`);
  }
  const panel = card.firstElementChild;
  const title = card.querySelector('[data-testid="search-result-title"]');
  const disclosure = card.querySelector('[data-testid="search-result-card-disclosure"]');
  const disclosureIcon = card.querySelector('[data-testid="search-result-card-disclosure-icon"]');
  const metadata = card.querySelector('[data-testid="search-result-metadata"]');
  const authors = card.querySelector('[data-testid="search-result-authors"]');
  const actions = card.querySelector('[data-testid="search-result-actions"]');
  if (!title || !metadata || !authors || !actions) {
    throw new Error(`expected complete paper card hierarchy for ${paperId}`);
  }
  const text = card.textContent;

  return {
    panelClass: panel.className,
    titleClass: title.className,
    titleTagName: title.tagName,
    titleHasExpandedState: title.hasAttribute("aria-expanded"),
    disclosureTagName: disclosure?.tagName,
    disclosureLabel: disclosure?.getAttribute("aria-label"),
    disclosureExpanded: disclosure?.getAttribute("aria-expanded"),
    hasDisclosureIcon: Boolean(disclosureIcon),
    metadataText: metadata.textContent,
    authorsText: authors.textContent,
    actionsText: actions.textContent,
    text,
    titleBeforeMetadata: text.indexOf(title.textContent) < text.indexOf(metadata.textContent),
    metadataBeforeAuthors: text.indexOf(metadata.textContent) < text.indexOf(authors.textContent),
    actionsBeforeAnalysis: text.indexOf(actions.textContent) < text.indexOf(analysis.summary),
  };
}

function renderSearchResultCard(paper: SearchMetadata["papers"][number]): HTMLDivElement {
  const container = document.createElement("div");
  const localRoot = createRoot(container);
  act(() => {
    localRoot.render(
      <SearchResultItem
        paper={paper}
        isLast
        analysisState="done"
        analysisResult={{ analysis, source: "abstract" }}
        isAnyPaperOpening={false}
        isOpening={false}
        onOpenCitationLineage={vi.fn()}
        onOpenGraphNeighbors={vi.fn()}
        onFindSimilar={vi.fn()}
      />,
    );
  });
  return container;
}

function createCitationLineageView(): ResearchRoutePayload {
  const now = "2026-04-13T00:00:00.000Z";
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "citation-1",
    type: "citation_lineage",
    title: "인용 계보: Attention Is All You Need",
    content: "citation lineage content",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: now,
    updatedAt: now,
    metadata: {
      type: "citation_lineage",
      seedPaper: {
        paperId: "seed-1",
        title: "Attention Is All You Need",
        abstract: "seed abstract",
        year: 2017,
        citationCount: 1000,
        url: "https://sah.borca.ai/papers/seed-1",
        authors: [{ name: "Vaswani" }],
      },
      referenceIds: [],
      citationIds: [],
      papers: [],
      total: 0,
    },
    reaction: null,
  };
}

function createGraphNeighborsView(): ResearchRoutePayload {
  const now = "2026-04-13T00:00:00.000Z";
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "graph-1",
    type: "graph_neighbors",
    title: "비슷한 논문: Attention Is All You Need",
    content: "graph neighbors content",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: now,
    updatedAt: now,
    metadata: {
      type: "graph_neighbors",
      seedPaper: {
        paperId: "seed-1",
        title: "Attention Is All You Need",
        abstract: "seed abstract",
        year: 2017,
        citationCount: 1000,
        url: "https://sah.borca.ai/papers/seed-1",
        authors: [{ name: "Vaswani" }],
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

async function render(doc: ResearchRoutePayload): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  root = createRoot(container);
  useResearchRouteStore.getState().setCurrentView(doc, "test-execution:184");
  await act(async () => {
    root?.render(<CitationLineageView document={doc} />);
    await Promise.resolve();
  });
  return container;
}

async function renderGraph(doc: ResearchRoutePayload): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  root = createRoot(container);
  useResearchRouteStore.getState().setCurrentView(doc, "test-execution:195");
  await act(async () => {
    root?.render(<GraphNeighborsView document={doc} />);
    await Promise.resolve();
  });
  return container;
}

beforeEach(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
  useReactionActionStore.getState().registerSendMessage(vi.fn());
  mockPush.mockClear();
  vi.stubGlobal("fetch", vi.fn());
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
});

describe("GraphNeighborsView graph neighbors", () => {
  it("places the AI comment below the graph-neighbor title context", async () => {
    const doc = createGraphNeighborsView();
    const container = document.createElement("div");
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(doc, "test-execution:233");

    await act(async () => {
      root?.render(
        <GraphNeighborsView
          document={doc}
          reactionSlot={<div data-testid="mock-reaction-slot">비슷한 논문 comment</div>}
        />,
      );
      await Promise.resolve();
    });

    const seedTitleCard = container.querySelector('[data-testid="relationship-seed-title-card"]');
    const reaction = container.querySelector('[data-testid="mock-reaction-slot"]');
    const rail = container.querySelector('[data-testid="graph-neighbors-content-rail"]');

    expect(rail?.className).toBe(RESEARCH_ROUTE_BODY_RAIL_CLASS);
    expect(rail?.className).not.toContain("px-5");
    expect(seedTitleCard).not.toBeNull();
    expect(reaction).not.toBeNull();
    expect(seedTitleCard?.compareDocumentPosition(reaction as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("renders co-cited and coupled graph-neighbor sections with adjacency-count signals", async () => {
    const doc = createGraphNeighborsView();
    if (doc.metadata.type !== "graph_neighbors") {
      throw new Error("expected graph_neighbors metadata");
    }
    doc.metadata.coCited = [
      {
        shared: 49,
        paper: {
          paperId: "cc-1",
          title: "Graph Attention Networks",
          abstract: null,
          year: 2017,
          citationCount: 25000,
          url: "https://example.com/cc-1",
          authors: [{ name: "Velickovic" }],
          openAccessPdf: null,
          doi: null,
          reviewed: false,
        },
      },
    ];
    doc.metadata.coupled = [
      {
        shared: 80,
        paper: {
          paperId: "cp-1",
          title: "Deep Learning on Graphs: A Survey",
          abstract: null,
          year: 2020,
          citationCount: 1200,
          url: "https://example.com/cp-1",
          authors: [{ name: "Zhang" }],
          openAccessPdf: null,
          doi: null,
          reviewed: false,
        },
      },
    ];
    doc.metadata.coCitedAvailability = {
      available: true,
      truncated: false,
      total: null,
      returned: 1,
      reason: null,
    };
    doc.metadata.coupledAvailability = {
      available: true,
      truncated: false,
      total: null,
      returned: 1,
      reason: null,
    };

    doc.metadata.papers = [doc.metadata.coCited[0]?.paper, doc.metadata.coupled[0]?.paper].filter(
      (paper): paper is NonNullable<typeof paper> => Boolean(paper),
    );
    doc.metadata.total = doc.metadata.papers.length;

    const container = await renderGraph(doc);

    const seedTitleIndex = container.textContent.indexOf("Attention Is All You Need");
    const firstAxisIndex = container.textContent.indexOf("함께 인용되는 논문 1편");
    expect(seedTitleIndex).toBeGreaterThanOrEqual(0);
    expect(firstAxisIndex).toBeGreaterThan(seedTitleIndex);
    const seedTitleCard = container.querySelector('[data-testid="relationship-seed-title-card"]');
    expect(seedTitleCard?.className).toContain("sticky");
    expect(seedTitleCard?.className).toContain("top-0");
    expect(seedTitleCard?.className).toContain("border-b");
    expect(seedTitleCard?.className).not.toContain("lh-panel");
    expect(container.textContent).toContain(
      "이 논문과 인용·참고문헌 관계로 묶인 논문을 두 축으로 보여 준다.",
    );
    // 두 축이 분리되어 라벨로 보인다.
    expect(container.textContent).toContain("함께 인용되는 논문 1편");
    expect(container.textContent).toContain("같은 토대를 공유하는 논문 1편");
    // 근거 수치(why-relevant)가 후보마다 붙는다.
    expect(container.textContent).toContain("함께 인용 49회");
    expect(container.textContent).toContain("참고문헌 80개 공유");
    expect(container.textContent).toContain("Graph Attention Networks");
    expect(container.textContent).toContain("Deep Learning on Graphs: A Survey");
  });

  it("keeps disclosure controls unique when the same paper appears on both graph axes", async () => {
    const doc = createGraphNeighborsView();
    if (doc.metadata.type !== "graph_neighbors") {
      throw new Error("expected graph_neighbors metadata");
    }
    const sharedPaper = {
      paperId: "shared-neighbor",
      title: "Shared Graph Neighbor",
      abstract: null,
      year: 2021,
      citationCount: 42,
      url: "https://example.com/shared-neighbor",
      authors: [{ name: "Shared Author" }],
      openAccessPdf: null,
      doi: null,
      reviewed: false,
    };
    doc.metadata.coCited = [{ shared: 9, paper: sharedPaper }];
    doc.metadata.coupled = [{ shared: 7, paper: sharedPaper }];
    doc.metadata.papers = [sharedPaper];
    doc.metadata.total = 1;

    const container = await renderGraph(doc);
    const cards = Array.from(
      container.querySelectorAll<HTMLElement>('[data-paper-id="shared-neighbor"]'),
    );
    const controlsIds = cards.map((card) => {
      const disclosure = card.querySelector<HTMLElement>(
        '[data-testid="search-result-card-disclosure"]',
      );
      const controlsId = disclosure?.getAttribute("aria-controls");
      expect(controlsId).toBeTruthy();
      const controlledPanel = controlsId
        ? (Array.from(card.querySelectorAll<HTMLElement>("[id]")).find(
            (element) => element.id === controlsId,
          ) ?? null)
        : null;
      expect(controlledPanel).not.toBeNull();
      expect(card.contains(controlledPanel)).toBe(true);
      return controlsId;
    });

    expect(cards).toHaveLength(2);
    expect(new Set(controlsIds).size).toBe(2);
  });

  it("paginates each graph-neighbor axis to 10 initial cards with a 더보기 (+10) window", async () => {
    const doc = createGraphNeighborsView();
    if (doc.metadata.type !== "graph_neighbors") {
      throw new Error("expected graph_neighbors metadata");
    }
    // 12편을 둬서 처음 10편만 보이고 더보기로 +10 펼쳐 12편 전부 보이는지 확인한다.
    doc.metadata.coCited = Array.from({ length: 12 }, (_unused, index) => ({
      shared: 50 - index,
      paper: {
        paperId: `cc-${String(index)}`,
        title: `Co-cited Neighbor ${String(index)}`,
        abstract: null,
        year: 2018,
        citationCount: 100 + index,
        url: `https://example.com/cc-${String(index)}`,
        authors: [{ name: "Author" }],
        openAccessPdf: null,
        doi: null,
        reviewed: false,
      },
    }));
    doc.metadata.coupled = [];
    doc.metadata.coCitedAvailability = {
      available: true,
      truncated: false,
      total: null,
      returned: 12,
      reason: null,
    };
    doc.metadata.coupledAvailability = {
      available: true,
      truncated: false,
      total: null,
      returned: 0,
      reason: null,
    };

    doc.metadata.papers = doc.metadata.coCited.map((entry) => entry.paper);
    doc.metadata.total = doc.metadata.papers.length;

    const container = await renderGraph(doc);

    // 처음에는 10편만 보이고 11/12번째는 숨는다.
    expect(container.textContent).toContain("Co-cited Neighbor 0");
    expect(container.textContent).toContain("Co-cited Neighbor 9");
    expect(container.textContent).not.toContain("Co-cited Neighbor 10");
    expect(container.textContent).not.toContain("Co-cited Neighbor 11");
    // 검색 결과 window와 같은 (보임/전체) 카운트 라벨.
    expect(container.textContent).toContain("더보기 (10/12)");

    const loadMoreButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("더보기 (10/12)"),
    );
    expect(loadMoreButton).toBeDefined();

    await act(async () => {
      loadMoreButton?.click();
      await Promise.resolve();
    });

    // 더보기 한 번에 +10 → 12편 전부 보이고 버튼은 사라진다.
    expect(container.textContent).toContain("Co-cited Neighbor 10");
    expect(container.textContent).toContain("Co-cited Neighbor 11");
    expect(container.textContent).not.toContain("더보기 (");
  });
});

describe("CitationLineageView graph-neighbor boundaries", () => {
  it("paginates citation direction cards to the same 10-card window", async () => {
    const doc = createCitationLineageView();
    if (doc.metadata.type !== "citation_lineage") {
      throw new Error("expected citation_lineage metadata");
    }
    doc.metadata.referenceIds = Array.from(
      { length: 12 },
      (_unused, index) => `ref-${String(index)}`,
    );
    doc.metadata.citationIds = [];
    doc.metadata.papers = doc.metadata.referenceIds.map((paperId, index) => ({
      paperId,
      title: `Reference Paper ${String(index)}`,
      abstract: null,
      year: 2020,
      citationCount: index,
      url: `https://example.com/${paperId}`,
      authors: [{ name: "Author" }],
      openAccessPdf: null,
      doi: null,
      reviewed: false,
    }));
    doc.metadata.total = doc.metadata.papers.length;

    const container = await render(doc);

    expect(container.textContent).toContain("Reference Paper 0");
    expect(container.textContent).toContain("Reference Paper 9");
    expect(container.textContent).not.toContain("Reference Paper 10");
    expect(container.textContent).not.toContain("Reference Paper 11");
    expect(container.textContent).toContain("더보기 (10/12)");

    const loadMoreButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("더보기 (10/12)"),
    );
    expect(loadMoreButton).toBeDefined();

    await act(async () => {
      loadMoreButton?.click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Reference Paper 10");
    expect(container.textContent).toContain("Reference Paper 11");
  });
});

describe("GraphNeighborsView card behavior", () => {
  it("queues inline analysis for graph-neighbor document cards inside the first visible budget", async () => {
    const now = "2026-04-13T00:00:00.000Z";
    const neighborPapers = Array.from({ length: 12 }, (_unused, index) => ({
      paperId: `cc-inline-${String(index)}`,
      title: `Graph Attention Neighbor ${String(index)}`,
      abstract: `We present graph attention neighbor ${String(index)} for neural message passing.`,
      year: 2017,
      citationCount: 25000 - index,
      url: `https://example.com/cc-inline-${String(index)}`,
      authors: [{ name: "Velickovic" }],
      openAccessPdf: null,
      doi: null,
      reviewed: false,
    }));
    const doc: ResearchRoutePayload = {
      status: "ready",
      version: 0,
      reactionVersion: 0,
      id: "graph-doc-1",
      type: "graph_neighbors",
      title: "비슷한 논문: Attention Is All You Need",
      content: "graph neighbors content",
      createdBy: "user",
      refs: [],
      ownerPrincipalId: "principal-1",
      createdAt: now,
      updatedAt: now,
      metadata: {
        type: "graph_neighbors",
        seedPaper: {
          paperId: "seed-1",
          title: "Attention Is All You Need",
          abstract: "seed abstract",
          year: 2017,
          citationCount: 1000,
          url: "https://sah.borca.ai/papers/seed-1",
          authors: [{ name: "Vaswani" }],
          openAccessPdf: null,
          doi: null,
        },
        papers: neighborPapers,
        total: neighborPapers.length,
        coCited: neighborPapers.map((paper, index) => ({
          shared: 49 - index,
          paper,
        })),
        coupled: [],
      },
      reaction: null,
    };

    const container = document.createElement("div");
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(doc, "test-execution:510");

    await act(async () => {
      root?.render(<GraphNeighborsView document={doc} />);
      await Promise.resolve();
    });

    const task = useBackgroundTaskStore.getState().inlineAnalysisTasks[doc.id];
    expect(task).toBeDefined();
    expect(task?.metadata.type).toBe("graph_neighbors");
    expect(task?.visibleCount).toBe(10);
    expect(task?.progressMap.get("cc-inline-0")).toBe("queued");
    expect(task?.progressMap.get("cc-inline-9")).toBe("queued");
    expect(task?.progressMap.has("cc-inline-10")).toBe(false);
    expect(task?.progressMap.has("cc-inline-11")).toBe(false);
    expect(container.textContent).toContain("분석 대기");
  });

  it("exposes the same card actions (citation lineage + find similar) on graph-neighbor cards as on search cards", async () => {
    const doc = createGraphNeighborsView();
    if (doc.metadata.type !== "graph_neighbors") {
      throw new Error("expected graph_neighbors metadata");
    }
    doc.metadata.coCited = [
      {
        shared: 49,
        paper: {
          paperId: "cc-action",
          title: "Graph Attention Networks",
          abstract: null,
          year: 2017,
          citationCount: 25000,
          url: "https://example.com/cc-action",
          authors: [{ name: "Velickovic" }],
          openAccessPdf: null,
          doi: null,
          reviewed: false,
        },
      },
    ];
    doc.metadata.coupled = [];
    doc.metadata.coCitedAvailability = {
      available: true,
      truncated: false,
      total: null,
      returned: 1,
      reason: null,
    };
    doc.metadata.coupledAvailability = {
      available: true,
      truncated: false,
      total: null,
      returned: 0,
      reason: null,
    };

    doc.metadata.papers = doc.metadata.coCited.map((entry) => entry.paper);
    doc.metadata.total = doc.metadata.papers.length;

    const container = await renderGraph(doc);

    const card = Array.from(container.querySelectorAll("[data-paper-id]")).find(
      (node) => node.getAttribute("data-paper-id") === "cc-action",
    );
    expect(card).toBeDefined();
    const actions = card?.querySelector('[data-testid="search-result-actions"]');
    expect(actions).toBeDefined();
    const actionText = actions?.textContent ?? "";
    // 검색 결과 카드와 동일한 액션 세트: PDF / 인용 계보 / 비슷한 논문.
    expect(actionText).toContain("PDF");
    expect(actionText).toContain("인용 25000");
    expect(actionText).toContain("비슷한 논문");
  });

  it("renders graph-neighbor list items with the same visible card hierarchy as search results", async () => {
    const paper: SearchMetadata["papers"][number] = {
      paperId: "cc-parity",
      title: "Graph Attention Networks",
      abstract: "We present graph attention networks for neural message passing.",
      year: 2017,
      venue: "ICLR",
      fieldsOfStudy: ["Computer Science", "Mathematics", "Biology"],
      citationCount: 25000,
      url: "https://example.com/cc-parity",
      authors: [{ name: "Velickovic" }, { name: "Cucurull" }, { name: "Casanova" }],
      openAccessPdf: { url: "https://example.com/cc-parity.pdf" },
      doi: null,
      inlineAnalysis: {
        version: INLINE_ANALYSIS_VERSION,
        inputFingerprint: "a".repeat(64),
        analysis,
        source: "abstract",
      },
    };
    const doc = createGraphNeighborsView();
    if (doc.metadata.type !== "graph_neighbors") {
      throw new Error("expected graph_neighbors metadata");
    }
    doc.metadata.coCited = [{ shared: 49, paper }];
    doc.metadata.coupled = [];
    doc.metadata.papers = [paper];
    doc.metadata.total = 1;

    const graphContainer = await renderGraph(doc);
    const searchContainer = renderSearchResultCard(paper);

    const graphCard = extractPaperCardSignature(graphContainer, paper.paperId);
    const searchCard = extractPaperCardSignature(searchContainer, paper.paperId);

    expect(graphCard.panelClass).toBe(searchCard.panelClass);
    expect(graphCard.titleClass).toBe(searchCard.titleClass);
    expect(graphCard.titleTagName).toBe("SPAN");
    expect(graphCard.titleHasExpandedState).toBe(false);
    expect(graphCard.disclosureTagName).toBe("BUTTON");
    expect(graphCard.disclosureLabel).toBe(searchCard.disclosureLabel);
    expect(graphCard.disclosureExpanded).toBe("false");
    expect(graphCard.hasDisclosureIcon).toBe(searchCard.hasDisclosureIcon);
    expect(graphCard.hasDisclosureIcon).toBe(true);
    expect(graphCard.metadataText).toBe(searchCard.metadataText);
    expect(graphCard.metadataText).toBe("2017·ICLR·분야Computer Science, Mathematics");
    expect(graphCard.authorsText).toBe(searchCard.authorsText);
    expect(graphCard.actionsText).toBe(searchCard.actionsText);
    expect(graphCard.text).toContain(analysis.summary);
    expect(graphCard.titleBeforeMetadata).toBe(true);
    expect(graphCard.metadataBeforeAuthors).toBe(true);
    expect(graphCard.actionsBeforeAnalysis).toBe(true);

    const graphAuthorRow = graphContainer.querySelector<HTMLElement>(
      '[data-paper-id="cc-parity"] [data-testid="search-result-authors"]',
    );
    expect(graphAuthorRow?.textContent).toBe("Velickovic,Cucurull,Casanova");
    expect(graphAuthorRow?.querySelectorAll("button")).toHaveLength(3);
  });

  it("renders citation direction list items with the same visible card hierarchy as search results", async () => {
    const paper: SearchMetadata["papers"][number] = {
      paperId: "ref-parity",
      title: "Neural Machine Translation by Jointly Learning to Align and Translate",
      abstract: "We align and translate jointly with an attention mechanism.",
      year: 2014,
      venue: "ICLR",
      fieldsOfStudy: ["Computer Science", "Linguistics", "Mathematics"],
      citationCount: 500,
      url: "https://example.com/ref-parity",
      authors: [{ name: "Bahdanau" }, { name: "Cho" }, { name: "Bengio" }],
      openAccessPdf: { url: "https://example.com/ref-parity.pdf" },
      doi: null,
      inlineAnalysis: {
        version: INLINE_ANALYSIS_VERSION,
        inputFingerprint: "a".repeat(64),
        analysis,
        source: "abstract",
      },
    };
    const doc = createCitationLineageView();
    if (doc.metadata.type !== "citation_lineage") {
      throw new Error("expected citation_lineage metadata");
    }
    doc.metadata.referenceIds = [paper.paperId];
    doc.metadata.citationIds = [];
    doc.metadata.papers = [paper];
    doc.metadata.total = 1;

    const citationContainer = await render(doc);
    const searchContainer = renderSearchResultCard(paper);

    const citationCard = extractPaperCardSignature(citationContainer, paper.paperId);
    const searchCard = extractPaperCardSignature(searchContainer, paper.paperId);

    expect(citationCard.panelClass).toBe(searchCard.panelClass);
    expect(citationCard.titleClass).toBe(searchCard.titleClass);
    expect(citationCard.titleTagName).toBe("SPAN");
    expect(citationCard.titleHasExpandedState).toBe(false);
    expect(citationCard.disclosureTagName).toBe("BUTTON");
    expect(citationCard.disclosureLabel).toBe(searchCard.disclosureLabel);
    expect(citationCard.disclosureExpanded).toBe("false");
    expect(citationCard.hasDisclosureIcon).toBe(searchCard.hasDisclosureIcon);
    expect(citationCard.hasDisclosureIcon).toBe(true);
    expect(citationCard.metadataText).toBe(searchCard.metadataText);
    expect(citationCard.metadataText).toBe("2014·ICLR·분야Computer Science, Linguistics");
    expect(citationCard.authorsText).toBe(searchCard.authorsText);
    expect(citationCard.actionsText).toBe(searchCard.actionsText);
    expect(citationCard.text).toContain(analysis.summary);
    expect(citationCard.titleBeforeMetadata).toBe(true);
    expect(citationCard.metadataBeforeAuthors).toBe(true);
    expect(citationCard.actionsBeforeAnalysis).toBe(true);
  });
});
