import { afterEach, describe, expect, it, vi } from "vitest";
import { hydrateEpistemePapers } from "@/app/server/services/episteme-literature";
import {
  lookupPaperNeighborhood,
  type LibraryNeighborhoodCandidate,
} from "@/app/server/services/episteme-paper-neighborhood";
import {
  blendNeighborhoodIntoPool,
  hydrateNeighborhoodSupplementBand,
  lookupLibraryNeighborhoodWithEvidence,
} from "@/app/server/services/library-anchor-blend";
import type { MappedPaper } from "@/app/server/services/search-service";

vi.mock("@/app/server/services/episteme-literature", () => ({
  hydrateEpistemePapers: vi.fn(),
}));
vi.mock("@/app/server/services/episteme-paper-neighborhood", () => ({
  lookupPaperNeighborhood: vi.fn(),
}));

const mockedLookup = vi.mocked(lookupPaperNeighborhood);
const mockedHydrate = vi.mocked(hydrateEpistemePapers);

function paper(id: string): MappedPaper {
  return {
    paperId: id,
    title: `Paper ${id}`,
    abstract: null,
    year: 2024,
    citationCount: 1,
    url: `https://example.com/${id}`,
    authors: ["Alice"],
  };
}

function candidate(id: string, defaultScore: number): LibraryNeighborhoodCandidate {
  return {
    corpusId: id,
    defaultScore,
    graphScore: defaultScore,
    semanticScore: null,
    sharedCiters: 1,
    sharedRefs: 0,
    seedCount: 1,
    sources: ["co_cited"],
  };
}

/** neighborhood of `count` candidates ids 2001.., weights descending count..1. */
function manyCandidateNeighborhood(count: number): Map<string, number> {
  return new Map(
    Array.from({ length: count }, (_, index): [string, number] => [
      `20${String(index + 1).padStart(2, "0")}`,
      count - index,
    ]),
  );
}

const TWO_FOLDERS = {
  folders: [
    { name: "해양", anchorCorpusIds: ["111", "222"] },
    { name: "리튬", anchorCorpusIds: ["333"] },
  ],
};

afterEach(() => {
  mockedLookup.mockReset();
  mockedHydrate.mockReset();
});

// Phase 1 depends only on the reader's local folder anchors, so the route can
// run it (and the band hydration) concurrently with the keyword fetch.
describe("lookupLibraryNeighborhoodWithEvidence (phase 1 — anchors only)", () => {
  it("merges folder neighborhoods from local anchors alone (no keyword pool input)", async () => {
    mockedLookup
      .mockResolvedValueOnce([candidate("1001", 10), candidate("501", 5)])
      .mockResolvedValueOnce([candidate("1002", 8), candidate("1001", 12)]);

    const { neighborhood, candidates, providerStatus } =
      await lookupLibraryNeighborhoodWithEvidence({
        libraryContext: TWO_FOLDERS,
        candidateLimit: 40,
      });

    // 폴더당 한 번씩 호출, corpus_id 병합 시 최강 score 유지(1001 → 12).
    expect(mockedLookup).toHaveBeenCalledTimes(2);
    expect(mockedHydrate).not.toHaveBeenCalled(); // phase 1은 hydrate하지 않는다
    expect(neighborhood).toEqual(
      new Map([
        ["1001", 12],
        ["501", 5],
        ["1002", 8],
      ]),
    );
    expect(candidates.get("1001")).toEqual(candidate("1001", 12));
    expect(providerStatus).toBe("ready");
  });

  it("excludes the reader's own library papers from every anchor call", async () => {
    mockedLookup.mockResolvedValue([candidate("1001", 9)]);

    await lookupLibraryNeighborhoodWithEvidence({
      libraryContext: TWO_FOLDERS,
      candidateLimit: 40,
    });

    // exclude = union of all folder anchor corpus ids (as numbers).
    for (const call of mockedLookup.mock.calls) {
      expect(call[0].excludeCorpusIds).toEqual([111, 222, 333]);
    }
    // per-folder anchor sets are sent independently.
    expect(mockedLookup.mock.calls[0][0].corpusIds).toEqual([111, 222]);
    expect(mockedLookup.mock.calls[1][0].corpusIds).toEqual([333]);
  });

  it("returns an empty neighborhood when every folder call fails", async () => {
    mockedLookup.mockResolvedValue(null);

    const { neighborhood, candidates, providerStatus } =
      await lookupLibraryNeighborhoodWithEvidence({
        libraryContext: TWO_FOLDERS,
        candidateLimit: 40,
      });

    expect(neighborhood.size).toBe(0);
    expect(candidates.size).toBe(0);
    expect(providerStatus).toBe("degraded");
    expect(mockedHydrate).not.toHaveBeenCalled();
  });

  it("keeps an empty successful provider response distinct from failure", async () => {
    mockedLookup.mockResolvedValue([]);

    const result = await lookupLibraryNeighborhoodWithEvidence({
      libraryContext: TWO_FOLDERS,
      candidateLimit: 40,
    });

    expect(result.neighborhood.size).toBe(0);
    expect(result.candidates.size).toBe(0);
    expect(result.providerStatus).toBe("ready");
  });
});

