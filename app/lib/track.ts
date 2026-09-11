/**
 * UI 인터랙션 이벤트를 서버에 fire-and-forget으로 전송한다.
 * Canonical analytics와 Amplitude client tracking을 이 모듈로 중앙화한다.
 */

import {
  initializeAmplitudeUnifiedModule,
  readAmplitudeUnifiedModule,
} from "./analytics/amplitude-unified-client";
import type { CanonicalEventPayload } from "./analytics/canonical-event";
import { trackCanonicalEvent } from "./analytics/client";
import { buildQueryAnalyticsMetadata, hashTextForAnalytics } from "./analytics/query-hash";
import type { InteractionEvent } from "./interaction-event";
export type { InteractionEvent } from "./interaction-event";

const interactionOnceKeys = new Set<string>();
const canonicalOnceKeys = new Set<string>();

type PaperReviewToggleEvent = Extract<InteractionEvent, { type: "paper_review_toggle" }>;
type PaperPdfOpenEvent = Extract<InteractionEvent, { type: "paper_pdf_open" }>;
type SearchResultLibraryAddClickedEvent = {
  type: PaperReviewToggleEvent["type"];
  data: Omit<PaperReviewToggleEvent["data"], "reviewed"> & { reviewed: true };
};
type SearchResultLibraryRemoveClickedEvent = {
  type: PaperReviewToggleEvent["type"];
  data: Omit<PaperReviewToggleEvent["data"], "reviewed"> & { reviewed: false };
};

export function trackInteractionOnce(key: string, event: InteractionEvent): boolean {
  if (interactionOnceKeys.has(key)) return false;
  interactionOnceKeys.add(key);
  track(event);
  return true;
}

export function trackAiCommentCardViewedOnce(params: {
  ownerPrincipalId: string;
  documentId: string;
  reactionKey: string;
}): boolean {
  return trackInteractionOnce(`ai_comment_card_viewed:${params.reactionKey}`, {
    type: "ai_comment_card_viewed",
    data: params,
  });
}

export function trackAiCommentCardExpandClicked(params: {
  ownerPrincipalId: string;
  documentId: string;
  reactionKey: string;
}): void {
  trackCanonicalEvent("product.ai_comment_card_expand.clicked", {
    actor: { type: "user", id: readIdentifiedUserId() },
    subject: {
      ownerPrincipalId: params.ownerPrincipalId,
      documentId: params.documentId,
    },
    properties: params,
  });
}

export function trackAiCommentRegenerateClicked(
  event: Extract<InteractionEvent, { type: "ai_comment_regenerate_clicked" }>,
) {
  track(event);
}

export function trackSearchResultsViewed(
  event: Extract<InteractionEvent, { type: "user_search" }>,
): boolean {
  return trackCanonicalEventOnce(
    `search_results_viewed:${event.data.searchContextId ?? event.data.documentId}`,
    "search_results_viewed",
    {
      actor: { type: "user", id: readIdentifiedUserId() },
      subject: {
        search_context_id: event.data.searchContextId ?? event.data.documentId,
      },
      properties: {
        journey_context_id: event.data.journeyContextId ?? event.data.documentId,
        search_context_id: event.data.searchContextId ?? event.data.documentId,
        sort: toAnalyticsTaxonomyToken(event.data.sort ?? "unknown"),
        result_count: event.data.resultCount,
        visible_result_count: event.data.visibleResultCount,
        library_grounding_applied: event.data.libraryGroundingApplied,
        library_anchor_paper_count: event.data.libraryAnchorPaperCount,
        source_surface: "search_results",
        ...(event.data.year ? { year_filter: event.data.year } : {}),
      },
    },
  );
}

