import { describe, expect, it } from "vitest";
import type { MappedPaper } from "@/app/server/services/search-service";
import { buildSearchViewPayload } from "@/app/server/services/search-service";

function paper(params: { paperId: string; title: string }): MappedPaper {
  return {
    paperId: params.paperId,
    title: params.title,
    abstract: `${params.title} abstract`,
    year: 2024,
    citationCount: 0,
    url: `https://example.com/${params.paperId}`,
    authors: ["Author"],
    openAccessPdf: null,
    doi: null,
    referenceIds: null,
    citationIds: null,
  };
}

describe("search research route payloads", () => {
  it("retains seedPaper metadata and excludes the seed paper from seeded search results", () => {
    const seedPaper = {
      paperId: "seed-paper",
      title: "Seed Paper",
      abstract: "seed abstract",
      year: 2024,
      citationCount: 42,
      url: "https://example.com/seed-paper",
      authors: [{ name: "Seed Author" }],
    };
    const payload = buildSearchViewPayload(
      "principal-1",
      "seeded search",
      [
        paper({ paperId: "seed-paper", title: "Seed Paper" }),
        paper({ paperId: "neighbor-paper", title: "Neighbor Paper" }),
      ],
      2,
      "user",
      undefined,
      "exact",
      undefined,
      undefined,
      undefined,
      seedPaper,
      undefined,
      undefined,
      "citationCount",
      "2020-",
    );

    expect(payload.metadata).toMatchObject({
      type: "search",
      query: "seeded search",
      seedPaper: { paperId: "seed-paper", title: "Seed Paper" },
      total: 1,
      sortOption: "citationCount",
      yearFilter: "2020-",
    });
    expect(payload.metadata).not.toHaveProperty("searchIntentMode");
    if (payload.metadata.type !== "search") throw new Error("expected search metadata");
    expect(payload.metadata.papers.map((entry) => entry.paperId)).toEqual(["neighbor-paper"]);
  });

  it("excludes a canonical E3 seed returned under its S2 compatibility identity", () => {
    const aliasedSeed = {
      ...paper({ paperId: "42", title: "Seed Paper" }),
      source: { canonicalPaperId: "pap_seed_42" },
      externalIds: { CorpusId: "42" },
    };
    const payload = buildSearchViewPayload(
      "principal-1",
      "seeded search",
      [aliasedSeed, paper({ paperId: "43", title: "Neighbor Paper" })],
      2,
      "user",
      undefined,
      "exact",
      undefined,
      undefined,
      undefined,
      { ...aliasedSeed, paperId: "pap_seed_42", authors: [{ name: "Seed Author" }] },
    );

    expect(payload.metadata).toMatchObject({ total: 1 });
    if (payload.metadata.type !== "search") throw new Error("expected search metadata");
    expect(payload.metadata.papers.map((entry) => entry.paperId)).toEqual(["43"]);
  });

  it("records spelling correction metadata in search research route payloads", () => {
    const payload = buildSearchViewPayload(
      "principal-1",
      "trasnformer",
      [paper({ paperId: "p1", title: "Transformer" })],
      1,
      "user",
      undefined,
      "exact",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        originalQuery: "trasnformer",
        correctedQuery: "transformer",
      },
    );

    expect(payload.metadata).toMatchObject({
      type: "search",
      query: "trasnformer",
      spellingCorrection: {
        originalQuery: "trasnformer",
        correctedQuery: "transformer",
      },
    });
    expect(payload.metadata).not.toHaveProperty("searchIntentMode");
  });

  it("preserves library basis metadata in search metadata", () => {
    const payload = buildSearchViewPayload(
      "principal-1",
      "clinical language models",
      [paper({ paperId: "p1", title: "Clinical Language Models" })],
      1,
      "user",
      undefined,
      "exact",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "interest",
      "",
      undefined,
      undefined,
      undefined,
      undefined,
      {
        available: true,
        context: {
          folders: [{ name: "의료 LLM" }],
          signalPresent: true,
          interestWeights: { p1: 42 },
          libraryOnlyPaperIds: [],
          computedAt: "2026-06-01T03:04:05.000Z",
          anchorPaperCount: 12,
        },
      },
    );

    expect(payload.metadata).toMatchObject({
      type: "search",
      sortOption: "interest",
      libraryContextAvailable: true,
      libraryContext: {
        folders: [{ name: "의료 LLM" }],
        signalPresent: true,
        computedAt: "2026-06-01T03:04:05.000Z",
        anchorPaperCount: 12,
      },
    });
  });

  it("records term seed and commits term discovery as pending in search research route payloads", () => {
    const payload = buildSearchViewPayload(
      "principal-1",
      "에이전트 기억",
      [
        paper({ paperId: "p1", title: "Workflow Memory for Large Language Models" }),
        paper({ paperId: "p2", title: "Retrieval Augmented Generation with Workflow Memory" }),
      ],
      2,
      "user",
      undefined,
      "exact",
      undefined,
      undefined,
      undefined,
      undefined,
      {
        sourceQuery: "에이전트",
        term: "workflow memory",
        candidateType: "broader",
        supportCount: 2,
      },
    );

    expect(payload.metadata).toMatchObject({
      type: "search",
      query: "에이전트 기억",
      termSeed: {
        sourceQuery: "에이전트",
        term: "workflow memory",
        candidateType: "broader",
        supportCount: 2,
      },
    });
    if (payload.metadata.type !== "search") throw new Error("expected search metadata");
    // Research term extraction runs off the critical path; the payload commits a pending
    // discovery state and the background route fills the list.
    expect(payload.metadata.englishTermDiscovery).toEqual({ status: "pending" });
    expect(payload.metadata.englishTermCandidates).toBeUndefined();
  });
});
