import { describe, expect, it } from "vitest";
import { INLINE_ANALYSIS_VERSION, type AIAnalysis } from "@/app/domain/analysis";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { buildInlineAnalysisMap, buildInlineAnalysisProgressMap } from "@/app/lib/inline-analysis";

describe("search view inline-analysis identity", () => {
  it("ignores same-version inline analysis snapshots without their input fingerprint", () => {
    const inlineAnalysis = {
      version: INLINE_ANALYSIS_VERSION,
      inputFingerprint: "a".repeat(64),
      source: "abstract" as const,
      analysis: {
        confidence: "high",
        semanticProfile: { claim: "claim", topics: [], method: null },
      } as unknown as AIAnalysis,
    };
    Reflect.deleteProperty(inlineAnalysis, "inputFingerprint");
    const papers: SearchMetadata["papers"] = [
      {
        paperId: "paper-1",
        title: "Paper 1",
        abstract: "abstract",
        year: 2025,
        citationCount: 1,
        url: "https://example.com/paper-1",
        authors: [],
        inlineAnalysis,
      },
    ];

    expect(buildInlineAnalysisMap(papers)).toEqual(new Map());
    expect(buildInlineAnalysisProgressMap(papers)).toEqual(new Map());
  });
});
