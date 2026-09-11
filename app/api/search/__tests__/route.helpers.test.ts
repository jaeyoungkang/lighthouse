import { describe, expect, it } from "vitest";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import type { LibraryContext } from "@/app/server/services/library-context-source";
import {
  applyBlendDedupAndLibraryOnly,
  buildSearchViewQueryTransitionPatch,
  filterLibraryContextByAnchorPaperIds,
} from "../route.helpers";

const libraryContext: LibraryContext = {
  folders: [{ name: "의료 LLM", anchorCorpusIds: ["c1"] }],
  neighborhood: { c1: 8096, c2: 4012 },
  computedAt: "2026-05-30T00:00:00.000Z",
};

const metadata: SearchMetadata = {
  type: "search",
  query: "research agents",
  total: 2,
  papers: [
    {
      paperId: "p1",
      title: "Paper 1",
      abstract: "abs 1",
      year: 2024,
      citationCount: 10,
      url: "https://example.com/1",
      authors: [{ name: "Alice" }],
    },
    {
      paperId: "p2",
      title: "Paper 2",
      abstract: "abs 2",
      year: 2023,
      citationCount: 5,
      url: "https://example.com/2",
      authors: [{ name: "Bob" }],
    },
  ],
};

describe("buildSearchViewQueryTransitionPatch", () => {
  it("clears the route AI comment so fresh route AI comment generation can describe the new query", () => {
    const patch = buildSearchViewQueryTransitionPatch({
      title: "검색: research agents (2편)",
      content: "search content",
      metadata,
    });

    expect(patch.reaction).toBeNull();
    expect(patch.reactionHistory).toEqual([]);
  });

  it("forwards title, content, and metadata unchanged", () => {
    const patch = buildSearchViewQueryTransitionPatch({
      title: "검색: research agents (2편)",
      content: "search content",
      metadata,
    });

    expect(patch.title).toBe("검색: research agents (2편)");
    expect(patch.content).toBe("search content");
    expect(patch.metadata).toBe(metadata);
  });
});

describe("applyBlendDedupAndLibraryOnly", () => {
  const paper = (paperId: string, title: string) => ({ paperId, title });

  it("keeps the provider total and exposes no supplements when there is no blend", () => {
    const result = applyBlendDedupAndLibraryOnly({
      keywordPapers: [paper("k1", "Deep Learning"), paper("k2", "Graph Neural Networks")],
      providerTotal: 40,
      blend: null,
    });

    expect(result.resultPapers.map((p) => p.paperId)).toEqual(["k1", "k2"]);
    expect(result.resultTotal).toBe(40);
    expect(result.libraryOnlyPaperIds).toEqual([]);
    expect(result.candidateCount).toBe(0);
  });

  it("drops an injected supplement that is a title-family dup of a keyword paper and shrinks the supplement set", () => {
    const result = applyBlendDedupAndLibraryOnly({
      keywordPapers: [paper("k1", "Deep Learning")],
      providerTotal: 40,
      blend: {
        // Keyword papers sort first, so the dup keyword paper survives dedup and
        // the injected "Deep Learning." candidate (same normalized title) drops.
        papers: [
          paper("k1", "Deep Learning"),
          paper("inj-dup", "Deep Learning."),
          paper("inj-unique", "Graph Neural Networks"),
        ],
        injectedPaperIds: ["inj-dup", "inj-unique"],
        blended: true,
      },
    });

    // inj-dup collapsed into k1 → out of the band; only inj-unique survives.
    expect(result.resultPapers.map((p) => p.paperId)).toEqual(["k1", "inj-unique"]);
    expect(result.libraryOnlyPaperIds).toEqual(["inj-unique"]);
    expect(result.libraryOnlyPaperIds).not.toContain("inj-dup");
    expect(result.candidateCount).toBe(1);
    // Blended → total reflects the deduped pool size, not the provider total.
    expect(result.resultTotal).toBe(2);
  });

  it("keeps every injected supplement when none duplicate a keyword paper", () => {
    const result = applyBlendDedupAndLibraryOnly({
      keywordPapers: [paper("k1", "Deep Learning")],
      providerTotal: 40,
      blend: {
        papers: [
          paper("k1", "Deep Learning"),
          paper("inj-1", "Graph Neural Networks"),
          paper("inj-2", "Reinforcement Learning"),
        ],
        injectedPaperIds: ["inj-1", "inj-2"],
        blended: true,
      },
    });

    expect(result.libraryOnlyPaperIds).toEqual(["inj-1", "inj-2"]);
    expect(result.candidateCount).toBe(2);
  });

  it("ignores injected ids and keeps the provider total when the blend degraded (blended:false)", () => {
    const result = applyBlendDedupAndLibraryOnly({
      keywordPapers: [paper("k1", "Deep Learning")],
      providerTotal: 40,
      blend: { papers: [paper("k1", "Deep Learning")], injectedPaperIds: [], blended: false },
    });

    expect(result.resultPapers.map((p) => p.paperId)).toEqual(["k1"]);
    expect(result.resultTotal).toBe(40);
    expect(result.libraryOnlyPaperIds).toEqual([]);
    expect(result.candidateCount).toBe(0);
  });
});

describe("filterLibraryContextByAnchorPaperIds", () => {
  it("keeps only requested library paper ids while preserving display metadata", () => {
    const filtered = filterLibraryContextByAnchorPaperIds(
      {
        folders: [
          {
            name: "의료 LLM",
            anchorCorpusIds: ["c1", "c2"],
            anchorPapers: [
              { paperId: "c1", title: "Clinical Language Models" },
              { paperId: "c2", title: "Hospital Retrieval" },
            ],
          },
          { name: "임상 평가", anchorCorpusIds: ["c3"] },
        ],
        neighborhood: { c1: 8096, c2: 4012 },
        computedAt: "2026-05-30T00:00:00.000Z",
      },
      ["c2"],
    );

    expect(filtered?.folders).toEqual([
      {
        name: "의료 LLM",
        anchorCorpusIds: ["c2"],
        anchorPapers: [{ paperId: "c2", title: "Hospital Retrieval" }],
      },
    ]);
  });

  it("returns an empty context when the selection is explicitly empty", () => {
    const filtered = filterLibraryContextByAnchorPaperIds(libraryContext, []);

    expect(filtered?.folders).toEqual([]);
  });
});
