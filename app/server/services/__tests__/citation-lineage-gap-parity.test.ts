// @promise promise:gap-network-detection-from-search
// @check acceptance-check:gap-network-detection-from-search-citation-source-quality-parity
import { beforeEach, describe, expect, it, vi } from "vitest";
import { epistemePostFetch } from "@/app/server/external-http-gateway/literature-provider-fetch";
import {
  fetchEpistemeSearchWindow,
  hydrateEpistemePapers,
} from "@/app/server/services/episteme-literature";

vi.mock("@/app/server/external-http-gateway/literature-provider-fetch", () => ({
  epistemeFetch: vi.fn(),
  epistemePostFetch: vi.fn(),
}));

const card = (projection: "standard" | "rich") => ({
  paper_uid: "pap_271854887",
  projection,
  omitted_fields: projection === "standard" ? ["abstract"] : [],
  title: "The AI Scientist",
  abstract: projection === "rich" ? "An automated research system." : null,
  authors: projection === "rich" ? [{ person_uid: "per_1", name: "Author", identifiers: [] }] : [],
  fields_of_study: projection === "rich" ? ["Computer Science"] : [],
  identifiers: [{ namespace: "s2_corpus_id", value: "271854887" }],
  source_memberships: ["s2"],
  citation_count: 7,
  reference_count: 3,
  currency: { generation: 4, state: "current" },
});

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

beforeEach(() => vi.clearAllMocks());

describe("Episteme 3 search and batch mapping parity", () => {
  it("keeps one product identity while a rich projection adds card details", async () => {
    vi.mocked(epistemePostFetch)
      .mockResolvedValueOnce(
        ok({
          items: [card("standard")],
          next_cursor: null,
          total: {
            value: 1,
            relation: "exact",
            basis: "lexical_matches",
            coverage: { full: true, indexed: 1, eligible: 1, generation: "4" },
            incomplete_reasons: [],
          },
          coverage: { paper: { full: true, indexed: 1, eligible: 1, generation: "4" } },
          currency: {
            retrieval_generation: "4",
            projection_generations: [4],
            state: "current",
          },
          elapsed_ms: 1,
          page: { generation: "4", next_cursor: null, size: 1 },
          completeness: { status: "complete", incomplete_reasons: [] },
        }),
      )
      .mockResolvedValueOnce(
        ok({
          items: [{ resolution: { input_ref: "s2:271854887" }, paper: card("rich") }],
          unresolved: [],
          completeness: { status: "complete", incomplete_reasons: [] },
        }),
      );

    const search = await fetchEpistemeSearchWindow({
      query: "AI Scientist",
      limit: 1,
      hydrate: false,
    });
    const [hydrated] = await hydrateEpistemePapers([search.papers[0]?.paperId ?? ""]);
    expect(search.papers[0]?.paperId).toBe("271854887");
    expect(hydrated.paperId).toBe("271854887");
    expect(search.papers[0]?.source?.canonicalPaperId).toBe("pap_271854887");
    expect(hydrated.abstract).toBe("An automated research system.");
    expect(hydrated.referenceAvailability).toMatchObject({
      truncated: true,
      total: 3,
      reason: "lazy_fetch_required",
    });
  });
});
