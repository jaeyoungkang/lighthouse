import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { hydrateEpistemePapers } from "@/app/server/services/episteme-literature";
import type * as EpistemeLiteratureModule from "@/app/server/services/episteme-literature";
import {
  lookupPaperNeighborhood,
  type LibraryNeighborhoodCandidate,
} from "@/app/server/services/episteme-paper-neighborhood";
import { getLibraryContextForUser } from "@/app/server/services/library-context-source";
import type * as LibraryContextSourceModule from "@/app/server/services/library-context-source";
import {
  buildSearchExecutionFromUrlParams,
  executeSearchFromUrl,
} from "@/app/server/services/search-execution";
import * as SearchServiceModule from "@/app/server/services/search-service";
import {
  applyLibraryContextToSearchResults,
  resolveLibraryNeighborhoodPreflight,
} from "@/app/server/services/search-hydration";
import type * as SearchHydrationModule from "@/app/server/services/search-hydration";
import type { MappedPaper } from "@/app/server/services/search-service";

const keywordSearchExport = vi.hoisted(
  () => process.env.AF_Q2_KEYWORD_SEARCH_EXPORT?.trim() || "fetchEpistemePapers",
);
const reviewedPapersSourceMock = vi.hoisted(() =>
  vi.fn(() => Promise.resolve({ reviewedPapers: [{ paperId: "900", title: "Anchor paper" }] })),
);

vi.mock("@/app/server/services/search-service", async (importOriginal) => {
  const actual: typeof SearchServiceModule = await importOriginal();
  return {
    ...actual,
    [keywordSearchExport]: vi.fn(),
    buildSearchViewPayload: vi.fn(
      (
        ownerPrincipalId: string,
        query: string,
        mappedPapers: MappedPaper[],
        total: number,
        _createdBy: "user" | "agent",
        _queryClauses: unknown,
        totalMode: SearchMetadata["totalMode"],
        _clauseStats: unknown,
        _userId: string,
        _reviewedMap: Map<string, Date>,
        _seedPaper: unknown,
        _termSeed: unknown,
        _spellingCorrection: unknown,
        sortOption: SearchMetadata["sortOption"] | undefined,
        yearFilter: string | undefined,
        _facetFilters: unknown,
        exactLookup: SearchMetadata["exactLookup"],
        _paging: unknown,
        _source: unknown,
        libraryGrounding: {
          context?: SearchMetadata["libraryContext"];
          available?: boolean;
          outcome?: SearchMetadata["libraryGrounding"];
        },
        abstractHydration: SearchMetadata["abstractHydration"],
      ) => ({
        ownerPrincipalId,
        type: "search",
        title: query,
        content: "",
        createdBy: "user",
        metadata: {
          type: "search",
          query,
          sortOption: sortOption ?? "relevance",
          ...(yearFilter ? { yearFilter } : {}),
          ...(exactLookup ? { exactLookup } : {}),
          papers: mappedPapers.map((paper) => ({
            paperId: paper.paperId,
            title: paper.title,
            abstract: paper.abstract,
            year: paper.year,
            citationCount: paper.citationCount,
            url: paper.url,
            authors: paper.authors.map((name) => ({ name })),
          })),
          total,
          ...(totalMode ? { totalMode } : {}),
          ...(libraryGrounding.context ? { libraryContext: libraryGrounding.context } : {}),
          ...(libraryGrounding.available ? { libraryContextAvailable: true } : {}),
          ...(libraryGrounding.outcome ? { libraryGrounding: libraryGrounding.outcome } : {}),
          ...(abstractHydration ? { abstractHydration } : {}),
        },
      }),
    ),
  };
});

// Delegate-through-actual seam: co-equal payload tests stub the two functions
// per test, while the preflight-internals tests below let the real
// search-hydration chain run against the deeper provider mocks.
vi.mock("@/app/server/services/search-hydration", async (importOriginal) => {
  const actual: typeof SearchHydrationModule = await importOriginal();
  return {
    ...actual,
    resolveLibraryNeighborhoodPreflight: vi.fn(actual.resolveLibraryNeighborhoodPreflight),
    applyLibraryContextToSearchResults: vi.fn(actual.applyLibraryContextToSearchResults),
  };
});

