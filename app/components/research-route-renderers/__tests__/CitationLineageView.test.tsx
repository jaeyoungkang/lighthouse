import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INLINE_ANALYSIS_VERSION, type AIAnalysis } from "@/app/domain/analysis";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { CitationLineageView } from "@/app/components/research-route-renderers/CitationLineageView";
import { RESEARCH_ROUTE_BODY_RAIL_CLASS } from "@/app/components/research/research-route-layout.shared";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

const inlineAnalysis: AIAnalysis = {
  summary: "이 논문은 Transformer 이전의 핵심 어텐션 축이다.",
  objective: "시퀀스 번역에서 어텐션 정렬을 개선한다.",
  methodology: "인코더-디코더와 소프트 어텐션을 사용한다.",
  results: "기존 번역 성능을 개선한다.",
  keywords: ["attention", "sequence modeling"],
  semanticProfile: {
    claim: "시퀀스 번역에서 어텐션 정렬을 개선한다.",
    topics: ["attention", "sequence modeling"],
    method: "인코더-디코더와 소프트 어텐션을 사용한다.",
    finding: "기존 번역 성능을 개선한다.",
    quotedBasis: {
      claim: "attention alignment",
      topics: ["attention", "sequence modeling"],
      method: "encoder-decoder with soft attention",
      finding: "improved translation quality",
    },
  },
  confidence: "high",
  evidenceMap: {},
};

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
      referenceIds: ["paper-ref-1"],
      citationIds: [],
      papers: [
        {
          paperId: "paper-ref-1",
          title: "Neural Machine Translation by Jointly Learning to Align and Translate",
          abstract: "reference abstract",
          year: 2014,
          citationCount: 500,
          url: "https://example.com/paper-ref-1",
          authors: [{ name: "Bahdanau" }],
          openAccessPdf: { url: "https://example.com/paper-ref-1.pdf" },
          doi: "10.1000/reference",
          reviewed: false,
          inlineAnalysis: {
            version: INLINE_ANALYSIS_VERSION,
            analysis: inlineAnalysis,
            source: "abstract",
          },
        },
      ],
      total: 1,
    },
    reaction: null,
  };
}

