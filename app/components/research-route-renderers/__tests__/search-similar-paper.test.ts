import { describe, it, expect } from "vitest";
import { buildSimilarPaperQuery } from "../search-view.helpers";
import type { PaperCore } from "@/app/domain/paper";
import type { InlineAnalysisCache } from "@/app/domain/research-route-payload";
import { INLINE_ANALYSIS_VERSION } from "@/app/domain/analysis";

// ─── Fixtures ──────────────────────────────────────────────

const basePaper: PaperCore = {
  paperId: "paper-1",
  title: "Attention Is All You Need",
  abstract: "We propose a new simple network architecture...",
  year: 2017,
  citationCount: 50000,
  url: "https://arxiv.org/abs/1706.03762",
  authors: [{ name: "Vaswani" }],
};

function makeInlineAnalysis(topics: string[]): InlineAnalysisCache {
  return {
    version: INLINE_ANALYSIS_VERSION,
    analysis: {
      summary: "Transformer architecture proposal",
      objective: "Replace RNNs with attention",
      methodology: "Self-attention mechanism",
      results: "SOTA on translation tasks",
      keywords: ["transformer", "attention"],
      semanticProfile: {
        claim: "Attention mechanisms alone are sufficient",
        topics,
        method: "Multi-head self-attention",
        finding: "Outperforms RNN-based models",
        quotedBasis: {
          claim: null,
          topics,
          method: null,
          finding: null,
        },
      },
      confidence: "high",
      evidenceMap: {},
    },
    source: "abstract",
  };
}

// ─── Tests ─────────────────────────────────────────────────

describe("buildSimilarPaperQuery — 유사 논문 쿼리 구성 (promise:similar-papers-discovery)", () => {
  it("AC5: 인라인 분석 없으면 제목 그대로 반환한다", () => {
    const query = buildSimilarPaperQuery(basePaper);
    expect(query).toBe("Attention Is All You Need");
  });

  it("AC5: inlineAnalysis가 undefined이면 제목 그대로 반환한다", () => {
    const query = buildSimilarPaperQuery(basePaper, undefined);
    expect(query).toBe("Attention Is All You Need");
  });

  it("AC2: 인라인 분석 있으면 제목 첫 5단어 + topics 상위 3개를 쉼표로 연결한다", () => {
    const inlineAnalysis = makeInlineAnalysis([
      "transformer",
      "self-attention",
      "neural machine translation",
      "deep learning",
    ]);
    const query = buildSimilarPaperQuery(basePaper, inlineAnalysis);
    // title 첫 5단어: "Attention Is All You Need" (exactly 5)
    // topics 상위 3: "transformer", "self-attention", "neural machine translation"
    expect(query).toBe(
      "Attention Is All You Need, transformer, self-attention, neural machine translation",
    );
  });

  it("AC2: 제목이 5단어를 초과하면 첫 5단어만 사용한다", () => {
    const longTitlePaper: PaperCore = {
      ...basePaper,
      title: "A Very Long Paper Title With Many Words Here",
    };
    const inlineAnalysis = makeInlineAnalysis(["topic-a", "topic-b"]);
    const query = buildSimilarPaperQuery(longTitlePaper, inlineAnalysis);
    expect(query).toBe("A Very Long Paper Title, topic-a, topic-b");
  });

  it("AC2: topics가 3개 미만이면 있는 것만 포함한다", () => {
    const inlineAnalysis = makeInlineAnalysis(["transformer", "attention"]);
    const query = buildSimilarPaperQuery(basePaper, inlineAnalysis);
    expect(query).toBe("Attention Is All You Need, transformer, attention");
  });

  it("AC5: 인라인 분석이 있어도 topics가 비어 있으면 제목 그대로 반환한다", () => {
    const inlineAnalysis = makeInlineAnalysis([]);
    const query = buildSimilarPaperQuery(basePaper, inlineAnalysis);
    expect(query).toBe("Attention Is All You Need");
  });

  it("AC2: 제목이 5단어 미만이면 제목 단어 전체를 사용한다", () => {
    const shortTitlePaper: PaperCore = {
      ...basePaper,
      title: "BERT Pretraining",
    };
    const inlineAnalysis = makeInlineAnalysis(["language model", "pretraining"]);
    const query = buildSimilarPaperQuery(shortTitlePaper, inlineAnalysis);
    expect(query).toBe("BERT Pretraining, language model, pretraining");
  });

  it("AC2: topics가 정확히 3개이면 모두 포함한다", () => {
    const inlineAnalysis = makeInlineAnalysis(["topic-a", "topic-b", "topic-c"]);
    const query = buildSimilarPaperQuery(basePaper, inlineAnalysis);
    expect(query).toBe("Attention Is All You Need, topic-a, topic-b, topic-c");
  });
});
