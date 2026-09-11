import { describe, expect, it } from "vitest";
import { mergeSearchBackgroundMetadata } from "@/app/components/research/background-search-tasks";
import type { AIAnalysis } from "@/app/domain/analysis";
import type { SearchMetadata } from "@/app/domain/research-route-payload";

function metadata(): SearchMetadata {
  return {
    type: "search",
    query: "research agents",
    total: 1,
    papers: [
      {
        paperId: "101",
        title: "Research Agents",
        abstract: "abstract",
        year: 2025,
        citationCount: 12,
        url: "https://example.com/101",
        authors: [{ name: "Author 1" }],
      },
    ],
  };
}

function inlineAnalysis(summary: string, inputFingerprint = "a".repeat(64)) {
  return {
    version: 1,
    inputFingerprint,
    source: "abstract" as const,
    analysis: { summary } as AIAnalysis,
  };
}

describe("search background inline-analysis merge", () => {
  it("keeps the current exact cache when stale hydration has no fingerprint", () => {
    const base = metadata();
    const legacyInlineAnalysis = { ...inlineAnalysis("legacy incoming") };
    Reflect.deleteProperty(legacyInlineAnalysis, "inputFingerprint");
    const current: SearchMetadata = {
      ...base,
      papers: base.papers.map((paper) => ({
        ...paper,
        inlineAnalysis: inlineAnalysis("current exact"),
      })),
    };
    const incoming: SearchMetadata = {
      ...base,
      papers: base.papers.map((paper) => ({ ...paper, inlineAnalysis: legacyInlineAnalysis })),
    };

    const merged = mergeSearchBackgroundMetadata(incoming, current, base);

    expect(merged.papers[0]).toMatchObject({
      inlineAnalysis: {
        inputFingerprint: "a".repeat(64),
        analysis: { summary: "current exact" },
      },
    });
  });

  it("keeps an authoritative exact-cache miss from restoring the base stale analysis", () => {
    const baseMetadata = metadata();
    const base: SearchMetadata = {
      ...baseMetadata,
      papers: baseMetadata.papers.map((paper) => ({
        ...paper,
        inlineAnalysis: inlineAnalysis("stale base", "b".repeat(64)),
      })),
    };
    const incoming: SearchMetadata = {
      ...base,
      papers: base.papers.map((paper) => {
        const paperWithoutInlineAnalysis = { ...paper };
        Reflect.deleteProperty(paperWithoutInlineAnalysis, "inlineAnalysis");
        return paperWithoutInlineAnalysis;
      }),
    };

    const merged = mergeSearchBackgroundMetadata(incoming, base, base);

    expect("inlineAnalysis" in merged.papers[0]).toBe(false);
  });
});
