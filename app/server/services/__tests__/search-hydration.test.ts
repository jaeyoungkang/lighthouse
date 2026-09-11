import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { hydrateEpistemePapers } from "@/app/server/services/episteme-literature";
import {
  blendNeighborhoodIntoPool,
  hydrateNeighborhoodSupplementBandWithOutcome,
  lookupLibraryNeighborhoodWithEvidence,
} from "@/app/server/services/library-anchor-blend";
import type { LibraryNeighborhoodCandidate } from "@/app/server/services/episteme-paper-neighborhood";
import type {
  LibraryContext,
  LibraryContextUserSource,
} from "@/app/server/services/library-context-source";
import { getLibraryContextForUser } from "@/app/server/services/library-context-source";
import { rankByLibraryInterest } from "@/app/server/services/library-grounded-ranking";
import {
  applyLibraryNeighborhoodToSearchResults,
  computeSearchHydration,
  resolveLibraryNeighborhoodPreflight,
  shouldRepairSearchHydration,
} from "@/app/server/services/search-hydration";
import type { MappedPaper } from "@/app/server/services/search-service";

vi.mock("@/app/server/services/episteme-literature", () => ({
  hydrateEpistemePapers: vi.fn(),
}));
vi.mock("@/app/server/services/library-anchor-blend", () => ({
  blendNeighborhoodIntoPool: vi.fn(),
  hydrateNeighborhoodSupplementBandWithOutcome: vi.fn(),
  lookupLibraryNeighborhoodWithEvidence: vi.fn(),
}));
vi.mock("@/app/server/services/library-context-source", () => ({
  getLibraryContextForUser: vi.fn(),
  filterLibraryContextByAnchorPaperIds: vi.fn(
    (context: LibraryContext | null, paperIds: readonly string[] | undefined) => {
      if (!context || !paperIds) return context;
      const selectedIds = new Set(paperIds);
      return {
        ...context,
        folders: context.folders
          .map((folder: { name: string; anchorCorpusIds: string[] }) => ({
            ...folder,
            anchorCorpusIds: folder.anchorCorpusIds.filter((paperId) => selectedIds.has(paperId)),
          }))
          .filter((folder: { anchorCorpusIds: string[] }) => folder.anchorCorpusIds.length > 0),
      };
    },
  ),
}));
vi.mock("@/app/server/services/library-grounded-ranking", () => ({
  rankByLibraryInterest: vi.fn(),
}));

const mockedHydrate = vi.mocked(hydrateEpistemePapers);
const mockedLookupNeighborhood = vi.mocked(lookupLibraryNeighborhoodWithEvidence);
const mockedHydrateSupplementBandWithOutcome = vi.mocked(
  hydrateNeighborhoodSupplementBandWithOutcome,
);
const mockedBlendNeighborhood = vi.mocked(blendNeighborhoodIntoPool);
const mockedGetLibraryContext = vi.mocked(getLibraryContextForUser);
const mockedRank = vi.mocked(rankByLibraryInterest);

function mappedPaper(id: string, title = `Paper ${id}`): MappedPaper {
  return {
    paperId: id,
    title,
    abstract: `Abstract ${id}`,
    year: 2024,
    venue: "Venue",
    citationCount: 10,
    url: `https://example.com/${id}`,
    authors: ["Ada"],
    openAccessPdf: { url: `https://example.com/${id}.pdf` },
  };
}

function lookupEvidence(
  neighborhood: Map<string, number>,
): Awaited<ReturnType<typeof lookupLibraryNeighborhoodWithEvidence>> {
  return {
    neighborhood,
    providerStatus: "ready",
    candidates: new Map(
      [...neighborhood].map(([corpusId, defaultScore]) => [
        corpusId,
        {
          corpusId,
          defaultScore,
          graphScore: defaultScore,
          semanticScore: null,
          sharedCiters: 1,
          sharedRefs: 0,
          seedCount: 1,
          sources: ["co_cited"],
        } satisfies LibraryNeighborhoodCandidate,
      ]),
    ),
  };
}

