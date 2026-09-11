import { describe, expect, it } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import {
  buildInlineAnalysisPayload,
  hasPendingInlineAnalysis,
  queueVisibleInlineAnalysis,
  selectInlineAnalysisBatch,
} from "@/app/lib/inline-analysis";

describe("search-view whitespace abstract handling", () => {
  it("keeps whitespace-only abstracts out of every inline-analysis scheduling stage", () => {
    const paper: SearchMetadata["papers"][number] = {
      paperId: "paper-whitespace-abstract",
      title: "Whitespace Abstract",
      abstract: "   \n  ",
      year: 2024,
      citationCount: 0,
      url: "https://example.com/whitespace",
      authors: [{ name: "Alice" }],
    };

    expect(buildInlineAnalysisPayload([paper])).toEqual([]);
    expect(
      queueVisibleInlineAnalysis({
        papers: [paper],
        visibleCount: 1,
        analysisMap: new Map(),
        analysisProgressMap: new Map(),
      }),
    ).toEqual(new Map());
    expect(
      selectInlineAnalysisBatch({
        papers: [paper],
        visibleCount: 1,
        analysisProgressMap: new Map([[paper.paperId, "queued"]]),
        batchSize: 1,
      }),
    ).toEqual([]);
    expect(hasPendingInlineAnalysis([paper], new Map(), new Map(), 1)).toBe(false);
  });
});
