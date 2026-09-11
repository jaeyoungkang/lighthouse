import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { t } from "@/app/i18n/message-access";

import { formatSearchCompletionLabel, truncateLabel } from "./search-view.helpers";
import { buildInlineAnalysisMap } from "@/app/lib/inline-analysis";

export function buildSearchSystemEventMessage(params: {
  query: string;
  kind: "success" | "analysis_completed" | "request_failed" | "invalid_response";
  metadata?: SearchMetadata;
}): string {
  switch (params.kind) {
    case "success":
      if (!params.metadata) {
        throw new Error("Search success event requires metadata");
      }

      return t("search.label.search-view-helpers.3", {
        param: params.query,
        param2: formatSearchCompletionLabel(params.metadata),
      });
    case "analysis_completed":
      if (!params.metadata) {
        throw new Error("Search analysis-complete event requires metadata");
      }

      return t("search.label.search-view-helpers.analysisCompleted", {
        query: params.query,
        count: buildInlineAnalysisMap(params.metadata.papers).size,
      });
    case "invalid_response":
      return t("search.error.search-view-helpers", { param: params.query });
    case "request_failed":
      return t("search.error.search-view-helpers.2", { param: params.query });
  }
}

export function buildCitationLineageSystemEventMessage(params: {
  title: string;
  kind: "opened" | "request_failed";
}): string {
  const truncatedTitle = truncateLabel(params.title);

  switch (params.kind) {
    case "opened":
      return t("search.label.search-view-helpers.citationLineageOpened", {
        title: truncatedTitle,
      });
    case "request_failed":
      return t("search.error.search-view-helpers.citationLineageFailed", {
        title: truncatedTitle,
      });
  }
}

export function buildGraphNeighborsSystemEventMessage(params: {
  title: string;
  kind: "opened" | "request_failed";
}): string {
  const truncatedTitle = truncateLabel(params.title);

  switch (params.kind) {
    case "opened":
      return t("search.label.search-view-helpers.graphNeighborsOpened", {
        title: truncatedTitle,
      });
    case "request_failed":
      return t("search.error.search-view-helpers.graphNeighborsFailed", {
        title: truncatedTitle,
      });
  }
}

export function buildReviewDoneSystemEventMessage(title: string): string {
  return t("search.label.search-view-helpers.5", { title: truncateLabel(title) });
}
