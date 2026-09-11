import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import { normalizeGraphSourcePaperIds } from "@/app/lib/graph-source-paper-ids";

export function filterSearchMetadataBySourcePaperIds(
  metadata: SearchMetadata,
  sourcePaperIds?: readonly string[],
): SearchMetadata {
  const normalizedSourcePaperIds = normalizeGraphSourcePaperIds(sourcePaperIds);
  if (!normalizedSourcePaperIds || normalizedSourcePaperIds.length === 0) {
    return metadata;
  }

  const paperById = new Map(metadata.papers.map((paper) => [paper.paperId, paper]));
  const papers = normalizedSourcePaperIds
    .map((paperId) => paperById.get(paperId))
    .filter((paper): paper is SearchMetadata["papers"][number] => paper != null);

  return {
    ...metadata,
    papers,
  };
}

export function knowledgeMapInputMatchesPaperIds(
  document: ResearchRoutePayload | null,
  paperIds: readonly string[],
): boolean {
  if (paperIds.length === 0) {
    return true;
  }
  if (!document || document.metadata.type !== "gap_network") {
    return false;
  }
  const documentPaperIds = document.metadata.papers.map((paper) => paper.paperId);
  return (
    documentPaperIds.length === paperIds.length &&
    documentPaperIds.every((paperId, index) => paperId === paperIds[index])
  );
}
