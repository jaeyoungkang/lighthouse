import { describe, expect, it, vi } from "vitest";
import { computeSearchHydrationPaperDelta } from "@/app/server/services/search-hydration";

const { hydrateEpistemePapersMock } = vi.hoisted(() => ({
  hydrateEpistemePapersMock: vi.fn(),
}));

vi.mock("@/app/server/services/episteme-literature", () => ({
  hydrateEpistemePapers: hydrateEpistemePapersMock,
}));

describe("search background projection service", () => {
  it("hydrates numeric committed ids except library-only ids and restores target order", async () => {
    hydrateEpistemePapersMock.mockResolvedValueOnce([
      { paperId: "2", title: "Paper 2", authors: [] },
      { paperId: "1", title: "Paper 1", authors: [] },
    ]);

    const result = await computeSearchHydrationPaperDelta({
      schemaVersion: 1,
      target: { query: "graph retrieval", orderedPaperIds: ["1", "library-paper", "2"] },
      hydration: { status: "pending", libraryOnlyPaperIds: ["library-paper"] },
    });

    expect(hydrateEpistemePapersMock).toHaveBeenCalledWith(["1", "2"], undefined);
    expect(result.map((paper) => paper.paperId)).toEqual(["1", "2"]);
  });

  it("matches a committed canonical uid to a hydrated S2 card alias", async () => {
    hydrateEpistemePapersMock.mockResolvedValueOnce([
      {
        paperId: "42",
        title: "Aliased paper",
        authors: [],
        source: { canonicalPaperId: "pap_e3_42" },
        externalIds: { CorpusId: "42" },
      },
    ]);

    const result = await computeSearchHydrationPaperDelta({
      schemaVersion: 1,
      target: { query: "graph retrieval", orderedPaperIds: ["pap_e3_42"] },
      hydration: { status: "pending", libraryOnlyPaperIds: [] },
    });

    expect(hydrateEpistemePapersMock).toHaveBeenCalledWith(["pap_e3_42"], undefined);
    expect(result.map((paper) => paper.paperId)).toEqual(["pap_e3_42"]);
  });
});
