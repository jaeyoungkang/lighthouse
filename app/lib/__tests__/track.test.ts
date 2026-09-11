import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  track,
  trackAiCommentCardExpandClicked,
  trackGapReportViewedOnce,
  trackGapAnalysisRetryClicked,
  trackGapViewMarginViewedOnce,
  trackGapViewPreparedReactionViewedOnce,
  trackInteractionOnce,
  trackResearchAuthChallengeViewed,
  trackResearchTermsViewedOnce,
  trackSearchLanguageAwareLibrarySupplementViewedOnce,
  trackSearchSubmitted,
} from "../track";
import { loadAmplitudeUnifiedModule } from "../analytics/amplitude-unified-client";
import { trackCanonicalEvent } from "../analytics/client";
import { getUserId } from "@amplitude/unified";

vi.mock("../analytics/client", () => ({
  trackCanonicalEvent: vi.fn(),
}));

vi.mock("@amplitude/unified", () => ({
  getUserId: vi.fn(),
  Identify: vi.fn(),
  identify: vi.fn(),
  initAll: vi.fn(),
  track: vi.fn(),
}));

const trackCanonicalEventMock = vi.mocked(trackCanonicalEvent);
const getUserIdMock = vi.mocked(getUserId);

function resetTrackMocks() {
  vi.stubEnv("NEXT_PUBLIC_AMPLITUDE_API_KEY", "amplitude-key");
  trackCanonicalEventMock.mockClear();
  getUserIdMock.mockReset();
  window.localStorage.clear();
}

describe("track canonical bridge search events", () => {
  beforeEach(resetTrackMocks);
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("loads the SDK identity lazily and uses it after the SDK chunk is available", async () => {
    getUserIdMock.mockReturnValue("user-1@example.com");
    const event = {
      type: "search_term_candidate" as const,
      data: {
        ownerPrincipalId: "principal-1",
        documentId: "search-1",
        query: "graph retrieval",
        term: "graph retrieval agents",
        candidateType: "broader" as const,
        supportCount: 3,
        sourceResearchRouteKind: "search" as const,
      },
    };
    track(event);
    await expect(loadAmplitudeUnifiedModule()).resolves.not.toBeNull();
    track(event);

    expect(trackCanonicalEventMock.mock.calls[0]?.[1].actor).toEqual({
      type: "user",
      id: undefined,
    });
    expect(trackCanonicalEventMock.mock.calls[1]?.[1].actor).toEqual({
      type: "user",
      id: "user-1@example.com",
    });
  });

  it("emits one first-visible event per route-owned search context", () => {
    const event = {
      type: "user_search" as const,
      data: {
        ownerPrincipalId: "principal-1",
        documentId: "search-context-1",
        query: "graph retrieval",
        sort: "relevance",
        resultCount: 12,
        visibleResultCount: 10,
        libraryGroundingApplied: true,
        libraryAnchorPaperCount: 4,
      },
    };

    track(event);
    track(event);

    expect(trackCanonicalEventMock.mock.calls.map((call) => call[0])).toEqual([
      "search_results_viewed",
    ]);
    expect(trackCanonicalEventMock.mock.calls[0]?.[1]).toMatchObject({
      subject: { search_context_id: "search-context-1" },
      properties: {
        journey_context_id: "search-context-1",
        search_context_id: "search-context-1",
        sort: "relevance",
        result_count: 12,
        visible_result_count: 10,
        library_grounding_applied: true,
        library_anchor_paper_count: 4,
        source_surface: "search_results",
      },
    });
    expect(trackCanonicalEventMock.mock.calls[0]?.[1].properties).not.toHaveProperty("query");
    expect(trackCanonicalEventMock.mock.calls[0]?.[1].properties).not.toHaveProperty("queryHash");
  });

  it("emits one submit event with parent lineage and no raw query", () => {
    trackSearchSubmitted({
      journeyContextId: "journey-1",
      searchContextId: "search-2",
      parentSearchContextId: "search-1",
      entrySource: "requery",
      queryLength: 15,
      sort: "relevance",
    });
    trackSearchSubmitted({
      journeyContextId: "journey-1",
      searchContextId: "search-2",
      parentSearchContextId: "search-1",
      entrySource: "requery",
      queryLength: 15,
      sort: "relevance",
    });

    expect(trackCanonicalEventMock).toHaveBeenCalledTimes(1);
    expect(trackCanonicalEventMock).toHaveBeenCalledWith("search_submitted", {
      actor: { type: "user", id: undefined },
      subject: { search_context_id: "search-2" },
      properties: {
        journey_context_id: "journey-1",
        search_context_id: "search-2",
        parent_search_context_id: "search-1",
        entry_source: "requery",
        query_length: 15,
        sort: "relevance",
      },
    });
    expect(JSON.stringify(trackCanonicalEventMock.mock.calls[0])).not.toContain("graph retrieval");
    expect(JSON.stringify(trackCanonicalEventMock.mock.calls[0])).not.toContain("queryHash");
  });
});

