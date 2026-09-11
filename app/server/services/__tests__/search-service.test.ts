import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as QueryClauseNormalizationService from "@/app/server/services/query-clause-normalization-service";
import {
  epistemeFetch,
  epistemePostFetch,
} from "@/app/server/external-http-gateway/literature-provider-fetch";
import {
  buildSearchViewPayload,
  fetchEpistemePapers,
  lookupPapersByIds,
  mergeEpistemeClauseResults,
} from "@/app/server/services/search-service";
import {
  corpusIdFor,
  makeEpistemePaperResponse,
  makeEpistemeResponse,
  mockHydrationFor,
  paper,
  resetServiceMocks,
} from "./search-service.fixtures";

vi.mock("@/app/server/external-http-gateway/literature-provider-fetch", () => ({
  epistemeFetch: vi.fn(),
  epistemePostFetch: vi.fn(),
}));

vi.mock("@/app/server/services/query-clause-normalization-service", async (importOriginal) => {
  const actual = await importOriginal<typeof QueryClauseNormalizationService>();
  return {
    normalizeSearchQueryClauses: vi.fn(actual.normalizeSearchQueryClauses),
  };
});

describe("search-service selected sort", () => {
  beforeEach(() => {
    resetServiceMocks();
  });

  it("applies deterministic oldest-first ordering for sorted clause results", () => {
    const merged = mergeEpistemeClauseResults({
      clauseResults: [
        {
          papers: [
            paper({ paperId: "newer", title: "Newer", year: 2024, citationCount: 10 }),
            paper({ paperId: "older", title: "Older", year: 1998, citationCount: 5 }),
          ],
        },
        {
          papers: [
            paper({ paperId: "missing-year", title: "Missing year", year: null }),
            paper({
              paperId: "same-year-cited",
              title: "Same year cited",
              year: 1998,
              citationCount: 50,
            }),
          ],
        },
      ],
      limit: 4,
      sort: "yearAsc",
    });

    expect(merged.map((entry) => entry.paperId)).toEqual([
      "same-year-cited",
      "older",
      "newer",
      "missing-year",
    ]);
  });

  it("requests a provider-wide ascending year window and final-sorts fetched papers", async () => {
    const mockedEpistemeFetch = vi.mocked(epistemeFetch);
    mockHydrationFor([
      paper({ paperId: "newer", title: "Newer", year: 2024 }),
      paper({ paperId: "older", title: "Older", year: 2001 }),
      paper({ paperId: "missing-year", title: "Missing year", year: null }),
    ]);
    mockedEpistemeFetch.mockResolvedValueOnce(
      makeEpistemeResponse({
        total: 3,
        papers: [
          paper({ paperId: "newer", title: "Newer", year: 2024 }),
          paper({ paperId: "older", title: "Older", year: 2001 }),
          paper({ paperId: "missing-year", title: "Missing year", year: null }),
        ],
      }),
    );

    const result = await fetchEpistemePapers({
      query: "heat transfer",
      limit: 10,
      sort: "yearAsc",
    });

    const requestUrl = new URL(mockedEpistemeFetch.mock.calls[0]?.[0] ?? "");
    expect(requestUrl.searchParams.get("sort")).toBe("year_asc");
    expect(result.papers.map((entry) => entry.paperId)).toEqual([
      corpusIdFor("older"),
      corpusIdFor("newer"),
      corpusIdFor("missing-year"),
    ]);
  });
});