// The band cap is owned here and applied BEFORE keyword dedup — the band is
// selected without knowing the keyword pool.
describe("hydrateNeighborhoodSupplementBand (band cap before keyword dedup)", () => {
  it("hydrates the top SEARCH_LIBRARY_NEAR_BAND_LIMIT candidates by weight without a keyword pool", async () => {
    const neighborhood = manyCandidateNeighborhood(42);
    const topIds = [...neighborhood.keys()].slice(0, 40);
    mockedHydrate.mockResolvedValueOnce(topIds.map((id) => paper(id)));

    const band = await hydrateNeighborhoodSupplementBand({ neighborhood });

    expect(mockedHydrate).toHaveBeenCalledWith(topIds, undefined);
    expect(band.map((p) => p.paperId)).toEqual(topIds);
  });

  it("passes canonical-only E3 candidate ids to batch hydration without numeric coercion", async () => {
    mockedHydrate.mockResolvedValueOnce([paper("pap_e3_candidate")]);

    const band = await hydrateNeighborhoodSupplementBand({
      neighborhood: new Map([["pap_e3_candidate", 10]]),
    });

    expect(mockedHydrate).toHaveBeenCalledWith(["pap_e3_candidate"], undefined);
    expect(band.map((item) => item.paperId)).toEqual(["pap_e3_candidate"]);
  });

  it("returns an empty band without calling the provider when the neighborhood is empty", async () => {
    const band = await hydrateNeighborhoodSupplementBand({ neighborhood: new Map() });

    expect(band).toEqual([]);
    expect(mockedHydrate).not.toHaveBeenCalled();
  });

  it("degrades to an empty band when hydration fails, keeping the call best-effort", async () => {
    mockedHydrate.mockRejectedValueOnce(new Error("hydrate down"));

    const band = await hydrateNeighborhoodSupplementBand({
      neighborhood: new Map([["1001", 11]]),
    });

    expect(band).toEqual([]);
  });
});

