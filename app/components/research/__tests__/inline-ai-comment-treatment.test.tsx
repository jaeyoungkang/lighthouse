import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INLINE_ANALYSIS_VERSION } from "@/app/domain/analysis";
import type {
  CitationLineageMetadata,
  GraphNeighborsMetadata,
  InlineAnalysisCache,
  SearchMetadata,
} from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";
import { CitationLineageResultsState } from "@/app/components/research-route-renderers/citation-lineage-view";
import { GraphNeighborsResultsState } from "@/app/components/research-route-renderers/graph-neighbors-view";
import { SearchResultsHeader } from "@/app/components/research-route-renderers/search-results-header";
import {
  INLINE_AI_COMMENT_ACTION_BUTTON_CLASS,
  INLINE_AI_COMMENT_FRAME_CLASS,
  INLINE_AI_COMMENT_TREATMENT,
} from "@/app/components/research/inline-ai-comment-treatment";
import { attachInlineAiCommentBodySlot } from "@/app/components/research/attach-inline-ai-comment-body-slot";
import { buildRelationshipResearchTermsBlock } from "@/app/components/research/search-results-overview-model";

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

function paper(overrides: Partial<PaperCore> = {}): PaperCore {
  return {
    paperId: "paper-1",
    title: "The AI Scientist-v2",
    abstract: "Agentic tree search for scientific discovery.",
    year: 2025,
    citationCount: 142,
    url: "https://example.com/paper-1",
    authors: [{ name: "Yutaro Yamada" }],
    ...overrides,
  };
}

function analyzedPaper(overrides: Partial<PaperCore> = {}): PaperCore {
  return {
    ...paper(overrides),
    reviewed: false,
    inlineAnalysis: {
      version: INLINE_ANALYSIS_VERSION,
      inputFingerprint: "a".repeat(64),
      source: "abstract",
      analysis: {
        summary: "Uses graph retrieval for scientific discovery.",
        keywords: ["graph retrieval"],
        semanticProfile: {
          claim: "Graph retrieval helps scientific discovery.",
          topics: ["graph retrieval"],
          method: "citation-aware retrieval",
          finding: "scientific discovery workflows",
          conclusion: null,
          quotedBasis: {
            claim: "graph retrieval",
            topics: ["graph retrieval"],
            method: "citation-aware retrieval",
            finding: "scientific discovery workflows",
            conclusion: null,
          },
        },
      },
    },
  } as PaperCore;
}

function render(element: ReactNode): HTMLElement {
  const container = document.createElement("div");
  root = createRoot(container);
  act(() => {
    root?.render(element);
  });
  return container;
}

function reactionSlot(label: string) {
  return <div data-testid="mock-reaction-slot">{label}</div>;
}

function getRelationshipGapAction(frame: HTMLElement): HTMLElement {
  const action =
    frame.parentElement?.querySelector<HTMLElement>(
      '[data-testid="relationship-view-gap-network-action"]',
    ) ?? null;
  if (!action) throw new Error("relationship gap action missing");
  return action;
}

function citationMetadata(): CitationLineageMetadata {
  const seedPaper = paper();
  const citedPaper = analyzedPaper({ paperId: "paper-2", title: "Agent Laboratory" });
  return {
    type: "citation_lineage",
    seedPaper,
    referenceIds: [],
    citationIds: [citedPaper.paperId],
    papers: [citedPaper],
    total: 1,
  };
}

function graphNeighborsMetadata(): GraphNeighborsMetadata {
  const seedPaper = paper();
  const neighborPaper = analyzedPaper({ paperId: "paper-3", title: "AlphaEvolve" });
  return {
    type: "graph_neighbors",
    seedPaper,
    papers: [neighborPaper],
    total: 1,
    coCited: [{ shared: 3, paper: neighborPaper }],
    coupled: [],
  };
}

function renderSearchFrame(): HTMLElement {
  const metadata: SearchMetadata = {
    type: "search",
    query: "ai for science",
    total: 1,
    papers: [paper()],
  };
  const container = render(
    <SearchResultsHeader
      metadata={metadata}
      sortOption="relevance"
      personalize={false}
      libraryContextAvailable={false}
      facetFilters={{ fieldsOfStudy: [], authors: [], venues: [], hasPdf: false }}
      yearFilter=""
      resultCount={1}
      isSearching={false}
      query="ai for science"
      yearRangeInputs={{ from: "", to: "" }}
      onYearRangeInputsChange={vi.fn()}
      onSearchSubmit={vi.fn()}
      onSortSelect={vi.fn()}
      onBasisSelect={vi.fn()}
      onToggleFacetValue={vi.fn()}
      onToggleHasPdf={vi.fn()}
      showInlineAnalysisStatus={false}
      analyzedCount={0}
      inlineAnalysisTotal={0}
      onApplySpellingCorrection={vi.fn()}
      isCreatingGapNetwork={false}
      representativeCount={0}
      showRepresentativeOnly={false}
      onToggleRepresentativeOnly={vi.fn()}
      onOpenGapNetwork={vi.fn()}
      reactionSlot={reactionSlot("search comment")}
    />,
  );
  const frame = container.querySelector<HTMLElement>(
    '[data-testid="search-results-reaction-below-basis"]',
  );
  if (!frame) throw new Error("search AI comment frame missing");
  return frame;
}

