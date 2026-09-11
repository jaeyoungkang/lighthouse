/**
 * search-service 테스트 공용 fixture.
 * `search-service.test.ts`와 `search-service.multi-query.test.ts`가 공유한다.
 * 사용하는 테스트 파일이 `literature-provider-fetch`와
 * `query-clause-normalization-service`를 vi.mock한 상태여야 한다 —
 * `resetServiceMocks`의 `vi.mocked(...)` 접근이 mock 인스턴스를 전제한다.
 */
import { vi } from "vitest";
import {
  epistemeFetch,
  epistemePostFetch,
} from "@/app/server/external-http-gateway/literature-provider-fetch";
import { normalizeSearchQueryClauses } from "@/app/server/services/query-clause-normalization-service";
import type { MappedPaper } from "@/app/server/services/search-service";

export function paper(params: {
  paperId: string;
  title: string;
  abstract?: string | null;
  citationCount?: number;
  year?: number | null;
}): MappedPaper {
  return {
    paperId: params.paperId,
    title: params.title,
    abstract: params.abstract === undefined ? `${params.title} abstract` : params.abstract,
    year: params.year ?? 2024,
    citationCount: params.citationCount ?? 0,
    url: `https://example.com/${params.paperId}`,
    authors: ["Author"],
    openAccessPdf: null,
    doi: null,
    referenceIds: null,
    citationIds: null,
  };
}

export function makeEpistemeResponse(params: {
  total: number;
  papers: Array<ReturnType<typeof paper>>;
}): Response {
  return new Response(
    JSON.stringify({
      items: params.papers.map(toEpisteme3Card),
      next_cursor: null,
      total: {
        value: params.total,
        relation: "bounded",
        basis: "hybrid_candidates",
        coverage: { full: false, generation: "fixture" },
        incomplete_reasons: [],
      },
      coverage: {
        paper: { full: true, indexed: params.total, eligible: params.total, generation: "test-4" },
      },
      currency: {
        retrieval_generation: "test-4",
        projection_generations: [4],
        state: "current",
      },
      elapsed_ms: 1,
      page: { generation: "test-4", next_cursor: null, size: params.papers.length },
      completeness: { status: "bounded", generations: { retrieval: "4" }, incomplete_reasons: [] },
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}

export function makeEpistemePaperResponse(
  entry: ReturnType<typeof paper> & { doi?: string | null },
): Response {
  return new Response(
    JSON.stringify({
      ...toEpisteme3Card(entry),
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
}

function hashCode(value: string): number {
  return Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 7);
}

export function corpusIdFor(paperId: string): string {
  return String(Number(paperId.replace(/\D/g, "")) || Math.abs(hashCode(paperId)));
}

function toEpisteme3Card(entry: ReturnType<typeof paper> & { doi?: string | null }) {
  const corpusId = corpusIdFor(entry.paperId);
  return {
    paper_uid: `pap_test_${corpusId}`,
    projection: "rich",
    omitted_fields: [],
    title: entry.title,
    abstract: entry.abstract,
    abstract_snippet: entry.abstract,
    publication_year: entry.year,
    venue: null,
    publication_venue: null,
    authors: entry.authors.map((name) => ({ person_uid: null, name, identifiers: [] })),
    fields_of_study: [],
    identifiers: [
      { namespace: "s2_corpus_id", value: corpusId },
      ...(entry.doi ? [{ namespace: "doi", value: entry.doi }] : []),
    ],
    source_memberships: ["s2"],
    has_pdf: false,
    has_open_access_location: false,
    access_url: entry.url,
    best_open_pdf: null,
    best_landing_page: entry.url,
    citation_count: entry.citationCount,
    reference_count: entry.referenceCount ?? 0,
    relevance: 1,
    currency: { generation: 4, state: "current" },
  };
}

export function resetServiceMocks() {
  vi.mocked(epistemeFetch).mockReset();
  vi.mocked(epistemePostFetch).mockReset();
  vi.mocked(normalizeSearchQueryClauses).mockClear();
  vi.mocked(epistemePostFetch).mockImplementation((url, body) => {
    if (url.endsWith("/search/papers")) {
      // Existing search-service assertions inspect the mocked transport URL. Mirror the
      // native request body there without changing the production E3 wire contract.
      const request = body as {
        query?: { text?: string };
        page?: { size?: number };
        sort?: string;
        filters?: { publication_year?: { gte?: number; lte?: number } };
      };
      const mirrored = new URL(url);
      if (request.query?.text) mirrored.searchParams.set("q", request.query.text);
      if (request.page?.size != null) mirrored.searchParams.set("limit", String(request.page.size));
      if (request.sort) mirrored.searchParams.set("sort", request.sort);
      if (request.filters?.publication_year?.gte != null)
        mirrored.searchParams.set("year_min", String(request.filters.publication_year.gte));
      if (request.filters?.publication_year?.lte != null)
        mirrored.searchParams.set("year_max", String(request.filters.publication_year.lte));
      return epistemeFetch(mirrored.toString());
    }
    const refs =
      typeof body === "object" && body !== null && "papers" in body
        ? ((body as { papers?: string[] }).papers ?? [])
        : [];
    return Promise.resolve(
      new Response(
        JSON.stringify({
          items: refs.map((ref) => {
            const corpusId = ref.replace(/^s2:/, "");
            return {
              resolution: { input_ref: ref },
              paper: toEpisteme3Card(paper({ paperId: corpusId, title: `Paper ${corpusId}` })),
            };
          }),
          unresolved: [],
          completeness: { status: "complete", incomplete_reasons: [] },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
  });
}

export function mockHydrationFor(...paperGroups: Array<Array<ReturnType<typeof paper>>>) {
  // E3 search requests a rich projection, so search tests no longer need a second batch response.
  void paperGroups;
}
