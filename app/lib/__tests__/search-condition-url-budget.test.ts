import { describe, expect, it } from "vitest";
import {
  buildCitationSeedPageRoute,
  buildResearchRoutePageRoute,
  buildSearchRoutePageRoute,
  buildSimilarSeedPageRoute,
} from "@/app/lib/api-routes";
import {
  SEARCH_CONDITION_REQUEST_TARGET_MAX_BYTES,
  SEARCH_CONDITION_VALUE_LIMITS,
  resolveSearchConditionRouteKind,
  searchParamsFromRecord,
  utf8ByteLength,
  validateSearchConditionUrl,
} from "@/app/lib/search-condition-url-budget";
import type { PaperCore } from "@/app/domain/paper";

function repeatToUtf8Bytes(value: string, bytes: number): string {
  const unitBytes = utf8ByteLength(value);
  expect(bytes % unitBytes).toBe(0);
  return value.repeat(bytes / unitBytes);
}

function seedPaper(overrides: Partial<PaperCore> = {}): PaperCore {
  return {
    paperId: "seed-paper",
    title: "Seed paper",
    abstract: null,
    year: 2026,
    citationCount: 42,
    url: "https://example.com/paper",
    authors: [],
    ...overrides,
  };
}

describe("search condition URL byte budget", () => {
  it.each([
    ["/", "search"],
    ["/search", "search"],
    ["/citation", "citation"],
    ["/similar", "similar"],
    ["/gap/report-1", null],
  ] as const)("maps the %s condition-route alias to %s", (pathname, routeKind) => {
    expect(resolveSearchConditionRouteKind(pathname)).toBe(routeKind);
  });

  it("measures UTF-8 bytes instead of JavaScript code units", () => {
    expect(utf8ByteLength("a")).toBe(1);
    expect(utf8ByteLength("한")).toBe(3);
    expect(utf8ByteLength("e\u0301")).toBe(3);
    expect(utf8ByteLength("😀")).toBe(4);
  });

  it("uses URLSearchParams percent encoding for the final request target", () => {
    const params = new URLSearchParams({ q: "한😀 %/?#&=+" });
    const result = validateSearchConditionUrl("search", params);

    expect(result).toEqual({
      ok: true,
      requestTarget: `/search?${params.toString()}`,
      requestTargetBytes: utf8ByteLength(`/search?${params.toString()}`),
    });
  });

  it("preserves unknown query keys when validating the server request target", () => {
    const params = searchParamsFromRecord("search", {
      q: "graph retrieval",
      utm_blob: "x".repeat(SEARCH_CONDITION_REQUEST_TARGET_MAX_BYTES),
    });

    expect(validateSearchConditionUrl("search", params)).toEqual({
      ok: false,
      reason: "request-target-limit",
    });
  });

  it("accepts the approved keyword-search maximum envelope below 8192 bytes", () => {
    const facetValues = Array.from(
      { length: SEARCH_CONDITION_VALUE_LIMITS.facetValuesPerKind },
      (_, index) =>
        `${repeatToUtf8Bytes(
          "😀",
          SEARCH_CONDITION_VALUE_LIMITS.facetValueBytes - 8,
        )}x${String(index).padStart(7, "0")}`,
    );
    const result = buildSearchRoutePageRoute({
      q: repeatToUtf8Bytes("😀", SEARCH_CONDITION_VALUE_LIMITS.keywordQueryBytes),
      sort: "citationCount",
      year: "2020-2026",
      personalize: false,
      libraryContextAvailable: true,
      entry: "requery",
      facetFilters: {
        fieldsOfStudy: facetValues,
        authors: facetValues.map((value) => value.replace("x", "a")),
        venues: facetValues.map((value) => value.replace("x", "v")),
        hasPdf: true,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(utf8ByteLength(result.route)).toBeLessThanOrEqual(
      SEARCH_CONDITION_REQUEST_TARGET_MAX_BYTES,
    );
  });

  it("accepts each relationship-route maximum envelope independently", () => {
    const maximumSeed = seedPaper({
      paperId: repeatToUtf8Bytes("😀", SEARCH_CONDITION_VALUE_LIMITS.seedPaperIdBytes),
      title: repeatToUtf8Bytes("😀", SEARCH_CONDITION_VALUE_LIMITS.seedPaperTitleBytes),
      url: "%".repeat(SEARCH_CONDITION_VALUE_LIMITS.seedPaperUrlBytes),
      year: SEARCH_CONDITION_VALUE_LIMITS.seedPaperYearMax,
      citationCount: SEARCH_CONDITION_VALUE_LIMITS.seedPaperCitationsMax,
    });

    for (const result of [
      buildCitationSeedPageRoute(maximumSeed),
      buildSimilarSeedPageRoute(maximumSeed),
    ]) {
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(utf8ByteLength(result.route)).toBeLessThanOrEqual(
        SEARCH_CONDITION_REQUEST_TARGET_MAX_BYTES,
      );
    }
  });
});

describe("search condition URL dimension validation", () => {
  it("rejects a query that crosses the raw UTF-8 limit by one byte", () => {
    const accepted = buildSearchRoutePageRoute({
      q: "a".repeat(SEARCH_CONDITION_VALUE_LIMITS.keywordQueryBytes),
    });
    const rejected = buildSearchRoutePageRoute({
      q: "a".repeat(SEARCH_CONDITION_VALUE_LIMITS.keywordQueryBytes + 1),
    });

    expect(accepted.ok).toBe(true);
    expect(rejected).toEqual({ ok: false, reason: "dimension-limit" });
  });

  it("rejects raw query and facet overflow before whitespace normalization", () => {
    expect(
      buildSearchRoutePageRoute({
        q: `${"a".repeat(SEARCH_CONDITION_VALUE_LIMITS.keywordQueryBytes)} `,
      }),
    ).toEqual({ ok: false, reason: "dimension-limit" });
    expect(
      buildSearchRoutePageRoute({
        q: "query",
        facetFilters: {
          authors: [`${" ".repeat(SEARCH_CONDITION_VALUE_LIMITS.facetValueBytes)}x`],
        },
      }),
    ).toEqual({ ok: false, reason: "dimension-limit" });
  });

  it("rejects a fifth facet and a facet value over 128 UTF-8 bytes", () => {
    expect(
      buildSearchRoutePageRoute({
        q: "query",
        facetFilters: { authors: ["a", "b", "c", "d", "e"] },
      }),
    ).toEqual({ ok: false, reason: "dimension-limit" });
    expect(
      buildSearchRoutePageRoute({
        q: "query",
        facetFilters: {
          authors: [repeatToUtf8Bytes("😀", SEARCH_CONDITION_VALUE_LIMITS.facetValueBytes) + "a"],
        },
      }),
    ).toEqual({ ok: false, reason: "dimension-limit" });
  });

  it("rejects mixed keyword, term, and seed-paper modes without truncation", () => {
    const params = new URLSearchParams({
      q: "query",
      sort: "year",
      termSourceQuery: "source",
      term: "term",
      termType: "direct",
      termSupport: "1",
      seedPaperId: "paper",
      seedPaperTitle: "Paper",
    });

    expect(validateSearchConditionUrl("search", params)).toEqual({
      ok: false,
      reason: "mode-conflict",
    });
  });

  it("requires an explicit bounded term-support count for term mode", () => {
    const params = new URLSearchParams({
      q: "query",
      termSourceQuery: "source",
      term: "term",
      termType: "direct",
    });

    expect(validateSearchConditionUrl("search", params)).toEqual({
      ok: false,
      reason: "mode-conflict",
    });
    params.set("termSupport", String(SEARCH_CONDITION_VALUE_LIMITS.termSupportMax + 1));
    expect(validateSearchConditionUrl("search", params)).toEqual({
      ok: false,
      reason: "invalid-value",
    });
  });

  it("requires a non-empty query for term and seed-paper follow-up modes", () => {
    expect(
      validateSearchConditionUrl(
        "search",
        new URLSearchParams({
          termSourceQuery: "source",
          term: "term",
          termType: "direct",
          termSupport: "1",
        }),
      ),
    ).toEqual({ ok: false, reason: "mode-conflict" });
    expect(
      validateSearchConditionUrl(
        "search",
        new URLSearchParams({
          seedPaperId: "paper",
          seedPaperTitle: "Paper",
        }),
      ),
    ).toEqual({ ok: false, reason: "mode-conflict" });
    expect(
      validateSearchConditionUrl(
        "search",
        new URLSearchParams({
          q: "   ",
          termSourceQuery: "source",
          term: "term",
          termType: "direct",
          termSupport: "1",
        }),
      ),
    ).toEqual({ ok: false, reason: "mode-conflict" });
    expect(
      validateSearchConditionUrl(
        "search",
        new URLSearchParams({
          q: "   ",
          seedPaperId: "paper",
          seedPaperTitle: "Paper",
        }),
      ),
    ).toEqual({ ok: false, reason: "mode-conflict" });
  });

  it("returns a safe rejection for oversized ephemeral document metadata", () => {
    expect(
      buildResearchRoutePageRoute({
        id: "search-view",
        type: "search",
        metadata: {
          type: "search",
          query: "a".repeat(SEARCH_CONDITION_VALUE_LIMITS.keywordQueryBytes + 1),
          total: 0,
          papers: [],
        },
      }),
    ).toEqual({ ok: false, reason: "dimension-limit" });
  });

  it("rejects a mismatched ephemeral payload instead of opening an empty search", () => {
    const document = {
      id: "mismatched-view",
      type: "search",
      metadata: {
        type: "citation_lineage",
        seedPaper: seedPaper(),
        referenceIds: [],
        citationIds: [],
        papers: [],
        total: 0,
      },
    } as unknown as Parameters<typeof buildResearchRoutePageRoute>[0];

    expect(buildResearchRoutePageRoute(document)).toEqual({
      ok: false,
      reason: "invalid-value",
    });
  });
});

describe("relationship seed URL byte budget", () => {
  it("rejects an over-limit relationship title for citation and similar", () => {
    const overLimitTitle =
      repeatToUtf8Bytes("😀", SEARCH_CONDITION_VALUE_LIMITS.seedPaperTitleBytes) + "a";
    expect(buildCitationSeedPageRoute(seedPaper({ title: overLimitTitle }))).toEqual({
      ok: false,
      reason: "dimension-limit",
    });
    expect(buildSimilarSeedPageRoute(seedPaper({ title: overLimitTitle }))).toEqual({
      ok: false,
      reason: "dimension-limit",
    });
  });
});

describe("publication-year condition URL validation", () => {
  it("accepts every canonical publication-year shape and rejects partial numeric suffixes", () => {
    for (const year of ["2024", "2024-2024", "1990-2020", "1990-", "-2020", ""]) {
      expect(
        validateSearchConditionUrl("search", new URLSearchParams({ q: "query", year })).ok,
      ).toBe(true);
    }

    for (const year of ["garbage", "2020abc", "2020-2024x", "2020--2024", " 2020 "]) {
      expect(
        validateSearchConditionUrl("search", new URLSearchParams({ q: "query", year })),
      ).toEqual({ ok: false, reason: "invalid-value" });
    }
  });
});