function renderCitationFrame(): { frame: HTMLElement; onSearchTerm: ReturnType<typeof vi.fn> } {
  const onSearchTerm = vi.fn();
  const container = render(
    <CitationLineageResultsState
      ownerPrincipalId="principal-1"
      documentId="citation-1"
      metadata={citationMetadata()}
      analysisProgressMap={new Map()}
      analysisMap={new Map()}
      citationLineageLoadingPaperId={null}
      graphNeighborsLoadingPaperId={null}
      onOpenCitationLineage={vi.fn()}
      onOpenGraphNeighbors={vi.fn()}
      onFindSimilar={vi.fn()}
      onSearchTerm={onSearchTerm}
      onOpenGapNetwork={vi.fn()}
      reactionSlot={reactionSlot("citation comment")}
    />,
  );
  const frame = container.querySelector<HTMLElement>(
    '[data-testid="relationship-view-ai-comment-frame"]',
  );
  if (!frame) throw new Error("citation AI comment frame missing");
  return { frame, onSearchTerm };
}

function renderGraphNeighborsFrame(): {
  frame: HTMLElement;
  onSearchTerm: ReturnType<typeof vi.fn>;
} {
  const onSearchTerm = vi.fn();
  const container = render(
    <GraphNeighborsResultsState
      ownerPrincipalId="principal-1"
      documentId="graph-1"
      metadata={graphNeighborsMetadata()}
      analysisProgressMap={new Map()}
      analysisMap={new Map()}
      citationLineageLoadingPaperId={null}
      graphNeighborsLoadingPaperId={null}
      onOpenCitationLineage={vi.fn()}
      onOpenGraphNeighbors={vi.fn()}
      onFindSimilar={vi.fn()}
      onSearchTerm={onSearchTerm}
      onOpenGapNetwork={vi.fn()}
      reactionSlot={reactionSlot("graph comment")}
    />,
  );
  const frame = container.querySelector<HTMLElement>(
    '[data-testid="relationship-view-ai-comment-frame"]',
  );
  if (!frame) throw new Error("graph-neighbor AI comment frame missing");
  return { frame, onSearchTerm };
}