vi.mock("@/app/server/services/library-context-source", async (importOriginal) => {
  const actual: typeof LibraryContextSourceModule = await importOriginal();
  return {
    ...actual,
    getLibraryContextForUser: vi.fn(),
  };
});

vi.mock("@/app/server/services/episteme-paper-neighborhood", () => ({
  lookupPaperNeighborhood: vi.fn(),
}));

vi.mock("@/app/server/services/episteme-literature", async (importOriginal) => {
  const actual: typeof EpistemeLiteratureModule = await importOriginal();
  return {
    ...actual,
    hydrateEpistemePapers: vi.fn(),
  };
});

vi.mock("@/app/server/domain-access/reviewed-paper-access", () => ({
  resolveMyReviewedPapersLibraryContextSource: reviewedPapersSourceMock,
  resolveMyCachedReviewedPapersLibraryContextSource: reviewedPapersSourceMock,
}));

type KeywordSearch = typeof SearchServiceModule.fetchEpistemePapers;
const mockedFetchKeywordPapers = vi.mocked(
  (SearchServiceModule as unknown as Record<string, KeywordSearch>)[keywordSearchExport],
);
const mockedResolvePreflight = vi.mocked(resolveLibraryNeighborhoodPreflight);
const mockedApplyLibraryNeighborhood = vi.mocked(applyLibraryContextToSearchResults);
const mockedGetLibraryContext = vi.mocked(getLibraryContextForUser);
const mockedLookupPaperNeighborhood = vi.mocked(lookupPaperNeighborhood);
const mockedHydrateEpistemePapers = vi.mocked(hydrateEpistemePapers);
const mockedResolveReviewedPapersSource = reviewedPapersSourceMock;

function mappedPaper(id: string, title = `Paper ${id}`): MappedPaper {
  return {
    paperId: id,
    title,
    abstract: null,
    year: 2024,
    venue: "Venue",
    citationCount: 10,
    url: `https://example.com/${id}`,
    authors: ["Ada"],
  };
}