export function trackSearchSubmitted(params: {
  journeyContextId: string;
  searchContextId: string;
  parentSearchContextId?: string;
  entrySource: "route-bar" | "empty-entry" | "requery" | "term" | "position" | "similar";
  queryLength: number;
  sort: string;
  yearFilter?: string;
  seedPaperId?: string;
}): boolean {
  return trackCanonicalEventOnce(`search_submitted:${params.searchContextId}`, "search_submitted", {
    actor: { type: "user", id: readIdentifiedUserId() },
    subject: { search_context_id: params.searchContextId },
    properties: {
      journey_context_id: params.journeyContextId,
      search_context_id: params.searchContextId,
      ...(params.parentSearchContextId
        ? { parent_search_context_id: params.parentSearchContextId }
        : {}),
      entry_source: toAnalyticsTaxonomyToken(params.entrySource),
      query_length: params.queryLength,
      sort: toAnalyticsTaxonomyToken(params.sort),
      ...(params.yearFilter ? { year_filter: params.yearFilter } : {}),
      ...(params.seedPaperId ? { seed_paper_id: params.seedPaperId } : {}),
    },
  });
}

export function trackPaperPdfOpened(event: PaperPdfOpenEvent): void {
  trackCanonicalEvent(
    "pdf_opened",
    buildPaperJourneyCanonicalPayload(event.data, readIdentifiedUserId(), {
      open_target: event.data.openTarget,
      open_element: event.data.openElement,
    }),
  );
}

export function trackSearchResultInspected(params: {
  journeyContextId: string;
  searchContextId: string;
  paperId: string;
  resultRank: number;
  sourceSurface: "search_results" | "citation_lineage" | "graph_neighbors";
  hasPdf: boolean;
  evidenceAvailability: "available" | "partial" | "unavailable" | "unknown";
}): boolean {
  return trackCanonicalEventOnce(
    `search_result_inspected:${params.searchContextId}:${params.paperId}:${String(params.resultRank)}`,
    "search_result_inspected",
    {
      actor: { type: "user", id: readIdentifiedUserId() },
      subject: {
        search_context_id: params.searchContextId,
        paper_id: params.paperId,
      },
      properties: {
        journey_context_id: params.journeyContextId,
        search_context_id: params.searchContextId,
        paper_id: params.paperId,
        result_rank: params.resultRank,
        source_surface: params.sourceSurface,
        has_pdf: params.hasPdf,
        evidence_availability: params.evidenceAvailability,
      },
    },
  );
}

export async function trackResearchAuthChallengeViewed(
  source: "library_bootstrap_401" | "moonlight_session_invalid" = "library_bootstrap_401",
): Promise<void> {
  await initializeAmplitudeUnifiedModule();
  trackCanonicalEvent("product.research_auth_challenge.viewed", {
    actor: { type: "user", id: undefined },
    subject: {},
    properties: { source },
  });
}

export function trackPaperSaved(event: SearchResultLibraryAddClickedEvent) {
  trackCanonicalEvent(
    "paper_saved",
    buildPaperJourneyCanonicalPayload(event.data, readIdentifiedUserId()),
  );
}

export function trackPaperUnsaved(event: SearchResultLibraryRemoveClickedEvent) {
  trackCanonicalEvent(
    "paper_unsaved",
    buildPaperJourneyCanonicalPayload(event.data, readIdentifiedUserId()),
  );
}

export function trackCitationLineageOpened(
  event: Extract<InteractionEvent, { type: "citation_lineage_open" }>,
) {
  trackCanonicalEvent(
    "citation_lineage_opened",
    buildPaperJourneyCanonicalPayload(event.data, readIdentifiedUserId(), {
      reference_count: event.data.referenceCount,
      citation_count: event.data.citationCount,
    }),
  );
}

export function trackGapReportClicked(
  event: Extract<InteractionEvent, { type: "gap_report_open" }>,
) {
  track(event);
}

export function trackGapReportViewedOnce(
  event: Extract<InteractionEvent, { type: "gap_network_viewed" }>,
): boolean {
  return trackInteractionOnce(
    `gap_report_viewed:${event.data.viewerPrincipalId}:${event.data.documentId}`,
    event,
  );
}

