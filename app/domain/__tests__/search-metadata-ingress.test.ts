import { describe, expect, it } from "vitest";
import {
  SEARCH_INGRESS_QUERY_MAX_CHARS,
  searchMetadataIngressSchema,
} from "@/app/domain/search-metadata-ingress";
import { searchMetadataSchema } from "@/app/domain/research-route-payload-schema";
import { SEARCH_RESULT_POOL_PAPER_LIMIT } from "@/app/lib/constants";

function paper(index: number) {
  return {
    paperId: `paper-${String(index)}`,
    title: `Paper ${String(index)}`,
    abstract: "abstract",
    year: 2026,
    citationCount: 0,
    url: `https://example.com/${String(index)}`,
    authors: [],
  };
}

function metadata(count = 1) {
  return {
    type: "search" as const,
    query: "bounded search",
    papers: Array.from({ length: count }, (_, index) => paper(index)),
    total: count,
  };
}

const queryClause = {
  rawClause: "agent memory",
  normalizedClause: "agent memory",
  role: "anchor" as const,
  isExtractive: true,
  derivedExpansions: [],
};

const clauseStat = {
  clause: "agent memory",
  role: "anchor" as const,
  total: 1,
  fetched: 1,
};

const englishTermCandidate = {
  term: "agent memory",
  type: "direct" as const,
  confidence: "high" as const,
  supportCount: 1,
  samplePaperIds: ["paper-0"],
  basis: "query",
};

const cardinalityCases = [
  {
    label: "queryClauses",
    maximum: 40,
    path: ["queryClauses"],
    fields: (count: number) => ({ queryClauses: Array.from({ length: count }, () => queryClause) }),
  },
  {
    label: "clauseStats",
    maximum: 40,
    path: ["clauseStats"],
    fields: (count: number) => ({ clauseStats: Array.from({ length: count }, () => clauseStat) }),
  },
  {
    label: "englishTermCandidates",
    maximum: 20,
    path: ["englishTermCandidates"],
    fields: (count: number) => ({
      englishTermCandidates: Array.from({ length: count }, () => englishTermCandidate),
    }),
  },
  {
    label: "libraryContext.folders",
    maximum: 100,
    path: ["libraryContext", "folders"],
    fields: (count: number) => ({
      libraryContext: {
        folders: Array.from({ length: count }, (_, index) => ({ name: `folder-${String(index)}` })),
        signalPresent: true,
        interestWeights: {},
      },
    }),
  },
  {
    label: "libraryContext.libraryOnlyPaperIds",
    maximum: 200,
    path: ["libraryContext", "libraryOnlyPaperIds"],
    fields: (count: number) => ({
      libraryContext: {
        folders: [],
        signalPresent: true,
        interestWeights: {},
        libraryOnlyPaperIds: Array.from({ length: count }, (_, index) => `paper-${String(index)}`),
      },
    }),
  },
  {
    label: "abstractHydration.libraryPaperIds",
    maximum: 200,
    path: ["abstractHydration", "libraryPaperIds"],
    fields: (count: number) => ({
      abstractHydration: {
        status: "ready" as const,
        libraryPaperIds: Array.from({ length: count }, (_, index) => `paper-${String(index)}`),
      },
    }),
  },
  {
    label: "facetFilters.fieldsOfStudy",
    maximum: 100,
    path: ["facetFilters", "fieldsOfStudy"],
    fields: (count: number) => ({
      facetFilters: {
        fieldsOfStudy: Array.from({ length: count }, (_, index) => `field-${String(index)}`),
        authors: [],
        venues: [],
        hasPdf: false,
      },
    }),
  },
] as const;

describe("search metadata ingress projection", () => {
  it("accepts the current combined result pool", () => {
    expect(
      searchMetadataIngressSchema.safeParse(metadata(SEARCH_RESULT_POOL_PAPER_LIMIT)).success,
    ).toBe(true);
  });

  it("rejects excess paper cardinality only at API ingress", () => {
    const oversized = metadata(SEARCH_RESULT_POOL_PAPER_LIMIT + 1);

    expect(searchMetadataSchema.safeParse(oversized).success).toBe(true);
    const result = searchMetadataIngressSchema.safeParse(oversized);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          code: "custom",
          path: ["papers"],
          message: `papers must contain at most ${String(SEARCH_RESULT_POOL_PAPER_LIMIT)} items`,
        }),
      );
    }
  });

  it("rejects an oversized query", () => {
    expect(
      searchMetadataIngressSchema.safeParse({
        ...metadata(),
        query: "q".repeat(SEARCH_INGRESS_QUERY_MAX_CHARS),
      }).success,
    ).toBe(true);
    const result = searchMetadataIngressSchema.safeParse({
      ...metadata(),
      query: "q".repeat(SEARCH_INGRESS_QUERY_MAX_CHARS + 1),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({
          code: "custom",
          path: ["query"],
          message: `query must contain at most ${String(SEARCH_INGRESS_QUERY_MAX_CHARS)} characters`,
        }),
      );
    }
  });

  it.each(cardinalityCases)(
    "enforces the exact $label ingress maximum and issue path",
    ({ label, maximum, path, fields }) => {
      expect(
        searchMetadataIngressSchema.safeParse({ ...metadata(), ...fields(maximum) }).success,
      ).toBe(true);
      const result = searchMetadataIngressSchema.safeParse({
        ...metadata(),
        ...fields(maximum + 1),
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toContainEqual(
          expect.objectContaining({
            code: "custom",
            path: [...path],
            message: `${label} must contain at most ${String(maximum)} items`,
          }),
        );
      }
    },
  );

  it("does not treat scalar facet fields as cardinality collections", () => {
    expect(
      searchMetadataIngressSchema.safeParse({
        ...metadata(),
        facetFilters: { fieldsOfStudy: [], authors: [], venues: [], hasPdf: true },
      }).success,
    ).toBe(true);
  });

  it("accepts hydration state before optional library paper ids are attached", () => {
    expect(
      searchMetadataIngressSchema.safeParse({
        ...metadata(),
        abstractHydration: { status: "pending" },
      }).success,
    ).toBe(true);
  });
});