function neighborhoodCandidate(id: string, defaultScore: number): LibraryNeighborhoodCandidate {
  return {
    corpusId: id,
    defaultScore,
    graphScore: defaultScore,
    semanticScore: null,
    sharedCiters: 1,
    sharedRefs: 0,
    seedCount: 1,
    sources: ["co_cited"],
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("search execution", () => {
  it("builds the search execution from URL params with live library preflight eligibility", () => {
    const input = buildSearchExecutionFromUrlParams({
      q: "graph retrieval",
      sort: "year",
      year: "2021-2024",
      field: ["Computer Science"],
      author: ["Alice", "Bob"],
      venue: "NeurIPS",
      hasPdf: "true",
      personalize: "false",
      lib: "1",
    });

    expect(input).toMatchObject({
      query: "graph retrieval",
      sort: "year",
      providerSort: "year",
      year: "2021-2024",
      personalize: false,
      libraryContextAvailable: true,
      facetFilters: {
        fieldsOfStudy: ["Computer Science"],
        authors: ["Alice", "Bob"],
        venues: ["NeurIPS"],
        hasPdf: true,
      },
    });

    const source = readFileSync(
      path.join(process.cwd(), "app/server/services/search-execution.ts"),
      "utf8",
    );
    expect(source).not.toContain("app/server/repository");
    expect(source).not.toContain("createAdminClient");
    expect(source).toContain("@/app/server/domain-access/reviewed-paper-access");
    if (process.env.AF_Q2_TARGET_ROOT) {
      expect(source).toMatch(/resolveMy(?:Cached)?ReviewedPapersLibraryContextSource/);
    } else {
      expect(source).toContain("resolveMyReviewedPapersLibraryContextSource");
    }
  });

  it("canonicalizes direct reversed, equal, and lower-open publication-year ranges", () => {
    expect(
      buildSearchExecutionFromUrlParams({ q: "graph retrieval", year: "2024-2021" }),
    ).toMatchObject({
      year: "2021-2024",
      canonicalKey: "q=graph+retrieval&year=2021-2024",
    });
    expect(
      buildSearchExecutionFromUrlParams({ q: "graph retrieval", year: "1990-" }),
    ).toMatchObject({
      year: "1990-",
      canonicalKey: "q=graph+retrieval&year=1990-",
    });
    expect(
      buildSearchExecutionFromUrlParams({ q: "graph retrieval", year: "2024-2024" }),
    ).toMatchObject({
      year: "2024",
      canonicalKey: "q=graph+retrieval&year=2024",
    });
  });

  it("carries the canonical publication-year range through execution metadata", async () => {
    const input = buildSearchExecutionFromUrlParams({
      q: "10.1145/3375637",
      year: "2024-2021",
    });
    if (!input) throw new Error("expected search execution input");
    mockedFetchKeywordPapers.mockResolvedValueOnce({
      papers: [mappedPaper("101")],
      total: 1,
      totalMode: "exact",
      queryClauses: [],
      clauseStats: [],
      exactLookup: { kind: "doi", value: "10.1145/3375637" },
    });
    mockedApplyLibraryNeighborhood.mockReturnValueOnce(null);

    const result = await executeSearchFromUrl({ ownerPrincipalId: "user-1", input });

    expect(mockedFetchKeywordPapers).toHaveBeenCalledWith(
      expect.objectContaining({ year: "2021-2024" }),
      undefined,
    );
    expect((result.view.metadata as SearchMetadata).yearFilter).toBe("2021-2024");
    expect((result.view.metadata as SearchMetadata).abstractHydration).toBeUndefined();
  });

  it("applies a completed My Library graph preflight to a direct search URL first payload", async () => {
    const input = buildSearchExecutionFromUrlParams({ q: "graph retrieval", sort: "relevance" });
    if (!input) throw new Error("expected search execution input");
    const keywordPapers = [mappedPaper("101")];
    const librarySummary = {
      folders: [{ name: "Graph" }],
      signalPresent: true,
      interestWeights: { "101": 1 },
      computedAt: "2026-07-07T00:00:00.000Z",
    } satisfies NonNullable<SearchMetadata["libraryContext"]>;

    mockedFetchKeywordPapers.mockResolvedValueOnce({
      papers: keywordPapers,
      total: 57,
      totalMode: "exact",
      queryClauses: [],
      clauseStats: [],
    });
    mockedResolvePreflight.mockResolvedValueOnce({
      libraryContext: {
        folders: [{ name: "Graph", anchorCorpusIds: ["900"] }],
        neighborhood: {},
        computedAt: "2026-07-07T00:00:00.000Z",
      },
      neighborhood: new Map([["301", 8]]),
      neighborhoodCandidates: new Map([["301", neighborhoodCandidate("301", 8)]]),
      anchorPaperIds: ["900"],
      hydratedCandidates: [mappedPaper("301")],
      providerStatus: "degraded",
    });
    mockedApplyLibraryNeighborhood.mockReturnValueOnce({
      papers: keywordPapers,
      total: 57,
      librarySummary,
      libraryContextAvailable: true,
      resolvedSort: "interest",
    });

    const result = await executeSearchFromUrl({
      ownerPrincipalId: "user-1",
      userEmail: "reader@example.com",
      input,
    });

    expect(mockedFetchKeywordPapers).toHaveBeenCalledWith(
      {
        query: "graph retrieval",
        limit: 40,
        year: undefined,
        sort: undefined,
        hydrate: false,
      },
      undefined,
    );
    const preflightParams = mockedResolvePreflight.mock.calls[0]?.[0];
    expect(preflightParams).toMatchObject({
      userEmail: "reader@example.com",
      query: "graph retrieval",
      personalize: true,
      libraryContextUserSource: { reviewedPapers: [{ paperId: "900", title: "Anchor paper" }] },
    });
    expect(preflightParams.signal).toBeInstanceOf(AbortSignal);
    expect(mockedApplyLibraryNeighborhood).toHaveBeenCalledWith({
      keywordPapers,
      providerTotal: 57,
      query: "graph retrieval",
      year: undefined,
      requestedSort: undefined,
      preflight: {
        libraryContext: {
          folders: [{ name: "Graph", anchorCorpusIds: ["900"] }],
          neighborhood: {},
          computedAt: "2026-07-07T00:00:00.000Z",
        },
        neighborhood: new Map([["301", 8]]),
        neighborhoodCandidates: new Map([["301", neighborhoodCandidate("301", 8)]]),
        anchorPaperIds: ["900"],
        hydratedCandidates: [mappedPaper("301")],
        providerStatus: "degraded",
      },
    });
    expect(result.view.metadata).toMatchObject({
      type: "search",
      sortOption: "interest",
      total: 57,
      libraryContext: librarySummary,
      libraryContextAvailable: true,
      libraryGrounding: {
        requested: true,
        status: "applied",
      },
      abstractHydration: {
        status: "pending",
      },
    });
    expect((result.view.metadata as SearchMetadata).abstractHydration).not.toHaveProperty(
      "personalize",
    );
    expect((result.view.metadata as SearchMetadata).papers.map((paper) => paper.paperId)).toEqual([
      "101",
    ]);
  });

  it("returns a failed view when keyword retrieval fails", async () => {
    const input = buildSearchExecutionFromUrlParams({ q: "graph retrieval" });
    if (!input) throw new Error("expected search execution input");
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    mockedFetchKeywordPapers.mockRejectedValueOnce(new Error("keyword provider unavailable"));

    const result = await executeSearchFromUrl({
      ownerPrincipalId: "user-1",
      input,
    });

    expect(result.failed).toBe(true);
    expect(result.executed).toBe(false);
    expect(result.view.status).toBe("failed");
  });
});

describe("search execution identity", () => {
  it("keeps production view identity on canonical conditions and changes it with conditions", async () => {
    const firstInput = buildSearchExecutionFromUrlParams({ q: "graph retrieval" });
    const changedInput = buildSearchExecutionFromUrlParams({
      q: "graph retrieval",
      sort: "year",
    });
    const collisionInputA = buildSearchExecutionFromUrlParams({ q: "bex9j8 q6d1kt" });
    const collisionInputB = buildSearchExecutionFromUrlParams({ q: "w9awp 1l9jjoz" });
    if (!firstInput || !changedInput || !collisionInputA || !collisionInputB) {
      throw new Error("expected search execution inputs");
    }
    for (const papers of [
      [mappedPaper("101")],
      [mappedPaper("202"), mappedPaper("203")],
      [mappedPaper("301")],
      [mappedPaper("401")],
      [mappedPaper("402")],
    ]) {
      mockedFetchKeywordPapers.mockResolvedValueOnce({
        papers,
        total: papers.length,
        totalMode: "exact",
        queryClauses: [],
        clauseStats: [],
      });
    }
    for (let index = 0; index < 5; index += 1) {
      mockedApplyLibraryNeighborhood.mockReturnValueOnce(null);
    }

    const first = await executeSearchFromUrl({ ownerPrincipalId: "user-1", input: firstInput });
    const changedSnapshot = await executeSearchFromUrl({
      ownerPrincipalId: "user-1",
      input: firstInput,
    });
    const changedCondition = await executeSearchFromUrl({
      ownerPrincipalId: "user-1",
      input: changedInput,
    });
    const collisionA = await executeSearchFromUrl({
      ownerPrincipalId: "user-1",
      input: collisionInputA,
    });
    const collisionB = await executeSearchFromUrl({
      ownerPrincipalId: "user-1",
      input: collisionInputB,
    });

    expect((first.view.metadata as SearchMetadata).papers).not.toEqual(
      (changedSnapshot.view.metadata as SearchMetadata).papers,
    );
    expect(changedSnapshot.view.id).toBe(first.view.id);
    expect(changedCondition.view.id).not.toBe(first.view.id);
    expect(collisionA.view.id).not.toBe(collisionB.view.id);
  });
});

describe("search execution — combined library result pool in the first payload", () => {
  it("waits for a slow library preflight and commits one combined result pool", async () => {
    // 그래프 preflight는 keyword fetch와 같은 검색 응답의 co-equal 입력이다 —
    // 과거 grace 곁예산(1.5s)이면 버려졌을 느린 preflight도 첫 payload가 기다려
    // 함께 커밋되고, preflight signal은 abort되지 않는다.
    vi.useFakeTimers();
    const input = buildSearchExecutionFromUrlParams({ q: "graph retrieval" });
    if (!input) throw new Error("expected search execution input");
    const keywordPapers = [mappedPaper("101"), mappedPaper("102")];
    const librarySummary = {
      folders: [{ name: "Graph" }],
      signalPresent: true,
      interestWeights: { "102": 2, "301": 1 },
      rankingMode: "combined_score",
      libraryOnlyPaperIds: ["301"],
      computedAt: "2026-07-07T00:00:00.000Z",
    } satisfies NonNullable<SearchMetadata["libraryContext"]>;
    const slowPreflight = {
      libraryContext: {
        folders: [{ name: "Graph", anchorCorpusIds: ["900"] }],
        neighborhood: {},
        computedAt: "2026-07-07T00:00:00.000Z",
      },
      neighborhood: new Map([["301", 8]]),
      neighborhoodCandidates: new Map([["301", neighborhoodCandidate("301", 8)]]),
      anchorPaperIds: ["900"],
      hydratedCandidates: [mappedPaper("301")],
    };
    let preflightSignal: AbortSignal | undefined;

    mockedFetchKeywordPapers.mockResolvedValueOnce({
      papers: keywordPapers,
      total: 57,
      totalMode: "exact",
      queryClauses: [],
      clauseStats: [],
    });
    mockedResolvePreflight.mockImplementationOnce(({ signal }) => {
      preflightSignal = signal;
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(slowPreflight);
        }, 5_000);
      });
    });
    mockedApplyLibraryNeighborhood.mockReturnValueOnce({
      papers: [...keywordPapers, mappedPaper("301")],
      total: 58,
      librarySummary,
      libraryContextAvailable: true,
      resolvedSort: "interest",
    });

    const resultPromise = executeSearchFromUrl({
      ownerPrincipalId: "user-1",
      userEmail: "reader@example.com",
      input,
    });
    await vi.waitFor(() => {
      expect(mockedResolvePreflight).toHaveBeenCalledTimes(1);
    });
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await resultPromise;

    expect(preflightSignal?.aborted).toBe(false);
    expect(mockedApplyLibraryNeighborhood).toHaveBeenCalledWith({
      keywordPapers,
      providerTotal: 57,
      query: "graph retrieval",
      year: undefined,
      requestedSort: undefined,
      preflight: slowPreflight,
    });
    expect(result.view.metadata).toMatchObject({
      type: "search",
      sortOption: "interest",
      total: 58,
      libraryContext: librarySummary,
      libraryContextAvailable: true,
      abstractHydration: {
        status: "pending",
      },
    });
    expect((result.view.metadata as SearchMetadata).papers.map((paper) => paper.paperId)).toEqual([
      "101",
      "102",
      "301",
    ]);
  });

  it("degrades to the keyword first payload when the graph preflight fails", async () => {
    // e2 실패·timeout은 preflight 체인의 degrade-to-null로 keyword-only 첫
    // payload에 닫히고, first_reveal_only 정책으로 늦은 재주입 없이 고정된다.
    const input = buildSearchExecutionFromUrlParams({ q: "graph retrieval" });
    if (!input) throw new Error("expected search execution input");
    const keywordPapers = [mappedPaper("101"), mappedPaper("102")];

    mockedFetchKeywordPapers.mockResolvedValueOnce({
      papers: keywordPapers,
      total: 57,
      totalMode: "exact",
      queryClauses: [],
      clauseStats: [],
    });
    mockedResolvePreflight.mockResolvedValueOnce(null);
    mockedApplyLibraryNeighborhood.mockReturnValueOnce(null as never);

    const result = await executeSearchFromUrl({
      ownerPrincipalId: "user-1",
      userEmail: "reader@example.com",
      input,
    });

    if (!process.env.AF_Q2_TARGET_ROOT) {
      expect(mockedApplyLibraryNeighborhood).toHaveBeenCalledWith({
        keywordPapers,
        providerTotal: 57,
        query: "graph retrieval",
        year: undefined,
        requestedSort: undefined,
        preflight: null,
      });
    }
    expect(result.view.metadata).toMatchObject({
      type: "search",
      sortOption: "relevance",
      total: 57,
      abstractHydration: {
        status: "pending",
      },
    });
    expect((result.view.metadata as SearchMetadata).libraryContext).toBeUndefined();
    expect((result.view.metadata as SearchMetadata).papers.map((paper) => paper.paperId)).toEqual([
      "101",
      "102",
    ]);
  });
});

