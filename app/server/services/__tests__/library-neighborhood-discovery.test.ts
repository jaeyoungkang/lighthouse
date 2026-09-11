import { expect, it } from "vitest";
import { searchMetadataIngressSchema } from "@/app/domain/search-metadata-ingress";
import {
  SEARCH_DOCUMENT_FETCH_LIMIT,
  SEARCH_LIBRARY_NEAR_BAND_LIMIT,
  SEARCH_RESULT_POOL_PAPER_LIMIT,
} from "@/app/lib/constants";
import { sortSearchPapers } from "@/app/lib/search-paper-sort";
import { selectNeighborhoodSupplements } from "@/app/server/services/library-neighborhood-discovery";
import { applyLibraryContextToSearchResults } from "@/app/server/services/search-hydration";
import { buildDocumentPaper, type MappedPaper } from "@/app/server/services/search-service";

function paper(id: string, year = 2024, title = `Paper ${id}`): MappedPaper {
  return {
    paperId: id,
    title,
    abstract: null,
    year,
    citationCount: 1,
    url: `https://example.com/${id}`,
    authors: ["Alice"],
  };
}

function sortedInterestIds(
  papers: readonly MappedPaper[],
  interestWeights: Record<string, number>,
  libraryOnlyPaperIds: readonly string[],
): string[] {
  return sortSearchPapers(
    papers.map((item) => buildDocumentPaper(item)),
    "interest",
    interestWeights,
    libraryOnlyPaperIds,
    "agent memory",
    "combined_score",
  ).map(({ paperId }) => paperId);
}

it("selects every paper in the forty-result graph band for the shared result pool", () => {
  const keywordPapers = Array.from({ length: SEARCH_DOCUMENT_FETCH_LIMIT }, (_, index) =>
    paper(String(501 + index)),
  );
  const candidates = Array.from({ length: SEARCH_LIBRARY_NEAR_BAND_LIMIT }, (_, index) =>
    paper(String(1001 + index)),
  );
  const result = selectNeighborhoodSupplements({
    keywordPapers,
    neighborhood: new Map(candidates.map((item, index) => [item.paperId, 100 - index])),
    prehydratedCandidates: [paper("501"), ...candidates],
  });

  expect(keywordPapers).toHaveLength(SEARCH_DOCUMENT_FETCH_LIMIT);
  expect(result.supplementPapers).toHaveLength(SEARCH_LIBRARY_NEAR_BAND_LIMIT);
  expect(result.supplementPapers.map(({ paperId }) => paperId)).toEqual(
    candidates.map(({ paperId }) => paperId),
  );
});

it("removes keyword and supplement title-family duplicates across corpus ids", () => {
  const result = selectNeighborhoodSupplements({
    keywordPapers: [paper("501", 2024, "A Shared Result.")],
    neighborhood: new Map([
      ["601", 9],
      ["602", 8],
      ["603", 7],
    ]),
    prehydratedCandidates: [
      paper("601", 2024, "A Shared Result"),
      paper("602", 2024, "A Distinct Discovery."),
      paper("603", 2024, "A Distinct Discovery"),
    ],
  });

  expect(result.supplementPapers.map(({ paperId }) => paperId)).toEqual(["602"]);
});

it("keeps a repeated graph paper id only once", () => {
  const result = selectNeighborhoodSupplements({
    keywordPapers: [],
    neighborhood: new Map([["601", 9]]),
    prehydratedCandidates: [
      paper("601", 2024, "First provider record"),
      paper("601", 2024, "Repeated provider record"),
    ],
  });

  expect(result.supplementPapers.map(({ paperId }) => paperId)).toEqual(["601"]);
});

it("filters only supplement candidates by the active year range", () => {
  const result = selectNeighborhoodSupplements({
    keywordPapers: [paper("501", 2020)],
    neighborhood: new Map([
      ["1001", 2],
      ["1002", 1],
    ]),
    prehydratedCandidates: [paper("1001", 2024), paper("1002", 2018)],
    year: "2022-2025",
  });

  expect(result.supplementPapers.map(({ paperId }) => paperId)).toEqual(["1001"]);
});

