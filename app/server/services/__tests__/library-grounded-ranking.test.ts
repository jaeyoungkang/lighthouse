import { describe, expect, it } from "vitest";
import { rankByLibraryInterest } from "@/app/server/services/library-grounded-ranking";

const libraryContext = {
  neighborhood: { "10": 3000, "20": 1500, "30": 0 },
  folders: [
    { name: "표현학습", anchorCorpusIds: ["1", "2"] },
    { name: "강화학습", anchorCorpusIds: ["3"] },
  ],
};

describe("rankByLibraryInterest", () => {
  it("projects neighborhood weights onto result papers and counts matches", () => {
    const result = rankByLibraryInterest(
      [{ paperId: "10" }, { paperId: "20" }, { paperId: "30" }, { paperId: "99" }],
      libraryContext,
    );

    // Only positive-weight, in-neighborhood papers are projected; a 0-weight
    // entry (30) and an absent paper (99) are not matched.
    expect(result.interestWeights).toEqual({ "10": 3000, "20": 1500 });
    expect(result.matchedCount).toBe(2);
    // Folder summary is reduced to names for the metadata summary.
    expect(result.folders).toEqual([{ name: "표현학습" }, { name: "강화학습" }]);
  });

  it("returns no matched weights when results do not overlap the library neighborhood", () => {
    const result = rankByLibraryInterest([{ paperId: "99" }, { paperId: "98" }], libraryContext);

    expect(result.interestWeights).toEqual({});
    expect(result.matchedCount).toBe(0);
  });

  it("ignores non-numeric and non-positive neighborhood values", () => {
    const malformedContext = {
      ...libraryContext,
      neighborhood: { text: "3000", negative: -2, missing: undefined },
    } as unknown as typeof libraryContext;

    const result = rankByLibraryInterest(
      [{ paperId: "text" }, { paperId: "negative" }, { paperId: "missing" }],
      malformedContext,
    );

    expect(result.interestWeights).toEqual({});
    expect(result.matchedCount).toBe(0);
  });
});