describe("track canonical bridge follow-up search events", () => {
  beforeEach(resetTrackMocks);
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("bridges research term clicks with the served source but without raw query or term text", () => {
    track({
      type: "search_term_candidate",
      data: {
        ownerPrincipalId: "principal-1",
        documentId: "search-1",
        query: "에이전트 기억",
        term: "workflow memory",
        candidateType: "broader",
        supportCount: 3,
        candidateSource: "llm",
        sourceResearchRouteKind: "search",
      },
    });

    expect(trackCanonicalEventMock.mock.calls.map((call) => call[0])).toEqual([
      "product.search_term_candidate.clicked",
    ]);
    const properties = trackCanonicalEventMock.mock.calls[0]?.[1].properties;
    expect(properties).toMatchObject({
      ownerPrincipalId: "principal-1",
      documentId: "search-1",
      candidateType: "broader",
      supportCount: 3,
      candidateSource: "llm",
      sourceResearchRouteKind: "search",
    });
    expect(typeof properties.queryHash).toBe("string");
    expect(typeof properties.termHash).toBe("string");
    expect(properties).not.toHaveProperty("query");
    expect(properties).not.toHaveProperty("term");
  });

  it("keeps compatibility query hashes bounded to legacy payloads without raw text", () => {
    trackSearchLanguageAwareLibrarySupplementViewedOnce({
      type: "user_search",
      data: {
        ownerPrincipalId: "principal-hash-boundary",
        documentId: "search-hash-boundary",
        query: "에이전트 기억",
        sort: "interest",
        resultCount: 7,
        visibleResultCount: 7,
        libraryGroundingApplied: true,
        libraryAnchorPaperCount: 2,
        languageAwareLibrarySupplementCount: 1,
      },
    });
    track({
      type: "spelling_correction",
      data: {
        ownerPrincipalId: "principal-hash-boundary",
        documentId: "search-hash-boundary",
        query: "retrival agent",
        correctedQuery: "retrieval agent",
      },
    });

    const supplement = trackCanonicalEventMock.mock.calls.find(
      ([name]) => name === "product.search_language_aware_library_supplement.viewed",
    )?.[1];
    const correction = trackCanonicalEventMock.mock.calls.find(
      ([name]) => name === "product.spelling_correction.clicked",
    )?.[1];

    expect(supplement?.properties).toMatchObject({ queryLength: 7 });
    expect(supplement?.properties.queryHash).toBeTypeOf("string");
    expect(supplement?.properties.queryHash).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
    expect(supplement?.properties).not.toHaveProperty("query");
    expect(correction?.properties.queryHash).toBeTypeOf("string");
    expect(correction?.properties.queryHash).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
    expect(correction?.properties.correctedQueryHash).toBeTypeOf("string");
    expect(correction?.properties.correctedQueryHash).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
    expect(correction?.properties).not.toHaveProperty("query");
    expect(correction?.properties).not.toHaveProperty("correctedQuery");
  });

  it("records viewed research terms only after the route view receives them", () => {
    const firstExecution = {
      executionId: "execution-a",
      ownerPrincipalId: "principal-1",
      documentId: "search-1",
      phase: "initial" as const,
      source: "llm" as const,
      candidateCount: 2,
    };
    const remountedExecution = { ...firstExecution, executionId: "execution-b" };
    expect(trackResearchTermsViewedOnce(firstExecution)).toBe(true);
    expect(trackResearchTermsViewedOnce(remountedExecution)).toBe(false);

    expect(trackCanonicalEventMock).toHaveBeenCalledTimes(1);
    expect(trackCanonicalEventMock).toHaveBeenCalledWith("product.research_terms.viewed", {
      actor: { type: "user", id: undefined },
      subject: {
        ownerPrincipalId: "principal-1",
        documentId: "search-1",
      },
      properties: {
        ownerPrincipalId: "principal-1",
        documentId: "search-1",
        phase: "initial",
        source: "llm",
        candidateCount: 2,
      },
    });
  });

  it("keeps fallback tracking alive when the canonical bridge throws", () => {
    trackCanonicalEventMock.mockImplementationOnce(() => {
      throw new Error("canonical unavailable");
    });

    expect(() => {
      track({
        type: "user_search",
        data: {
          ownerPrincipalId: "principal-1",
          documentId: "search-1",
          query: "graph retrieval",
          sort: "relevance",
          resultCount: 12,
          visibleResultCount: 10,
          libraryGroundingApplied: true,
          libraryAnchorPaperCount: 0,
        },
      });
    }).not.toThrow();
  });
});