it("applies the year range before choosing a title-family representative", () => {
  const result = selectNeighborhoodSupplements({
    keywordPapers: [],
    neighborhood: new Map([
      ["1001", 10],
      ["1002", 5],
    ]),
    prehydratedCandidates: [
      paper("1001", 2018, "Shared Discovery."),
      paper("1002", 2024, "Shared Discovery"),
    ],
    year: "2022-2025",
  });

  expect(result.supplementPapers.map(({ paperId }) => paperId)).toEqual(["1002"]);
});

it("combines query and graph-relation scores with equal maximum contributions", () => {
  const keywordPapers = [paper("501"), paper("502")];
  const result = applyLibraryContextToSearchResults({
    keywordPapers,
    providerTotal: 57,
    query: "agent memory",
    preflight: {
      libraryContext: {
        folders: [{ name: "내 연구", anchorCorpusIds: ["900"] }],
        neighborhood: {},
        computedAt: "2026-07-22T00:00:00.000Z",
      },
      neighborhood: new Map([
        ["502", 10],
        ["1001", 9],
      ]),
      neighborhoodCandidates: new Map(),
      anchorPaperIds: ["900"],
      hydratedCandidates: [paper("1001")],
    },
  });

  expect(result?.papers.map(({ paperId }) => paperId)).toEqual(["501", "502", "1001"]);
  expect(result?.total).toBe(58);
  expect(result?.resolvedSort).toBe("interest");
  expect(result?.librarySummary).toMatchObject({
    interestWeights: { "502": 2, "1001": 1 },
    libraryOnlyPaperIds: ["1001"],
    rankingMode: "combined_score",
  });
  expect(result?.librarySummary?.interestWeights).not.toHaveProperty("501");
  expect(result?.librarySummary?.combinedRankWeights?.["501"]).toBeCloseTo(0.5);
  expect(result?.librarySummary?.combinedRankWeights?.["502"]).toBeCloseTo(0.75);
  expect(result?.librarySummary?.combinedRankWeights?.["1001"]).toBeCloseTo(0.075);
  expect(
    sortedInterestIds(
      result?.papers ?? [],
      result?.librarySummary?.combinedRankWeights ?? {},
      result?.librarySummary?.libraryOnlyPaperIds ?? [],
    ),
  ).toEqual(["502", "501", "1001"]);
});

it("keeps a graph-overlapping keyword paper in the library evidence weights", () => {
  const result = applyLibraryContextToSearchResults({
    keywordPapers: [paper("501")],
    providerTotal: 1,
    query: "agent memory",
    preflight: {
      libraryContext: {
        folders: [{ name: "내 연구", anchorCorpusIds: ["900"] }],
        neighborhood: {},
        computedAt: "2026-07-23T00:00:00.000Z",
      },
      neighborhood: new Map([["501", 10]]),
      neighborhoodCandidates: new Map(),
      anchorPaperIds: ["900"],
      hydratedCandidates: [],
    },
  });

  expect(result?.librarySummary).toMatchObject({
    signalPresent: true,
    interestWeights: { "501": 1 },
    libraryOnlyPaperIds: [],
    rankingMode: "combined_score",
  });
});

it("pins the P05/P95 magnitude policy with an intermediate graph score", () => {
  const graphPapers = ["1001", "1002", "1003", "1004", "1005"].map((id) => paper(id));
  const result = applyLibraryContextToSearchResults({
    keywordPapers: [paper("501")],
    providerTotal: 1,
    query: "agent memory",
    preflight: {
      libraryContext: {
        folders: [{ name: "내 연구", anchorCorpusIds: ["900"] }],
        neighborhood: {},
        computedAt: "2026-07-23T00:00:00.000Z",
      },
      neighborhood: new Map([
        ["1001", 100],
        ["1002", 4],
        ["1003", 3],
        ["1004", 2],
        ["1005", 1],
      ]),
      neighborhoodCandidates: new Map(),
      anchorPaperIds: ["900"],
      hydratedCandidates: graphPapers,
    },
  });

  // Five positive values make P05=1.2 and P95=80.8. For score 4:
  // M=(4-1.2)/(80.8-1.2), P=4/5, R=0.7M+0.3P, library contribution=0.5R.
  expect(result?.librarySummary?.combinedRankWeights?.["1002"]).toBeCloseTo(
    0.5 * (0.7 * ((4 - 1.2) / (80.8 - 1.2)) + 0.3 * (4 / 5)),
    6,
  );
});

