import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { SearchResultItem } from "@/app/components/research-route-renderers/search-result-item";
import { buildSearchResultBasisBadge } from "@/app/components/research-route-renderers/search-view.helpers";

const keywordPaper: SearchMetadata["papers"][number] = {
  paperId: "keyword-paper",
  title: "Keyword Paper",
  abstract: null,
  year: 2024,
  citationCount: 1,
  url: "https://example.com/keyword",
  authors: [{ name: "Author 1" }],
  openAccessPdf: null,
  doi: null,
  referenceIds: null,
  citationIds: null,
};

const supplementPaper: SearchMetadata["papers"][number] = {
  ...keywordPaper,
  paperId: "supplement-paper",
  title: "Supplement Paper",
};

const competitiveSupplementPaper: SearchMetadata["papers"][number] = {
  ...keywordPaper,
  paperId: "competitive-supplement-paper",
  title: "Agent Memory Planning",
};

const plainPaper: SearchMetadata["papers"][number] = {
  ...keywordPaper,
  paperId: "plain-paper",
  title: "Plain Paper",
};

const libraryContext: NonNullable<SearchMetadata["libraryContext"]> = {
  folders: [{ name: "AI Agents" }],
  signalPresent: true,
  interestWeights: {
    "keyword-paper": 100,
    "supplement-paper": 90,
    "competitive-supplement-paper": 80,
  },
  libraryOnlyPaperIds: ["supplement-paper", "competitive-supplement-paper"],
};

const metadata: SearchMetadata = {
  type: "search",
  query: "agent memory",
  papers: [keywordPaper, supplementPaper, competitiveSupplementPaper, plainPaper],
  total: 4,
  libraryContext,
};

describe("search result library-proximity badge", () => {
  it("marks every result with positive library-proximity evidence", () => {
    expect(
      buildSearchResultBasisBadge({
        metadata,
        paper: keywordPaper,
      }),
    ).toEqual({ label: "내 연구와 가까움" });
    expect(
      buildSearchResultBasisBadge({
        metadata,
        paper: supplementPaper,
      }),
    ).toEqual({ label: "내 연구와 가까움" });
    expect(
      buildSearchResultBasisBadge({
        metadata,
        paper: competitiveSupplementPaper,
      }),
    ).toEqual({ label: "내 연구와 가까움" });
    expect(
      buildSearchResultBasisBadge({
        metadata,
        paper: plainPaper,
      }),
    ).toBeNull();
    expect(
      buildSearchResultBasisBadge({
        metadata,
        paper: keywordPaper,
        personalize: false,
      }),
    ).toEqual({ label: "내 연구와 가까움" });
    expect(
      buildSearchResultBasisBadge({
        metadata: {
          ...metadata,
          exactLookup: { kind: "doi", value: "10.1145/3375637" },
        },
        paper: keywordPaper,
      }),
    ).toBeNull();
  });

  it("requires a positive weight and does not infer proximity from membership", () => {
    expect(
      buildSearchResultBasisBadge({
        metadata: {
          ...metadata,
          libraryContext: {
            ...libraryContext,
            interestWeights: {
              ...libraryContext.interestWeights,
              "supplement-paper": 0,
              "competitive-supplement-paper": -1,
            },
          },
        },
        paper: supplementPaper,
      }),
    ).toBeNull();
    expect(
      buildSearchResultBasisBadge({
        metadata: {
          ...metadata,
          libraryContext: {
            ...libraryContext,
            interestWeights: {
              ...libraryContext.interestWeights,
              "competitive-supplement-paper": -1,
            },
          },
        },
        paper: competitiveSupplementPaper,
      }),
    ).toBeNull();
  });

  it("pins the research-proximity badge inside the card without adding a metadata row", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    try {
      act(() => {
        root.render(
          <SearchResultItem
            paper={{
              ...keywordPaper,
              title: "The AI Scientist",
              venue: "NeurIPS",
            }}
            isLast
            basisBadge={{
              label: "내 연구와 가까움",
            }}
            analysisState="done"
            isAnyPaperOpening={false}
            isOpening={false}
            onOpenPdf={vi.fn()}
          />,
        );
      });

      const titleRow = container.querySelector('[data-testid="search-result-title-row"]');
      const metadataRow = container.querySelector('[data-testid="search-result-metadata"]');
      const badge = container.querySelector('[data-testid="search-result-basis-badge"]');
      const cardWrapper = container.querySelector('[data-paper-id="keyword-paper"]');
      const card = cardWrapper?.querySelector('[data-testid="search-result-card"]');
      expect(badge).toHaveTextContent("내 연구와 가까움");
      expect(badge?.className).not.toContain("absolute");
      expect(badge?.className).toContain("h-7");
      expect(badge?.className).toContain("shrink-0");
      expect(badge?.className).toContain("rounded-lh-sm");
      expect(badge?.className).toContain("border-success/35");
      expect(badge?.className).toContain("lh-type-micro");
      expect(badge?.className).toContain("text-success");
      expect(badge?.className).toContain("bg-success-soft/70");
      expect(badge?.className).not.toContain("shadow-sm");
      expect(cardWrapper?.contains(badge)).toBe(true);
      expect(card?.contains(badge)).toBe(true);
      expect(titleRow?.contains(badge)).toBe(true);
      expect(metadataRow?.contains(badge)).toBe(false);
    } finally {
      act(() => {
        root.unmount();
      });
    }
  });
});
