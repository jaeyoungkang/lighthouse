import { describe, expect, it } from "vitest";
import { mergeSearchEnrichmentDelta } from "@/app/components/research/background-search-tasks";
import { INLINE_ANALYSIS_VERSION, type AIAnalysis } from "@/app/domain/analysis";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import {
  buildSearchEnrichmentCommandV1,
  buildSearchSpellingCorrectionCommandV1,
  buildSearchTermDiscoveryCommandV1,
  hasSameSearchBackgroundTarget,
  SEARCH_BACKGROUND_COMMAND_VERSION,
  SEARCH_BACKGROUND_QUERY_MAX_CHARS,
  searchEnrichmentDeltaResponseV1Schema,
  searchTermDiscoveryCommandV1Schema,
} from "@/app/domain/search-background-transport";
import {
  SEARCH_BACKGROUND_PAPER_ID_MAX_CHARS,
  SEARCH_RESULT_POOL_PAPER_LIMIT,
  TERM_CANDIDATE_LLM_PAPER_LIMIT,
  TERM_CANDIDATE_PROMPT_ABSTRACT_CHARS,
  TERM_CANDIDATE_PROMPT_FIELD_CHARS,
} from "@/app/lib/constants";
import { MAX_SEARCH_QUERY_CLAUSES } from "@/app/lib/search-query";
import { getRouteBodyLimit } from "@/app/server/operational/route-ingress-policy";

function paper(paperId: string) {
  return {
    paperId,
    title: `Paper ${paperId}`,
    abstract: `Abstract ${paperId}`,
    year: 2026,
    citationCount: 1,
    url: `https://example.com/${paperId}`,
    authors: [{ name: "Ada" }],
  };
}

function metadata(paperCount = SEARCH_RESULT_POOL_PAPER_LIMIT): SearchMetadata {
  return {
    type: "search",
    query: "graph retrieval",
    papers: Array.from({ length: paperCount }, (_, index) => paper(String(index + 1))),
    total: paperCount,
    abstractHydration: { status: "pending" },
  };
}

function maximalPaperId(index: number): string {
  return (
    "한".repeat(SEARCH_BACKGROUND_PAPER_ID_MAX_CHARS - 1) + String.fromCharCode(0x3400 + index)
  );
}

function maximalMetadata(): SearchMetadata {
  const papers = Array.from({ length: SEARCH_RESULT_POOL_PAPER_LIMIT }, (_, index) => ({
    ...paper(maximalPaperId(index)),
    title: "한".repeat(TERM_CANDIDATE_PROMPT_FIELD_CHARS),
    abstract: "한".repeat(TERM_CANDIDATE_PROMPT_ABSTRACT_CHARS),
  }));
  const promptPaperIds = papers
    .slice(0, TERM_CANDIDATE_LLM_PAPER_LIMIT)
    .map(({ paperId }) => paperId);
  return {
    type: "search",
    query: "한".repeat(SEARCH_BACKGROUND_QUERY_MAX_CHARS),
    papers,
    total: papers.length,
    abstractHydration: { status: "pending", repairAttempted: true },
    libraryContext: {
      folders: [],
      signalPresent: true,
      interestWeights: {},
      libraryOnlyPaperIds: papers.map(({ paperId }) => paperId),
    },
    queryClauses: Array.from({ length: MAX_SEARCH_QUERY_CLAUSES }, () => ({
      rawClause: "한".repeat(SEARCH_BACKGROUND_QUERY_MAX_CHARS),
      normalizedClause: "한".repeat(SEARCH_BACKGROUND_QUERY_MAX_CHARS),
      role: "other" as const,
      isExtractive: true,
      derivedExpansions: Array.from({ length: MAX_SEARCH_QUERY_CLAUSES }, () =>
        "한".repeat(SEARCH_BACKGROUND_QUERY_MAX_CHARS),
      ),
    })),
    graphSupport: {
      version: 1,
      source: "episteme-paper-neighborhood",
      basis: "loaded_result_sample",
      status: "ready",
      samplePaperIds: promptPaperIds,
      paperScores: Object.fromEntries(
        promptPaperIds.map((paperId) => [
          paperId,
          {
            defaultScore: 1,
            graphScore: 1,
            semanticScore: null,
            sharedCiters: 1,
            sharedRefs: 1,
            seedCount: 1,
            sources: ["citation"],
          },
        ]),
      ),
      generatedAt: "2026-08-05T00:00:00.000Z",
    },
  };
}

