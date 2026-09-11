import { afterEach, describe, expect, it } from "vitest";
import { INLINE_ANALYSIS_VERSION, type AIAnalysis } from "@/app/domain/analysis";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import {
  buildReviewedPaperPayload,
  buildSearchViewBodyViewModel,
  createReviewedIdSet,
  formatPaperAuthors,
  getNextVisibleSearchResultCount,
  getAnalysisStatusBadge,
  summarizeAnalysisProgress,
  toggleReviewedPaperIds,
  truncateLabel,
} from "@/app/components/research-route-renderers/search-view.helpers";
import { persistInlineAnalysis } from "@/app/components/research/background-inline-analysis";
import {
  buildYearRangeFilter,
  paperMatchesYearFilter,
  parseYearRangeFilter,
} from "@/app/domain/search-year-range";
import {
  buildInlineAnalysisMap,
  buildInlineAnalysisPayload,
  buildInlineAnalysisProgressMap,
  buildInlineAnalysisResponseMap,
  hasPendingInlineAnalysis,
  hasRunningInlineAnalysis,
  mergeInlineAnalysisIntoPapers,
  mergeInlineAnalysisResults,
  queueVisibleInlineAnalysis,
  resolveInlineAnalysisBatchProgress,
  selectInlineAnalysisBatch,
  updateInlineAnalysisProgress,
} from "@/app/lib/inline-analysis";
import { sortSearchPapers } from "@/app/lib/search-paper-sort";
import {
  buildReviewDoneSystemEventMessage,
  buildSearchSystemEventMessage,
} from "@/app/components/research-route-renderers/search-view-messages.helpers";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

const analysis: AIAnalysis = {
  summary: "summary",
  objective: "objective",
  methodology: "methodology",
  results: "results",
  keywords: ["one", "two"],
  semanticProfile: {
    claim: "objective",
    topics: ["one", "two"],
    method: "methodology",
    finding: "results",
    quotedBasis: {
      claim: "objective evidence",
      topics: ["one", "two"],
      method: "method evidence",
      finding: "result evidence",
    },
  },
  confidence: "high",
  evidenceMap: {},
};
const inputFingerprint = "a".repeat(64);

const papers: SearchMetadata["papers"] = [
  {
    paperId: "paper-1",
    title: "Paper 1",
    abstract: "abstract 1",
    year: 2024,
    citationCount: 10,
    url: "https://example.com/1",
    authors: [{ name: "Alice" }],
    reviewed: true,
    inlineAnalysis: {
      version: INLINE_ANALYSIS_VERSION,
      inputFingerprint,
      analysis,
      source: "abstract",
    },
  },
  {
    paperId: "paper-2",
    title: "Paper 2",
    abstract: null,
    year: 2023,
    citationCount: 3,
    url: "https://example.com/2",
    authors: [{ name: "Bob" }, { name: "Carol" }],
  },
];

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
});

