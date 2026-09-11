import { describe, expect, it } from "vitest";
import { INLINE_ANALYSIS_VERSION } from "@/app/domain/analysis";
import { buildCanonicalGapNetworkSourceSnapshot } from "../gap-network-view-input";
import { buildGapReportSourceInputDigest } from "../gap-report-source-identity";

const paper = {
  paperId: "paper-1",
  title: "Paper",
  abstract: "abstract",
  year: 2026,
  citationCount: 1,
  url: "https://example.com/paper-1",
  authors: [{ name: "Author" }],
  referenceIds: [],
  citationIds: [],
};

describe("gap report source identity", () => {
  it("projects viewer-private fields out before persistence, digest, and build", () => {
    const canonical = buildCanonicalGapNetworkSourceSnapshot({
      sourceSnapshotId: "route-a",
      sourceQuery: "research agents",
      papers: [
        {
          ...paper,
          reviewed: true,
          reviewedAt: "2026-07-12T00:00:00.000Z",
          inlineAnalysis: {
            version: INLINE_ANALYSIS_VERSION,
            source: "abstract",
            analysis: {
              summary: "viewer summary",
              objective: "viewer claim",
              methodology: "viewer method",
              results: "viewer finding",
              keywords: ["private"],
              semanticProfile: {
                claim: "viewer claim",
                topics: ["private"],
                method: "viewer method",
                finding: "viewer finding",
                quotedBasis: {
                  claim: null,
                  topics: [],
                  method: null,
                  finding: null,
                },
              },
              confidence: "high",
              evidenceMap: {},
            },
          },
        },
      ],
    });

    expect(canonical.papers[0]).not.toHaveProperty("reviewed");
    expect(canonical.papers[0]).not.toHaveProperty("reviewedAt");
    expect(canonical.papers[0]).not.toHaveProperty("inlineAnalysis");
  });

  it("ignores ephemeral source route ids for global content reuse", () => {
    const first = buildGapReportSourceInputDigest({
      sourceSnapshotId: "route-a",
      sourceQuery: " research agents ",
      papers: [paper],
    });
    const second = buildGapReportSourceInputDigest({
      sourceSnapshotId: "route-b",
      sourceQuery: "research agents",
      papers: [paper],
    });

    expect(first).toBe(second);
  });

  it("changes when persisted, share-safe build input changes", () => {
    const first = buildGapReportSourceInputDigest({
      sourceSnapshotId: "route-a",
      sourceQuery: "research agents",
      papers: [paper],
      createdBy: "user",
    });
    const second = buildGapReportSourceInputDigest({
      sourceSnapshotId: "route-a",
      sourceQuery: "research agents",
      papers: [{ ...paper, title: "Changed paper" }],
      createdBy: "user",
    });

    expect(first).not.toBe(second);
  });

  it("ignores viewer-private fields, unselected papers, query clauses, and graph timestamps", () => {
    const shared = {
      sourceSnapshotId: "route-a",
      sourceQuery: "research agents",
      sourcePaperIds: ["paper-1"],
      papers: [paper, { ...paper, paperId: "paper-2", title: "Unselected" }],
      graphSupport: {
        version: 1 as const,
        source: "episteme-paper-neighborhood" as const,
        basis: "loaded_result_sample" as const,
        status: "ready" as const,
        samplePaperIds: ["paper-1"],
        paperScores: {
          "paper-1": {
            defaultScore: 1,
            graphScore: 1,
            semanticScore: null,
            sharedCiters: 1,
            sharedRefs: null,
            seedCount: 1,
            sources: ["co_cited"],
          },
        },
        generatedAt: "2026-07-10T00:00:00.000Z",
      },
    };
    const first = buildGapReportSourceInputDigest({
      ...shared,
      papers: [{ ...paper, reviewed: true, inlineAnalysis: undefined }, shared.papers[1]],
      queryClauses: [],
    });
    const second = buildGapReportSourceInputDigest({
      ...shared,
      graphSupport: { ...shared.graphSupport, generatedAt: "2026-07-12T00:00:00.000Z" },
    });

    expect(first).toBe(second);
  });

  it("changes when build-effective graph evidence changes", () => {
    const base = {
      sourceSnapshotId: "route-a",
      sourceQuery: "research agents",
      papers: [paper],
      graphSupport: {
        version: 1 as const,
        source: "episteme-paper-neighborhood" as const,
        basis: "loaded_result_sample" as const,
        status: "ready" as const,
        samplePaperIds: ["paper-1"],
        paperScores: {
          "paper-1": {
            defaultScore: 1,
            graphScore: 1,
            semanticScore: null,
            sharedCiters: 1,
            sharedRefs: null,
            seedCount: 1,
            sources: ["co_cited"],
          },
        },
        generatedAt: "2026-07-10T00:00:00.000Z",
      },
    };
    const changed = {
      ...base,
      graphSupport: {
        ...base.graphSupport,
        paperScores: {
          "paper-1": { ...base.graphSupport.paperScores["paper-1"], graphScore: 2 },
        },
      },
    };

    expect(buildGapReportSourceInputDigest(base)).not.toBe(
      buildGapReportSourceInputDigest(changed),
    );
  });
});