describe("search execution — preflight-internal discovery hydration", () => {
  const LIBRARY_CONTEXT = {
    folders: [{ name: "Graph", anchorCorpusIds: ["900"] }],
    neighborhood: {},
    computedAt: "2026-07-07T00:00:00.000Z",
  };

  type KeywordFetchResult = Awaited<ReturnType<KeywordSearch>>;

  it("starts discovery hydration inside the preflight concurrently with the keyword fetch", async () => {
    // 이 테스트는 real search-hydration 체인을 태운다: 발견 후보 /papers/batch
    // hydration은 keyword fetch 완료를 기다리지 않고 preflight 체인 안에서
    // 이미 시작되어 keyword fetch와 병렬로 겹친다.
    const input = buildSearchExecutionFromUrlParams({ q: "graph retrieval" });
    if (!input) throw new Error("expected search execution input");
    const timingLog = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const keywordPapers = [mappedPaper("101"), mappedPaper("102")];
    let resolveKeywordFetch!: (value: KeywordFetchResult) => void;
    mockedFetchKeywordPapers.mockReturnValueOnce(
      new Promise<KeywordFetchResult>((resolve) => {
        resolveKeywordFetch = resolve;
      }),
    );
    mockedGetLibraryContext.mockResolvedValueOnce(LIBRARY_CONTEXT);
    mockedLookupPaperNeighborhood.mockResolvedValueOnce([neighborhoodCandidate("301", 8)]);
    mockedHydrateEpistemePapers.mockResolvedValueOnce([mappedPaper("301")]);

    const resultPromise = executeSearchFromUrl({
      ownerPrincipalId: "user-1",
      userEmail: "reader@example.com",
      input,
    });

    // keyword fetch가 아직 미해결인 시점에 발견 후보 hydration은 이미 호출됐다.
    await vi.waitFor(() => {
      expect(mockedHydrateEpistemePapers).toHaveBeenCalledTimes(1);
    });
    expect(mockedHydrateEpistemePapers).toHaveBeenCalledWith(["301"], expect.any(AbortSignal));

    resolveKeywordFetch({
      papers: keywordPapers,
      total: 57,
      totalMode: "exact",
      queryClauses: [],
      clauseStats: [],
    });
    const result = await resultPromise;

    // projection은 prehydrated 후보의 순수 계산이라 새 hydration 왕복이 없다.
    expect(mockedHydrateEpistemePapers).toHaveBeenCalledTimes(1);
    expect((result.view.metadata as SearchMetadata).papers.map((paper) => paper.paperId)).toEqual([
      "101",
      "102",
      "301",
    ]);
    expect(result.view.metadata).toMatchObject({
      sortOption: "interest",
      libraryContextAvailable: true,
      libraryContext: {
        rankingMode: "combined_score",
        libraryOnlyPaperIds: ["301"],
      },
    });
    expect(timingLog).toHaveBeenCalledWith(
      "[search-timing]",
      expect.objectContaining({
        graphCandidatesReturned: 1,
        graphCandidatesHydrated: 1,
        libraryDiscoveryCount: 1,
      }),
    );
  });

  it("starts keyword retrieval beside the live library read, then starts graph retrieval when ids arrive", async () => {
    const input = buildSearchExecutionFromUrlParams({ q: "graph retrieval" });
    if (!input) throw new Error("expected search execution input");
    const timingLog = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const keywordPapers = [mappedPaper("101"), mappedPaper("102")];
    const callLog: string[] = [];
    let resolveReviewedSource!: (value: {
      reviewedPapers: Array<{ paperId: string; title: string }>;
    }) => void;
    let resolveKeywordFetch!: (value: KeywordFetchResult) => void;
    let resolveNeighborhood!: (value: LibraryNeighborhoodCandidate[]) => void;
    let resolveSupplementBatch!: (value: MappedPaper[]) => void;
    mockedResolveReviewedPapersSource.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          callLog.push("source:reviewed-papers");
          resolveReviewedSource = resolve;
        }),
    );
    mockedFetchKeywordPapers.mockImplementationOnce(() => {
      callLog.push("provider:keyword-fetch");
      return new Promise<KeywordFetchResult>((resolve) => {
        resolveKeywordFetch = resolve;
      });
    });
    mockedGetLibraryContext.mockResolvedValueOnce(LIBRARY_CONTEXT);
    mockedLookupPaperNeighborhood.mockImplementationOnce(() => {
      callLog.push("provider:paper-neighborhood");
      return new Promise((resolve) => {
        resolveNeighborhood = resolve;
      });
    });
    mockedHydrateEpistemePapers.mockImplementationOnce(() => {
      callLog.push("provider:papers-batch");
      return new Promise((resolve) => {
        resolveSupplementBatch = resolve;
      });
    });

    const resultPromise = executeSearchFromUrl({
      ownerPrincipalId: "user-1",
      userEmail: "reader@example.com",
      input,
    });

    // Keyword retrieval does not wait for the owner-shaped DB source.
    await vi.waitFor(() => {
      expect(mockedFetchKeywordPapers).toHaveBeenCalledTimes(1);
      expect(mockedResolveReviewedPapersSource).toHaveBeenCalled();
    });
    expect(mockedLookupPaperNeighborhood).not.toHaveBeenCalled();
    expect(callLog).toEqual(["provider:keyword-fetch", "source:reviewed-papers"]);

    resolveReviewedSource({ reviewedPapers: [{ paperId: "900", title: "Anchor paper" }] });
    // Source가 준비되는 즉시 PaperNeighborhood가 keyword 결과를 기다리지 않고 시작된다.
    await vi.waitFor(() => {
      expect(mockedLookupPaperNeighborhood).toHaveBeenCalledTimes(1);
    });
    expect(callLog).toEqual([
      "provider:keyword-fetch",
      "source:reviewed-papers",
      "provider:paper-neighborhood",
    ]);

    callLog.push("keyword-fetch:resolved");
    resolveKeywordFetch({
      papers: keywordPapers,
      total: 57,
      totalMode: "exact",
      queryClauses: [],
      clauseStats: [],
    });
    expect(mockedHydrateEpistemePapers).not.toHaveBeenCalled();

    // E3 rich batch hydration은 keyword 결과가 아니라 discovery 응답에 의존한다.
    // 따라서 keyword가 먼저 끝난 일정에서도 graph 응답 직후 바로 시작한다.
    resolveNeighborhood([neighborhoodCandidate("301", 8)]);
    await vi.waitFor(() => {
      expect(mockedHydrateEpistemePapers).toHaveBeenCalledWith(["301"], expect.any(AbortSignal));
    });
    expect(callLog).toEqual([
      "provider:keyword-fetch",
      "source:reviewed-papers",
      "provider:paper-neighborhood",
      "keyword-fetch:resolved",
      "provider:papers-batch",
    ]);

    let revealed = false;
    void resultPromise.then(() => {
      revealed = true;
    });
    await Promise.resolve();
    expect(revealed).toBe(false);

    resolveSupplementBatch([mappedPaper("301")]);
    const result = await resultPromise;
    expect(revealed).toBe(true);
    expect((result.view.metadata as SearchMetadata).papers.map((paper) => paper.paperId)).toEqual([
      "101",
      "102",
      "301",
    ]);
    expect(timingLog).toHaveBeenCalledWith(
      "[search-timing]",
      expect.objectContaining({
        librarySourceOutcome: "ready",
        reviewedPaperCount: 1,
        librarySourceResolutionMs: expect.any(Number) as number,
      }),
    );
  });
});