describe("search-view helpers: inline analysis", () => {
  it("builds inline analysis and reviewed lookup structures", () => {
    expect(buildInlineAnalysisMap(papers).get("paper-1")?.source).toBe("abstract");
    expect(buildInlineAnalysisProgressMap(papers)).toEqual(new Map([["paper-1", "done"]]));
    expect(createReviewedIdSet(papers)).toEqual(new Set(["paper-1"]));
  });

  it("ignores stale inline analysis cache versions", () => {
    const firstPaper = papers.at(0);
    if (!firstPaper) {
      throw new Error("expected paper fixture");
    }

    const stalePapers: SearchMetadata["papers"] = [
      {
        ...firstPaper,
        inlineAnalysis: {
          analysis,
          source: "abstract",
          version: 1,
        },
      },
    ];

    expect(buildInlineAnalysisMap(stalePapers)).toEqual(new Map());
    expect(buildInlineAnalysisProgressMap(stalePapers)).toEqual(new Map());
  });

  it("ignores failure placeholders so the client can retry analysis", () => {
    const firstPaper = papers.at(0);
    if (!firstPaper) {
      throw new Error("expected paper fixture");
    }

    const failedPapers: SearchMetadata["papers"] = [
      {
        ...firstPaper,
        inlineAnalysis: {
          analysis: {
            ...analysis,
            confidence: "low",
            semanticProfile: {
              ...analysis.semanticProfile,
              claim: null,
              topics: [],
              method: null,
            },
          },
          source: "abstract",
          version: INLINE_ANALYSIS_VERSION,
        },
      },
    ];

    expect(buildInlineAnalysisMap(failedPapers)).toEqual(new Map());
    expect(buildInlineAnalysisProgressMap(failedPapers)).toEqual(new Map());
  });

  it("builds minimal inline analysis payloads only for papers with abstracts", () => {
    const paperWithManyAuthors = papers[0]
      ? {
          ...papers[0],
          authors: Array.from({ length: 279 }, (_, index) => ({
            name: `Author ${String(index + 1)}`,
          })),
        }
      : null;
    if (!paperWithManyAuthors) throw new Error("expected paper fixture");

    expect(buildInlineAnalysisPayload([paperWithManyAuthors, papers[1]])).toEqual([
      {
        paperId: "paper-1",
        title: "Paper 1",
        abstract: "abstract 1",
        year: 2024,
      },
    ]);
  });

  it("merges inline analysis results into papers", () => {
    const merged = mergeInlineAnalysisIntoPapers(
      papers,
      new Map([
        [
          "paper-2",
          {
            inputFingerprint,
            analysis,
            source: "abstract" as const,
          },
        ],
      ]),
    );

    expect(merged[1]).toMatchObject({
      paperId: "paper-2",
      inlineAnalysis: {
        version: INLINE_ANALYSIS_VERSION,
        analysis,
        source: "abstract",
      },
    });
  });

  it("queues visible inline analysis work and selects batches from queued papers", () => {
    const queueCandidates: SearchMetadata["papers"] = [
      ...papers,
      {
        paperId: "paper-3",
        title: "Paper 3",
        abstract: "abstract 3",
        year: 2022,
        citationCount: 1,
        url: "https://example.com/3",
        authors: [{ name: "Dora" }],
      },
      {
        paperId: "paper-4",
        title: "Paper 4",
        abstract: "abstract 4",
        year: 2021,
        citationCount: 0,
        url: "https://example.com/4",
        authors: [{ name: "Eve" }],
      },
    ];

    const queued = queueVisibleInlineAnalysis({
      papers: queueCandidates,
      visibleCount: 3,
      analysisMap: buildInlineAnalysisMap(queueCandidates),
      analysisProgressMap: buildInlineAnalysisProgressMap(queueCandidates),
    });

    expect(queued).toEqual(
      new Map([
        ["paper-1", "done"],
        ["paper-3", "queued"],
      ]),
    );
    expect(
      selectInlineAnalysisBatch({
        papers: queueCandidates,
        visibleCount: 3,
        analysisProgressMap: new Map([...queued, ["paper-4", "queued" as const]]),
        batchSize: 2,
      }).map((paper) => paper.paperId),
    ).toEqual(["paper-3"]);
    expect(hasRunningInlineAnalysis(queued)).toBe(false);
  });

  it("requeues missing inline analysis results before surfacing an error", () => {
    const responseMap = buildInlineAnalysisResponseMap([
      {
        paperId: "paper-3",
        analysis,
        source: "abstract",
      },
    ]);
    const mergedAnalysisMap = mergeInlineAnalysisResults(new Map(), responseMap);
    const runningProgress = updateInlineAnalysisProgress(
      new Map(),
      ["paper-3", "paper-4"],
      "running",
    );

    expect(mergedAnalysisMap.get("paper-3")).toEqual({
      analysis,
      source: "abstract",
    });
    expect(hasRunningInlineAnalysis(runningProgress)).toBe(true);
    expect(
      resolveInlineAnalysisBatchProgress({
        analysisProgressMap: runningProgress,
        batchPaperIds: ["paper-3", "paper-4"],
        resultMap: responseMap,
      }),
    ).toEqual(
      new Map([
        ["paper-3", "done"],
        ["paper-4", "queued"],
      ]),
    );
  });

  it("detects pending inline analysis only for visible papers with abstracts", () => {
    const progressMap = new Map<string, "queued" | "done" | "error">([
      ["paper-1", "done"],
      ["paper-2", "error"],
    ]);
    const analysisMap = new Map([
      [
        "paper-1",
        {
          analysis,
          source: "abstract" as const,
        },
      ],
    ]);

    expect(hasPendingInlineAnalysis(papers, analysisMap, progressMap, 2)).toBe(false);
    expect(
      hasPendingInlineAnalysis(
        [
          {
            paperId: "paper-3",
            title: "Paper 3",
            abstract: "abstract 3",
            year: 2022,
            citationCount: 1,
            url: "https://example.com/3",
            authors: [{ name: "Dora" }],
          },
        ],
        new Map(),
        new Map(),
        1,
      ),
    ).toBe(true);
  });
});

