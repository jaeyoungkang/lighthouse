import type { SearchMetadata } from "@/app/domain/research-route-payload";

export function isNumericSearchPaperId(paperId: string): boolean {
  return /^\d+$/.test(paperId);
}

export function isEpisteme3SearchPaperId(paperId: string): boolean {
  return isNumericSearchPaperId(paperId) || /^pap_/i.test(paperId);
}

export function hasEpisteme3SearchPaper(metadata: SearchMetadata): boolean {
  return metadata.papers.some((paper) => isEpisteme3SearchPaperId(paper.paperId));
}

export function hasHydratedSearchPaperDetails(metadata: SearchMetadata): boolean {
  return metadata.papers.some(
    (paper) =>
      paper.authors.length > 0 ||
      (typeof paper.abstract === "string" && paper.abstract.trim().length > 0) ||
      paper.referenceCount != null,
  );
}

export function shouldRepairSearchHydrationMetadata(metadata: SearchMetadata): boolean {
  return (
    metadata.abstractHydration?.status === "ready" &&
    metadata.abstractHydration.repairAttempted !== true &&
    metadata.papers.length > 0 &&
    metadata.papers.some((paper) => isEpisteme3SearchPaperId(paper.paperId)) &&
    !hasHydratedSearchPaperDetails(metadata)
  );
}