describe("search-service provider ordering", () => {
  beforeEach(() => {
    resetServiceMocks();
  });

  it("preserves provider relevance order for the default relevance window", async () => {
    const mockedEpistemeFetch = vi.mocked(epistemeFetch);
    const shallowOpportunity = paper({
      paperId: "opportunity",
      title: "AI for Science: The Next Big Opportunity",
      abstract: null,
      citationCount: 0,
    });
    const survey = paper({
      paperId: "survey",
      title: "From AI for Science to Agentic Science: A Survey on Autonomous Scientific Discovery",
      abstract: "A survey with a substantial abstract about autonomous scientific discovery.",
      citationCount: 32,
    });
    const review = paper({
      paperId: "review",
      title:
        "AI for Science: A Comprehensive Review on Innovations, Challenges, and Future Directions",
      abstract: "A comprehensive review with a substantial abstract about AI for science.",
      citationCount: 17,
    });
    mockedEpistemeFetch.mockResolvedValueOnce(
      makeEpistemeResponse({
        total: 3,
        papers: [shallowOpportunity, survey, review],
      }),
    );
    mockHydrationFor([shallowOpportunity, survey, review]);

    const result = await fetchEpistemePapers({
      query: "ai for science",
      limit: 10,
    });

    expect(result.papers.map((entry) => entry.paperId)).toEqual([
      corpusIdFor("opportunity"),
      corpusIdFor("survey"),
      corpusIdFor("review"),
    ]);
  });

  it("keeps provider relevance order when an exact-looking result has sparse metadata", async () => {
    const mockedEpistemeFetch = vi.mocked(epistemeFetch);
    const exactMatch = paper({
      paperId: "exact",
      title: "AI for Science",
      abstract: null,
      citationCount: 39,
    });
    const survey = paper({
      paperId: "survey",
      title: "From AI for Science to Agentic Science: A Survey on Autonomous Scientific Discovery",
      abstract: "A survey with a substantial abstract about autonomous scientific discovery.",
      citationCount: 32,
    });
    mockedEpistemeFetch.mockResolvedValueOnce(
      makeEpistemeResponse({
        total: 2,
        papers: [exactMatch, survey],
      }),
    );
    mockHydrationFor([exactMatch, survey]);

    const result = await fetchEpistemePapers({
      query: "ai for science",
      limit: 10,
    });

    expect(result.papers.map((entry) => entry.paperId)).toEqual([
      corpusIdFor("exact"),
      corpusIdFor("survey"),
    ]);
  });

  it("sends a comma-separated compound query through one provider request", async () => {
    const mockedEpistemeFetch = vi.mocked(epistemeFetch);
    mockedEpistemeFetch.mockResolvedValueOnce(
      makeEpistemeResponse({
        total: 1,
        papers: [
          paper({
            paperId: "compound",
            title: "Tackling Climate Change with Machine Learning",
          }),
        ],
      }),
    );

    const result = await fetchEpistemePapers({
      query: "machine learning, climate change",
      limit: 40,
      hydrate: false,
    });

    expect(mockedEpistemeFetch).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(mockedEpistemeFetch.mock.calls[0]?.[0] ?? "");
    expect(requestUrl.searchParams.get("q")).toBe("machine learning, climate change");
    expect(result.queryClauses).toHaveLength(1);
    expect(result.clauseStats).toEqual([]);
    expect(result.totalMode).not.toBe("merged");
  });

  it("keeps semicolon-separated conditions on the explicit multi-query path", async () => {
    const mockedEpistemeFetch = vi.mocked(epistemeFetch);
    mockedEpistemeFetch
      .mockResolvedValueOnce(
        makeEpistemeResponse({
          total: 1,
          papers: [paper({ paperId: "machine-learning", title: "Machine Learning" })],
        }),
      )
      .mockResolvedValueOnce(
        makeEpistemeResponse({
          total: 1,
          papers: [paper({ paperId: "climate-change", title: "Climate Change" })],
        }),
      );

    const result = await fetchEpistemePapers({
      query: "machine learning; climate change",
      limit: 40,
      hydrate: false,
    });

    expect(mockedEpistemeFetch).toHaveBeenCalledTimes(2);
    expect(
      mockedEpistemeFetch.mock.calls.map(([url]) => new URL(url).searchParams.get("q")),
    ).toEqual(["machine learning", "climate change"]);
    expect(result.queryClauses).toHaveLength(2);
    expect(result.clauseStats).toHaveLength(2);
    expect(result.totalMode).toBe("merged");
  });

  it("derives provider requests and metadata from the same deduped clauses", async () => {
    const mockedEpistemeFetch = vi.mocked(epistemeFetch);
    mockedEpistemeFetch.mockResolvedValueOnce(
      makeEpistemeResponse({
        total: 1,
        papers: [paper({ paperId: "foo", title: "Foo" })],
      }),
    );

    const result = await fetchEpistemePapers({
      query: "Towards Foo; Foo",
      limit: 40,
      hydrate: false,
    });

    expect(mockedEpistemeFetch).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(mockedEpistemeFetch.mock.calls[0]?.[0] ?? "");
    expect(requestUrl.searchParams.get("q")).toBe("Foo");
    expect(result.queryClauses).toHaveLength(1);
    expect(result.queryClauses[0]?.normalizedClause).toBe("Foo");
    expect(result.clauseStats).toEqual([]);
    expect(result.totalMode).not.toBe("merged");
  });

  it.each([
    { label: "initial request", offset: undefined },
    { label: "offset pagination", offset: 10 },
  ])(
    "does not call the provider when explicit separators leave no search clause ($label)",
    async ({ offset }) => {
      const mockedEpistemeFetch = vi.mocked(epistemeFetch);

      const result = await fetchEpistemePapers({
        query: ";;;",
        limit: 40,
        offset,
        hydrate: false,
      });

      expect(mockedEpistemeFetch).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        papers: [],
        total: 0,
        totalMode: "not_computed",
        queryClauses: [],
        clauseStats: [],
      });
    },
  );
});