describe("search-view helpers: inline analysis persistence", () => {
  it("returns null when inline analysis persistence does not yield a valid document", async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(
        persistInlineAnalysis("doc-1", papers, undefined, "test-execution"),
      ).resolves.toBeNull();
    }
  });

  it("does not merge late inline analysis after hydration changes its prompt input", async () => {
    const currentMetadata: SearchMetadata = {
      type: "search",
      query: "agent memory",
      total: 2,
      abstractHydration: { status: "ready", personalize: true },
      libraryContextAvailable: true,
      papers: papers.map((paper, index) => ({
        ...paper,
        title: `Hydrated Paper ${String(index + 1)}`,
        abstract: `hydrated abstract ${String(index + 1)}`,
        authors: [{ name: index === 0 ? "Hydrated Alice" : "Hydrated Bob" }],
        inlineAnalysis: undefined,
      })),
    };
    const currentView = {
      status: "ready" as const,
      version: 0,
      reactionVersion: 0,
      id: "doc-1",
      type: "search" as const,
      title: "검색: agent memory",
      content: "",
      createdBy: "user" as const,
      metadata: currentMetadata,
      reaction: null,
      refs: [],
      ownerPrincipalId: "principal-1",
      createdAt: "2026-07-04T00:00:00.000Z",
      updatedAt: "2026-07-04T00:10:00.000Z",
    };
    const executionId = "test-execution";
    useResearchRouteStore.getState().setCurrentView(currentView, executionId);

    const lateTaskPapers = mergeInlineAnalysisIntoPapers(
      [
        {
          paperId: "paper-1",
          title: "Stale Paper 1",
          abstract: "stale abstract",
          year: 2020,
          citationCount: 1,
          url: "https://example.com/stale-1",
          authors: [{ name: "Stale Alice" }],
        },
        {
          paperId: "stale-only",
          title: "Stale Only",
          abstract: "stale only abstract",
          year: 2021,
          citationCount: 2,
          url: "https://example.com/stale-only",
          authors: [{ name: "Stale Only" }],
        },
      ],
      new Map([
        ["paper-1", { inputFingerprint, analysis, source: "abstract" }],
        ["stale-only", { inputFingerprint, analysis, source: "abstract" }],
      ]),
    );

    const updatedDocument = await persistInlineAnalysis(
      "doc-1",
      lateTaskPapers,
      undefined,
      executionId,
    );
    const updatedMetadata =
      useResearchRouteStore.getState().currentView?.metadata.type === "search"
        ? useResearchRouteStore.getState().currentView?.metadata
        : null;

    expect(updatedDocument?.updatedAt).toBe("2026-07-04T00:10:00.001Z");
    expect(updatedMetadata).toMatchObject({
      abstractHydration: { status: "ready", personalize: true },
      libraryContextAvailable: true,
    });
    expect(updatedMetadata?.papers).toHaveLength(2);
    expect(updatedMetadata?.papers[0]).toMatchObject({
      paperId: "paper-1",
      title: "Hydrated Paper 1",
      abstract: "hydrated abstract 1",
      authors: [{ name: "Hydrated Alice" }],
      inlineAnalysis: undefined,
    });
    expect(updatedMetadata?.papers[1]).toMatchObject({
      paperId: "paper-2",
      title: "Hydrated Paper 2",
    });
    expect(updatedMetadata?.papers.some((paper) => paper.paperId === "stale-only")).toBe(false);
  });
});

describe("search-view helpers: sorting and URL fallbacks", () => {
  it("sorts search papers by citation and year with deterministic tie-breakers", () => {
    const sortablePapers: SearchMetadata["papers"] = [
      {
        paperId: "older-high-cite",
        title: "Older high citation paper",
        abstract: null,
        year: 2022,
        citationCount: 50,
        url: "https://example.com/older-high-cite",
        authors: [],
      },
      {
        paperId: "newer-high-cite",
        title: "Newer high citation paper",
        abstract: null,
        year: 2024,
        citationCount: 50,
        url: "https://example.com/newer-high-cite",
        authors: [],
      },
      {
        paperId: "newer-low-cite",
        title: "Newer low citation paper",
        abstract: null,
        year: 2025,
        citationCount: 5,
        url: "https://example.com/newer-low-cite",
        authors: [],
      },
    ];

    expect(sortSearchPapers(sortablePapers, "citationCount").map((paper) => paper.paperId)).toEqual(
      ["newer-high-cite", "older-high-cite", "newer-low-cite"],
    );
    expect(sortSearchPapers(sortablePapers, "year").map((paper) => paper.paperId)).toEqual([
      "newer-low-cite",
      "newer-high-cite",
      "older-high-cite",
    ]);
    expect(sortSearchPapers(sortablePapers, "yearAsc").map((paper) => paper.paperId)).toEqual([
      "older-high-cite",
      "newer-high-cite",
      "newer-low-cite",
    ]);
  });

  it("ranks weighted query results under interest and keeps provider order under relevance", () => {
    const papers: SearchMetadata["papers"] = ["a", "b", "c"].map((id) => ({
      paperId: id,
      title: id.toUpperCase(),
      abstract: null,
      year: 2020,
      citationCount: 1,
      url: "",
      authors: [],
    }));
    // With no library-only ids these are all query results. Interest still uses
    // the projected library weights, while relevance is the provider-order escape hatch.
    const interestWeights = { c: 3000, a: 1500 };

    expect(
      sortSearchPapers(papers, "interest", interestWeights).map((paper) => paper.paperId),
    ).toEqual(["c", "a", "b"]);
    expect(
      sortSearchPapers(papers, "relevance", interestWeights).map((paper) => paper.paperId),
    ).toEqual(["a", "b", "c"]);
  });
});

