import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { CitationLineageView } from "@/app/components/research-route-renderers/CitationLineageView";
import { GraphNeighborsView } from "@/app/components/research-route-renderers/GraphNeighborsView";
import { PAPER_GENERATED_CONTENT_REGION_CLASS } from "@/app/components/research-route-renderers/search-result-generated-content";
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
let originalSendBeaconDescriptor: PropertyDescriptor | undefined;

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
  useResearchRouteStore.getState().setCurrentView(doc, "test-execution:101");
  await act(async () => {
    root?.render(<CitationLineageView document={doc} />);
    await Promise.resolve();
  });
  return container;
}

async function renderGraph(doc: ResearchRoutePayload): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  root = createRoot(container);
  useResearchRouteStore.getState().setCurrentView(doc, "test-execution:112");
  await act(async () => {
    root?.render(<GraphNeighborsView document={doc} />);
    await Promise.resolve();
  });
  return container;
}

function expectUnavailableFields(container: HTMLElement): void {
  const fieldsGroup = container.querySelector('[data-testid="paper-fields-group"]');
  expect(fieldsGroup?.querySelector('[data-testid="paper-fields-label"]')).toHaveTextContent(
    "분야",
  );
  expect(fieldsGroup?.querySelector('[data-testid="paper-fields"]')).toHaveTextContent("정보 없음");
}

beforeEach(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
  useReactionActionStore.getState().registerSendMessage(vi.fn());
  mockPush.mockClear();
  vi.stubGlobal("fetch", vi.fn());
  originalSendBeaconDescriptor = Object.getOwnPropertyDescriptor(
    globalThis.navigator,
    "sendBeacon",
  );
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
  if (originalSendBeaconDescriptor) {
    Object.defineProperty(globalThis.navigator, "sendBeacon", originalSendBeaconDescriptor);
  } else {
    delete (globalThis.navigator as { sendBeacon?: Navigator["sendBeacon"] }).sendBeacon;
  }
  originalSendBeaconDescriptor = undefined;
  vi.unstubAllGlobals();
});