describe("inline AI comment visual treatment", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  it("uses one frame treatment for search, citation lineage, and graph-neighbor AI comments", () => {
    const searchFrame = renderSearchFrame();
    const searchClass = searchFrame.className;
    const searchTreatment = searchFrame.getAttribute("data-ai-comment-treatment");

    act(() => {
      root?.unmount();
    });
    root = null;
    const { frame: citationFrame, onSearchTerm: onCitationSearchTerm } = renderCitationFrame();
    const citationClass = citationFrame.className;
    const citationTreatment = citationFrame.getAttribute("data-ai-comment-treatment");
    const citationAction = getRelationshipGapAction(citationFrame);
    expect(citationAction.className).toBe(INLINE_AI_COMMENT_ACTION_BUTTON_CLASS);
    expect(citationAction.textContent).toContain("현재 논문 묶음의 관계를 분석");
    expect(citationFrame.contains(citationAction)).toBe(false);
    expect(
      citationAction.compareDocumentPosition(citationFrame) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      citationFrame.querySelector('[data-testid="search-ai-comment-research-terms"]'),
    ).not.toBeNull();
    expect(citationFrame.textContent).toContain("주요 연구 용어");
    expect(citationFrame.textContent).toContain("graph retrieval");
    act(() => {
      citationFrame
        .querySelector<HTMLButtonElement>(
          '[data-testid="search-ai-comment-research-term-links"] button',
        )
        ?.click();
    });
    const citationSearchCalls = onCitationSearchTerm.mock.calls as Array<
      [string, { termSeed?: { sourceQuery?: string } }]
    >;
    expect(citationSearchCalls[0]?.[0]).toBe("citation-aware retrieval");
    expect(citationSearchCalls[0]?.[1].termSeed?.sourceQuery).toBe("The AI Scientist-v2");

    act(() => {
      root?.unmount();
    });
    root = null;
    const { frame: graphFrame, onSearchTerm: onGraphSearchTerm } = renderGraphNeighborsFrame();
    const graphClass = graphFrame.className;
    const graphTreatment = graphFrame.getAttribute("data-ai-comment-treatment");
    const graphAction = getRelationshipGapAction(graphFrame);

    expect(searchClass).toBe(INLINE_AI_COMMENT_FRAME_CLASS);
    expect(citationClass).toBe(INLINE_AI_COMMENT_FRAME_CLASS);
    expect(graphClass).toBe(INLINE_AI_COMMENT_FRAME_CLASS);
    expect(searchClass).toContain("gap-3");
    expect(searchClass).toContain("px-5");
    expect(searchClass).toContain("py-5");
    expect(searchClass).toContain("lh-type-reading-body");
    expect(searchClass).toContain("lh-tone-primary");
    expect(searchTreatment).toBe(INLINE_AI_COMMENT_TREATMENT);
    expect(citationTreatment).toBe(INLINE_AI_COMMENT_TREATMENT);
    expect(graphTreatment).toBe(INLINE_AI_COMMENT_TREATMENT);
    expect(
      searchFrame.querySelector('[data-testid="search-results-gap-network-action"]'),
    ).toBeNull();
    expect(graphAction.className).toBe(INLINE_AI_COMMENT_ACTION_BUTTON_CLASS);
    expect(graphAction.textContent).toContain("현재 논문 묶음의 관계를 분석");
    expect(graphFrame.contains(graphAction)).toBe(false);
    expect(graphAction.compareDocumentPosition(graphFrame) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(
      graphFrame.querySelector('[data-testid="search-ai-comment-research-terms"]'),
    ).not.toBeNull();
    expect(graphFrame.textContent).toContain("주요 연구 용어");
    expect(graphFrame.textContent).toContain("graph retrieval");

    act(() => {
      graphFrame
        .querySelector<HTMLButtonElement>(
          '[data-testid="search-ai-comment-research-term-links"] button',
        )
        ?.click();
    });
    const graphSearchCalls = onGraphSearchTerm.mock.calls as Array<
      [string, { termSeed?: { sourceQuery?: string } }]
    >;
    expect(graphSearchCalls[0]?.[0]).toBe("citation-aware retrieval");
    expect(graphSearchCalls[0]?.[1].termSeed?.sourceQuery).toBe("The AI Scientist-v2");
  });

  it("keeps relationship research terms grounded in quoted semantic-profile evidence", () => {
    const ungroundedPaper = analyzedPaper({
      paperId: "paper-ungrounded",
      title: "Relationship term fixture",
    }) as PaperCore & { inlineAnalysis: InlineAnalysisCache };
    ungroundedPaper.inlineAnalysis.analysis.semanticProfile.topics = [
      "artificial intelligence",
      "ai scientist",
      "grounded graph retrieval",
      "ungrounded synthesis",
    ];
    ungroundedPaper.inlineAnalysis.analysis.semanticProfile.method = "speculative agent workflow";
    ungroundedPaper.inlineAnalysis.analysis.semanticProfile.finding = "unsupported discovery claim";
    ungroundedPaper.inlineAnalysis.analysis.semanticProfile.quotedBasis = {
      claim: null,
      topics: ["artificial intelligence", "ai scientist", "grounded graph retrieval"],
      method: null,
      finding: null,
      conclusion: null,
    };

    const block = buildRelationshipResearchTermsBlock({
      documentType: "citation_lineage",
      papers: [paper({ title: "AI Scientist" }), ungroundedPaper],
    });

    expect(block?.sections[0]?.terms?.map((term) => term.term)).toEqual([
      "grounded graph retrieval",
    ]);
  });

  it("passes the inline body append slot through a Fragment-wrapped consumer", () => {
    function SlotConsumer({ inlineBodyAppendSlot }: { inlineBodyAppendSlot?: ReactNode }) {
      return <div data-testid="slot-consumer">{inlineBodyAppendSlot}</div>;
    }

    const container = render(
      attachInlineAiCommentBodySlot(
        <div>
          <>
            <SlotConsumer />
          </>
        </div>,
        <span data-testid="inline-body-append-slot">research terms</span>,
      ),
    );

    expect(container.querySelectorAll('[data-testid="inline-body-append-slot"]')).toHaveLength(1);
    expect(
      container
        .querySelector('[data-testid="slot-consumer"]')
        ?.querySelector('[data-testid="inline-body-append-slot"]'),
    ).not.toBeNull();
  });
});
