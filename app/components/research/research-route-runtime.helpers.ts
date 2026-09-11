// @promise promise:route-view-ai-comment-inline-surface
// @promise promise:gap-network-detection-from-search
// @promise promise:reaction-from-visible-snapshot
// @aspect aspect:route-view-ai-reaction-rules
// @check acceptance-check:route-view-ai-comment-inline-surface-active-document-content-only
// @check acceptance-check:reaction-from-visible-snapshot-snapshot-input
// @check acceptance-check:reaction-from-visible-snapshot-basis-match
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import type { RouteAiCommentGenerationTrigger } from "@/app/components/research/route-ai-comment-generation-scheduler";
import { hasActiveSearchFacetFilters } from "@/app/domain/search-facets";
import { shouldRepairSearchHydrationMetadata } from "@/app/lib/search-hydration-state";
import { buildViewSnapshot } from "@/app/lib/view-snapshot";
import type { ViewSnapshot } from "@/app/domain/view-snapshot";

export function isRouteAiCommentGenerationWaitingForHydration(
  document: ResearchRoutePayload,
): boolean {
  if (document.type === "search") {
    return (
      hasActiveSearchFacetFilters(document.metadata.facetFilters) &&
      (document.metadata.abstractHydration?.status === "pending" ||
        shouldRepairSearchHydrationMetadata(document.metadata))
    );
  }
  return (
    document.type === "graph_neighbors" && document.metadata.cardDataHydration?.status === "pending"
  );
}

export function buildRouteAiCommentGenerationCommand(document: ResearchRoutePayload): {
  trigger: RouteAiCommentGenerationTrigger;
  ownerPrincipalId: string;
  targetRoutePayloadId: string;
  viewSnapshot: ViewSnapshot;
} | null {
  if (document.type === "search") {
    const metadata: SearchMetadata = document.metadata;
    if (
      !metadata.query.trim() ||
      metadata.papers.length === 0 ||
      isRouteAiCommentGenerationWaitingForHydration(document)
    ) {
      return null;
    }
    const viewSnapshot = buildViewSnapshot(document);
    if (
      !viewSnapshot ||
      viewSnapshot.content.kind !== "search" ||
      viewSnapshot.content.results.length === 0
    ) {
      return null;
    }

    return {
      trigger: "user_search",
      ownerPrincipalId: document.ownerPrincipalId,
      targetRoutePayloadId: document.id,
      viewSnapshot,
    };
  }

  if (document.type === "citation_lineage") {
    const viewSnapshot = buildViewSnapshot(document);
    if (!viewSnapshot) return null;
    return {
      trigger: "citation_lineage_opened",
      ownerPrincipalId: document.ownerPrincipalId,
      targetRoutePayloadId: document.id,
      viewSnapshot,
    };
  }

  if (document.type === "graph_neighbors") {
    if (isRouteAiCommentGenerationWaitingForHydration(document)) return null;
    const viewSnapshot = buildViewSnapshot(document);
    if (!viewSnapshot) return null;
    return {
      trigger: "graph_neighbors_opened",
      ownerPrincipalId: document.ownerPrincipalId,
      targetRoutePayloadId: document.id,
      viewSnapshot,
    };
  }

  return null;
}
