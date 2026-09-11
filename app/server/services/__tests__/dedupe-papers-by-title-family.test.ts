import { describe, expect, it } from "vitest";
import { dedupePapersByTitleFamily, type MappedPaper } from "@/app/server/services/search-service";

const mk = (paperId: string, title: string): MappedPaper =>
  ({
    paperId,
    title,
    abstract: null,
    year: 2023,
    citationCount: 0,
    url: "",
    authors: [],
  }) as MappedPaper;

describe("dedupePapersByTitleFamily", () => {
  it("drops title-family near-duplicates (punctuation variants) keeping the first, preserves order, never collapses empty titles", () => {
    const papers = [
      mk("p1", "Almanac: Retrieval-Augmented Language Models for Clinical Medicine"),
      mk("p2", "A Different Paper"),
      mk("p3", "Almanac - Retrieval-Augmented Language Models for Clinical Medicine."),
      mk("p4", ""),
      mk("p5", ""),
    ];
    // p3 is a punctuation variant of p1 (dropped); empty-title p4/p5 both kept.
    expect(dedupePapersByTitleFamily(papers).map((p) => p.paperId)).toEqual([
      "p1",
      "p2",
      "p4",
      "p5",
    ]);
  });
});