it("commits all forty keyword and forty graph papers within the shared ingress capacity", () => {
  const keywordPapers = Array.from({ length: SEARCH_DOCUMENT_FETCH_LIMIT }, (_, index) =>
    paper(String(501 + index)),
  );
  const candidates = Array.from({ length: SEARCH_LIBRARY_NEAR_BAND_LIMIT }, (_, index) =>
    paper(String(1001 + index)),
  );
  const result = applyLibraryContextToSearchResults({
    keywordPapers,
    providerTotal: 40,
    query: "agent memory",
    preflight: {
      libraryContext: {
        folders: [{ name: "내 연구", anchorCorpusIds: ["900"] }],
        neighborhood: {},
        computedAt: "2026-07-23T00:00:00.000Z",
      },
      neighborhood: new Map(
        candidates.map((item, index) => [item.paperId, index < 3 ? 100 - index : 20 - index / 10]),
      ),
      neighborhoodCandidates: new Map(),
      anchorPaperIds: ["900"],
      hydratedCandidates: candidates,
    },
  });

  expect(result?.papers).toHaveLength(SEARCH_RESULT_POOL_PAPER_LIMIT);
  expect(result?.total).toBe(SEARCH_RESULT_POOL_PAPER_LIMIT);
  expect(result?.librarySummary?.libraryOnlyPaperIds).toHaveLength(SEARCH_LIBRARY_NEAR_BAND_LIMIT);
  expect(result?.librarySummary?.libraryOnlyPaperIds).toEqual(
    candidates.map(({ paperId }) => paperId),
  );
  expect(result?.librarySummary?.combinedRankWeights?.["501"]).toBeCloseTo(0.5);
  expect(result?.librarySummary?.combinedRankWeights?.["1001"]).toBeCloseTo(0.5);
  expect(
    searchMetadataIngressSchema.safeParse({
      type: "search",
      query: "agent memory",
      papers: (result?.papers ?? []).map((item) => buildDocumentPaper(item)),
      total: result?.total ?? 0,
      libraryContext: result?.librarySummary,
      sortOption: result?.resolvedSort,
    }).success,
  ).toBe(true);
  const sortedIds = sortedInterestIds(
    result?.papers ?? [],
    result?.librarySummary?.combinedRankWeights ?? {},
    result?.librarySummary?.libraryOnlyPaperIds ?? [],
  );
  expect(sortedIds.slice(0, 10)).toEqual([
    "501",
    "1001",
    "1002",
    "1003",
    "502",
    "503",
    "504",
    "505",
    "506",
    "507",
  ]);
});

it("uses graph proximity as the sole library evidence for markers and ranking", () => {
  const result = applyLibraryContextToSearchResults({
    keywordPapers: [paper("501"), paper("502")],
    providerTotal: 2,
    query: "agent memory",
    preflight: {
      libraryContext: {
        folders: [{ name: "내 연구", anchorCorpusIds: ["900"] }],
        neighborhood: {},
        computedAt: "2026-07-22T00:00:00.000Z",
      },
      neighborhood: new Map([
        ["501", 4],
        ["1001", 9],
        ["1002", 6],
      ]),
      neighborhoodCandidates: new Map(),
      anchorPaperIds: ["900"],
      hydratedCandidates: [paper("1001"), paper("1002")],
    },
  });

  expect(result?.resolvedSort).toBe("interest");
  expect(
    sortedInterestIds(
      result?.papers ?? [],
      result?.librarySummary?.combinedRankWeights ?? {},
      result?.librarySummary?.libraryOnlyPaperIds ?? [],
    ),
  ).toEqual(["501", "1001", "502", "1002"]);
});
