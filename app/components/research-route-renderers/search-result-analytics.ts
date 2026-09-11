import type { PaperCore } from "@/app/domain/paper";

export type PdfOpenTarget = "moonlight_external";
export type PdfOpenElement = "pdf_button";

export interface SearchResultCardAnalyticsContext {
  ownerPrincipalId: string;
  documentId: string;
  journeyContextId: string;
  searchContextId: string;
  resultRank: number;
  rankBucket: "top_3" | "top_10" | "below_10";
  totalResultCount: number;
  visibleResultCount: number;
  queryHash?: string;
  sort?: string;
  yearFilter?: string;
  sourceSurface?: "search_results" | "citation_lineage" | "graph_neighbors";
}

export type PaperEvidenceAvailability = "available" | "partial" | "unavailable" | "unknown";

export interface CardMetadata {
  hasPdf: boolean;
  year: number | null;
  citationCount: number;
  referenceCount: number;
  authorCount: number;
}

export function buildCardMetadata(paper: PaperCore, hasPdf: boolean): CardMetadata {
  return {
    hasPdf,
    year: paper.year,
    citationCount: paper.citationCount,
    referenceCount: paper.referenceCount ?? paper.referenceIds?.length ?? 0,
    authorCount: paper.authors.length,
  };
}

export function resolvePaperEvidenceAvailability(paper: PaperCore): PaperEvidenceAvailability {
  const referenceCount = paper.referenceCount ?? paper.referenceIds?.length ?? 0;
  const citationCount = paper.citationCount;
  const hasEvidence = referenceCount > 0 || citationCount > 0;
  const explicitlyUnavailable =
    paper.referenceAvailability?.available === false ||
    paper.citationAvailability?.available === false;
  if (hasEvidence && explicitlyUnavailable) return "partial";
  if (hasEvidence) return "available";
  if (explicitlyUnavailable) return "unavailable";
  return "unknown";
}
