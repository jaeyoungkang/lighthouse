export type PdfOpenFailedReason =
  | "publisher_blocked"
  | "request_failed"
  | "invalid_response"
  | "network_error";

export type SearchRequestContext = "initial" | "query_transition" | "seeded_followup";

export type InteractionEvent =
  | { type: "message_sent"; data: { ownerPrincipalId: string; textLength: number } }
  | { type: "proposal_respond"; data: { ownerPrincipalId: string; response: string } }
  | {
      type: "user_search";
      data: {
        ownerPrincipalId: string;
        documentId: string;
        journeyContextId?: string;
        searchContextId?: string;
        query: string;
        sort?: string;
        year?: string;
        resultCount: number;
        visibleResultCount: number;
        libraryGroundingApplied: boolean;
        libraryAnchorPaperCount: number;
        languageAwareLibrarySupplementCount?: number;
        requestContext?: SearchRequestContext;
      };
    }
  | {
      type: "user_tab_switch";
      data: {
        ownerPrincipalId: string;
        docId: string;
        panel: "left" | "right";
        docType: string;
        title: string;
      };
    }
  | {
      type: "paper_review_toggle";
      data: {
        ownerPrincipalId: string;
        documentId: string;
        journeyContextId: string;
        searchContextId: string;
        paperId: string;
        title: string;
        resultRank: number;
        sourceSurface: "search_results" | "citation_lineage" | "graph_neighbors";
        hasPdf: boolean;
        evidenceAvailability: "available" | "partial" | "unavailable" | "unknown";
        reviewed: boolean;
      };
    }
  | {
      type: "paper_pdf_open";
      data: {
        ownerPrincipalId: string;
        journeyContextId: string;
        searchContextId: string;
        paperId: string;
        title: string;
        openTarget: "moonlight_external";
        openElement: "pdf_button";
        resultRank: number;
        rankBucket: "top_3" | "top_10" | "below_10";
        totalResultCount: number;
        visibleResultCount: number;
        hasPdf: boolean;
        year: number | null;
        citationCount: number;
        referenceCount: number;
        authorCount: number;
        documentId?: string;
        queryHash?: string;
        sort?: string;
        yearFilter?: string;
        pdfHostKind?: string;
        sourceSurface?: string;
        evidenceAvailability: "available" | "partial" | "unavailable" | "unknown";
      };
    }
  | {
      type: "pdf_open_failed";
      data: {
        ownerPrincipalId: string;
        paperId: string;
        title?: string;
        reason: PdfOpenFailedReason;
      };
    }
  | {
      type: "gap_network_open";
      data: {
        ownerPrincipalId: string;
        documentId: string;
        lens?: string;
        sourceType?: string;
      };
    }
  | {
      type: "gap_report_open";
      data: {
        ownerPrincipalId: string;
        documentId: string;
        lens?: string;
        sourceType?: string;
      };
    }
  | {
      type: "gap_network_viewed";
      data: {
        viewerPrincipalId: string;
        documentId: string;
      };
    }
  | {
      type: "gap_led_next_search_clicked";
      data: {
        viewerPrincipalId: string;
        documentId?: string;
        seedKind?: "cluster" | "concept" | "gap";
      };
    }
  | {
      type: "document_close";
      data: { ownerPrincipalId: string; documentId: string; documentType: string };
    }
  | { type: "document_create"; data: { ownerPrincipalId: string; documentType: string } }
  | {
      type: "ai_comment_regenerate_clicked";
      data: { ownerPrincipalId: string; documentId: string; documentType: string };
    }
  | {
      type: "citation_lineage_open";
      data: {
        ownerPrincipalId: string;
        journeyContextId: string;
        searchContextId: string;
        paperId: string;
        title: string;
        resultRank: number;
        sourceSurface: "search_results" | "citation_lineage" | "graph_neighbors";
        hasPdf: boolean;
        evidenceAvailability: "available" | "partial" | "unavailable" | "unknown";
        referenceCount: number;
        citationCount: number;
      };
    }
  | {
      type: "citation_lineage_viewed";
      data: {
        ownerPrincipalId: string;
        paperId: string;
        title: string;
        referenceCount: number;
        citationCount: number;
      };
    }
  | {
      type: "similar_papers_discovery";
      data: {
        ownerPrincipalId: string;
        documentId: string;
        journeyContextId: string;
        searchContextId: string;
        paperId: string;
        title: string;
        resultRank: number;
        sourceSurface: "search_results" | "citation_lineage" | "graph_neighbors";
        hasPdf: boolean;
        evidenceAvailability: "available" | "partial" | "unavailable" | "unknown";
      };
    }
  | {
      type: "search_term_candidate";
      data: {
        ownerPrincipalId: string;
        documentId: string;
        query: string;
        term: string;
        candidateType: "direct" | "broader" | "narrower" | "variant";
        supportCount: number;
        candidateSource?: "llm";
        sourceResearchRouteKind: "search" | "citation_lineage" | "graph_neighbors";
        sourceDocumentType?: "search" | "citation_lineage" | "graph_neighbors";
      };
    }
  | {
      type: "different_position_search";
      data: {
        ownerPrincipalId: string;
        documentId: string;
        paperId: string;
        queryHash: string;
        queryLength: number;
      };
    }
  | {
      type: "gap_overlay_decision_evidence";
      data: { documentId?: string | null; selectionKind?: string };
    }
  | {
      type: "spelling_correction";
      data: {
        ownerPrincipalId: string;
        documentId: string;
        query: string;
        correctedQuery: string;
      };
    }
  | {
      type: "ai_comment_card_viewed";
      data: { ownerPrincipalId: string; documentId: string; reactionKey: string };
    }
  | { type: "about_commitment_link_clicked"; data: { target: "promises" | "changes" } }
  | {
      type: "gap_view_margin_viewed";
      data: { viewerPrincipalId: string; researchRoutePayloadId: string; hasEdgeEvidence: boolean };
    }
  | {
      type: "gap_view_prepared_reaction_viewed";
      data: {
        viewerPrincipalId: string;
        researchRoutePayloadId: string;
        preparedReactionCount: number;
      };
    };