function metadata(overrides: Partial<SearchMetadata> = {}): SearchMetadata {
  return {
    type: "search",
    query: "graph retrieval",
    sortOption: "relevance",
    papers: [
      {
        paperId: "101",
        title: "Lightweight 101",
        abstract: null,
        year: 2024,
        citationCount: 3,
        url: "https://example.com/101",
        authors: [],
      },
      {
        paperId: "102",
        title: "Lightweight 102",
        abstract: null,
        year: 2023,
        citationCount: 2,
        url: "https://example.com/102",
        authors: [],
      },
    ],
    total: 57,
    abstractHydration: { status: "pending" },
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("library neighborhood preflight", () => {
  it("resolves a library neighborhood preflight from the current source and query", async () => {
    const libraryContext = {
      folders: [{ name: "Graph", anchorCorpusIds: ["900", "901"] }],
      neighborhood: {},
      computedAt: "2026-07-07T00:00:00.000Z",
    };
    const neighborhood = new Map([["301", 8]]);
    mockedGetLibraryContext.mockResolvedValueOnce(libraryContext);
    mockedLookupNeighborhood.mockResolvedValueOnce(lookupEvidence(neighborhood));
    mockedHydrateSupplementBandWithOutcome.mockResolvedValueOnce({
      papers: [mappedPaper("301")],
      providerStatus: "ready",
    });

    const preflight = await resolveLibraryNeighborhoodPreflight({
      userEmail: "reader@example.com",
      query: "graph retrieval",
      personalize: true,
      libraryPaperIds: ["900"],
    });

    expect(mockedGetLibraryContext).toHaveBeenCalledWith("reader@example.com");
    expect(mockedLookupNeighborhood).toHaveBeenCalledWith({
      libraryContext: {
        ...libraryContext,
        folders: [{ name: "Graph", anchorCorpusIds: ["900"] }],
      },
      query: "graph retrieval",
      candidateLimit: 40,
      signal: undefined,
    });
    // 보충 후보 hydration은 keyword 결과 없이 preflight 체인 안에서 완주한다.
    expect(mockedHydrateSupplementBandWithOutcome).toHaveBeenCalledWith({
      neighborhood,
      signal: undefined,
    });
    expect(preflight).toEqual({
      libraryContext: {
        ...libraryContext,
        folders: [{ name: "Graph", anchorCorpusIds: ["900"] }],
      },
      neighborhood,
      neighborhoodCandidates: lookupEvidence(neighborhood).candidates,
      anchorPaperIds: ["900"],
      hydratedCandidates: [mappedPaper("301")],
      providerStatus: "ready",
      legDurationsMs: {
        neighborhood: expect.any(Number) as number,
        supplementHydration: expect.any(Number) as number,
      },
    });
  });

  it("keeps the neighborhood projection with an empty supplement band when the neighborhood is empty", async () => {
    const libraryContext = {
      folders: [{ name: "Graph", anchorCorpusIds: ["900"] }],
      neighborhood: {},
      computedAt: "2026-07-07T00:00:00.000Z",
    };
    mockedGetLibraryContext.mockResolvedValueOnce(libraryContext);
    mockedLookupNeighborhood.mockResolvedValueOnce(lookupEvidence(new Map()));

    const preflight = await resolveLibraryNeighborhoodPreflight({
      userEmail: "reader@example.com",
      query: "graph retrieval",
      personalize: true,
    });

    expect(mockedHydrateSupplementBandWithOutcome).not.toHaveBeenCalled();
    expect(preflight?.hydratedCandidates).toEqual([]);
    expect(preflight?.neighborhood.size).toBe(0);
  });

  it("resolves a library neighborhood preflight from a current reviewed-papers source", async () => {
    const libraryContext = {
      folders: [{ name: "Graph", anchorCorpusIds: ["pap_e3_only"] }],
      neighborhood: {},
      computedAt: "2026-07-07T00:00:00.000Z",
    };
    const libraryContextUserSource = {
      reviewedPapers: [{ paperId: "pap_e3_only", title: "Anchor paper" }],
    } satisfies LibraryContextUserSource;
    const neighborhood = new Map([["301", 8]]);
    mockedGetLibraryContext.mockResolvedValueOnce(libraryContext);
    mockedLookupNeighborhood.mockResolvedValueOnce(lookupEvidence(neighborhood));
    mockedHydrateSupplementBandWithOutcome.mockResolvedValueOnce({
      papers: [mappedPaper("301")],
      providerStatus: "ready",
    });

    const preflight = await resolveLibraryNeighborhoodPreflight({
      userEmail: "reader@example.com",
      query: "graph retrieval",
      personalize: true,
      libraryContextUserSource,
    });

    expect(mockedGetLibraryContext).toHaveBeenCalledWith(
      "reader@example.com",
      libraryContextUserSource,
    );
    expect(preflight?.libraryContext).toEqual(libraryContext);
    expect(preflight?.anchorPaperIds).toEqual(["pap_e3_only"]);
    expect(preflight?.hydratedCandidates).toEqual([mappedPaper("301")]);
  });
});

describe("library neighborhood first-reveal blend", () => {
  it("applies a completed library preflight to a first search result payload", () => {
    const libraryContext = {
      folders: [{ name: "Graph", anchorCorpusIds: ["900"] }],
      neighborhood: {},
      computedAt: "2026-07-07T00:00:00.000Z",
    };
    const keywordPapers = [mappedPaper("101"), mappedPaper("102")];
    const blendedPapers = [...keywordPapers, mappedPaper("301")];
    mockedBlendNeighborhood.mockReturnValueOnce({
      blended: true,
      papers: blendedPapers,
      neighborhood: { "101": 9, "301": 8 },
      injectedPaperIds: ["301"],
    });
    mockedRank.mockReturnValueOnce({
      folders: [{ name: "Graph" }],
      matchedCount: 1,
      interestWeights: { "101": 9, "301": 8 },
    });

    const result = applyLibraryNeighborhoodToSearchResults({
      keywordPapers,
      providerTotal: 57,
      query: "graph retrieval",
      preflight: {
        libraryContext,
        neighborhood: new Map([
          ["101", 9],
          ["301", 8],
        ]),
        neighborhoodCandidates: lookupEvidence(
          new Map([
            ["101", 9],
            ["301", 8],
          ]),
        ).candidates,
        anchorPaperIds: ["900"],
        hydratedCandidates: [mappedPaper("101"), mappedPaper("301")],
      },
    });

    // blend는 preflight가 이미 hydrate한 보충 후보를 받는 순수 계산 경로다.
    expect(mockedBlendNeighborhood).toHaveBeenCalledWith({
      keywordPapers,
      neighborhood: new Map([
        ["101", 9],
        ["301", 8],
      ]),
      prehydratedCandidates: [mappedPaper("101"), mappedPaper("301")],
      year: undefined,
    });
    expect(result?.papers.map((paper) => paper.paperId)).toEqual(["101", "102", "301"]);
    expect(result?.total).toBe(3);
    expect(result?.resolvedSort).toBe("interest");
    expect(result?.librarySummary).toEqual({
      folders: [{ name: "Graph" }],
      signalPresent: true,
      interestWeights: { "101": 9, "301": 8 },
      libraryOnlyPaperIds: ["301"],
      computedAt: "2026-07-07T00:00:00.000Z",
    });
    expect(result?.graphSupport).toMatchObject({
      version: 2,
      basis: "library_anchor_neighborhood",
      anchorPaperCount: 1,
      samplePaperIds: ["101", "301"],
      candidateCounts: {
        providerReturned: 2,
        hydrated: 2,
        keywordOverlap: 1,
        admittedSupplement: 1,
        filteredOut: {
          candidateCap: 0,
          hydrationUnavailable: 0,
          publicationYear: 0,
          nonPositiveScore: 0,
          titleFamilyDuplicate: 0,
        },
      },
    });
    expect(result?.graphSupport?.paperScores).toMatchObject({
      "101": { defaultScore: 9 },
      "301": { defaultScore: 8 },
    });
  });
});

describe("library neighborhood full-window admission", () => {
  it("expands a full 40-paper keyword window when a graph-only neighbor is admitted", () => {
    const keywordPapers = Array.from({ length: 40 }, (_, index) =>
      mappedPaper(String(1001 + index)),
    );
    const graphOnlyPaper = mappedPaper("9001", "Graph-only neighbor");
    const neighborhood = new Map([[graphOnlyPaper.paperId, 8]]);
    mockedBlendNeighborhood.mockReturnValueOnce({
      blended: true,
      papers: [...keywordPapers, graphOnlyPaper],
      neighborhood: Object.fromEntries(neighborhood),
      injectedPaperIds: [graphOnlyPaper.paperId],
    });
    mockedRank.mockReturnValueOnce({
      folders: [{ name: "Graph" }],
      matchedCount: 1,
      interestWeights: { [graphOnlyPaper.paperId]: 8 },
    });

    const result = applyLibraryNeighborhoodToSearchResults({
      keywordPapers,
      providerTotal: 40,
      query: "graph retrieval",
      preflight: {
        libraryContext: {
          folders: [{ name: "Graph", anchorCorpusIds: ["900"] }],
          neighborhood: Object.fromEntries(neighborhood),
          computedAt: "2026-07-14T00:00:00.000Z",
        },
        neighborhood,
        neighborhoodCandidates: lookupEvidence(neighborhood).candidates,
        anchorPaperIds: ["900"],
        hydratedCandidates: [graphOnlyPaper],
      },
    });

    expect(result?.papers).toHaveLength(41);
    expect(result?.total).toBe(41);
    expect(result?.papers.at(-1)?.paperId).toBe(graphOnlyPaper.paperId);
    expect(result?.librarySummary?.libraryOnlyPaperIds).toEqual([graphOnlyPaper.paperId]);
    expect(result?.graphSupport?.candidateCounts.admittedSupplement).toBe(1);
  });

  it("records candidates outside the bounded hydration band as candidate-cap exclusions", () => {
    const neighborhood = new Map(
      Array.from({ length: 42 }, (_, index) => [String(2001 + index), 42 - index] as const),
    );
    const keywordPapers = [mappedPaper("2001"), mappedPaper("2002")];
    const hydratedCandidates = [...neighborhood.keys()]
      .slice(0, 40)
      .map((paperId) => mappedPaper(paperId));
    const supplements = hydratedCandidates.slice(2);
    mockedBlendNeighborhood.mockReturnValueOnce({
      blended: true,
      papers: [...keywordPapers, ...supplements],
      neighborhood: Object.fromEntries(neighborhood),
      injectedPaperIds: supplements.map((paper) => paper.paperId),
    });
    mockedRank.mockReturnValueOnce({
      folders: [{ name: "Graph" }],
      matchedCount: 40,
      interestWeights: Object.fromEntries(neighborhood),
    });

    const result = applyLibraryNeighborhoodToSearchResults({
      keywordPapers,
      providerTotal: 2,
      query: "graph retrieval",
      preflight: {
        libraryContext: {
          folders: [{ name: "Graph", anchorCorpusIds: ["900"] }],
          neighborhood: {},
          computedAt: "2026-07-07T00:00:00.000Z",
        },
        neighborhood,
        neighborhoodCandidates: lookupEvidence(neighborhood).candidates,
        anchorPaperIds: ["900"],
        hydratedCandidates,
      },
    });

    expect(result?.graphSupport?.candidateCounts).toMatchObject({
      providerReturned: 42,
      hydrated: 40,
      keywordOverlap: 2,
      admittedSupplement: 38,
      filteredOut: {
        candidateCap: 2,
        hydrationUnavailable: 0,
        nonPositiveScore: 0,
      },
    });
  });

  it("classifies a positive graph supplement removed by title dedupe as a title duplicate", () => {
    const keyword = mappedPaper("101", "Shared title");
    const duplicateSupplement = mappedPaper("301", "Shared title");
    const neighborhood = new Map([["301", 8]]);
    mockedBlendNeighborhood.mockReturnValueOnce({
      blended: true,
      papers: [keyword, duplicateSupplement],
      neighborhood: { "301": 8 },
      injectedPaperIds: ["301"],
    });
    mockedRank.mockReturnValueOnce({
      folders: [{ name: "Graph" }],
      matchedCount: 0,
      interestWeights: {},
    });

    const result = applyLibraryNeighborhoodToSearchResults({
      keywordPapers: [keyword],
      providerTotal: 1,
      query: "shared title",
      preflight: {
        libraryContext: {
          folders: [{ name: "Graph", anchorCorpusIds: ["900"] }],
          neighborhood: {},
          computedAt: "2026-07-07T00:00:00.000Z",
        },
        neighborhood,
        neighborhoodCandidates: lookupEvidence(neighborhood).candidates,
        anchorPaperIds: ["900"],
        hydratedCandidates: [duplicateSupplement],
      },
    });

    expect(result?.papers.map((paper) => paper.paperId)).toEqual(["101"]);
    expect(result?.graphSupport?.candidateCounts.filteredOut).toMatchObject({
      nonPositiveScore: 0,
      titleFamilyDuplicate: 1,
    });
  });

  it("preserves a legacy committed snapshot while deduping only live supplements", () => {
    const keywordPapers = [mappedPaper("101", "Shared Title"), mappedPaper("102", "Shared Title.")];
    const duplicateSupplement = mappedPaper("301", "Shared Title!");
    const novelSupplement = mappedPaper("302", "Novel Title");
    const neighborhood = new Map([
      ["301", 9],
      ["302", 8],
    ]);
    mockedBlendNeighborhood.mockReturnValueOnce({
      blended: true,
      papers: [duplicateSupplement, ...keywordPapers, novelSupplement],
      neighborhood: { "301": 9, "302": 8 },
      injectedPaperIds: ["301", "302"],
    });
    mockedRank.mockReturnValueOnce({
      folders: [{ name: "Graph" }],
      matchedCount: 1,
      interestWeights: { "302": 8 },
    });

    const result = applyLibraryNeighborhoodToSearchResults({
      keywordPapers,
      providerTotal: 57,
      query: "graph retrieval",
      preflight: {
        libraryContext: {
          folders: [{ name: "Graph", anchorCorpusIds: ["900"] }],
          neighborhood: { "301": 9, "302": 8 },
          computedAt: "2026-07-13T00:00:00.000Z",
        },
        neighborhood,
        neighborhoodCandidates: lookupEvidence(neighborhood).candidates,
        anchorPaperIds: ["900"],
        hydratedCandidates: [duplicateSupplement, novelSupplement],
      },
    });

    expect(result?.papers.map((paper) => paper.paperId)).toEqual(["101", "102", "302"]);
    expect(result?.librarySummary?.libraryOnlyPaperIds).toEqual(["302"]);
  });
});

describe("computeSearchHydration", () => {
  it.each([
    ["provider error", new Error("Episteme unavailable")],
    ["provider abort", new DOMException("Aborted", "AbortError")],
  ])("surfaces a %s so background enrichment can retry", async (_label, failure) => {
    mockedHydrate.mockRejectedValueOnce(failure);

    await expect(
      computeSearchHydration(
        metadata({
          abstractHydration: { status: "ready", personalize: true },
        }),
        "reader@example.com",
        undefined,
        { repairReady: true },
      ),
    ).rejects.toBe(failure);
  });

  it("reports a successful empty batch so the caller can terminalize lightweight cards", async () => {
    mockedHydrate.mockResolvedValueOnce([]);

    const result = await computeSearchHydration(
      metadata({
        abstractHydration: { status: "ready", personalize: true },
      }),
      "reader@example.com",
      undefined,
      { repairReady: true },
    );

    expect(result).toBeNull();
  });

  it("can repair a fully lightweight ready result that was closed before hydration ran", async () => {
    mockedHydrate.mockResolvedValueOnce([mappedPaper("101"), mappedPaper("102")]);
    const readyLightweight = metadata({
      abstractHydration: { status: "ready", personalize: true },
    });
    const alreadyAttempted = metadata({
      abstractHydration: { status: "ready", personalize: true, repairAttempted: true },
    });
    const partiallyHydrated = metadata({
      abstractHydration: { status: "ready", personalize: true },
      papers: [
        {
          paperId: "101",
          title: "Hydrated 101",
          abstract: "Abstract 101",
          year: 2024,
          citationCount: 10,
          url: "https://example.com/101",
          authors: [{ name: "Ada" }],
          referenceCount: 3,
        },
        {
          paperId: "102",
          title: "Still lightweight",
          abstract: null,
          year: 2023,
          citationCount: 2,
          url: "https://example.com/102",
          authors: [],
        },
      ],
    });

    await expect(
      computeSearchHydration(readyLightweight, "reader@example.com"),
    ).resolves.toBeNull();
    expect(shouldRepairSearchHydration(readyLightweight)).toBe(true);
    expect(shouldRepairSearchHydration(partiallyHydrated)).toBe(false);
    expect(shouldRepairSearchHydration(alreadyAttempted)).toBe(false);
    await expect(
      computeSearchHydration(partiallyHydrated, "reader@example.com", undefined, {
        repairReady: true,
      }),
    ).resolves.toBeNull();

    const result = await computeSearchHydration(readyLightweight, "reader@example.com", undefined, {
      repairReady: true,
    });

    expect(mockedHydrate).toHaveBeenCalledWith(["101", "102"], undefined);
    expect(result?.papers.map((paper) => paper.authors)).toEqual([["Ada"], ["Ada"]]);
    expect(result?.resolvedSort).toBe("relevance");
  });

  it("hydrates the committed corpus ids and preserves provider total when no library blend applies", async () => {
    mockedHydrate.mockResolvedValueOnce([
      {
        ...mappedPaper("101", "Hydrated title 101"),
        year: 2030,
        citationCount: 999,
      },
      mappedPaper("102"),
    ]);

    const result = await computeSearchHydration(
      metadata({
        abstractHydration: { status: "pending", requestedSort: "year" },
      }),
      "reader@example.com",
    );

    expect(mockedHydrate).toHaveBeenCalledWith(["101", "102"], undefined);
    expect(mockedLookupNeighborhood).not.toHaveBeenCalled();
    expect(result?.papers.map((paper) => paper.paperId)).toEqual(["101", "102"]);
    expect(result?.total).toBe(57);
    expect(result?.resolvedSort).toBe("year");
    expect(result?.librarySummary).toBeUndefined();
    expect(result?.papers[0]).toMatchObject({
      title: "Lightweight 101",
      year: 2024,
      citationCount: 3,
      abstract: "Abstract 101",
      authors: ["Ada"],
      openAccessPdf: { url: "https://example.com/101.pdf" },
    });
  });

  it("does not re-run library graph retrieval while hydrating committed cards", async () => {
    mockedHydrate.mockResolvedValueOnce([mappedPaper("101"), mappedPaper("102")]);

    const result = await computeSearchHydration(
      metadata({
        abstractHydration: { status: "pending", personalize: true },
      }),
      "reader@example.com",
    );

    expect(mockedHydrate).toHaveBeenCalledWith(["101", "102"], undefined);
    expect(result?.papers.map((paper) => paper.paperId)).toEqual(["101", "102"]);
    expect(mockedGetLibraryContext).not.toHaveBeenCalled();
    expect(mockedLookupNeighborhood).not.toHaveBeenCalled();
    expect(mockedHydrateSupplementBandWithOutcome).not.toHaveBeenCalled();
    expect(mockedBlendNeighborhood).not.toHaveBeenCalled();
  });

  it("does not batch-hydrate first-reveal graph supplements a second time", async () => {
    mockedHydrate.mockResolvedValueOnce([mappedPaper("101", "Hydrated keyword")]);
    const supplement: SearchMetadata["papers"][number] = {
      ...metadata().papers[0],
      paperId: "301",
      title: "Frozen graph supplement",
      abstract: "Abstract 301",
      url: "https://example.com/301",
      authors: [{ name: "Ada" }],
      openAccessPdf: { url: "https://example.com/301.pdf" },
    };

    const result = await computeSearchHydration(
      metadata({
        papers: [metadata().papers[0], supplement],
        libraryContext: {
          folders: [{ name: "Graph" }],
          signalPresent: true,
          interestWeights: { "101": 9, "301": 8 },
          libraryOnlyPaperIds: ["301"],
        },
        abstractHydration: {
          status: "pending",
          personalize: true,
          libraryBlendPolicy: "first_reveal_only",
        },
      }),
      "reader@example.com",
    );

    expect(mockedHydrate).toHaveBeenCalledWith(["101"], undefined);
    expect(result?.papers).toEqual([
      {
        ...mappedPaper("101", "Lightweight 101"),
        citationCount: 3,
      },
      expect.objectContaining({
        paperId: "301",
        title: "Frozen graph supplement",
        abstract: "Abstract 301",
        authors: ["Ada"],
      }),
    ]);
  });
});

describe("computeSearchHydration first-reveal policy", () => {
  it("does not add late library-near candidates when the first reveal already locked the result set", async () => {
    const existingLibrarySummary = {
      folders: [{ name: "Graph" }],
      signalPresent: true,
      interestWeights: { "101": 4 },
      combinedRankWeights: { "101": 0.5, "102": 0.25 },
      libraryOnlyPaperIds: [],
      rankingMode: "combined_score",
      computedAt: "2026-06-16T00:00:00.000Z",
    } satisfies NonNullable<SearchMetadata["libraryContext"]>;
    mockedHydrate.mockResolvedValueOnce([mappedPaper("101"), mappedPaper("102")]);

    const result = await computeSearchHydration(
      metadata({
        sortOption: "interest",
        libraryContext: existingLibrarySummary,
        libraryContextAvailable: true,
        abstractHydration: {
          status: "pending",
          personalize: true,
          libraryBlendPolicy: "first_reveal_only",
        },
      }),
      "reader@example.com",
    );

    expect(mockedHydrate).toHaveBeenCalledWith(["101", "102"], undefined);
    expect(mockedGetLibraryContext).not.toHaveBeenCalled();
    expect(mockedLookupNeighborhood).not.toHaveBeenCalled();
    expect(mockedBlendNeighborhood).not.toHaveBeenCalled();
    expect(result?.papers.map((paper) => paper.paperId)).toEqual(["101", "102"]);
    expect(result?.total).toBe(57);
    expect(result?.resolvedSort).toBe("interest");
    expect(result?.libraryContextAvailable).toBe(true);
    expect(result?.librarySummary).toEqual(existingLibrarySummary);
  });
  it("preserves committed corpus ids when locked papers share a title family", async () => {
    const committedPapers = [
      mappedPaper("101", "Shared Title"),
      mappedPaper("102", "Shared Title."),
    ];
    mockedHydrate.mockResolvedValueOnce(committedPapers);

    const result = await computeSearchHydration(
      metadata({
        papers: committedPapers.map((paper) => ({
          ...paper,
          authors: paper.authors.map((name) => ({ name })),
        })),
        abstractHydration: {
          status: "pending",
          personalize: true,
          libraryBlendPolicy: "first_reveal_only",
        },
      }),
      "reader@example.com",
    );

    expect(result?.papers.map((paper) => paper.paperId)).toEqual(["101", "102"]);
    expect(result?.total).toBe(57);
  });
});