export function trackGapAnalysisRetryClicked(params: {
  gapReportId: string;
  retryCount: number;
}): void {
  trackCanonicalEvent("gap_analysis_retry_clicked", {
    actor: { type: "user", id: readIdentifiedUserId() },
    subject: { gap_report_id: params.gapReportId },
    properties: {
      gap_report_id: params.gapReportId,
      retry_count: params.retryCount,
    },
  });
}

export function trackGapLedNextSearchClicked(
  event: Extract<InteractionEvent, { type: "gap_led_next_search_clicked" }>,
) {
  track(event);
}

export function trackSearchLanguageAwareLibrarySupplementViewedOnce(
  event: Extract<InteractionEvent, { type: "user_search" }>,
): boolean {
  return trackSearchLanguageAwareLibrarySupplementViewedCanonicalOnce(
    event,
    readIdentifiedUserId(),
  );
}

export function trackSpellingCorrectionClicked(
  event: Extract<InteractionEvent, { type: "spelling_correction" }>,
) {
  track(event);
}

export function trackAboutCommitmentLinkClicked(
  event: Extract<InteractionEvent, { type: "about_commitment_link_clicked" }>,
) {
  track(event);
}

export function trackGapViewMarginViewedOnce(
  event: Extract<InteractionEvent, { type: "gap_view_margin_viewed" }>,
) {
  trackInteractionOnce(
    `gap_view_margin_viewed:${event.data.viewerPrincipalId}:${event.data.researchRoutePayloadId}`,
    event,
  );
}

export function trackGapViewPreparedReactionViewedOnce(
  event: Extract<InteractionEvent, { type: "gap_view_prepared_reaction_viewed" }>,
) {
  trackInteractionOnce(
    `gap_view_prepared_reaction_viewed:${event.data.viewerPrincipalId}:${event.data.researchRoutePayloadId}`,
    event,
  );
}

export function trackSimilarPapersOpened(
  event: Extract<InteractionEvent, { type: "similar_papers_discovery" }>,
) {
  trackCanonicalEvent(
    "similar_papers_opened",
    buildPaperJourneyCanonicalPayload(event.data, readIdentifiedUserId()),
  );
}

export function trackSearchTermCandidateClicked(
  event: Extract<InteractionEvent, { type: "search_term_candidate" }>,
) {
  track(event);
}

export function trackResearchTermsViewedOnce(params: {
  ownerPrincipalId: string;
  documentId: string;
  phase: "initial";
  source: "llm";
  candidateCount: number;
}): boolean {
  const { ownerPrincipalId, documentId, phase, source, candidateCount } = params;
  return trackCanonicalEventOnce(
    `product.research_terms.viewed:${ownerPrincipalId}:${documentId}:${phase}`,
    "product.research_terms.viewed",
    {
      actor: { type: "user", id: readIdentifiedUserId() },
      subject: {
        ownerPrincipalId,
        documentId,
      },
      properties: { ownerPrincipalId, documentId, phase, source, candidateCount },
    },
  );
}

export function trackDifferentPositionSearchClicked(
  event: Extract<InteractionEvent, { type: "different_position_search" }>,
) {
  track(event);
}

export function trackGapOverlayDecisionEvidenceClicked(
  event: Extract<InteractionEvent, { type: "gap_overlay_decision_evidence" }>,
) {
  track(event);
}

