import type { CitationLineageMetadata } from "@/app/domain/research-route-payload";

export interface CitationDirectionSplit {
  references: CitationLineageMetadata["papers"];
  citations: CitationLineageMetadata["papers"];
}

export function splitPapersByCitationDirection(
  metadata: CitationLineageMetadata,
): CitationDirectionSplit {
  const refSet = new Set(metadata.referenceIds);
  const citSet = new Set(metadata.citationIds);

  const references: CitationLineageMetadata["papers"] = [];
  const citations: CitationLineageMetadata["papers"] = [];

  for (const paper of metadata.papers) {
    if (refSet.has(paper.paperId)) {
      references.push(paper);
    } else if (citSet.has(paper.paperId)) {
      citations.push(paper);
    } else {
      citations.push(paper);
    }
  }

  return { references, citations };
}

export function getCitationLineageGapInputPapers(
  metadata: CitationLineageMetadata,
): CitationLineageMetadata["papers"] {
  if (metadata.referenceIds.length === 0 && metadata.citationIds.length === 0) {
    return [];
  }
  const { references, citations } = splitPapersByCitationDirection(metadata);
  return [...references, ...citations];
}