// Phase 2 is a pure computation over already-arrived inputs: keyword-pool
// overlap removal → weight order → year admission. No provider round-trip.
describe("blendNeighborhoodIntoPool (pure phase 2)", () => {
  it("blends prehydrated band candidates into the keyword pool in weight order", () => {
    const result = blendNeighborhoodIntoPool({
      keywordPapers: [paper("501"), paper("502")],
      neighborhood: new Map([
        ["1001", 12],
        ["501", 5], // 키워드 풀에 이미 있으니 주입 후보에서 제외
        ["1002", 8],
      ]),
      prehydratedCandidates: [paper("1002"), paper("1001"), paper("501")],
    });

    expect(mockedHydrate).not.toHaveBeenCalled();
    expect(result.blended).toBe(true);
    // 키워드 풀 overlap 제거 후 neighborhood weight 순서로 주입된다.
    expect(result.injectedPaperIds).toEqual(["1001", "1002"]);
    expect(result.papers.map((p) => p.paperId)).toEqual(["501", "502", "1001", "1002"]);
    expect(result.neighborhood).toEqual({ "1001": 12, "501": 5, "1002": 8 });
  });

  it("caps the supplement band before keyword dedup without rank backfill", async () => {
    // AC library-anchor-blend rev 3: the band (top SEARCH_LIBRARY_NEAR_BAND_LIMIT
    // by weight) is hydrated without knowing the keyword pool. Keyword overlap
    // removed in the blend under-fills the band — candidates ranked past the
    // cap are never backfilled into the supplement pool.
    const neighborhood = manyCandidateNeighborhood(42);
    // ranks #1 and #2 (2001, 2002) are also keyword results — inside the band.
    const keywordPapers = [paper("2001"), paper("2002")];
    mockedHydrate.mockImplementationOnce((corpusIds) =>
      Promise.resolve(corpusIds.map((id) => paper(String(id)))),
    );

    const band = await hydrateNeighborhoodSupplementBand({ neighborhood });
    const result = blendNeighborhoodIntoPool({
      keywordPapers,
      neighborhood,
      prehydratedCandidates: band,
    });

    // supplement count = cap(40) − overlap(2); ranks 41-42 are not injected.
    expect(result.injectedPaperIds).toHaveLength(38);
    expect(result.injectedPaperIds).toEqual([...neighborhood.keys()].slice(2, 40));
    expect(result.injectedPaperIds).not.toContain("2041");
    expect(result.injectedPaperIds).not.toContain("2042");
    // The full neighborhood still projects (all 42 weights) despite the cap.
    expect(Object.keys(result.neighborhood)).toHaveLength(42);
  });

  it("admits only in-range prehydrated supplements when a year range applies", () => {
    const result = blendNeighborhoodIntoPool({
      keywordPapers: [paper("501")],
      neighborhood: new Map([
        ["1001", 10],
        ["1002", 9],
        ["1003", 8],
      ]),
      prehydratedCandidates: [
        { ...paper("1001"), year: 2019 },
        { ...paper("1002"), year: 2024 },
        { ...paper("1003"), year: null },
      ],
      year: "2018-2019",
    });

    // Out-of-range (2024) and year-less supplements never enter the pool —
    // they would be invisible in the year-filtered result list while still
    // distorting the year-distribution widget and the reaction input.
    expect(result.blended).toBe(true);
    expect(result.papers.map((p) => p.paperId)).toEqual(["501", "1001"]);
    expect(result.injectedPaperIds).toEqual(["1001"]);
    // The neighborhood projection is unaffected by supplement admission.
    expect(Object.keys(result.neighborhood).sort()).toEqual(["1001", "1002", "1003"]);
  });

  it("admits supplements of any year when the search has no year range", () => {
    const result = blendNeighborhoodIntoPool({
      keywordPapers: [paper("501")],
      neighborhood: new Map([
        ["1001", 10],
        ["1002", 9],
      ]),
      prehydratedCandidates: [
        { ...paper("1001"), year: 2019 },
        { ...paper("1002"), year: null },
      ],
    });

    expect(result.papers.map((p) => p.paperId)).toEqual(["501", "1001", "1002"]);
    expect(result.injectedPaperIds).toEqual(["1001", "1002"]);
  });

  it("degrades to keyword-only when the neighborhood is empty", () => {
    const result = blendNeighborhoodIntoPool({
      keywordPapers: [paper("501"), paper("502")],
      neighborhood: new Map(),
      prehydratedCandidates: [],
    });

    expect(result.blended).toBe(false);
    expect(result.papers.map((p) => p.paperId)).toEqual(["501", "502"]);
    expect(result.neighborhood).toEqual({});
    expect(result.injectedPaperIds).toEqual([]);
  });

  it("keeps the neighborhood projecting when the prehydrated band is empty (hydration failed)", () => {
    const result = blendNeighborhoodIntoPool({
      keywordPapers: [paper("501")],
      neighborhood: new Map([["1001", 11]]),
      prehydratedCandidates: [],
    });

    expect(result.blended).toBe(true);
    // no new card, but the neighborhood still scores the keyword pool.
    expect(result.papers.map((p) => p.paperId)).toEqual(["501"]);
    expect(result.injectedPaperIds).toEqual([]);
    expect(result.neighborhood).toEqual({ "1001": 11 });
  });
});

