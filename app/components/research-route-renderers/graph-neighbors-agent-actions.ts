"use client";

// @promise promise:gap-network-detection-from-search
// @promise promise:graph-neighbor-papers
// @check acceptance-check:graph-neighbor-papers-gap-surface
// @aspect aspect:knowledge-map-followup-surface

import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import { t } from "@/app/i18n/message-access";
import {
  type GapReportNavigationTarget,
  openGapNetworkFromSearchSource,
} from "./search-view-agent-actions";

interface GapNetworkNavigationOptions {
  navigationTarget?: GapReportNavigationTarget | null;
}

function buildGraphNeighborGapSupport(
  metadata: Extract<ResearchRoutePayload["metadata"], { type: "graph_neighbors" }>,
): SearchMetadata["graphSupport"] | undefined {
  const paperScores: NonNullable<SearchMetadata["graphSupport"]>["paperScores"] = {};

  for (const entry of metadata.coCited) {
    paperScores[entry.paper.paperId] = {
      defaultScore: entry.shared,
      graphScore: entry.shared,
      semanticScore: null,
      sharedCiters: entry.shared,
      sharedRefs: null,
      seedCount: 1,
      sources: [`co_cited:${metadata.seedPaper.paperId}`],
    };
  }

  for (const entry of metadata.coupled) {
    const existing = paperScores[entry.paper.paperId];
    paperScores[entry.paper.paperId] = {
      defaultScore: Math.max(existing?.defaultScore ?? 0, entry.shared),
      graphScore: Math.max(existing?.graphScore ?? 0, entry.shared),
      semanticScore: existing?.semanticScore ?? null,
      sharedCiters: existing?.sharedCiters ?? null,
      sharedRefs: entry.shared,
      seedCount: existing ? 2 : 1,
      sources: [...(existing?.sources ?? []), `coupled:${metadata.seedPaper.paperId}`],
    };
  }

  const samplePaperIds = metadata.papers.map((paper) => paper.paperId);
  if (samplePaperIds.length === 0) return undefined;

  return {
    version: 2,
    source: "episteme-paper-neighborhood",
    basis: "graph_neighbor_snapshot",
    status: Object.keys(paperScores).length > 0 ? "ready" : "empty",
    samplePaperIds,
    paperScores,
    generatedAt: new Date().toISOString(),
  };
}

export function openGapNetworkFromGraphNeighbors(
  document: ResearchRoutePayload,
  navigate?: (url: string) => void,
  options?: GapNetworkNavigationOptions,
): void {
  if (document.type !== "graph_neighbors") {
    options?.navigationTarget?.discard();
    return;
  }

  const metadata = document.metadata;
  if (metadata.papers.length === 0) {
    options?.navigationTarget?.discard();
    return;
  }

  openGapNetworkFromSearchSource(
    document,
    {
      type: "search",
      query: t("search.label.graph-neighbors.gapQuery", {
        title: metadata.seedPaper.title,
      }),
      papers: metadata.papers,
      total: metadata.papers.length,
      graphSupport: buildGraphNeighborGapSupport(metadata),
    },
    navigate,
    undefined,
    options,
  );
}
