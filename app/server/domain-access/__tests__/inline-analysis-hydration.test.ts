import { describe, expect, it, vi } from "vitest";
import { INLINE_ANALYSIS_VERSION, type AIAnalysis } from "@/app/domain/analysis";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { buildSearchTermDiscoveryCommandV1 } from "@/app/domain/search-background-transport";
import {
  TERM_CANDIDATE_PROMPT_ABSTRACT_CHARS,
  TERM_CANDIDATE_PROMPT_FIELD_CHARS,
} from "@/app/lib/constants";
import { hydrateSearchMetadataWithCachedInlineAnalysis } from "@/app/server/domain-access/inline-analysis-access";
import { buildInlineAnalysisInputFingerprint } from "@/app/server/domain-access/inline-analysis-identity";
import type { PaperInlineAnalysisCacheRecord } from "@/app/server/repository/paper-inline-analysis-cache";

const analysis: AIAnalysis = {
  summary: "summary",
  objective: "objective",
  methodology: "methodology",
  results: "results",
  keywords: ["cache"],
  semanticProfile: {
    topics: ["shared cache"],
    method: "evaluation",
    claim: "claim",
    finding: "finding",
    quotedBasis: { topics: [], method: null, claim: null, finding: null },
  },
  confidence: "high",
  evidenceMap: {},
};

function paper() {
  return {
    paperId: "paper-1",
    title: "Paper 1",
    abstract: "abstract",
    year: 2025,
    citationCount: 1,
    url: "https://example.com/paper-1",
    authors: [],
  };
}

function staleMetadata(): SearchMetadata {
  return {
    type: "search",
    query: "shared cache",
    papers: [
      {
        ...paper(),
        inlineAnalysis: {
          version: INLINE_ANALYSIS_VERSION,
          inputFingerprint: "b".repeat(64),
          analysis: { ...analysis, summary: "stale input" },
          source: "abstract",
        },
      },
    ],
    total: 1,
  };
}

