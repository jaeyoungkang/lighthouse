import type { SearchMetadata } from "@/app/domain/research-route-payload";

export function createMetadata(paperCount = 1): SearchMetadata {
  return {
    type: "search",
    query: "agent memory",
    total: paperCount,
    papers: Array.from({ length: paperCount }, (_, index) => ({
      paperId: `paper-${String(index + 1)}`,
      title: `Agent Memory Paper ${String(index + 1)}`,
      abstract: `abstract ${String(index + 1)}`,
      year: 2024,
      citationCount: 12 - index,
      url: `https://example.com/paper-${String(index + 1)}`,
      authors: [{ name: "Alice" }],
      openAccessPdf: { url: `https://example.com/paper-${String(index + 1)}.pdf` },
      doi: null,
      referenceIds: null,
      citationIds: null,
    })),
  };
}