function analysis(profileField = "retrieval"): AIAnalysis {
  return {
    summary: "summary",
    objective: "objective",
    methodology: "methodology",
    results: "results",
    keywords: ["retrieval"],
    semanticProfile: {
      topics: [profileField],
      method: profileField,
      claim: profileField,
      finding: profileField,
      quotedBasis: { topics: [], method: null, claim: null, finding: null },
    },
    confidence: "high",
    evidenceMap: {},
  };
}

function utf8Bytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

describe("search background v1 transport", () => {
  it("preserves all 80 committed papers and rejects provider control of the basis", () => {
    const existing = metadata();
    const merged = mergeSearchEnrichmentDelta(
      {
        papers: [
          {
            paperId: "1",
            abstract: "Hydrated",
            authors: [{ name: "Grace" }],
          },
        ],
        abstractHydration: { status: "ready" },
      },
      existing,
      existing,
    );

    expect(merged.papers.map((item) => item.paperId)).toEqual(
      existing.papers.map((item) => item.paperId),
    );
    expect(merged.papers[0]).toMatchObject({
      paperId: "1",
      title: "Paper 1",
      year: 2026,
      citationCount: 1,
      url: "https://example.com/1",
      abstract: "Hydrated",
      authors: [{ name: "Grace" }],
    });
    expect(merged.papers[79]).toEqual(existing.papers[79]);
  });

  it("removes committed inline analysis when hydration changes its canonical input", () => {
    const existing = metadata(1);
    existing.papers[0] = {
      ...existing.papers[0],
      inlineAnalysis: {
        version: INLINE_ANALYSIS_VERSION,
        inputFingerprint: "a".repeat(64),
        source: "abstract",
        analysis: analysis(),
      },
    };

    const merged = mergeSearchEnrichmentDelta(
      {
        papers: [{ paperId: "1", abstract: "Changed abstract" }],
        abstractHydration: { status: "ready" },
      },
      existing,
      existing,
    );

    expect(merged.papers[0]?.abstract).toBe("Changed abstract");
    expect(merged.papers[0]).not.toHaveProperty("inlineAnalysis");
  });

  it("keeps maximal UTF-8 enrichment and term commands inside route byte limits", async () => {
    const maximal = maximalMetadata();
    const enrichment = buildSearchEnrichmentCommandV1(maximal);
    const termDiscovery = await buildSearchTermDiscoveryCommandV1(maximal);

    expect(enrichment.target.orderedPaperIds).toHaveLength(SEARCH_RESULT_POOL_PAPER_LIMIT);
    expect(enrichment.target.orderedPaperIds.every((id) => id.length === 512)).toBe(true);
    expect(enrichment.hydration.libraryOnlyPaperIds).toHaveLength(SEARCH_RESULT_POOL_PAPER_LIMIT);
    expect(termDiscovery.promptPapers).toHaveLength(TERM_CANDIDATE_LLM_PAPER_LIMIT);
    expect(termDiscovery.queryClauses).toHaveLength(MAX_SEARCH_QUERY_CLAUSES);
    expect(
      termDiscovery.queryClauses.every((clause) => clause.derivedExpansions.length === 4),
    ).toBe(true);
    expect(termDiscovery.graphSupportedPaperIds).toHaveLength(TERM_CANDIDATE_LLM_PAPER_LIMIT);
    expect(utf8Bytes(enrichment)).toBeLessThanOrEqual(
      getRouteBodyLimit("app/api/search/enrichment/route.ts").maxBytes,
    );
    expect(utf8Bytes(termDiscovery)).toBeLessThanOrEqual(
      getRouteBodyLimit("app/api/search/term-discovery/route.ts").maxBytes,
    );
  });
});