describe("search-view helpers: search decisions", () => {
  it("builds search body view models and pagination decisions without intent ranking", () => {
    expect(
      buildSearchViewBodyViewModel({
        metadata: {
          type: "search",
          query: "",
          papers: [],
          total: 0,
        },
        visibleCount: 10,
        analysisProgressMap: new Map(),
      }),
    ).toEqual({
      isEmpty: true,
      resultPapers: [],
      visiblePapers: [],
      resultCount: 0,
      hasMorePapers: false,
      analyzedCount: 0,
      runningCount: 0,
      queuedCount: 0,
      isAnalyzing: false,
    });

    expect(
      buildSearchViewBodyViewModel({
        metadata: {
          type: "search",
          query: "llm",
          sortOption: "yearAsc",
          papers,
          total: 15,
        },
        visibleCount: 1,
        analysisProgressMap: new Map([
          ["paper-1", "done"],
          ["paper-2", "queued"],
        ]),
      }),
    ).toEqual({
      isEmpty: false,
      resultPapers: [papers[1], papers[0]],
      visiblePapers: [papers[1]],
      resultCount: 2,
      hasMorePapers: true,
      analyzedCount: 1,
      runningCount: 0,
      queuedCount: 1,
      isAnalyzing: true,
    });

    expect(
      buildSearchViewBodyViewModel({
        metadata: {
          type: "search",
          query: "llm",
          papers,
          total: 15,
        },
        visibleCount: 10,
        yearFilter: "2024",
        analysisProgressMap: new Map(),
      }).visiblePapers.map((paper) => paper.paperId),
    ).toEqual(["paper-1"]);

    expect(getNextVisibleSearchResultCount(10, 14)).toBe(14);
    expect(getNextVisibleSearchResultCount(10, 30)).toBe(20);
  });

  it("toggles reviewed paper ids", () => {
    expect(toggleReviewedPaperIds(new Set(["paper-1"]), "paper-1")).toEqual(new Set());
    expect(toggleReviewedPaperIds(new Set(["paper-1"]), "paper-2")).toEqual(
      new Set(["paper-1", "paper-2"]),
    );
  });
});

describe("search-view helpers: payloads and labels", () => {
  it("builds reviewed payloads and system messages", () => {
    expect(buildReviewedPaperPayload(papers[0])).toEqual({
      paperId: "paper-1",
      title: "Paper 1",
      url: "https://example.com/1",
      authors: [{ name: "Alice" }],
      year: 2024,
      citationCount: 10,
    });
    expect(buildReviewDoneSystemEventMessage("a".repeat(65))).toBe(
      `[system] "${"a".repeat(60)}…" 라이브러리에 추가`,
    );
    expect(
      buildSearchSystemEventMessage({
        query: "llm",
        kind: "request_failed",
      }),
    ).toBe('[system] "llm" 검색이 실패했다 — 잠시 후 다시 시도해보자');
    expect(
      buildSearchSystemEventMessage({
        query: "llm",
        kind: "invalid_response",
      }),
    ).toBe('[system] "llm" 검색 응답을 처리하지 못했다');
    expect(() =>
      buildSearchSystemEventMessage({
        query: "llm",
        kind: "analysis_completed",
      }),
    ).toThrow("Search analysis-complete event requires metadata");
    expect(() =>
      buildSearchSystemEventMessage({
        query: "llm",
        kind: "success",
      }),
    ).toThrow("Search success event requires metadata");
  });
});