describe("inline analysis cache hydration identity", () => {
  it.each([
    { title: "  Paper\nOne  ", abstract: "  method\tresult  ", year: null },
    { title: '논문 "β"', abstract: "초록\n\n내용", year: 2026 },
  ])("keeps the browser fingerprint mirror equal to the server canonical hash", async (input) => {
    const canonicalPaper = { ...paper(), ...input };
    const metadata: SearchMetadata = {
      type: "search",
      query: "shared cache",
      papers: [canonicalPaper],
      total: 1,
    };

    const promptPaper = (await buildSearchTermDiscoveryCommandV1(metadata)).promptPapers[0];

    expect(promptPaper.inputFingerprint).toBe(buildInlineAnalysisInputFingerprint(canonicalPaper));
  });

  it("reuses the full canonical cache identity after title and abstract prompt truncation", async () => {
    const canonicalPaper = {
      ...paper(),
      title: "T".repeat(TERM_CANDIDATE_PROMPT_FIELD_CHARS + 1),
      abstract: "A".repeat(TERM_CANDIDATE_PROMPT_ABSTRACT_CHARS + 301),
    };
    const canonicalMetadata: SearchMetadata = {
      type: "search",
      query: "shared cache",
      papers: [canonicalPaper],
      total: 1,
    };
    const promptPaper = (await buildSearchTermDiscoveryCommandV1(canonicalMetadata))
      .promptPapers[0];
    const inputFingerprint = promptPaper.inputFingerprint;
    if (!inputFingerprint) throw new Error("expected an exact cache identity");
    expect(inputFingerprint).toBe(buildInlineAnalysisInputFingerprint(canonicalPaper));
    const projectedMetadata: SearchMetadata = {
      ...canonicalMetadata,
      papers: [
        {
          ...canonicalPaper,
          title: promptPaper.title,
          abstract: promptPaper.abstract,
        },
      ],
    };
    const cached: PaperInlineAnalysisCacheRecord = {
      paperId: canonicalPaper.paperId,
      version: INLINE_ANALYSIS_VERSION,
      inputFingerprint,
      analysis,
      source: "abstract",
      createdAt: "2026-08-05T00:00:00.000Z",
      updatedAt: "2026-08-05T00:00:00.000Z",
    };
    const listCachedInlineAnalyses = vi.fn().mockResolvedValue(new Map([["paper-1", cached]]));

    const next = await hydrateSearchMetadataWithCachedInlineAnalysis(
      {
        db: { source: "shared-db" } as never,
        metadata: projectedMetadata,
        cacheInputFingerprintByPaperId: new Map([[canonicalPaper.paperId, inputFingerprint]]),
      },
      { listCachedInlineAnalyses },
    );

    expect(listCachedInlineAnalyses).toHaveBeenCalledWith(
      { source: "shared-db" },
      [expect.objectContaining({ paperId: canonicalPaper.paperId, inputFingerprint })],
      undefined,
    );
    expect(next.papers[0]).toMatchObject({
      inlineAnalysis: {
        inputFingerprint,
        analysis: { semanticProfile: analysis.semanticProfile },
      },
    });
  });

  it("replaces a same-version embedded analysis when its paper input fingerprint changed", async () => {
    const currentFingerprint = buildInlineAnalysisInputFingerprint(paper());
    const cached: PaperInlineAnalysisCacheRecord = {
      paperId: "paper-1",
      version: INLINE_ANALYSIS_VERSION,
      inputFingerprint: currentFingerprint,
      analysis,
      source: "abstract",
      createdAt: "2026-07-13T00:00:00.000Z",
      updatedAt: "2026-07-13T00:00:00.000Z",
    };
    const listCachedInlineAnalyses = vi.fn().mockResolvedValue(new Map([["paper-1", cached]]));
    const signal = new AbortController().signal;

    const next = await hydrateSearchMetadataWithCachedInlineAnalysis(
      { db: { source: "shared-db" } as never, metadata: staleMetadata(), signal },
      { listCachedInlineAnalyses },
    );

    expect(next.papers[0]).toMatchObject({
      inlineAnalysis: {
        inputFingerprint: currentFingerprint,
        analysis: { summary: "summary" },
      },
    });
    expect(listCachedInlineAnalyses).toHaveBeenCalledWith(
      { source: "shared-db" },
      [expect.objectContaining({ paperId: "paper-1", inputFingerprint: currentFingerprint })],
      signal,
    );
  });

  it("removes a mismatched embedded analysis when the exact shared cache is missing", async () => {
    const listCachedInlineAnalyses = vi.fn().mockResolvedValue(new Map());

    const next = await hydrateSearchMetadataWithCachedInlineAnalysis(
      { db: { source: "shared-db" } as never, metadata: staleMetadata() },
      { listCachedInlineAnalyses },
    );

    expect(listCachedInlineAnalyses).toHaveBeenCalledTimes(1);
    expect("inlineAnalysis" in next.papers[0]).toBe(false);
  });

  it("removes embedded analysis from a whitespace-only abstract without consulting the cache", async () => {
    const listCachedInlineAnalyses = vi.fn();
    const metadata = staleMetadata();
    metadata.papers[0] = {
      ...metadata.papers[0],
      abstract: "  \n\t ",
    };

    const next = await hydrateSearchMetadataWithCachedInlineAnalysis(
      { db: { source: "shared-db" } as never, metadata },
      { listCachedInlineAnalyses },
    );

    expect(listCachedInlineAnalyses).not.toHaveBeenCalled();
    expect("inlineAnalysis" in next.papers[0]).toBe(false);
  });

  it("propagates an aborted request signal to the shared-cache read", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("request cancelled", "AbortError"));
    const listCachedInlineAnalyses = vi.fn(
      (_db: unknown, _identities: unknown, signal?: AbortSignal) => {
        signal?.throwIfAborted();
        return Promise.resolve(new Map());
      },
    );

    await expect(
      hydrateSearchMetadataWithCachedInlineAnalysis(
        {
          db: { source: "shared-db" } as never,
          metadata: staleMetadata(),
          signal: controller.signal,
        },
        { listCachedInlineAnalyses },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
