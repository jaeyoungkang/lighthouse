import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  epistemeFetch,
  epistemePostFetch,
} from "@/app/server/external-http-gateway/literature-provider-fetch";
import {
  fetchEpistemeSearchWindow,
  getEpistemeBaseUrl,
  hydrateEpistemePapers,
  lookupEpistemePaperByIdentifier,
  lookupCitationLineageForPaper,
  lookupGraphNeighborsForPaper,
} from "@/app/server/services/episteme-literature";

vi.mock("@/app/server/external-http-gateway/literature-provider-fetch", () => ({
  epistemeFetch: vi.fn(),
  epistemePostFetch: vi.fn(),
}));

const card = (id = "123", uid = "pap_123") => ({
  paper_uid: uid,
  projection: "rich",
  omitted_fields: [],
  title: "E3 paper",
  abstract: "Abstract",
  abstract_snippet: "Abstract",
  publication_year: 2026,
  venue: { name: "Venue" },
  publication_venue: "Venue",
  authors: [{ person_uid: "per_1", name: "Author", identifiers: [] }],
  fields_of_study: ["Computer Science"],
  identifiers: [
    { namespace: "s2_corpus_id", value: id },
    { namespace: "doi", value: "10.1000/e3" },
    { namespace: "openalex_work_id", value: "W123" },
  ],
  source_memberships: ["s2", "openalex"],
  has_pdf: true,
  has_open_access_location: true,
  access_url: "https://example.org/e3",
  best_open_pdf: "https://example.org/e3.pdf",
  best_landing_page: "https://example.org/e3",
  citation_count: 7,
  reference_count: 3,
  relevance: null,
  currency: { generation: 4, state: "current" },
});

const response = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

const searchMetadata = {
  coverage: { paper: { full: true, indexed: 1, eligible: 1, generation: "4" } },
  currency: { retrieval_generation: "4", projection_generations: [4], state: "current" },
  elapsed_ms: 1,
};