export function trackAiContentFeedbackSubmitted(input: {
  documentId: string | null;
  documentType?: string;
  surfaceId: string;
  surfaceKind: string;
  promiseRef: string;
  value: "helpful" | "not_helpful";
  previousValue: "helpful" | "not_helpful" | null;
  outputSnapshot: {
    title?: string;
    body: string;
    timestamp?: string;
  };
  metadata?: Record<string, string | number | boolean | null>;
}): void {
  const properties: Record<string, unknown> = {
    surfaceId: input.surfaceId,
    surfaceKind: input.surfaceKind,
    promiseRef: input.promiseRef,
    value: input.value,
    previousValue: input.previousValue,
    outputBodyHash: hashTextForAnalytics(input.outputSnapshot.body),
    outputBodyLength: input.outputSnapshot.body.length,
  };

  if (input.documentId) properties.documentId = input.documentId;
  if (input.documentType) properties.documentType = input.documentType;
  if (input.outputSnapshot.title) {
    properties.outputTitleHash = hashTextForAnalytics(input.outputSnapshot.title);
    properties.outputTitleLength = input.outputSnapshot.title.length;
  }
  if (input.outputSnapshot.timestamp) properties.outputTimestamp = input.outputSnapshot.timestamp;
  if (typeof input.metadata?.paperId === "string") {
    properties.metadataPaperId = input.metadata.paperId;
  }
  if (typeof input.metadata?.source === "string") properties.metadataSource = input.metadata.source;
  if (typeof input.metadata?.selectionKind === "string") {
    properties.metadataSelectionKind = input.metadata.selectionKind;
  }

  trackCanonicalEvent("product.ai_content_feedback.submitted", {
    actor: { type: "user", id: readIdentifiedUserId() },
    subject: {
      surfaceId: input.surfaceId,
      promiseRef: input.promiseRef,
      ...(input.documentId ? { documentId: input.documentId } : {}),
    },
    properties,
  });
}

export function track(event: InteractionEvent): void {
  try {
    trackCanonicalBridge(event);
  } catch (error) {
    console.warn("[track] canonical analytics bridge failed:", error);
  }
}

function trackCanonicalBridge(event: InteractionEvent): void {
  const actorId = readIdentifiedUserId();
  if (trackSearchCanonicalBridge(event, actorId)) return;
  if (trackDocumentCanonicalBridge(event, actorId)) return;
  if (trackResearchRouteCanonicalBridge(event, actorId)) return;
  trackCommitmentCanonicalBridge(event, actorId);
}

function trackSearchCanonicalBridge(event: InteractionEvent, actorId: string | undefined): boolean {
  switch (event.type) {
    // Search submissions emit at the accepted client transition boundary in
    // SearchFollowupActivationProvider; this event is the destination result window.
    case "user_search": {
      trackSearchResultsViewed(event);
      return true;
    }
    case "spelling_correction":
      trackCanonicalEvent("product.spelling_correction.clicked", {
        actor: { type: "user", id: actorId },
        subject: {
          ownerPrincipalId: event.data.ownerPrincipalId,
          documentId: event.data.documentId,
        },
        properties: {
          ownerPrincipalId: event.data.ownerPrincipalId,
          documentId: event.data.documentId,
          queryHash: buildQueryAnalyticsMetadata(event.data.query).queryHash,
          correctedQueryHash: buildQueryAnalyticsMetadata(event.data.correctedQuery).queryHash,
        },
      });
      return true;
    case "search_term_candidate": {
      const queryMetadata = buildQueryAnalyticsMetadata(event.data.query);
      const termMetadata = buildQueryAnalyticsMetadata(event.data.term);
      trackCanonicalEvent("product.search_term_candidate.clicked", {
        actor: { type: "user", id: actorId },
        subject: {
          ownerPrincipalId: event.data.ownerPrincipalId,
          documentId: event.data.documentId,
        },
        properties: {
          ownerPrincipalId: event.data.ownerPrincipalId,
          documentId: event.data.documentId,
          queryHash: queryMetadata.queryHash,
          termHash: termMetadata.queryHash,
          candidateType: event.data.candidateType,
          supportCount: event.data.supportCount,
          ...(event.data.candidateSource ? { candidateSource: event.data.candidateSource } : {}),
          sourceResearchRouteKind: event.data.sourceResearchRouteKind,
        },
      });
      return true;
    }
    case "different_position_search": {
      trackCanonicalEvent("product.different_position_search.clicked", {
        actor: { type: "user", id: actorId },
        subject: {
          ownerPrincipalId: event.data.ownerPrincipalId,
          documentId: event.data.documentId,
          paperId: event.data.paperId,
        },
        properties: {
          ownerPrincipalId: event.data.ownerPrincipalId,
          documentId: event.data.documentId,
          paperId: event.data.paperId,
          queryHash: event.data.queryHash,
          queryLength: event.data.queryLength,
        },
      });
      return true;
    }
    default:
      return false;
  }
}

