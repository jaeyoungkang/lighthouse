import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as QueryClauseNormalizationService from "@/app/server/services/query-clause-normalization-service";
import { epistemeFetch } from "@/app/server/external-http-gateway/literature-provider-fetch";
import { normalizeSearchQueryClauses } from "@/app/server/services/query-clause-normalization-service";
import {
  allocateEpistemeClauseLimits,
  fetchEpistemePapers,
  mergeEpistemeClauseResults,
  parseEpistemeSearchClauses,
} from "@/app/server/services/search-service";
import {
  corpusIdFor,
  makeEpistemeResponse,
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

function anchorThemeQueryClauses(): ReturnType<typeof normalizeSearchQueryClauses> {
  return [
    {
      rawClause: "The AI Scientist",
      normalizedClause: "The AI Scientist",
      role: "anchor",
      isExtractive: true,
      derivedExpansions: [],
    },
    {
      rawClause: "automation of AI research",
      normalizedClause: "automation of AI research",
      role: "theme",
      isExtractive: true,
      derivedExpansions: [],
    },
  ];
}

function extractiveQueryClauses(): ReturnType<typeof normalizeSearchQueryClauses> {
  return [
    {
      rawClause: "Towards end-to-end automation of AI research",
      normalizedClause: "end-to-end automation of AI research",
      role: "theme",
      isExtractive: true,
      derivedExpansions: ["autonomous research workflow"],
    },
    {
      rawClause: "the ai scientist",
      normalizedClause: "The AI Scientist",
      role: "anchor",
      isExtractive: true,
      derivedExpansions: [],
    },
  ];
}

describe("search-service clause handling", () => {
  beforeEach(() => {
    resetServiceMocks();
  });

  it("keeps comma queries intact and dedupes explicit semicolon clauses", () => {
    expect(parseEpistemeSearchClauses("machine learning, climate change")).toEqual([
      "machine learning, climate change",
    ]);
    expect(
      parseEpistemeSearchClauses(
        "  The AI Scientist; automation of AI research ; the ai scientist  ",
      ),
    ).toEqual(["The AI Scientist", "automation of AI research"]);
    expect(parseEpistemeSearchClauses("The AI Scientist")).toEqual(["The AI Scientist"]);
  });

  it("keeps the overall search budget fixed when splitting clauses", () => {
    expect(allocateEpistemeClauseLimits(100, 2)).toEqual([50, 50]);
    expect(allocateEpistemeClauseLimits(99, 3)).toEqual([33, 33, 33]);
    expect(allocateEpistemeClauseLimits(2, 4)).toEqual([1, 1]);
    expect(allocateEpistemeClauseLimits(100, 2, anchorThemeQueryClauses())).toEqual([40, 60]);
  });

  it("interleaves multi-query relevance results while deduping overlaps", () => {
    const merged = mergeEpistemeClauseResults({
      clauseResults: [
        { papers: [paper({ paperId: "a", title: "A" }), paper({ paperId: "b", title: "B" })] },
        { papers: [paper({ paperId: "c", title: "C" }), paper({ paperId: "b", title: "B" })] },
      ],
      limit: 4,
      sort: "relevance",
    });

    expect(merged.map((entry) => entry.paperId)).toEqual(["a", "c", "b"]);
  });

  it("splits multi-query fetches across the shared result budget", async () => {
    const mockedEpistemeFetch = vi.mocked(epistemeFetch);
    vi.mocked(normalizeSearchQueryClauses).mockReturnValueOnce(anchorThemeQueryClauses());
    mockedEpistemeFetch
      .mockResolvedValueOnce(
        makeEpistemeResponse({
          total: 40,
          papers: [
            paper({ paperId: "p1", title: "The AI Scientist" }),
            paper({ paperId: "shared", title: "Shared Paper" }),
          ],
        }),
      )
      .mockResolvedValueOnce(
        makeEpistemeResponse({
          total: 60,
          papers: [
            paper({ paperId: "shared", title: "Shared Paper" }),
            paper({ paperId: "p2", title: "Automation of AI Research" }),
          ],
        }),
      );

    const result = await fetchEpistemePapers({
      query: "The AI Scientist; automation of AI research",
      limit: 100,
      year: "2021-2024",
    });

    expect(mockedEpistemeFetch).toHaveBeenCalledTimes(2);

    const firstUrl = new URL(mockedEpistemeFetch.mock.calls[0]?.[0] ?? "");
    const secondUrl = new URL(mockedEpistemeFetch.mock.calls[1]?.[0] ?? "");

    expect(firstUrl.searchParams.get("q")).toBe("The AI Scientist");
    expect(secondUrl.searchParams.get("q")).toBe("automation of AI research");
    expect(firstUrl.searchParams.get("limit")).toBe("40");
    expect(secondUrl.searchParams.get("limit")).toBe("60");
    for (const url of [firstUrl, secondUrl]) {
      expect(url.searchParams.get("year_min")).toBe("2021");
      expect(url.searchParams.get("year_max")).toBe("2024");
    }
    expect(result.papers.map((entry) => entry.paperId)).toEqual([
      corpusIdFor("p1"),
      corpusIdFor("shared"),
      corpusIdFor("p2"),
    ]);
    expect(result.total).toBe(3);
    expect(result.totalMode).toBe("merged");
    expect(result.queryClauses[0]?.role).toBe("anchor");
    expect(result.clauseStats).toEqual([
      {
        clause: "The AI Scientist",
        role: "anchor",
        total: 40,
        fetched: 2,
        providerWindow: {
          totalMode: "candidate_window",
          hasMore: false,
          nextCursor: null,
          generation: "test-4",
          completenessStatus: "bounded",
          currencyState: "current",
          totalCoverage: { full: false, generation: "fixture" },
        },
      },
      {
        clause: "automation of AI research",
        role: "theme",
        total: 60,
        fetched: 2,
        providerWindow: {
          totalMode: "candidate_window",
          hasMore: false,
          nextCursor: null,
          generation: "test-4",
          completenessStatus: "bounded",
          currencyState: "current",
          totalCoverage: { full: false, generation: "fixture" },
        },
      },
    ]);
  });

  it("starts clause fetches concurrently and merges results in clause order", async () => {
    const mockedEpistemeFetch = vi.mocked(epistemeFetch);
    vi.mocked(normalizeSearchQueryClauses).mockReturnValueOnce(anchorThemeQueryClauses());

    let resolveFirstClause: ((response: Response) => void) | undefined;
    const firstClauseDeferred = new Promise<Response>((resolve) => {
      resolveFirstClause = resolve;
    });
    mockedEpistemeFetch.mockReturnValueOnce(firstClauseDeferred).mockResolvedValueOnce(
      makeEpistemeResponse({
        total: 60,
        papers: [paper({ paperId: "p2", title: "Automation of AI Research" })],
      }),
    );

    const resultPromise = fetchEpistemePapers({
      query: "The AI Scientist; automation of AI research",
      limit: 100,
    });

    // 첫 절 fetch가 아직 미해결인 상태에서 둘째 절 fetch가 이미 시작되어 있어야
    // 한다 — 순차 실행이면 둘째 호출은 여기서 일어나지 않는다.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mockedEpistemeFetch).toHaveBeenCalledTimes(2);
    expect(new URL(mockedEpistemeFetch.mock.calls[0]?.[0] ?? "").searchParams.get("q")).toBe(
      "The AI Scientist",
    );
    expect(new URL(mockedEpistemeFetch.mock.calls[1]?.[0] ?? "").searchParams.get("q")).toBe(
      "automation of AI research",
    );

    resolveFirstClause?.(
      makeEpistemeResponse({
        total: 40,
        papers: [paper({ paperId: "p1", title: "The AI Scientist" })],
      }),
    );

    const result = await resultPromise;
    // 둘째 절이 먼저 해결됐어도 병합과 clauseStats는 절 배열 순서를 따른다.
    expect(result.papers.map((entry) => entry.paperId)).toEqual([
      corpusIdFor("p1"),
      corpusIdFor("p2"),
    ]);
    expect(result.clauseStats.map((stat) => stat.clause)).toEqual([
      "The AI Scientist",
      "automation of AI research",
    ]);
  });

  it("uses extractive normalized clauses for retrieval", async () => {
    const mockedEpistemeFetch = vi.mocked(epistemeFetch);
    vi.mocked(normalizeSearchQueryClauses).mockReturnValueOnce(extractiveQueryClauses());
    mockedEpistemeFetch
      .mockResolvedValueOnce(
        makeEpistemeResponse({
          total: 20,
          papers: [paper({ paperId: "p1", title: "Automation" })],
        }),
      )
      .mockResolvedValueOnce(
        makeEpistemeResponse({
          total: 20,
          papers: [paper({ paperId: "p2", title: "AI Scientist" })],
        }),
      );

    await fetchEpistemePapers({
      query: "Towards end-to-end automation of AI research; the ai scientist",
      limit: 20,
    });

    const firstUrl = new URL(mockedEpistemeFetch.mock.calls[0]?.[0] ?? "");
    const secondUrl = new URL(mockedEpistemeFetch.mock.calls[1]?.[0] ?? "");

    expect(firstUrl.searchParams.get("q")).toBe("end-to-end automation of AI research");
    expect(secondUrl.searchParams.get("q")).toBe("The AI Scientist");
  });

  it("keeps offset pagination on the original unsplit query", async () => {
    const mockedEpistemeFetch = vi.mocked(epistemeFetch);
    mockedEpistemeFetch.mockResolvedValueOnce(
      makeEpistemeResponse({
        total: 12,
        papers: [paper({ paperId: "p1", title: "The AI Scientist" })],
      }),
    );

    await fetchEpistemePapers({
      query: "The AI Scientist, automation of AI research",
      limit: 10,
      offset: 10,
    });

    expect(mockedEpistemeFetch).toHaveBeenCalledTimes(1);

    const requestUrl = new URL(mockedEpistemeFetch.mock.calls[0]?.[0] ?? "");
    expect(requestUrl.searchParams.get("q")).toBe("The AI Scientist, automation of AI research");
    // E3 is cursor-native. The compatibility offset is served by requesting the
    // bounded prefix and slicing it locally, never by inventing an E3 cursor.
    expect(requestUrl.searchParams.get("limit")).toBe("20");
    expect(requestUrl.searchParams.has("offset")).toBe(false);
  });
});
