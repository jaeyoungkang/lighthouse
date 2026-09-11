// Co-located negative + behavior test for
// `promise:gap-network-detection-from-search#acceptance-check:gap-network-detection-from-search-analysis-input-cap`.
//
// Why this test exists: the AC encodes a value-as-promise — gap analysis reads only
// the top-N papers from the already sorted search result pool. `MAX_GRAPH_SOURCE_PAPERS`
// is the only input that feeds `toGraphPaperSnapshots`, the search→gap input. This
// file pins the *literal* `40`, asserts the `@check-removes-fails:` marker above the
// constant, and locks that `toGraphPaperSnapshots` caps its output at the top 40 in
// order.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";
import { MAX_GRAPH_SOURCE_PAPERS } from "@/app/lib/constants";
import {
  toGraphPaperSnapshotProjection,
  toGraphPaperSnapshots,
} from "@/app/lib/graph-paper-snapshots";

const CONSTANTS_SOURCE = readFileSync(resolve(__dirname, "../constants.ts"), "utf8");

function buildPaper(index: number): PaperCore {
  return {
    paperId: `paper-${String(index)}`,
    title: `Paper ${String(index)}`,
    abstract: `abstract ${String(index)}`,
    year: 2020,
    citationCount: index,
    url: `https://example.com/paper-${String(index)}`,
    authors: [{ name: `Author ${String(index)}` }],
  };
}

function buildPapers(count: number): SearchMetadata["papers"] {
  return Array.from({ length: count }, (_unused, index) => buildPaper(index));
}

describe("gap-network analysis input cap (negative test)", () => {
  it("MAX_GRAPH_SOURCE_PAPERS is literally 40 — changing the value breaks the gap input promise", () => {
    expect(MAX_GRAPH_SOURCE_PAPERS).toBe(40);
  });

  it("constants.ts carries the @check-removes-fails comment naming this AC, anchored above the constant", () => {
    expect(CONSTANTS_SOURCE).toMatch(
      /\/\/\s*@check-removes-fails:\s*acceptance-check:gap-network-detection-from-search-analysis-input-cap/,
    );
    const markerIdx = CONSTANTS_SOURCE.indexOf(
      "@check-removes-fails: acceptance-check:gap-network-detection-from-search-analysis-input-cap",
    );
    const declarationIdx = CONSTANTS_SOURCE.indexOf("export const MAX_GRAPH_SOURCE_PAPERS");
    expect(markerIdx).toBeGreaterThan(-1);
    expect(declarationIdx).toBeGreaterThan(markerIdx);
  });
});

describe("toGraphPaperSnapshots caps at the top 40 search results", () => {
  it("returns at most 40 snapshots when more results are supplied", () => {
    const snapshots = toGraphPaperSnapshots("query", undefined, buildPapers(100));
    expect(snapshots).toHaveLength(40);
  });

  it("keeps the first 40 in the supplied result order", () => {
    const snapshots = toGraphPaperSnapshots("query", undefined, buildPapers(100));
    expect(snapshots[0]?.paperId).toBe("paper-0");
    expect(snapshots[39]?.paperId).toBe("paper-39");
    expect(snapshots.some((snapshot) => snapshot.paperId === "paper-40")).toBe(false);
  });

  it("passes through every result when fewer than 40 are supplied", () => {
    const snapshots = toGraphPaperSnapshots("query", undefined, buildPapers(12));
    expect(snapshots).toHaveLength(12);
  });

  it("deduplicates paper ids and preserves relation equality with bounded local ids", () => {
    const oversizedPaperId = "논문".repeat(100);
    const papers = [
      {
        ...buildPaper(1),
        citationIds: [oversizedPaperId],
        authors: Array.from({ length: 101 }, (_, index) => ({ name: `Author ${String(index)}` })),
      },
      {
        ...buildPaper(2),
        paperId: oversizedPaperId,
        referenceIds: ["paper-1", "external-reference", "external-reference"],
      },
      { ...buildPaper(1), title: "duplicate row" },
    ];

    const projection = toGraphPaperSnapshotProjection(papers);
    const normalizedSecondId = projection.paperIdMap.get(oversizedPaperId);

    expect(projection.papers).toHaveLength(2);
    expect(normalizedSecondId).toMatch(/^__gap_paper_/);
    expect(projection.papers[0]?.citationIds).toEqual([normalizedSecondId]);
    expect(projection.papers[1]?.referenceIds?.[0]).toBe("paper-1");
    expect(projection.papers[1]?.referenceIds).toHaveLength(2);
    expect(projection.papers.every((paper) => paper.authors.length === 0)).toBe(true);
    expect(projection.papers.every((paper) => paper.openAccessPdf === null)).toBe(true);
    expect(projection.papers.every((paper) => paper.doi === null)).toBe(true);
  });
});