type PaperJourneyEventData = Extract<
  InteractionEvent,
  {
    type:
      | "paper_pdf_open"
      | "paper_review_toggle"
      | "citation_lineage_open"
      | "similar_papers_discovery";
  }
>["data"];

function buildPaperJourneyCanonicalPayload(
  data: PaperJourneyEventData,
  actorId: string | undefined,
  extraProperties: Record<string, unknown> = {},
): Parameters<typeof trackCanonicalEvent>[1] {
  return {
    actor: { type: "user", id: actorId },
    subject: {
      search_context_id: data.searchContextId,
      paper_id: data.paperId,
    },
    properties: {
      journey_context_id: data.journeyContextId,
      search_context_id: data.searchContextId,
      paper_id: data.paperId,
      result_rank: data.resultRank,
      source_surface: data.sourceSurface ?? "search_results",
      has_pdf: data.hasPdf,
      evidence_availability: data.evidenceAvailability,
      ...extraProperties,
    },
  };
}

function trackDocumentCanonicalBridge(
  event: InteractionEvent,
  actorId: string | undefined,
): boolean {
  switch (event.type) {
    case "ai_comment_regenerate_clicked":
      trackCanonicalEvent("product.ai_comment_regenerate.clicked", {
        actor: { type: "user", id: actorId },
        subject: {
          ownerPrincipalId: event.data.ownerPrincipalId,
          documentId: event.data.documentId,
        },
        properties: {
          ownerPrincipalId: event.data.ownerPrincipalId,
          documentId: event.data.documentId,
          documentType: event.data.documentType,
        },
      });
      return true;
    case "paper_pdf_open":
      trackPaperPdfOpened(event);
      return true;
    case "paper_review_toggle":
      if (event.data.reviewed) {
        trackPaperSaved({ ...event, data: { ...event.data, reviewed: true } });
      } else {
        trackPaperUnsaved({ ...event, data: { ...event.data, reviewed: false } });
      }
      return true;
    case "citation_lineage_open":
      trackCitationLineageOpened(event);
      return true;
    case "gap_report_open":
      trackCanonicalEvent("product.gap_report.clicked", {
        actor: { type: "user", id: actorId },
        subject: {
          ownerPrincipalId: event.data.ownerPrincipalId,
          documentId: event.data.documentId,
        },
        properties: event.data,
      });
      return true;
    case "gap_network_viewed":
      trackCanonicalEvent("product.gap_report.viewed", {
        actor: { type: "user", id: actorId },
        subject: {
          viewerPrincipalId: event.data.viewerPrincipalId,
          documentId: event.data.documentId,
        },
        properties: event.data,
      });
      return true;
    case "gap_led_next_search_clicked":
      trackCanonicalEvent("product.gap_led_next_search.clicked", {
        actor: { type: "user", id: actorId },
        subject: {
          viewerPrincipalId: event.data.viewerPrincipalId,
          documentId: event.data.documentId ?? null,
        },
        properties: event.data,
      });
      return true;
    default:
      return false;
  }
}