describe("search-service DOI lookup", () => {
  beforeEach(() => {
    resetServiceMocks();
  });

  it("resolves DOI input through the exact paper endpoint before keyword search", async () => {
    const mockedEpistemeFetch = vi.mocked(epistemeFetch);
    mockedEpistemeFetch.mockResolvedValueOnce(
      makeEpistemePaperResponse({
        ...paper({ paperId: "doi-paper", title: "Exact DOI Paper", year: 2023 }),
        doi: "10.1145/3375637",
      }),
    );

    const result = await fetchEpistemePapers({
      query: "https://doi.org/10.1145/3375637",
      limit: 40,
      year: "2023",
    });

    expect(mockedEpistemeFetch).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(mockedEpistemeFetch.mock.calls[0]?.[0] ?? "");
    expect(requestUrl.pathname).toBe("/api/v3/papers/by-ref");
    expect(requestUrl.searchParams.get("ref")).toBe("doi:10.1145/3375637");
    expect(result.total).toBe(1);
    expect(result.totalMode).toBe("exact");
    expect(result.queryClauses).toEqual([]);
    expect(result.exactLookup).toEqual({ kind: "doi", value: "10.1145/3375637" });
    expect(result.source?.provider).toBe("episteme3");
    expect(typeof result.source?.canonicalPaperId).toBe("string");
    expect(typeof result.source?.generation).toBe("string");
    expect(result.papers[0]).toMatchObject({
      paperId: corpusIdFor("doi-paper"),
      doi: "10.1145/3375637",
    });
  });

  it("resolves arXiv DOI input through the arXiv paper identifier before keyword search", async () => {
    const mockedEpistemeFetch = vi.mocked(epistemeFetch);
    mockedEpistemeFetch.mockResolvedValueOnce(
      makeEpistemePaperResponse({
        ...paper({
          paperId: "ai-scientist",
          title: "The AI Scientist: Towards Fully Automated Open-Ended Scientific Discovery",
          year: 2024,
        }),
      }),
    );

    const result = await fetchEpistemePapers({
      query: "https://doi.org/10.48550/arXiv.2408.06292",
      limit: 40,
    });

    expect(mockedEpistemeFetch).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(mockedEpistemeFetch.mock.calls[0]?.[0] ?? "");
    expect(requestUrl.pathname).toBe("/api/v3/papers/by-ref");
    expect(requestUrl.searchParams.get("ref")).toBe("arxiv:2408.06292");
    expect(result.totalMode).toBe("exact");
    expect(result.exactLookup).toEqual({
      kind: "doi",
      value: "10.48550/arXiv.2408.06292",
    });
    expect(result.papers[0]).toMatchObject({
      paperId: corpusIdFor("ai-scientist"),
      title: "The AI Scientist: Towards Fully Automated Open-Ended Scientific Discovery",
      doi: "10.48550/arXiv.2408.06292",
    });
  });

  it("falls back to normalized DOI keyword search when DOI exact lookup has no match", async () => {
    const mockedEpistemeFetch = vi.mocked(epistemeFetch);
    mockedEpistemeFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "not found" }), { status: 404 }))
      .mockResolvedValueOnce(
        makeEpistemeResponse({
          total: 1,
          papers: [paper({ paperId: "fallback", title: "Fallback match" })],
        }),
      );

    const result = await fetchEpistemePapers({
      query: "https://doi.org/10.9999/not-found?download=true",
      limit: 40,
    });

    expect(mockedEpistemeFetch).toHaveBeenCalledTimes(2);
    const fallbackUrl = new URL(mockedEpistemeFetch.mock.calls[1]?.[0] ?? "");
    expect(fallbackUrl.pathname).toContain("/search");
    expect(fallbackUrl.searchParams.get("q")).toBe("10.9999/not-found");
    expect(result.papers.map((entry) => entry.paperId)).toEqual([corpusIdFor("fallback")]);
    expect(result.exactLookup).toBeUndefined();
  });

  it("applies the publication-year range before returning an exact DOI match", async () => {
    const mockedEpistemeFetch = vi.mocked(epistemeFetch);
    mockedEpistemeFetch
      .mockResolvedValueOnce(
        makeEpistemePaperResponse({
          ...paper({ paperId: "doi-outside-range", title: "Outside range", year: 2018 }),
          doi: "10.1145/3375637",
        }),
      )
      .mockResolvedValueOnce(
        makeEpistemeResponse({
          total: 1,
          papers: [paper({ paperId: "fallback-in-range", title: "Fallback match", year: 2021 })],
        }),
      );

    const result = await fetchEpistemePapers({
      query: "https://doi.org/10.1145/3375637",
      limit: 40,
      year: "2020-2022",
      hydrate: false,
    });

    expect(mockedEpistemeFetch).toHaveBeenCalledTimes(2);
    const fallbackUrl = new URL(mockedEpistemeFetch.mock.calls[1]?.[0] ?? "");
    expect(fallbackUrl.pathname).toContain("/search");
    expect(fallbackUrl.searchParams.get("q")).toBe("10.1145/3375637");
    expect(fallbackUrl.searchParams.get("year_min")).toBe("2020");
    expect(fallbackUrl.searchParams.get("year_max")).toBe("2022");
    expect(result.papers.map((entry) => entry.paperId)).toEqual([corpusIdFor("fallback-in-range")]);
    expect(result.exactLookup).toBeUndefined();
  });
});

