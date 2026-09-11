import { beforeEach, describe, expect, it, vi } from "vitest";
import { epistemePostFetch } from "@/app/server/external-http-gateway/literature-provider-fetch";
import {
  lookupPaperNeighborhood,
  PAPER_NEIGHBORHOOD_MAX_EXCLUDE_IDS,
  PAPER_NEIGHBORHOOD_MAX_QUERY_CHARACTERS,
} from "@/app/server/services/episteme-paper-neighborhood";

vi.mock("@/app/server/external-http-gateway/literature-provider-fetch", () => ({
  epistemePostFetch: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("Episteme 3 library discovery", () => {
  it("maps E3 fusion and retriever evidence without product vocabulary on the wire", async () => {
    vi.mocked(epistemePostFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              paper: {
                paper_uid: "pap_candidate",
                projection: "standard",
                omitted_fields: ["abstract"],
                title: "Candidate",
                authors: [],
                fields_of_study: [],
                identifiers: [{ namespace: "s2_corpus_id", value: "456" }],
                source_memberships: ["s2"],
                citation_count: 1,
                reference_count: 2,
                currency: { generation: 4, state: "current" },
              },
              rank: 1,
              fusion_score: 0.75,
              evidence: [
                {
                  retriever: "co_citation",
                  seed_paper_uid: "pap_seed",
                  raw_signal: 5,
                  normalized_signal: 0.7,
                },
                {
                  retriever: "semantic",
                  seed_paper_uid: null,
                  raw_signal: 0.8,
                  normalized_signal: 0.8,
                },
              ],
            },
          ],
          seeds: [{ input_ref: "s2:123", status: "resolved" }],
          coverage: { graph_generation: "4", paper_generation: "4", retrievers: [] },
          fusion: { quality: "balanced" },
          elapsed_ms: 1,
          completeness: { status: "bounded", incomplete_reasons: [] },
        }),
        { status: 200 },
      ),
    );

    const candidates = await lookupPaperNeighborhood({
      corpusIds: [123],
      excludeCorpusIds: [123],
      query: "memory",
      limit: 40,
    });
    expect(candidates?.[0]).toMatchObject({
      corpusId: "456",
      defaultScore: 0.75,
      graphScore: 0.7,
      semanticScore: 0.8,
      sharedCiters: 5,
      sources: ["co_citation", "semantic"],
      providerMetadata: {
        graphGeneration: "4",
        paperGeneration: "4",
        quality: "balanced",
        completenessStatus: "bounded",
        elapsedMs: 1,
      },
    });
    expect(vi.mocked(epistemePostFetch).mock.calls[0]?.[0]).toBe(
      "https://sah.borca.ai/api/v3/papers/discover",
    );
    expect(vi.mocked(epistemePostFetch).mock.calls[0]?.[1]).toMatchObject({
      seeds: ["s2:123"],
      exclude: ["s2:123"],
      retrievers: ["co_citation", "bibliographic_coupling", "semantic"],
    });
  });

  it("caps provider exclusions and still filters the full bounded source locally", async () => {
    const excluded = Array.from(
      { length: PAPER_NEIGHBORHOOD_MAX_EXCLUDE_IDS + 1 },
      (_, index) => index + 1,
    );
    vi.mocked(epistemePostFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              paper: {
                paper_uid: "pap_excluded",
                projection: "standard",
                omitted_fields: ["abstract"],
                title: "Already in library",
                authors: [],
                fields_of_study: [],
                identifiers: [{ namespace: "s2_corpus_id", value: "1001" }],
                source_memberships: ["s2"],
                citation_count: 1,
                reference_count: 1,
                currency: { generation: 4, state: "current" },
              },
              rank: 1,
              fusion_score: 0.5,
              evidence: [],
            },
          ],
          seeds: [{ input_ref: "s2:2001", status: "resolved" }],
          coverage: { graph_generation: "4", paper_generation: "4", retrievers: [] },
          fusion: { quality: "balanced" },
          elapsed_ms: 1,
          completeness: { status: "bounded", incomplete_reasons: [] },
        }),
        { status: 200 },
      ),
    );

    const candidates = await lookupPaperNeighborhood({
      corpusIds: [2_001],
      excludeCorpusIds: excluded,
      limit: 40,
    });

    const body = vi.mocked(epistemePostFetch).mock.calls[0]?.[1] as { exclude: string[] };
    expect(body.exclude).toHaveLength(PAPER_NEIGHBORHOOD_MAX_EXCLUDE_IDS);
    expect(candidates).toEqual([]);
  });

  it("caps discovery queries at the E3 request contract", async () => {
    vi.mocked(epistemePostFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [],
          seeds: [{ input_ref: "s2:123", status: "resolved" }],
          coverage: { graph_generation: "4", paper_generation: "4", retrievers: [] },
          fusion: { quality: "balanced" },
          elapsed_ms: 1,
          completeness: { status: "complete", incomplete_reasons: [] },
        }),
        { status: 200 },
      ),
    );

    await lookupPaperNeighborhood({
      corpusIds: [123],
      query: "가".repeat(PAPER_NEIGHBORHOOD_MAX_QUERY_CHARACTERS + 1),
      limit: 40,
    });

    const body = vi.mocked(epistemePostFetch).mock.calls[0]?.[1] as { query: string };
    expect(Array.from(body.query)).toHaveLength(PAPER_NEIGHBORHOOD_MAX_QUERY_CHARACTERS);
  });

  it("degrades when E3 cannot resolve any discovery seed", async () => {
    vi.mocked(epistemePostFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [],
          seeds: [{ input_ref: "pap_missing", status: "unresolved" }],
          unresolved: [{ input_ref: "pap_missing", status: "unresolved" }],
          coverage: { graph_generation: "4", paper_generation: "4", retrievers: [] },
          fusion: { quality: "balanced" },
          elapsed_ms: 1,
          completeness: { status: "unavailable", incomplete_reasons: ["no_resolved_seeds"] },
        }),
        { status: 200 },
      ),
    );

    await expect(
      lookupPaperNeighborhood({ corpusIds: ["pap_missing"], limit: 40 }),
    ).resolves.toBeNull();
    expect(vi.mocked(epistemePostFetch).mock.calls[0]?.[1]).toMatchObject({
      seeds: ["pap_missing"],
    });
  });
});