describe("track canonical bridge route-view events", () => {
  beforeEach(resetTrackMocks);

  const paperContext = {
    ownerPrincipalId: "principal-1",
    documentId: "search-1",
    journeyContextId: "search-1",
    searchContextId: "search-1",
    paperId: "paper-1",
    title: "Paper",
    resultRank: 1,
    sourceSurface: "search_results" as const,
    hasPdf: true,
    evidenceAvailability: "available" as const,
  };

  it("bridges PDF, citation, and similar actions with one shared context shape", () => {
    track({
      type: "paper_pdf_open",
      data: {
        ...paperContext,
        openTarget: "moonlight_external",
        openElement: "pdf_button",
        rankBucket: "top_3",
        totalResultCount: 10,
        visibleResultCount: 10,
        year: 2024,
        citationCount: 12,
        referenceCount: 4,
        authorCount: 2,
      },
    });
    track({
      type: "citation_lineage_open",
      data: { ...paperContext, referenceCount: 4, citationCount: 12 },
    });
    track({ type: "similar_papers_discovery", data: paperContext });

    expect(trackCanonicalEventMock.mock.calls.map((call) => call[0])).toEqual([
      "pdf_opened",
      "citation_lineage_opened",
      "similar_papers_opened",
    ]);
    for (const [, payload] of trackCanonicalEventMock.mock.calls) {
      expect(payload.properties).toMatchObject({
        journey_context_id: "search-1",
        search_context_id: "search-1",
        paper_id: "paper-1",
        result_rank: 1,
        source_surface: "search_results",
        has_pdf: true,
        evidence_availability: "available",
      });
      expect(payload.properties).not.toHaveProperty("query");
      expect(payload.properties).not.toHaveProperty("queryHash");
    }
  });

  it("emits save and unsave only through committed-state events", () => {
    track({ type: "paper_review_toggle", data: { ...paperContext, reviewed: true } });
    track({ type: "paper_review_toggle", data: { ...paperContext, reviewed: false } });

    expect(trackCanonicalEventMock.mock.calls.map((call) => call[0])).toEqual([
      "paper_saved",
      "paper_unsaved",
    ]);
  });

  it("emits a gap report view once per viewer and shared report", () => {
    const event = {
      type: "gap_network_viewed" as const,
      data: {
        viewerPrincipalId: "viewer-once",
        documentId: "gap-once",
      },
    };

    expect(trackGapReportViewedOnce(event)).toBe(true);
    expect(trackGapReportViewedOnce(event)).toBe(false);
    expect(trackCanonicalEventMock.mock.calls.map((call) => call[0])).toEqual([
      "product.gap_report.viewed",
    ]);
  });

  it("emits one canonical action for each explicit gap analysis retry click", () => {
    trackGapAnalysisRetryClicked({ gapReportId: "gap-1", retryCount: 2 });

    expect(trackCanonicalEventMock).toHaveBeenCalledWith("gap_analysis_retry_clicked", {
      actor: { type: "user", id: undefined },
      subject: { gap_report_id: "gap-1" },
      properties: { gap_report_id: "gap-1", retry_count: 2 },
    });
    expect(trackCanonicalEventMock).toHaveBeenCalledOnce();
  });
});

