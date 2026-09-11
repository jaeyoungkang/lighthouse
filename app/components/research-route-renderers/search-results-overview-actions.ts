// @promise promise:search-results-suggest-english-terms
// @check acceptance-check:search-results-suggest-english-terms-prefilled-search

import type { SearchTermDiscoveryState } from "@/app/domain/research-route-payload";
import type { SearchResultsOverviewTerm } from "@/app/components/research/search-results-overview-model";
import { trackSearchTermCandidateClicked } from "@/app/lib/track";
import type { FollowupActivationEvent, SearchTermFollowupHandler } from "./search-view.helpers";

export function commitSearchResultsOverviewTerm({
  candidate,
  ownerPrincipalId,
  documentId,
  query,
  candidateSource,
  sourceResearchRouteKind,
  onSearchTerm,
  event,
}: {
  candidate: SearchResultsOverviewTerm;
  ownerPrincipalId: string;
  documentId: string;
  query: string;
  candidateSource?: SearchTermDiscoveryState["source"];
  sourceResearchRouteKind: "search" | "citation_lineage" | "graph_neighbors";
  onSearchTerm?: SearchTermFollowupHandler;
  event?: FollowupActivationEvent;
}) {
  trackSearchTermCandidateClicked({
    type: "search_term_candidate",
    data: {
      ownerPrincipalId: ownerPrincipalId,
      documentId,
      query,
      term: candidate.term,
      candidateType: candidate.candidateType,
      supportCount: candidate.supportCount,
      candidateSource,
      sourceResearchRouteKind,
    },
  });
  onSearchTerm?.(
    candidate.term,
    {
      termSeed: {
        sourceQuery: query,
        term: candidate.term,
        candidateType: candidate.candidateType,
        supportCount: candidate.supportCount,
      },
    },
    event,
  );
}