describe("GraphNeighborsView states", () => {
  it("uses the shared paper-card detail loading frame while graph-neighbor card data hydrates", async () => {
    const doc = createGraphNeighborsView();
    if (doc.metadata.type !== "graph_neighbors") {
      throw new Error("expected graph_neighbors metadata");
    }
    doc.metadata.cardDataHydration = { status: "pending" };
    doc.metadata.coCited = [
      {
        shared: 49,
        paper: {
          paperId: "cc-pending",
          title: "Lightweight Graph Neighbor",
          abstract: null,
          year: 2024,
          citationCount: 9,
          url: "https://example.com/cc-pending",
          authors: [],
          openAccessPdf: null,
          doi: null,
          reviewed: false,
        },
      },
    ];
    doc.metadata.coupled = [];
    doc.metadata.papers = doc.metadata.coCited.map((entry) => entry.paper);
    doc.metadata.total = doc.metadata.papers.length;

    const container = await renderGraph(doc);

    expect(container.textContent).toContain("Lightweight Graph Neighbor");
    expect(container.textContent).toContain("PDF 확인 중");
    expect(container.textContent).toContain("논문 정보 보강 중");
    expect(container.textContent).toContain("저자·초록 보강");
    expect(container.textContent).toContain("분석 입력 보강");
    expect(container.querySelector('[data-testid="search-result-details-loading"]')).toBeTruthy();
    const generatedRegion = container.querySelector(
      '[data-generated-content-region="paper-card-analysis"]',
    );
    for (const className of PAPER_GENERATED_CONTENT_REGION_CLASS.split(" ")) {
      expect(generatedRegion?.className).toContain(className);
    }
    expect(
      container.querySelector('[data-testid="search-result-pending-details-skeleton"]'),
    ).toBeNull();
  });

  it("keeps a metadata-only analysis region after graph-neighbor hydration settles", async () => {
    const doc = createGraphNeighborsView();
    if (doc.metadata.type !== "graph_neighbors") {
      throw new Error("expected graph_neighbors metadata");
    }
    const sparsePaper = {
      paperId: "cc-sparse",
      title: "Sparse Graph Neighbor",
      abstract: null,
      year: 2024,
      fieldsOfStudy: null,
      citationCount: 9,
      url: "https://example.com/cc-sparse",
      authors: [],
      openAccessPdf: null,
      doi: null,
      reviewed: false,
    };
    doc.metadata.cardDataHydration = { status: "ready" };
    doc.metadata.coCited = [{ shared: 49, paper: sparsePaper }];
    doc.metadata.coupled = [];
    doc.metadata.papers = [sparsePaper];
    doc.metadata.total = 1;

    const container = await renderGraph(doc);
    const evidenceLimit = container.querySelector('[data-testid="search-result-evidence-limit"]');

    expect(evidenceLimit?.getAttribute("data-evidence-source")).toBe("metadata-only");
    expect(evidenceLimit?.textContent).toContain("초록이 없어 분석하지 못했습니다.");
    expect(container.textContent).toContain("출처 정보 없음");
    expectUnavailableFields(container);
    expect(container.textContent).toContain("저자 정보 미제공");
    expect(container.textContent).not.toContain("분석 대기");
  });

  it("keeps a metadata-only analysis region in a settled citation list", async () => {
    const doc = createCitationLineageView();
    if (doc.metadata.type !== "citation_lineage") {
      throw new Error("expected citation_lineage metadata");
    }
    const sparsePaper = {
      paperId: "ref-sparse",
      title: "Sparse Citation",
      abstract: null,
      year: 2020,
      citationCount: 1,
      url: "https://example.com/ref-sparse",
      authors: [],
    };
    doc.metadata.referenceIds = [sparsePaper.paperId];
    doc.metadata.papers = [sparsePaper];
    doc.metadata.total = 1;

    const container = await render(doc);
    const evidenceLimit = container.querySelector('[data-testid="search-result-evidence-limit"]');

    expect(container.textContent).toContain("Sparse Citation");
    expect(evidenceLimit?.getAttribute("data-evidence-source")).toBe("metadata-only");
    expect(evidenceLimit?.textContent).toContain("초록이 없어 분석하지 못했습니다.");
    expect(container.textContent).toContain("출처 정보 없음");
    expectUnavailableFields(container);
    expect(container.textContent).toContain("저자 정보 미제공");
    expect(container.textContent).not.toContain("분석 대기");
  });

  it("shows the graph-neighbors-empty message when both axes were attempted but returned nothing", async () => {
    const doc = createGraphNeighborsView();
    if (doc.metadata.type !== "graph_neighbors") {
      throw new Error("expected graph_neighbors metadata");
    }
    doc.metadata.coCited = [];
    doc.metadata.coupled = [];

    const container = await renderGraph(doc);

    expect(container.textContent).toContain("이 논문과 비슷한 논문을 찾지 못했다.");
  });

  it("keeps graph-neighbor sections out of the citation-lineage page", async () => {
    const doc = createCitationLineageView();
    if (doc.metadata.type !== "citation_lineage") {
      throw new Error("expected citation_lineage metadata");
    }

    const container = await render(doc);

    expect(container.textContent).not.toContain("함께 인용되는 논문");
    expect(container.textContent).not.toContain("같은 토대를 공유하는 논문");
    expect(container.textContent).not.toContain("이 논문과 비슷한 논문을 찾지 못했다.");
    expect(container.textContent).not.toContain("비슷한 논문을 일시적으로 불러오지 못했다.");
    // 인용 계보 본체는 그대로 유지된다.
    expect(container.textContent).toContain("Attention Is All You Need");
  });

  it("renders a degraded line distinct from honest-empty when graphLoadFailed is true", async () => {
    const doc = createGraphNeighborsView();
    if (doc.metadata.type !== "graph_neighbors") {
      throw new Error("expected graph_neighbors metadata");
    }
    doc.metadata.graphLoadFailed = true;

    const container = await renderGraph(doc);

    expect(container.textContent).toContain("Attention Is All You Need");
    // degraded 안내가 보이고, 정직한 빈 결과 메시지와 구분된다.
    expect(container.textContent).toContain(
      "지금 비슷한 논문을 불러오지 못했다. 잠시 후 다시 시도해보자.",
    );
    expect(container.textContent).not.toContain("이 논문과 비슷한 논문을 찾지 못했다.");
  });
});