describe("track canonical bridge commitment events", () => {
  beforeEach(() => {
    trackCanonicalEventMock.mockClear();
    getUserIdMock.mockReset();
    window.localStorage.clear();
  });

  it("bridges #41 product commitment events to canonical analytics", () => {
    track({
      type: "ai_comment_card_viewed",
      data: {
        ownerPrincipalId: "principal-1",
        documentId: "doc-1",
        reactionKey: "doc-1:block-1",
      },
    });
    track({ type: "about_commitment_link_clicked", data: { target: "promises" } });
    track({
      type: "gap_view_margin_viewed",
      data: {
        viewerPrincipalId: "principal-1",
        researchRoutePayloadId: "gap-1",
        hasEdgeEvidence: true,
      },
    });
    track({
      type: "gap_view_prepared_reaction_viewed",
      data: {
        viewerPrincipalId: "principal-1",
        researchRoutePayloadId: "gap-1",
        preparedReactionCount: 3,
      },
    });
    expect(trackCanonicalEventMock.mock.calls.map((call) => call[0])).toEqual([
      "product.ai_comment_card.viewed",
      "product.researcher_prose_promises_page.clicked",
      "product.gap_view_margin.viewed",
      "product.gap_view_prepared_reaction.viewed",
    ]);
  });

  it("emits AI comment expansion without collecting generated prose", () => {
    trackAiCommentCardExpandClicked({
      ownerPrincipalId: "principal-1",
      documentId: "doc-1",
      reactionKey: "doc-1:block-1:2026-07-16",
    });

    expect(trackCanonicalEventMock).toHaveBeenCalledWith(
      "product.ai_comment_card_expand.clicked",
      expect.objectContaining({
        subject: {
          ownerPrincipalId: "principal-1",
          documentId: "doc-1",
        },
        properties: {
          ownerPrincipalId: "principal-1",
          documentId: "doc-1",
          reactionKey: "doc-1:block-1:2026-07-16",
        },
      }),
    );
    expect(JSON.stringify(trackCanonicalEventMock.mock.calls[0])).not.toContain("body");
  });

  it("suppresses repeated one-shot interaction keys before canonical emission", () => {
    const event = {
      type: "ai_comment_card_viewed" as const,
      data: {
        ownerPrincipalId: "principal-1",
        documentId: "doc-1",
        reactionKey: "doc-1:block-once",
      },
    };

    expect(trackInteractionOnce("test-ai-card-once", event)).toBe(true);
    expect(trackInteractionOnce("test-ai-card-once", event)).toBe(false);

    expect(trackCanonicalEventMock.mock.calls.map((call) => call[0])).toEqual([
      "product.ai_comment_card.viewed",
    ]);
  });

  it("keeps shared gap view one-shot identities separate for each viewer", () => {
    for (const viewerPrincipalId of ["viewer-1", "viewer-2"]) {
      trackGapViewMarginViewedOnce({
        type: "gap_view_margin_viewed",
        data: { viewerPrincipalId, researchRoutePayloadId: "gap-shared", hasEdgeEvidence: true },
      });
      trackGapViewPreparedReactionViewedOnce({
        type: "gap_view_prepared_reaction_viewed",
        data: { viewerPrincipalId, researchRoutePayloadId: "gap-shared", preparedReactionCount: 2 },
      });
    }

    expect(trackCanonicalEventMock.mock.calls.map((call) => call[0])).toEqual([
      "product.gap_view_margin.viewed",
      "product.gap_view_prepared_reaction.viewed",
      "product.gap_view_margin.viewed",
      "product.gap_view_prepared_reaction.viewed",
    ]);
  });
});

describe("track canonical research auth challenge events", () => {
  beforeEach(resetTrackMocks);
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("emits the visible auth challenge state transition", async () => {
    await trackResearchAuthChallengeViewed();
    await trackResearchAuthChallengeViewed("moonlight_session_invalid");

    expect(trackCanonicalEventMock.mock.calls).toEqual([
      [
        "product.research_auth_challenge.viewed",
        {
          actor: { type: "user", id: undefined },
          subject: {},
          properties: { source: "library_bootstrap_401" },
        },
      ],
      [
        "product.research_auth_challenge.viewed",
        {
          actor: { type: "user", id: undefined },
          subject: {},
          properties: { source: "moonlight_session_invalid" },
        },
      ],
    ]);
  });
});