describe("search-view helpers: presentation", () => {
  it("formats authors, badges, truncation, and progress summaries", () => {
    expect(formatPaperAuthors([])).toBe("");
    expect(formatPaperAuthors(papers[0].authors)).toBe("Alice");
    expect(
      formatPaperAuthors([{ name: "Alice" }, { name: "Bob" }, { name: "Carol" }, { name: "Dora" }]),
    ).toBe("Alice, Bob, Carol 외 1명");
    expect(getAnalysisStatusBadge("running")).toMatchObject({
      label: "분석 중",
      showSpinner: true,
    });
    expect(getAnalysisStatusBadge("done")).toMatchObject({
      label: "분석 완료",
      showSpinner: false,
    });
    expect(getAnalysisStatusBadge("queued")).toMatchObject({
      label: "분석 대기",
      showSpinner: false,
    });
    expect(getAnalysisStatusBadge("error")).toMatchObject({
      label: "분석 실패",
      showSpinner: false,
    });
    // promise:inline-analysis-auto-run AC6: 4 analysis states render as mutually distinguishable chips.
    const states = ["queued", "running", "done", "error"] as const;
    const badges = states.map((state) => getAnalysisStatusBadge(state));
    expect(new Set(badges.map((badge) => badge.label)).size).toBe(4);
    expect(new Set(badges.map((badge) => badge.className)).size).toBeGreaterThan(1);
    expect(badges.filter((badge) => badge.showSpinner)).toHaveLength(1);
    expect(badges.find((badge) => badge.showSpinner)?.label).toBe("분석 중");
    expect(truncateLabel("a".repeat(61))).toBe(`${"a".repeat(60)}…`);
    expect(truncateLabel("short")).toBe("short");
    expect(
      summarizeAnalysisProgress(
        new Map([
          ["a", "done"],
          ["b", "running"],
          ["c", "queued"],
          ["d", "error"],
        ]),
      ),
    ).toEqual({
      analyzedCount: 1,
      runningCount: 1,
      queuedCount: 1,
      isAnalyzing: true,
    });
    expect(summarizeAnalysisProgress(new Map([["a", "error"]]))).toEqual({
      analyzedCount: 0,
      runningCount: 0,
      queuedCount: 0,
      isAnalyzing: false,
    });
  });
});

describe("publication-year range filter helpers parse/build/match", () => {
  it("parses single year, range, half-open, and empty strings", () => {
    expect(parseYearRangeFilter("")).toEqual({ from: null, to: null });
    expect(parseYearRangeFilter("2024")).toEqual({ from: 2024, to: 2024 });
    expect(parseYearRangeFilter("2024-2024")).toEqual({ from: 2024, to: 2024 });
    expect(parseYearRangeFilter("1990-2000")).toEqual({ from: 1990, to: 2000 });
    expect(parseYearRangeFilter("1990-")).toEqual({ from: 1990, to: null });
    expect(parseYearRangeFilter("-2010")).toEqual({ from: null, to: 2010 });
    expect(parseYearRangeFilter("garbage")).toEqual({ from: null, to: null });
  });

  it("builds canonical range strings", () => {
    expect(buildYearRangeFilter(null, null)).toBe("");
    expect(buildYearRangeFilter(2024, 2024)).toBe("2024");
    expect(buildYearRangeFilter(1990, 2000)).toBe("1990-2000");
    expect(buildYearRangeFilter(1990, null)).toBe("1990-");
    expect(buildYearRangeFilter(null, 2010)).toBe("-2010");
  });

  it("normalizes reversed ranges so downstream matchers do not drop all papers", () => {
    expect(parseYearRangeFilter("2000-1990")).toEqual({ from: 1990, to: 2000 });
    expect(buildYearRangeFilter(2000, 1990)).toBe("1990-2000");
    expect(paperMatchesYearFilter(1995, buildYearRangeFilter(2000, 1990))).toBe(true);
  });

  it("matches paper years against ranges and single values", () => {
    expect(paperMatchesYearFilter(2024, "")).toBe(true);
    expect(paperMatchesYearFilter(2024, "2024")).toBe(true);
    expect(paperMatchesYearFilter(2023, "2024")).toBe(false);
    expect(paperMatchesYearFilter(1995, "1990-2000")).toBe(true);
    expect(paperMatchesYearFilter(2001, "1990-2000")).toBe(false);
    expect(paperMatchesYearFilter(2025, "1990-")).toBe(true);
    expect(paperMatchesYearFilter(1985, "1990-")).toBe(false);
    expect(paperMatchesYearFilter(1900, "-2010")).toBe(true);
    expect(paperMatchesYearFilter(2011, "-2010")).toBe(false);
    expect(paperMatchesYearFilter(null, "2024")).toBe(false);
    expect(paperMatchesYearFilter(null, "")).toBe(true);
  });
});