describe("CitationLineageView", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
    useReactionActionStore.getState().registerSendMessage(vi.fn());
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

  it("renders the seed paper card and separated reference and citation sections", async () => {
    const citationDocument = createCitationLineageView();
    if (citationDocument.metadata.type !== "citation_lineage") {
      throw new Error("expected citation_lineage metadata");
    }
    citationDocument.metadata.citationIds = ["paper-cit-1"];
    citationDocument.metadata.papers = [
      ...citationDocument.metadata.papers,
      {
        paperId: "paper-cit-1",
        title: "BERT: Pre-training of Deep Bidirectional Transformers",
        abstract: "citation abstract",
        year: 2019,
        citationCount: 900,
        url: "https://example.com/paper-cit-1",
        authors: [{ name: "Devlin" }],
        openAccessPdf: null,
        doi: null,
        reviewed: false,
      },
    ];

    const container = document.createElement("div");
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(citationDocument, "test-execution:142");

    await act(async () => {
      root?.render(<CitationLineageView document={citationDocument} />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("인용 관계");
    expect(container.textContent).toContain("Attention Is All You Need");
    const seedTitleCard = container.querySelector('[data-testid="relationship-seed-title-card"]');
    expect(seedTitleCard?.className).toContain("sticky");
    expect(seedTitleCard?.className).toContain("top-0");
    expect(seedTitleCard?.className).toContain("border-b");
    expect(seedTitleCard?.className).not.toContain("lh-panel");
    expect(container.textContent).toContain("선행 1편");
    expect(container.textContent).toContain("인용한 논문 1편");
    expect(container.textContent).toContain(
      "Neural Machine Translation by Jointly Learning to Align and Translate",
    );
    expect(container.textContent).toContain(
      "BERT: Pre-training of Deep Bidirectional Transformers",
    );
    expect(container.querySelector("input")).toBeNull();
  });

  it("uses the shared ResearchRoutePayload body rail without an extra horizontal padding rail", async () => {
    const citationDocument = createCitationLineageView();
    const container = document.createElement("div");
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(citationDocument, "test-execution:171");

    await act(async () => {
      root?.render(<CitationLineageView document={citationDocument} />);
      await Promise.resolve();
    });

    const rail = container.querySelector('[data-testid="citation-lineage-content-rail"]');
    expect(rail?.className).toBe(RESEARCH_ROUTE_BODY_RAIL_CLASS);
    expect(rail?.className).not.toContain("px-5");
  });

  it("places the AI comment below the citation relationship title context", async () => {
    const citationDocument = createCitationLineageView();
    const container = document.createElement("div");
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(citationDocument, "test-execution:187");

    await act(async () => {
      root?.render(
        <CitationLineageView
          document={citationDocument}
          reactionSlot={<div data-testid="mock-reaction-slot">인용 관계 comment</div>}
        />,
      );
      await Promise.resolve();
    });

    const seedTitleCard = container.querySelector('[data-testid="relationship-seed-title-card"]');
    const reaction = container.querySelector('[data-testid="mock-reaction-slot"]');

    expect(seedTitleCard).not.toBeNull();
    expect(reaction).not.toBeNull();
    expect(seedTitleCard?.compareDocumentPosition(reaction as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("keeps the research-gap follow-up out of the ResearchRoutePayload body", async () => {
    const citationDocument = createCitationLineageView();
    if (citationDocument.metadata.type !== "citation_lineage") {
      throw new Error("expected citation_lineage metadata");
    }
    citationDocument.metadata.citationIds = ["paper-cit-1"];
    citationDocument.metadata.papers = [
      ...citationDocument.metadata.papers,
      {
        paperId: "paper-cit-1",
        title: "BERT: Pre-training of Deep Bidirectional Transformers",
        abstract: "citation abstract",
        year: 2019,
        citationCount: 900,
        url: "https://example.com/paper-cit-1",
        authors: [{ name: "Devlin" }],
        openAccessPdf: null,
        doi: null,
        reviewed: false,
      },
    ];

    const container = document.createElement("div");
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(citationDocument, "test-execution:233");

    await act(async () => {
      root?.render(<CitationLineageView document={citationDocument} />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("인용한 논문 1편");
    expect(container.textContent).not.toContain("인용 관계로 공백 찾기");
    expect(
      Array.from(container.querySelectorAll("button")).some((button) =>
        button.textContent.includes("공백 찾기"),
      ),
    ).toBe(false);
  });

  it("renders empty states for true-zero reference and citation directions", async () => {
    const emptyDirectionsDocument = createCitationLineageView();
    if (emptyDirectionsDocument.metadata.type !== "citation_lineage") {
      throw new Error("expected citation_lineage metadata");
    }
    emptyDirectionsDocument.metadata.referenceIds = [];
    emptyDirectionsDocument.metadata.citationIds = [];
    emptyDirectionsDocument.metadata.papers = [];
    emptyDirectionsDocument.metadata.seedPaper = {
      ...emptyDirectionsDocument.metadata.seedPaper,
      referenceCount: 0,
    };

    const container = document.createElement("div");
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(emptyDirectionsDocument, "test-execution:264");

    await act(async () => {
      root?.render(<CitationLineageView document={emptyDirectionsDocument} />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("이 논문의 선행 연구는 아직 등록되어 있지 않다.");
    expect(container.textContent).toContain("이 논문을 인용한 논문이 아직 없다.");
  });

  it("renders provider-limited reference state instead of a true-zero empty state", async () => {
    const limitedDocument = createCitationLineageView();
    if (limitedDocument.metadata.type !== "citation_lineage") {
      throw new Error("expected citation_lineage metadata");
    }
    limitedDocument.metadata.referenceIds = [];
    limitedDocument.metadata.papers = [];
    limitedDocument.metadata.referenceAvailability = {
      available: false,
      truncated: false,
      total: 0,
      returned: 0,
      reason: "semantic_scholar_graph_empty_full_text_available",
    };
    limitedDocument.metadata.seedPaper = {
      ...limitedDocument.metadata.seedPaper,
      referenceCount: 0,
    };

    const container = document.createElement("div");
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(limitedDocument, "test-execution:296");

    await act(async () => {
      root?.render(<CitationLineageView document={limitedDocument} />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("선행 연구 목록은 아직 제공되거나 추출되지 않았다");
    expect(container.textContent).toContain("실제 선행 연구가 없다는 뜻은 아니다");
    expect(container.textContent).not.toContain("선행 연구는 아직 등록되어 있지 않다");
  });

  it("shows the limited-list state with referenceCount and direct links when references is empty but referenceCount > 0", async () => {
    const elidedDocument = createCitationLineageView();
    if (elidedDocument.metadata.type !== "citation_lineage") {
      throw new Error("expected citation_lineage metadata");
    }
    elidedDocument.metadata.referenceIds = [];
    elidedDocument.metadata.papers = [];
    elidedDocument.metadata.seedPaper = {
      ...elidedDocument.metadata.seedPaper,
      paperId: "elided-seed",
      url: "https://sah.borca.ai/papers/elided-seed",
      doi: "10.63619/ijais.v1i1.002",
      referenceCount: 66,
    };

    const container = document.createElement("div");
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(elidedDocument, "test-execution:325");

    await act(async () => {
      root?.render(<CitationLineageView document={elidedDocument} />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("66");
    expect(container.textContent).toContain("목록은 아직 제공되거나 추출되지 않았다");

    const s2Link = container.querySelector<HTMLAnchorElement>(
      'a[href="https://sah.borca.ai/papers/elided-seed"]',
    );
    expect(s2Link).toBeTruthy();

    const doiLink = container.querySelector<HTMLAnchorElement>(
      'a[href="https://doi.org/10.63619/ijais.v1i1.002"]',
    );
    expect(doiLink).toBeTruthy();
  });

  it("falls back to the no-data message when both references and referenceCount are empty", async () => {
    const noDataDocument = createCitationLineageView();
    if (noDataDocument.metadata.type !== "citation_lineage") {
      throw new Error("expected citation_lineage metadata");
    }
    noDataDocument.metadata.referenceIds = [];
    noDataDocument.metadata.papers = [];
    noDataDocument.metadata.seedPaper = {
      ...noDataDocument.metadata.seedPaper,
      paperId: "empty-seed",
      url: "https://sah.borca.ai/papers/empty-seed",
      doi: null,
      referenceCount: 0,
    };

    const container = document.createElement("div");
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(noDataDocument, "test-execution:363");

    await act(async () => {
      root?.render(<CitationLineageView document={noDataDocument} />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("선행 연구는 아직 등록되어 있지 않다");
    expect(container.textContent).not.toContain("출판사");
    expect(
      container.querySelector<HTMLAnchorElement>(
        'a[href="https://sah.borca.ai/papers/empty-seed"]',
      ),
    ).toBeTruthy();
    expect(container.querySelector<HTMLAnchorElement>('a[href^="https://doi.org/"]')).toBeNull();
  });
});