const discoveryMetadata = {
  seeds: [{ input_ref: "s2:123", status: "resolved" }],
  coverage: { graph_generation: "4", paper_generation: "4", retrievers: [] },
  fusion: { quality: "balanced" },
  elapsed_ms: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Episteme 3 native literature adapter", () => {
  it("pins every provider call below the native /api/v3 namespace", () => {
    expect(getEpistemeBaseUrl()).toBe("https://sah.borca.ai/api/v3");
  });

  it("posts the E3 search contract and accepts nullable relevance", async () => {
    vi.mocked(epistemePostFetch).mockResolvedValueOnce(
      response({
        items: [card()],
        next_cursor: "opaque-cursor",
        total: {
          value: 200,
          relation: "estimated",
          basis: "hybrid_candidates",
          coverage: searchMetadata.coverage.paper,
          incomplete_reasons: ["adaptive_lexical_estimate"],
        },
        ...searchMetadata,
        currency: { ...searchMetadata.currency, state: "mixed" },
        page: { generation: "4", next_cursor: "opaque-cursor", size: 1 },
        completeness: {
          status: "estimated",
          generations: { retrieval: "4" },
          incomplete_reasons: ["adaptive_lexical_estimate"],
        },
      }),
    );
    const result = await fetchEpistemeSearchWindow({
      query: "attention",
      limit: 20,
      hydrate: false,
    });

    expect(vi.mocked(epistemePostFetch).mock.calls[0]?.[0]).toBe(
      "https://sah.borca.ai/api/v3/search/papers",
    );
    expect(vi.mocked(epistemePostFetch).mock.calls[0]?.[1]).toMatchObject({
      query: { text: "attention", retrieval: "hybrid_rerank" },
      page: { size: 20 },
      projection: "standard",
    });
    expect(result.papers[0]?.paperId).toBe("123");
    expect(result.paging?.nextCursor).toBe("opaque-cursor");
    expect(result.totalMode).toBe("estimated");
    expect(result.source).toMatchObject({
      provider: "episteme3",
      baseCorpus: "multi_provider",
      completenessStatus: "estimated",
      freshnessMode: "configured",
      currencyState: "mixed",
      coverage: { full: true, generation: "4" },
      totalCoverage: { full: true, generation: "4" },
      elapsedMs: 1,
    });
  });

  it("fails closed when E3 search envelope metadata is incomplete", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(epistemePostFetch).mockResolvedValueOnce(
      response({
        items: [card()],
        next_cursor: null,
        total: {
          value: 1,
          relation: "exact",
          basis: "lexical_matches",
          coverage: searchMetadata.coverage.paper,
          incomplete_reasons: [],
        },
        page: { generation: "4", next_cursor: null, size: 1 },
        completeness: { status: "complete", incomplete_reasons: [] },
      }),
    );

    await expect(
      fetchEpistemeSearchWindow({ query: "attention", limit: 20, hydrate: false }),
    ).rejects.toMatchObject({ code: "SEARCH_PARSE_FAILED" });
  });

  it("uses E3 lexical ordering for provider-wide secondary sorts", async () => {
    vi.mocked(epistemePostFetch).mockResolvedValueOnce(
      response({
        items: [card()],
        next_cursor: null,
        total: {
          value: 1,
          relation: "exact",
          basis: "lexical_matches",
          coverage: searchMetadata.coverage.paper,
          incomplete_reasons: [],
        },
        ...searchMetadata,
        page: { generation: "4", next_cursor: null, size: 1 },
        completeness: { status: "complete", incomplete_reasons: [] },
      }),
    );

    await fetchEpistemeSearchWindow({
      query: "attention",
      limit: 20,
      sort: "citationCount",
      hydrate: false,
    });

    expect(vi.mocked(epistemePostFetch).mock.calls[0]?.[1]).toMatchObject({
      query: { text: "attention", retrieval: "lexical" },
      sort: "citations",
    });
  });

  it("hydrates stored numeric ids through E3 paper refs and rich projection", async () => {
    vi.mocked(epistemePostFetch).mockResolvedValueOnce(
      response({
        items: [{ resolution: { input_ref: "s2:123" }, paper: card() }],
        unresolved: [],
        completeness: { status: "complete", incomplete_reasons: [] },
      }),
    );
    const papers = await hydrateEpistemePapers([123]);
    expect(vi.mocked(epistemePostFetch).mock.calls[0]?.[1]).toEqual({
      papers: ["s2:123"],
      projection: "rich",
    });
    expect(papers[0]?.source?.canonicalPaperId).toBe("pap_123");
    expect(papers[0]?.externalIds?.OpenAlex).toBe("W123");
  });

  it("uses the E3 by-ref exact lookup instead of the removed E2 lookup route", async () => {
    vi.mocked(epistemeFetch).mockResolvedValueOnce(response(card()));
    await lookupEpistemePaperByIdentifier({ doi: "10.1000/e3" });
    const url = new URL(vi.mocked(epistemeFetch).mock.calls[0]?.[0] ?? "");
    expect(url.pathname).toBe("/api/v3/papers/by-ref");
    expect(url.searchParams.get("ref")).toBe("doi:10.1000/e3");
  });

  it("fetches E3 citation directions with exact availability", async () => {
    const citationPage = (direction: "cites" | "cited_by", neighborId: string) => ({
      paper_uid: "pap_123",
      direction,
      items: [
        {
          source_paper_uid: direction === "cites" ? "pap_123" : `pap_${neighborId}`,
          target_paper_uid: direction === "cites" ? `pap_${neighborId}` : "pap_123",
          relation: "citation",
          paper: card(neighborId, `pap_${neighborId}`),
        },
      ],
      next_cursor: null,
      total: 1,
      total_relation: "exact",
      graph_generation: "4",
      page: { generation: "4", next_cursor: null, size: 1 },
      completeness: { status: "complete", incomplete_reasons: [] },
    });
    vi.mocked(epistemeFetch)
      .mockResolvedValueOnce(response(citationPage("cites", "201")))
      .mockResolvedValueOnce(response(citationPage("cited_by", "301")));

    const result = await lookupCitationLineageForPaper({
      paperId: "123",
      title: "Seed",
      abstract: null,
      year: 2026,
      citationCount: 1,
      url: "https://example.org/seed",
      authors: [],
    });
    expect(result.referenceIds).toEqual(["201"]);
    expect(result.citationIds).toEqual(["301"]);
    expect(result.referenceAvailability).toMatchObject({ available: true, truncated: false });
    const urls = vi.mocked(epistemeFetch).mock.calls.map(([url]) => new URL(url));
    expect(urls.map((url) => url.pathname)).toEqual([
      "/api/v3/graph/citations",
      "/api/v3/graph/citations",
    ]);
    expect(urls.map((url) => url.searchParams.get("paper"))).toEqual(["s2:123", "s2:123"]);
  });

  it("keeps a citation page usable when E3 omits default relation on an unresolved edge", async () => {
    const page = (direction: "cites" | "cited_by") => ({
      paper_uid: "pap_123",
      direction,
      items: [
        {
          source_paper_uid: direction === "cites" ? "pap_123" : "pap_unresolved",
          target_paper_uid: direction === "cites" ? "pap_unresolved" : "pap_123",
          paper: null,
        },
      ],
      next_cursor: null,
      total: 1,
      total_relation: "exact",
      graph_generation: "4",
      page: { generation: "4", next_cursor: null, size: 1 },
      completeness: { status: "bounded", incomplete_reasons: [] },
    });
    vi.mocked(epistemeFetch)
      .mockResolvedValueOnce(response(page("cites")))
      .mockResolvedValueOnce(response(page("cited_by")));

    const result = await lookupCitationLineageForPaper({
      paperId: "123",
      title: "Seed",
      abstract: null,
      year: 2026,
      citationCount: 1,
      url: "https://example.org/seed",
      authors: [],
    });

    expect(result.papers).toEqual([]);
    expect(result.referenceAvailability).toMatchObject({
      returned: 0,
      truncated: true,
      reason: "unresolved_paper_projection",
    });
  });
});