describe("search-service term discovery boundary", () => {
  it("commits search ResearchRoutePayloads with pending term discovery instead of blocking on LLM extraction", () => {
    const payload = buildSearchViewPayload(
      "principal-1",
      "slide accessibility",
      [
        paper({ paperId: "p1", title: "Highlighting Visualization for Slide Accessibility" }),
        paper({ paperId: "p2", title: "Multi Touch Interaction for Slide Access" }),
      ],
      2,
      "user",
    );
    if (payload.metadata.type !== "search") throw new Error("expected search metadata");
    expect(payload.metadata.englishTermDiscovery).toEqual({ status: "pending" });
    expect(payload.metadata.englishTermCandidates).toBeUndefined();
  });
});

describe("search-service spelling correction boundary", () => {
  beforeEach(() => {
    resetServiceMocks();
  });

  it("returns original search results without running spelling correction on the search critical path", async () => {
    const mockedEpistemeFetch = vi.mocked(epistemeFetch);
    mockedEpistemeFetch.mockResolvedValueOnce(
      makeEpistemeResponse({
        total: 1,
        papers: [paper({ paperId: "typo-match", title: "Trasnformer typo match" })],
      }),
    );

    const result = await fetchEpistemePapers({
      query: "trasnformer",
      limit: 10,
    });

    expect(mockedEpistemeFetch).toHaveBeenCalledTimes(1);
    expect(new URL(mockedEpistemeFetch.mock.calls[0]?.[0] ?? "").searchParams.get("q")).toBe(
      "trasnformer",
    );
    expect(result.papers.map((entry) => entry.paperId)).toEqual([corpusIdFor("typo-match")]);
  });

  it("keeps offset pagination on the original query without spelling correction", async () => {
    const mockedEpistemeFetch = vi.mocked(epistemeFetch);
    mockedEpistemeFetch.mockResolvedValueOnce(
      makeEpistemeResponse({
        total: 12,
        papers: [paper({ paperId: "p1", title: "Transformer" })],
      }),
    );

    await fetchEpistemePapers({
      query: "trasnformer",
      limit: 10,
      offset: 10,
    });

    expect(mockedEpistemeFetch).toHaveBeenCalledTimes(1);
    expect(new URL(mockedEpistemeFetch.mock.calls[0]?.[0] ?? "").searchParams.get("q")).toBe(
      "trasnformer",
    );
  });
});

describe("search-service errors", () => {
  beforeEach(() => {
    resetServiceMocks();
  });

  it("surfaces provider rate limits when Episteme returns 429", async () => {
    const mockedEpistemeFetch = vi.mocked(epistemeFetch);

    mockedEpistemeFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: "Too Many Requests",
          code: "429",
        }),
        {
          status: 429,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    await expect(
      fetchEpistemePapers({
        query: "transformer",
        limit: 10,
      }),
    ).rejects.toThrow(/rate limit|429|Too Many Requests|Literature provider rate limit/i);
  });

  it("does not hydrate non-corpus paper IDs as Episteme corpus IDs", async () => {
    const mockedEpistemePostFetch = vi.mocked(epistemePostFetch);

    await expect(lookupPapersByIds(["abc123", "paper-non-corpus"])).resolves.toEqual([]);
    expect(mockedEpistemePostFetch).not.toHaveBeenCalled();
  });
});
