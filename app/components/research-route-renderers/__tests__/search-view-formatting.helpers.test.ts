import { describe, expect, it } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import {
  buildPaperExternalUrl,
  buildMoonlightFileUrl,
  formatSearchCompletionLabel,
} from "@/app/components/research-route-renderers/search-view.helpers";
import { buildSearchSystemEventMessage } from "@/app/components/research-route-renderers/search-view-messages.helpers";

const papers: SearchMetadata["papers"] = [
  {
    paperId: "paper-1",
    title: "Paper 1",
    abstract: "abstract 1",
    year: 2024,
    citationCount: 10,
    url: "https://example.com/1",
    authors: [{ name: "Alice" }],
  },
  {
    paperId: "paper-2",
    title: "Paper 2",
    abstract: null,
    year: 2023,
    citationCount: 3,
    url: "https://example.com/2",
    authors: [{ name: "Bob" }],
  },
];

describe("search-view helper formatting", () => {
  it("builds the external paper link from provider url or Episteme paper page, never Semantic Scholar", () => {
    // 빈 식별자 → Episteme 공개 base (Semantic Scholar로 가지 않는다)
    expect(buildPaperExternalUrl("  ")).toBe("https://sah.borca.ai");
    // url이 없는 corpus id → Episteme paper 페이지 (S2 CorpusID 페이지가 아니다)
    expect(buildPaperExternalUrl("271854887")).toBe("https://sah.borca.ai/papers/271854887");
    // 서버가 준 paper.url(이미 landing/DOI/arXiv/Episteme 체인 결과)은 그대로 사용
    expect(buildPaperExternalUrl("271854887", "https://arxiv.org/abs/1706.03762")).toBe(
      "https://arxiv.org/abs/1706.03762",
    );
    expect(buildPaperExternalUrl("271854887", "https://doi.org/10.1145/3292500")).toBe(
      "https://doi.org/10.1145/3292500",
    );
    // 안전하지 않은 scheme은 거부하고 Episteme paper 페이지로 fallback
    expect(buildPaperExternalUrl("271854887", "javascript:alert(1)")).toBe(
      "https://sah.borca.ai/papers/271854887",
    );
  });

  it("builds Moonlight handoff links from direct paper URLs", () => {
    expect(buildMoonlightFileUrl("https://cdn.example.com/paper.pdf")).toBe(
      "https://themoonlight.io/file?url=https%3A%2F%2Fcdn.example.com%2Fpaper.pdf",
    );
    expect(buildMoonlightFileUrl(" javascript:alert(1) ")).toBeNull();
    expect(buildMoonlightFileUrl("")).toBeNull();
  });

  it("formats completion labels for single and merged searches", () => {
    expect(formatSearchCompletionLabel({ type: "search", query: "llm", papers, total: 87 })).toBe(
      "2편",
    );
    expect(
      formatSearchCompletionLabel({
        type: "search",
        query: "llm",
        queryClauses: [
          {
            rawClause: "llm",
            normalizedClause: "llm",
            role: "anchor",
            isExtractive: true,
            derivedExpansions: [],
          },
          {
            rawClause: "evaluation",
            normalizedClause: "evaluation",
            role: "constraint",
            isExtractive: true,
            derivedExpansions: [],
          },
        ],
        papers,
        total: 87,
        totalMode: "merged",
      }),
    ).toBe("병합 2편");
    expect(
      buildSearchSystemEventMessage({
        query: "llm",
        kind: "success",
        metadata: { type: "search", query: "llm", papers, total: 87 },
      }),
    ).toBe('[system] "llm" 검색 완료 — 2편');
    expect(
      buildSearchSystemEventMessage({
        query: "llm",
        kind: "analysis_completed",
        metadata: { type: "search", query: "llm", papers, total: 87 },
      }),
    ).toBe('[system] "llm" 검색 분석 업데이트 — 0편 핵심 포인트 반영');
  });
});