describe("gap report graph source identity", () => {
  it("projects private search diagnostics out of shared gap persistence and identity", () => {
    const graphSupport = {
      version: 2 as const,
      source: "episteme-paper-neighborhood" as const,
      basis: "library_anchor_neighborhood" as const,
      status: "ready" as const,
      anchorPaperCount: 17,
      samplePaperIds: ["paper-1"],
      paperScores: {
        "paper-1": {
          defaultScore: 1,
          graphScore: 1,
          semanticScore: null,
          sharedCiters: 1,
          sharedRefs: null,
          seedCount: 1,
          sources: ["co_cited"],
        },
      },
      candidateCounts: {
        providerReturned: 42,
        hydrated: 40,
        keywordOverlap: 1,
        admittedSupplement: 39,
        deferredByQueryRelevance: 3,
        filteredOut: {
          candidateCap: 2,
          hydrationUnavailable: 0,
          publicationYear: 0,
          nonPositiveScore: 0,
          titleFamilyDuplicate: 0,
        },
      },
      generatedAt: "2026-07-14T00:00:00.000Z",
    };
    const input = {
      sourceSnapshotId: "route-a",
      sourceQuery: "research agents",
      papers: [paper],
      graphSupport,
    };
    const canonical = buildCanonicalGapNetworkSourceSnapshot(input);

    expect(canonical.graphSupport).toMatchObject({
      version: 2,
      basis: "gap_source_snapshot",
      samplePaperIds: ["paper-1"],
      paperScores: graphSupport.paperScores,
    });
    expect(canonical.graphSupport).not.toHaveProperty("anchorPaperCount");
    expect(canonical.graphSupport).not.toHaveProperty("candidateCounts");
    expect(buildGapReportSourceInputDigest(input)).toBe(
      buildGapReportSourceInputDigest({
        ...input,
        graphSupport: {
          ...graphSupport,
          anchorPaperCount: 999,
          candidateCounts: {
            ...graphSupport.candidateCounts,
            providerReturned: 999,
          },
        },
      }),
    );
  });

  it("pins locale-independent ordering for content-addressed graph keys", () => {
    const graphScore = (score: number) => ({
      defaultScore: score,
      graphScore: score,
      semanticScore: null,
      sharedCiters: score,
      sharedRefs: null,
      seedCount: 1,
      sources: ["co_cited" as const],
    });
    const input = {
      sourceSnapshotId: "route-a",
      sourceQuery: "research agents",
      sourcePaperIds: ["Z", "ä"],
      papers: [
        { ...paper, paperId: "Z", title: "Z", url: "https://example.com/Z" },
        { ...paper, paperId: "ä", title: "ä", url: "https://example.com/a-umlaut" },
      ],
      graphSupport: {
        version: 1 as const,
        source: "episteme-paper-neighborhood" as const,
        basis: "loaded_result_sample" as const,
        status: "ready" as const,
        samplePaperIds: ["Z", "ä"],
        paperScores: { ä: graphScore(2), Z: graphScore(1) },
        generatedAt: "2026-07-10T00:00:00.000Z",
      },
    };

    expect(buildGapReportSourceInputDigest(input)).toBe(
      "243558fbb2444d23870a55d17888591f20214c53acf3f7959a250894b6ad896e",
    );
  });
});
