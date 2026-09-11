import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";

export const EPHEMERAL_SEARCH_DOCUMENT_ID_PREFIX = "search-ephemeral-";
export const EPHEMERAL_CITATION_LINEAGE_DOCUMENT_ID_PREFIX = "citation-ephemeral-";
export const EPHEMERAL_GRAPH_NEIGHBORS_DOCUMENT_ID_PREFIX = "graph-neighbors-ephemeral-";

export function isEphemeralSearchViewId(documentId: string): boolean {
  return documentId.startsWith(EPHEMERAL_SEARCH_DOCUMENT_ID_PREFIX);
}

export function isEphemeralResearchDocumentId(documentId: string): boolean {
  return (
    documentId.startsWith(EPHEMERAL_SEARCH_DOCUMENT_ID_PREFIX) ||
    documentId.startsWith(EPHEMERAL_CITATION_LINEAGE_DOCUMENT_ID_PREFIX) ||
    documentId.startsWith(EPHEMERAL_GRAPH_NEIGHBORS_DOCUMENT_ID_PREFIX)
  );
}

export function isEphemeralSearchView(
  document: Pick<ResearchRoutePayload, "id" | "type">,
): boolean {
  return document.type === "search" && isEphemeralSearchViewId(document.id);
}