describe("search background v1 rejection and identity boundaries", () => {
  it("rejects every bounded command dimension at max plus one", async () => {
    const maximal = maximalMetadata();
    const command = await buildSearchTermDiscoveryCommandV1(maximal);
    const extraPaper = { ...command.promptPapers[0], paperId: maximalPaperId(999) };
    const extraClause = command.queryClauses[0];

    expect(() =>
      buildSearchEnrichmentCommandV1(metadata(SEARCH_RESULT_POOL_PAPER_LIMIT + 1)),
    ).toThrow();
    expect(
      searchTermDiscoveryCommandV1Schema.safeParse({
        ...command,
        target: {
          ...command.target,
          orderedPaperIds: ["한".repeat(SEARCH_BACKGROUND_PAPER_ID_MAX_CHARS + 1)],
        },
        promptPapers: [],
        graphSupportedPaperIds: [],
      }).success,
    ).toBe(false);
    const paperWithoutFingerprint = { ...command.promptPapers[0] };
    Reflect.deleteProperty(paperWithoutFingerprint, "inputFingerprint");
    expect(
      searchTermDiscoveryCommandV1Schema.safeParse({
        ...command,
        promptPapers: [paperWithoutFingerprint],
        graphSupportedPaperIds: [],
      }).success,
    ).toBe(false);
    expect(
      searchTermDiscoveryCommandV1Schema.safeParse({
        ...command,
        promptPapers: [{ ...command.promptPapers[0], abstract: null }],
        graphSupportedPaperIds: [],
      }).success,
    ).toBe(false);
    expect(
      searchTermDiscoveryCommandV1Schema.safeParse({
        ...command,
        promptPapers: [...command.promptPapers, extraPaper],
      }).success,
    ).toBe(false);
    expect(
      searchTermDiscoveryCommandV1Schema.safeParse({
        ...command,
        promptPapers: [
          {
            ...command.promptPapers[0],
            semanticProfile: { topics: "untrusted", method: null, claim: null, finding: null },
          },
        ],
        graphSupportedPaperIds: [],
      }).success,
    ).toBe(false);
    expect(
      searchTermDiscoveryCommandV1Schema.safeParse({
        ...command,
        promptPapers: [
          { ...command.promptPapers[0], title: "한".repeat(TERM_CANDIDATE_PROMPT_FIELD_CHARS + 1) },
        ],
        graphSupportedPaperIds: [],
      }).success,
    ).toBe(false);
    expect(
      searchTermDiscoveryCommandV1Schema.safeParse({
        ...command,
        promptPapers: [
          {
            ...command.promptPapers[0],
            abstract: "한".repeat(TERM_CANDIDATE_PROMPT_ABSTRACT_CHARS + 1),
          },
        ],
        graphSupportedPaperIds: [],
      }).success,
    ).toBe(false);
    expect(
      searchTermDiscoveryCommandV1Schema.safeParse({
        ...command,
        queryClauses: [...command.queryClauses, extraClause],
      }).success,
    ).toBe(false);
    expect(
      searchTermDiscoveryCommandV1Schema.safeParse({
        ...command,
        queryClauses: [
          {
            ...extraClause,
            derivedExpansions: [
              ...extraClause.derivedExpansions,
              "한".repeat(SEARCH_BACKGROUND_QUERY_MAX_CHARS),
            ],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      searchTermDiscoveryCommandV1Schema.safeParse({
        ...command,
        graphSupportedPaperIds: [...command.graphSupportedPaperIds, extraPaper.paperId],
      }).success,
    ).toBe(false);
  });

  it("keeps inline analysis out while carrying only its exact cache identity", async () => {
    const current = metadata(1);
    current.papers[0] = {
      ...current.papers[0],
      inlineAnalysis: {
        version: INLINE_ANALYSIS_VERSION,
        inputFingerprint: "a".repeat(64),
        source: "abstract",
        analysis: analysis(),
      },
    };

    const projectedPaper = (await buildSearchTermDiscoveryCommandV1(current)).promptPapers[0];
    expect(projectedPaper.inputFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(projectedPaper.inputFingerprint).not.toBe("a".repeat(64));
    expect(projectedPaper).not.toHaveProperty("semanticProfile");
  });

  it("omits cache identity when the bounded prompt abstract is only whitespace", async () => {
    const current = metadata(1);
    current.papers[0] = {
      ...current.papers[0],
      abstract: `${" ".repeat(TERM_CANDIDATE_PROMPT_ABSTRACT_CHARS)}usable after prompt cap`,
    };

    const projectedPaper = (await buildSearchTermDiscoveryCommandV1(current)).promptPapers[0];

    expect(projectedPaper.abstract).toBe(" ".repeat(TERM_CANDIDATE_PROMPT_ABSTRACT_CHARS));
    expect(projectedPaper).not.toHaveProperty("inputFingerprint");
  });

  it("keeps papers 13-80 in stale-response identity even though they are outside the prompt", async () => {
    const command = await buildSearchTermDiscoveryCommandV1(metadata());
    const changed = {
      ...command.target,
      orderedPaperIds: command.target.orderedPaperIds.map((paperId, index) =>
        index === SEARCH_RESULT_POOL_PAPER_LIMIT - 1 ? "changed-last-paper" : paperId,
      ),
    };

    expect(hasSameSearchBackgroundTarget(command.target, changed)).toBe(false);
  });

  it("keeps the spelling command query-only and bounded", () => {
    const command = buildSearchSpellingCorrectionCommandV1(
      "한".repeat(SEARCH_BACKGROUND_QUERY_MAX_CHARS),
    );

    expect(command).toEqual({
      schemaVersion: SEARCH_BACKGROUND_COMMAND_VERSION,
      target: { query: "한".repeat(SEARCH_BACKGROUND_QUERY_MAX_CHARS) },
    });
    expect(utf8Bytes(command)).toBeLessThanOrEqual(
      getRouteBodyLimit("app/api/search/spelling-correction/route.ts").maxBytes,
    );
    expect(() =>
      buildSearchSpellingCorrectionCommandV1("한".repeat(SEARCH_BACKGROUND_QUERY_MAX_CHARS + 1)),
    ).toThrow();
  });

  it("rejects duplicate, foreign, and authority-expanding enrichment delta fields", () => {
    const target = buildSearchEnrichmentCommandV1(metadata(2)).target;
    const base = {
      schemaVersion: SEARCH_BACKGROUND_COMMAND_VERSION,
      target,
      delta: {
        papers: [{ paperId: "1", abstract: "Hydrated" }],
        abstractHydration: { status: "ready" as const },
      },
      updatedAt: "2026-08-05T00:00:00.000Z",
    };

    expect(searchEnrichmentDeltaResponseV1Schema.safeParse(base).success).toBe(true);
    expect(
      searchEnrichmentDeltaResponseV1Schema.safeParse({
        ...base,
        delta: { ...base.delta, papers: [{ paperId: "1" }, { paperId: "1" }] },
      }).success,
    ).toBe(false);
    expect(
      searchEnrichmentDeltaResponseV1Schema.safeParse({
        ...base,
        delta: { ...base.delta, papers: [{ paperId: "foreign" }] },
      }).success,
    ).toBe(false);
    expect(
      searchEnrichmentDeltaResponseV1Schema.safeParse({
        ...base,
        delta: { ...base.delta, papers: [{ paperId: "1", title: "Provider title" }] },
      }).success,
    ).toBe(false);
    expect(
      searchEnrichmentDeltaResponseV1Schema.safeParse({
        ...base,
        delta: {
          ...base.delta,
          papers: [
            {
              paperId: "1",
              inlineAnalysis: {
                version: INLINE_ANALYSIS_VERSION,
                inputFingerprint: "a".repeat(64),
                source: "abstract",
                analysis: analysis(),
              },
            },
          ],
        },
      }).success,
    ).toBe(false);
  });
});
