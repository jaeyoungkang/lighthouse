import { describe, expect, it } from "vitest";
import type { PaperCore } from "@/app/domain/paper";
import type { CitationLineageMetadata } from "@/app/domain/research-route-payload";
import {
  buildCitationLineageCitationsGapQuery,
  getCitationLineageGapInputPapers,
  splitPapersByCitationDirection,
} from "@/app/components/research-route-renderers/citation-lineage.helpers";

function makePaper(id: string): CitationLineageMetadata["papers"][number] {
  return {
    paperId: id,
    title: `Paper ${id}`,
    abstract: `abstract ${id}`,
    year: 2024,
    citationCount: 5,
    url: `https://example.com/${id}`,
    authors: [{ name: "Author" }],
  };
}

function makeSeedPaper(): PaperCore {
  return {
    paperId: "seed",
    title: "Seed Paper",
    abstract: "seed abstract",
    year: 2023,
    citationCount: 100,
    url: "https://example.com/seed",
    authors: [{ name: "Seed Author" }],
    referenceIds: null,
    citationIds: null,
  };
}

function makeMetadata(
  papers: CitationLineageMetadata["papers"],
  referenceIds: string[],
  citationIds: string[],
): CitationLineageMetadata {
  return {
    type: "citation_lineage",
    seedPaper: makeSeedPaper(),
    referenceIds,
    citationIds,
    papers,
    total: papers.length,
  };
}

describe("splitPapersByCitationDirection", () => {
  it("puts papers matching metadata.referenceIds into references", () => {
    const papers = [makePaper("r1"), makePaper("r2"), makePaper("c1")];
    const metadata = makeMetadata(papers, ["r1", "r2"], ["c1"]);

    const result = splitPapersByCitationDirection(metadata);

    expect(result.references.map((p) => p.paperId)).toEqual(["r1", "r2"]);
    expect(result.citations.map((p) => p.paperId)).toEqual(["c1"]);
  });

  it("puts papers matching metadata.citationIds into citations", () => {
    const papers = [makePaper("c1"), makePaper("c2")];
    const metadata = makeMetadata(papers, [], ["c1", "c2"]);

    const result = splitPapersByCitationDirection(metadata);

    expect(result.references).toHaveLength(0);
    expect(result.citations.map((p) => p.paperId)).toEqual(["c1", "c2"]);
  });

  it("puts papers in neither list into citations (default)", () => {
    const papers = [makePaper("r1"), makePaper("unknown")];
    const metadata = makeMetadata(papers, ["r1"], []);

    const result = splitPapersByCitationDirection(metadata);

    expect(result.references.map((p) => p.paperId)).toEqual(["r1"]);
    expect(result.citations.map((p) => p.paperId)).toEqual(["unknown"]);
  });

  it("returns empty arrays when papers is empty", () => {
    const metadata = makeMetadata([], ["r1"], ["c1"]);

    const result = splitPapersByCitationDirection(metadata);

    expect(result.references).toHaveLength(0);
    expect(result.citations).toHaveLength(0);
  });

  it("handles empty referenceIds and citationIds", () => {
    const papers = [makePaper("p1"), makePaper("p2")];
    const metadata = makeMetadata(papers, [], []);

    const result = splitPapersByCitationDirection(metadata);

    expect(result.references).toHaveLength(0);
    expect(result.citations.map((p) => p.paperId)).toEqual(["p1", "p2"]);
  });

  it("classifies paper as reference when present in both lists (referenceIds wins)", () => {
    const papers = [makePaper("both")];
    const metadata = makeMetadata(papers, ["both"], ["both"]);

    const result = splitPapersByCitationDirection(metadata);

    expect(result.references.map((p) => p.paperId)).toEqual(["both"]);
    expect(result.citations).toHaveLength(0);
  });

  it("preserves paper order in each direction", () => {
    const papers = [makePaper("r2"), makePaper("c1"), makePaper("r1"), makePaper("c2")];
    const metadata = makeMetadata(papers, ["r1", "r2"], ["c1", "c2"]);

    const result = splitPapersByCitationDirection(metadata);

    expect(result.references.map((p) => p.paperId)).toEqual(["r2", "r1"]);
    expect(result.citations.map((p) => p.paperId)).toEqual(["c1", "c2"]);
  });

  it("builds a scoped research-gap query for citation papers", () => {
    expect(buildCitationLineageCitationsGapQuery(makeMetadata([], [], []))).toBe(
      "인용 관계: Seed Paper",
    );
  });
});

describe("getCitationLineageGapInputPapers", () => {
  it("returns references followed by citations as the gap input set", () => {
    const papers = [makePaper("r1"), makePaper("c1"), makePaper("r2"), makePaper("c2")];
    const metadata = makeMetadata(papers, ["r1", "r2"], ["c1", "c2"]);

    const result = getCitationLineageGapInputPapers(metadata);

    expect(result.map((p) => p.paperId)).toEqual(["r1", "r2", "c1", "c2"]);
  });

  it("returns only the available direction when one is empty", () => {
    const refOnly = makeMetadata([makePaper("r1")], ["r1"], []);
    expect(getCitationLineageGapInputPapers(refOnly).map((p) => p.paperId)).toEqual(["r1"]);

    const citOnly = makeMetadata([makePaper("c1")], [], ["c1"]);
    expect(getCitationLineageGapInputPapers(citOnly).map((p) => p.paperId)).toEqual(["c1"]);
  });

  it("returns an empty array when both directions are empty", () => {
    expect(getCitationLineageGapInputPapers(makeMetadata([], [], []))).toEqual([]);
  });

  it("returns an empty array when both id lists are empty even if metadata.papers carries unexpected entries", () => {
    const stray = makeMetadata([makePaper("stray")], [], []);
    expect(getCitationLineageGapInputPapers(stray)).toEqual([]);
  });
});
