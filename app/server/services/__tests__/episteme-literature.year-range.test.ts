import { beforeEach, describe, expect, it, vi } from "vitest";
import { epistemePostFetch } from "@/app/server/external-http-gateway/literature-provider-fetch";
import { fetchEpistemeSearchWindow } from "@/app/server/services/episteme-literature";

vi.mock("@/app/server/external-http-gateway/literature-provider-fetch", () => ({
  epistemeFetch: vi.fn(),
  epistemePostFetch: vi.fn(),
}));

function emptySearchResponse(): Response {
  return new Response(
    JSON.stringify({
      items: [],
      next_cursor: null,
      total: {
        value: 0,
        relation: "exact",
        basis: "lexical_matches",
        coverage: { full: true, generation: "4" },
        incomplete_reasons: [],
      },
      coverage: { paper: { full: true, indexed: 0, eligible: 0, generation: "4" } },
      currency: { retrieval_generation: "4", projection_generations: [4], state: "current" },
      elapsed_ms: 1,
      page: { generation: "4", next_cursor: null, size: 0 },
      completeness: { status: "complete", incomplete_reasons: [] },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

beforeEach(() => {
  vi.mocked(epistemePostFetch).mockReset();
});

describe("Episteme publication-year bounds", () => {
  it("sends canonical half-open and reversed publication-year bounds", async () => {
    vi.mocked(epistemePostFetch)
      .mockResolvedValueOnce(emptySearchResponse())
      .mockResolvedValueOnce(emptySearchResponse());

    await fetchEpistemeSearchWindow({
      query: "transformer",
      limit: 1,
      year: "1990-",
      hydrate: false,
    });
    await fetchEpistemeSearchWindow({
      query: "transformer",
      limit: 1,
      year: "2024-2021",
      hydrate: false,
    });

    const lowerOpenBody = vi.mocked(epistemePostFetch).mock.calls[0]?.[1] as {
      filters: { publication_year: Record<string, number> };
    };
    expect(lowerOpenBody.filters.publication_year).toEqual({ gte: 1990 });
    const reversedBody = vi.mocked(epistemePostFetch).mock.calls[1]?.[1] as {
      filters: { publication_year: Record<string, number> };
    };
    expect(reversedBody.filters.publication_year).toEqual({ gte: 2021, lte: 2024 });
  });
});
