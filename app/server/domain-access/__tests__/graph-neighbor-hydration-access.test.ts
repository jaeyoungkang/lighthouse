import { beforeEach, describe, expect, it, vi } from "vitest";
import { INLINE_ANALYSIS_VERSION } from "@/app/domain/analysis";
import type { GraphNeighborsMetadata } from "@/app/domain/research-route-payload";
import { hydrateGraphNeighborSnapshot } from "@/app/server/domain-access/graph-neighbor-hydration-access";

const requireOwnerPrincipalAuth = vi.hoisted(() => vi.fn());
const getReviewedStatus = vi.hoisted(() => vi.fn());
const hydrateEpistemePapers = vi.hoisted(() => vi.fn());

vi.mock("@/app/server/auth/identity", () => ({ requireOwnerPrincipalAuth }));
vi.mock("@/app/server/repository/reviewed-papers", () => ({ getReviewedStatus }));
vi.mock("@/app/server/services/episteme-literature", () => ({ hydrateEpistemePapers }));

function paper(): GraphNeighborsMetadata["papers"][number] {
  return {
    paperId: "101",
    title: "Lightweight title",
    abstract: null,
    year: 2025,
    citationCount: 1,
    url: "https://example.com/101",
    authors: [{ name: "Ada" }],
    inlineAnalysis: {
      version: INLINE_ANALYSIS_VERSION,
      inputFingerprint: "a".repeat(64),
      source: "abstract",
      analysis: {} as never,
    },
  };
}

describe("graph-neighbor hydration access", () => {
  beforeEach(() => {
    requireOwnerPrincipalAuth.mockResolvedValue({ db: {}, user: { id: "user-1" } });
    getReviewedStatus.mockResolvedValue(new Map());
    hydrateEpistemePapers.mockResolvedValue([
      {
        paperId: "101",
        title: "Hydrated title",
        abstract: "Hydrated abstract",
        year: 2026,
        citationCount: 2,
        url: "https://example.com/101",
        authors: ["Ada"],
      },
    ]);
  });

  it("drops embedded analysis when hydrated paper input changes", async () => {
    const existingPaper = paper();
    const metadata: GraphNeighborsMetadata = {
      type: "graph_neighbors",
      seedPaper: { ...existingPaper, paperId: "seed" },
      papers: [existingPaper],
      total: 1,
      coCited: [{ shared: 1, paper: existingPaper }],
      coupled: [{ shared: 1, paper: existingPaper }],
      cardDataHydration: { status: "pending" },
      coCitedAvailability: null,
      coupledAvailability: null,
    };

    const result = await hydrateGraphNeighborSnapshot({ metadata });

    expect("inlineAnalysis" in result.metadata.papers[0]).toBe(false);
    expect("inlineAnalysis" in result.metadata.coCited[0].paper).toBe(false);
    expect("inlineAnalysis" in result.metadata.coupled[0].paper).toBe(false);
  });

  it("hydrates a canonical uid through its S2 alias without breaking graph entry joins", async () => {
    const existingPaper = { ...paper(), paperId: "pap_e3_101" };
    hydrateEpistemePapers.mockResolvedValueOnce([
      {
        paperId: "101",
        title: "Hydrated title",
        abstract: "Hydrated abstract",
        year: 2026,
        citationCount: 2,
        url: "https://example.com/101",
        authors: ["Ada"],
        source: { canonicalPaperId: "pap_e3_101" },
        externalIds: { CorpusId: "101" },
      },
    ]);
    const metadata: GraphNeighborsMetadata = {
      type: "graph_neighbors",
      seedPaper: { ...existingPaper, paperId: "seed" },
      papers: [existingPaper],
      total: 1,
      coCited: [{ shared: 1, paper: existingPaper }],
      coupled: [],
      cardDataHydration: { status: "pending" },
      coCitedAvailability: null,
      coupledAvailability: null,
    };

    const reviewedAt = new Date("2026-09-03T00:00:00.000Z");
    getReviewedStatus.mockResolvedValueOnce(new Map([["101", reviewedAt]]));
    const result = await hydrateGraphNeighborSnapshot({ metadata });

    expect(hydrateEpistemePapers).toHaveBeenCalledWith(["pap_e3_101"], undefined);
    expect(result.metadata.papers[0]).toMatchObject({
      paperId: "pap_e3_101",
      abstract: "Hydrated abstract",
      reviewed: true,
      reviewedAt: reviewedAt.toISOString(),
    });
    expect(getReviewedStatus).toHaveBeenCalledWith(
      {},
      "user-1",
      expect.arrayContaining(["pap_e3_101", "101", "s2:101"]),
    );
    expect(result.metadata.coCited[0].paper).toMatchObject({
      paperId: "pap_e3_101",
      abstract: "Hydrated abstract",
    });
  });
});
