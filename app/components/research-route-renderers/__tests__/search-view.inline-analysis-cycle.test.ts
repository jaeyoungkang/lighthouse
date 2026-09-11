import { describe, expect, it } from "vitest";
import { buildInlineAnalysisCycleKey } from "@/app/lib/inline-analysis";
import type { SearchMetadata } from "@/app/domain/research-route-payload";

const paper: SearchMetadata["papers"][number] = {
  paperId: "paper",
  title: "Paper",
  abstract: "Abstract",
  year: 2026,
  citationCount: 0,
  url: "https://example.com/paper",
  authors: [{ name: "Author" }],
};

describe("inline-analysis exposure cycle identity", () => {
  it("keeps cycle identity fields structurally separated", () => {
    const left: SearchMetadata = {
      type: "search",
      query: "x:ARXIV",
      total: 1,
      papers: [{ ...paper, paperId: "123" }],
    };
    const right: SearchMetadata = {
      type: "search",
      query: "x",
      total: 1,
      papers: [{ ...paper, paperId: "ARXIV:123" }],
    };

    expect(buildInlineAnalysisCycleKey("document", left)).not.toBe(
      buildInlineAnalysisCycleKey("document", right),
    );
  });
});
