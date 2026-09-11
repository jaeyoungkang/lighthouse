import { beforeEach, describe, expect, it, vi } from "vitest";
import { epistemePostFetch } from "@/app/server/external-http-gateway/literature-provider-fetch";
import { lookupGraphNeighborsForPaper } from "@/app/server/services/episteme-literature";
import { executeGraphNeighborsFromUrl } from "@/app/server/services/relationship-execution";

vi.mock("@/app/server/external-http-gateway/literature-provider-fetch", () => ({
  epistemeFetch: vi.fn(),
  epistemePostFetch: vi.fn(),
}));

const response = (items: unknown[]) =>
  new Response(
    JSON.stringify({
      seeds: [{ input_ref: "s2:123", status: "resolved" }],
      items,
      coverage: { graph_generation: "4", paper_generation: "4", retrievers: [] },
      fusion: { quality: "balanced" },
      elapsed_ms: 1,
      completeness: { status: "complete", incomplete_reasons: [] },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

const card = (paperId: string) => ({
  paper_uid: `pap_${paperId}`,
  projection: "standard",
  omitted_fields: ["abstract"],
  title: `Paper ${paperId}`,
  authors: [],
  fields_of_study: [],
  identifiers: [{ namespace: "s2_corpus_id", value: paperId }],
  source_memberships: ["s2"],
  citation_count: 0,
  reference_count: 0,
  currency: { generation: 4, state: "current" },
});

const seedPaper = {
  paperId: "123",
  title: "Seed",
  abstract: null,
  year: 2026,
  citationCount: 0,
  url: "https://example.org/seed",
  authors: [],
};

beforeEach(() => vi.clearAllMocks());

describe("E3 graph-neighbor discovery", () => {
  it("excludes the seed paper if the provider echoes it back", async () => {
    vi.mocked(epistemePostFetch).mockResolvedValueOnce(
      response([
        {
          paper: card("123"),
          rank: 1,
          fusion_score: 0.9,
          evidence: [
            {
              retriever: "co_citation",
              seed_paper_uid: "pap_123",
              raw_signal: 5,
              normalized_signal: 1,
            },
          ],
        },
      ]),
    );
    const result = await lookupGraphNeighborsForPaper(seedPaper);
    expect(result.coCited).toEqual([]);
    expect(result.coupled).toEqual([]);
  });

  it("marks empty graph-neighbor route payloads as ready instead of pending", async () => {
    vi.mocked(epistemePostFetch).mockResolvedValueOnce(response([]));
    const result = await executeGraphNeighborsFromUrl({
      ownerPrincipalId: "principal-1",
      input: {
        canonicalKey: "seed:123",
        seedPaper,
      },
    });
    expect(result.failed).toBe(false);
    expect(result.view.metadata.type).toBe("graph_neighbors");
    if (result.view.metadata.type === "graph_neighbors") {
      expect(result.view.metadata.cardDataHydration).toEqual({ status: "ready" });
      expect(result.view.metadata.graphLoadFailed).not.toBe(true);
    }
  });
});