// Two-phase composition (lookup → band hydrate → pure blend) — the shape the
// route preflight actually runs.
describe("two-phase composition (lookup → band → blend)", () => {
  it("blends graph candidates into the keyword pool and merges folder neighborhoods", async () => {
    // folder1 → 1001(10) + 501(5, overlaps keyword); folder2 → 1002(8) + 1001(12, stronger)
    mockedLookup
      .mockResolvedValueOnce([candidate("1001", 10), candidate("501", 5)])
      .mockResolvedValueOnce([candidate("1002", 8), candidate("1001", 12)]);
    mockedHydrate.mockImplementationOnce((corpusIds) =>
      Promise.resolve(corpusIds.map((id) => paper(String(id)))),
    );

    const { neighborhood, candidates } = await lookupLibraryNeighborhoodWithEvidence({
      libraryContext: TWO_FOLDERS,
      candidateLimit: 40,
    });
    const band = await hydrateNeighborhoodSupplementBand({ neighborhood });
    const result = blendNeighborhoodIntoPool({
      keywordPapers: [paper("501"), paper("502")],
      neighborhood,
      prehydratedCandidates: band,
    });

    // The band is hydrated by weight without keyword knowledge (1001, 1002, 501);
    // the blend then removes the keyword overlap (501).
    expect(mockedHydrate).toHaveBeenCalledWith(["1001", "1002", "501"], undefined);
    expect(result.blended).toBe(true);
    expect(result.papers.map((p) => p.paperId)).toEqual(["501", "502", "1001", "1002"]);
    // dedup across folders keeps the strongest score (1001: 12, not 10).
    expect(result.neighborhood).toEqual({ "1001": 12, "501": 5, "1002": 8 });
    expect(result.injectedPaperIds).toEqual(["1001", "1002"]);
    expect(candidates.get("1001")).toEqual(candidate("1001", 12));
  });

  it("degrades to keyword-only when every folder call fails", async () => {
    mockedLookup.mockResolvedValue(null);

    const { neighborhood } = await lookupLibraryNeighborhoodWithEvidence({
      libraryContext: TWO_FOLDERS,
      candidateLimit: 40,
    });
    const band = await hydrateNeighborhoodSupplementBand({ neighborhood });
    const result = blendNeighborhoodIntoPool({
      keywordPapers: [paper("501"), paper("502")],
      neighborhood,
      prehydratedCandidates: band,
    });

    expect(result.blended).toBe(false);
    expect(result.papers.map((p) => p.paperId)).toEqual(["501", "502"]);
    expect(result.neighborhood).toEqual({});
    expect(mockedHydrate).not.toHaveBeenCalled();
  });

  it("keeps the live neighborhood projecting when band hydration fails", async () => {
    mockedLookup.mockResolvedValueOnce([candidate("1001", 11)]).mockResolvedValueOnce(null);
    mockedHydrate.mockRejectedValueOnce(new Error("hydrate down"));

    const { neighborhood } = await lookupLibraryNeighborhoodWithEvidence({
      libraryContext: TWO_FOLDERS,
      candidateLimit: 40,
    });
    const band = await hydrateNeighborhoodSupplementBand({ neighborhood });
    const result = blendNeighborhoodIntoPool({
      keywordPapers: [paper("501")],
      neighborhood,
      prehydratedCandidates: band,
    });

    expect(result.blended).toBe(true);
    // no new card, but the neighborhood still scores the keyword pool.
    expect(result.papers.map((p) => p.paperId)).toEqual(["501"]);
    expect(result.neighborhood).toEqual({ "1001": 11 });
  });
});
