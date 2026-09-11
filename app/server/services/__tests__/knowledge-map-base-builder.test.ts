import { describe, expect, it } from "vitest";
import { INLINE_ANALYSIS_VERSION, type AIAnalysis } from "@/app/domain/analysis";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { buildExternalSignalsFromInlineAnalysis } from "@/app/server/services/knowledge-map/base-builder";

const analysis = {
  confidence: "high",
  semanticProfile: {
    claim: "Current claim",
    topics: ["current topic"],
    method: "current method",
    finding: "current finding",
  },
} as AIAnalysis;

function paper(params: {
  paperId: string;
  abstract: string;
  version: number;
}): SearchMetadata["papers"][number] {
  return {
    paperId: params.paperId,
    title: `Paper ${params.paperId}`,
    abstract: params.abstract,
    year: 2026,
    citationCount: 1,
    url: `https://example.com/${params.paperId}`,
    authors: [],
    reviewed: false,
    inlineAnalysis: {
      version: params.version,
      inputFingerprint: params.paperId.repeat(64).slice(0, 64),
      analysis,
      source: "abstract",
    },
  };
}

describe("buildExternalSignalsFromInlineAnalysis", () => {
  it("uses only current analyses backed by a usable abstract", () => {
    const signals = buildExternalSignalsFromInlineAnalysis([
      paper({ paperId: "a", abstract: "usable abstract", version: INLINE_ANALYSIS_VERSION }),
      paper({
        paperId: "b",
        abstract: "legacy abstract",
        version: INLINE_ANALYSIS_VERSION - 1,
      }),
      paper({ paperId: "c", abstract: " \n\t ", version: INLINE_ANALYSIS_VERSION }),
    ]);

    expect(signals).toEqual([
      {
        paperId: "a",
        claim: "Current claim",
        topics: ["current topic"],
        methods: ["current method"],
        finding: "current finding",
      },
    ]);
  });
});