function trackResearchRouteCanonicalBridge(
  event: InteractionEvent,
  actorId: string | undefined,
): boolean {
  switch (event.type) {
    case "similar_papers_discovery":
      trackSimilarPapersOpened(event);
      return true;
    case "gap_overlay_decision_evidence":
      trackCanonicalEvent("product.gap_overlay_decision_evidence.clicked", {
        actor: { type: "user", id: actorId },
        subject: event.data.documentId ? { documentId: event.data.documentId } : {},
        properties: {
          ...(event.data.documentId ? { documentId: event.data.documentId } : {}),
          ...(event.data.selectionKind ? { selectionKind: event.data.selectionKind } : {}),
        },
      });
      return true;
    default:
      return false;
  }
}

function trackCommitmentCanonicalBridge(
  event: InteractionEvent,
  actorId: string | undefined,
): void {
  switch (event.type) {
    case "ai_comment_card_viewed":
      trackCanonicalEvent("product.ai_comment_card.viewed", {
        actor: { type: "user", id: actorId },
        subject: {
          ownerPrincipalId: event.data.ownerPrincipalId,
          documentId: event.data.documentId,
        },
        properties: event.data,
      });
      return;
    case "about_commitment_link_clicked":
      trackCanonicalEvent("product.researcher_prose_promises_page.clicked", {
        actor: { type: "user", id: actorId },
        subject: {},
        properties: { target: event.data.target },
      });
      return;
    case "gap_view_margin_viewed":
      trackCanonicalEvent("product.gap_view_margin.viewed", {
        actor: { type: "user", id: actorId },
        subject: {
          viewerPrincipalId: event.data.viewerPrincipalId,
          researchRoutePayloadId: event.data.researchRoutePayloadId,
        },
        properties: event.data,
      });
      return;
    case "gap_view_prepared_reaction_viewed":
      trackCanonicalEvent("product.gap_view_prepared_reaction.viewed", {
        actor: { type: "user", id: actorId },
        subject: {
          viewerPrincipalId: event.data.viewerPrincipalId,
          researchRoutePayloadId: event.data.researchRoutePayloadId,
        },
        properties: event.data,
      });
      return;
    default:
      return;
  }
}

function readIdentifiedUserId(): string | undefined {
  try {
    return readAmplitudeUnifiedModule()?.getUserId();
  } catch {
    return undefined;
  }
}

function toAnalyticsTaxonomyToken(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function trackSearchLanguageAwareLibrarySupplementViewedCanonicalOnce(
  event: Extract<InteractionEvent, { type: "user_search" }>,
  actorId: string | undefined,
): boolean {
  const admittedSupplementCount = event.data.languageAwareLibrarySupplementCount ?? 0;
  if (admittedSupplementCount <= 0) return false;

  const queryMetadata = buildQueryAnalyticsMetadata(event.data.query);
  return trackCanonicalEventOnce(
    `product.search_language_aware_library_supplement.viewed:${event.data.ownerPrincipalId}:${event.data.documentId}:${queryMetadata.queryHash}:${event.data.sort ?? "unknown"}`,
    "product.search_language_aware_library_supplement.viewed",
    {
      actor: { type: "user", id: actorId },
      subject: {
        ownerPrincipalId: event.data.ownerPrincipalId,
        documentId: event.data.documentId,
      },
      properties: {
        ownerPrincipalId: event.data.ownerPrincipalId,
        documentId: event.data.documentId,
        ...queryMetadata,
        sort: event.data.sort ?? "unknown",
        resultCount: event.data.resultCount,
        admittedSupplementCount,
      },
    },
  );
}

function trackCanonicalEventOnce(
  key: string,
  name: string,
  payload: CanonicalEventPayload,
): boolean {
  if (canonicalOnceKeys.has(key)) return false;
  canonicalOnceKeys.add(key);
  trackCanonicalEvent(name, payload);
  return true;
}

/** Amplitude 사용자 식별. */
export function identifyUser(email: string): void {
  void initializeAmplitudeUnifiedModule().then((module) => {
    if (!module) return;
    try {
      module.identify(new module.Identify().set("email", email), { user_id: email });
    } catch {
      // fire-and-forget
    }
  });
}