describe("Episteme 3 graph discovery adapter", () => {
  it("derives both graph axes from E3 discovery evidence", async () => {
    vi.mocked(epistemePostFetch).mockResolvedValueOnce(
      response({
        items: [
          {
            paper: card("456", "pap_456"),
            rank: 1,
            fusion_score: 0.8,
            evidence: [
              {
                retriever: "co_citation",
                seed_paper_uid: "pap_123",
                raw_signal: 4,
                normalized_signal: 0.8,
              },
              {
                retriever: "bibliographic_coupling",
                seed_paper_uid: "pap_123",
                raw_signal: 3,
                normalized_signal: 0.6,
              },
            ],
          },
        ],
        ...discoveryMetadata,
        completeness: { status: "bounded", incomplete_reasons: ["limit_applied"] },
      }),
    );
    const result = await lookupGraphNeighborsForPaper({
      paperId: "123",
      title: "Seed",
      abstract: null,
      year: 2026,
      citationCount: 0,
      url: "https://example.org/seed",
      authors: [],
    });
    expect(result.coCited).toEqual([{ paperId: "456", shared: 4 }]);
    expect(result.coupled).toEqual([{ paperId: "456", shared: 3 }]);
    expect(vi.mocked(epistemePostFetch).mock.calls[0]?.[0]).toContain("/api/v3/papers/discover");
  });

  it("excludes a discovery seed returned under its S2 alias", async () => {
    vi.mocked(epistemePostFetch).mockResolvedValueOnce(
      response({
        items: [
          {
            paper: card("123", "pap_seed"),
            rank: 1,
            fusion_score: 1,
            evidence: [
              {
                retriever: "co_citation",
                seed_paper_uid: "pap_seed",
                raw_signal: 5,
                normalized_signal: 1,
              },
            ],
          },
        ],
        ...discoveryMetadata,
        completeness: { status: "complete", incomplete_reasons: [] },
      }),
    );

    const result = await lookupGraphNeighborsForPaper({
      paperId: "pap_seed",
      title: "Seed",
      abstract: null,
      year: 2026,
      citationCount: 0,
      url: "https://example.org/seed",
      authors: [],
    });

    expect(result.papers).toEqual([]);
    expect(result.coCited).toEqual([]);
  });

  it("degrades graph discovery when E3 reports unavailable completeness", async () => {
    vi.mocked(epistemePostFetch).mockResolvedValueOnce(
      response({
        items: [],
        seeds: [],
        unresolved: [{ input_ref: "pap_missing", status: "unresolved" }],
        coverage: { graph_generation: "4", paper_generation: "4", retrievers: [] },
        fusion: { quality: "balanced" },
        elapsed_ms: 1,
        completeness: { status: "unavailable", incomplete_reasons: ["no_resolved_seeds"] },
      }),
    );

    await expect(
      lookupGraphNeighborsForPaper({
        paperId: "pap_missing",
        title: "Missing seed",
        abstract: null,
        year: null,
        citationCount: 0,
        url: "https://example.org/missing",
        authors: [],
      }),
    ).rejects.toMatchObject({ code: "SEARCH_SERVER_ERROR" });
  });

  it("preserves graph discovery rate-limit classification", async () => {
    vi.mocked(epistemePostFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "rate limited" }), { status: 429 }),
    );

    await expect(
      lookupGraphNeighborsForPaper({
        paperId: "pap_seed",
        title: "Seed",
        abstract: null,
        year: 2026,
        citationCount: 0,
        url: "https://example.org/seed",
        authors: [],
      }),
    ).rejects.toMatchObject({ code: "SEARCH_RATE_LIMITED" });
  });
});
