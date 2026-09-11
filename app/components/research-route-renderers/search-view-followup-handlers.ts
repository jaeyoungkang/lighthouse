"use client";

// @promise promise:search-results-suggest-english-terms
// @promise promise:similar-papers-discovery
// @promise promise:inline-analysis-auto-run
// @promise promise:gap-led-next-search
// @promise promise:citation-lineage
// @promise promise:graph-neighbor-papers
// @aspect aspect:immediate-navigation
// @check acceptance-check:search-results-suggest-english-terms-click-feedback
// @check acceptance-check:similar-papers-discovery-author-topic-search
// @check acceptance-check:inline-analysis-auto-run-search-click-feedback
// @check acceptance-check:gap-led-next-search-click-feedback
// @check acceptance-check:citation-lineage-keyword-click-feedback
// @check acceptance-check:graph-neighbor-papers-keyword-click-feedback

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { EnglishTermCandidate, SearchMetadata } from "@/app/domain/research-route-payload";
import type { PaperCore } from "@/app/domain/paper";
import { useLibraryAvailabilityStore } from "@/app/stores/library-availability-store";
import {
  runWithSearchActivationCleanup,
  useSearchFollowupActivation,
} from "@/app/components/research/search-followup-activation";
import { buildSearchRoutePageRoute, type ConditionRouteBuildResult } from "@/app/lib/api-routes";
import { getCurrentUsableInlineAnalysisRecord } from "@/app/lib/inline-analysis";
import { buildSimilarPaperQuery } from "./search-view.helpers";
import type { FollowupActivationEvent, SearchFollowupSeedOptions } from "./search-view.helpers";
import { navigateFollowupRoute, shouldOpenFollowupInNewWindow } from "./view-followup-window";

function useAcceptedSearchFollowupNavigation() {
  const router = useRouter();
  const { acceptConditionUrl, clearIfStillPending, startActivation } =
    useSearchFollowupActivation();
  const pushRoute = useCallback(
    (route: string) => {
      router.push(route);
    },
    [router],
  );

  return useCallback(
    (route: string, query: string, event?: FollowupActivationEvent): boolean => {
      acceptConditionUrl();
      const activation = shouldOpenFollowupInNewWindow(event)
        ? null
        : startActivation({ route, query });
      return runWithSearchActivationCleanup({
        activation,
        clearIfStillPending,
        navigate: () => navigateFollowupRoute(route, pushRoute, event),
      });
    },
    [acceptConditionUrl, clearIfStillPending, pushRoute, startActivation],
  );
}

export function useFindSimilarHandler(params: {
  documentId: string;
  ownerPrincipalId: string;
  // 검색 view와 인용 계보 view가 함께 쓰므로 `papers`만 요구한다 (similar 검색 query는
  // 해당 논문의 cached inline analysis가 있으면 사용한다).
  metadata: Pick<SearchMetadata, "papers">;
}) {
  const { metadata } = params;
  const libraryContextAvailable = useLibraryAvailabilityStore((state) => state.available);
  const { reportConditionUrlRejected } = useSearchFollowupActivation();
  const navigateAcceptedRoute = useAcceptedSearchFollowupNavigation();

  return useCallback(
    (paper: PaperCore, event?: FollowupActivationEvent) => {
      const paperWithReview = metadata.papers.find((p) => p.paperId === paper.paperId);
      const inlineAnalysis = paperWithReview
        ? getCurrentUsableInlineAnalysisRecord(paperWithReview)
        : undefined;
      const query = buildSimilarPaperQuery(paper, inlineAnalysis);

      // 클릭은 서버 왕복을 기다리지 않고 즉시 entry route로 이동한다
      // (aspect:immediate-navigation). seed 논문의 정체성·표시 맥락은 transient
      // entry URL로 운반되어 서버 ResearchRoutePayload metadata에 보존된다.
      const route = buildSearchRoutePageRoute({
        q: query,
        libraryContextAvailable: libraryContextAvailable ? true : undefined,
        entry: "similar",
        seedPaper: paper,
      });
      if (!route.ok) {
        reportConditionUrlRejected();
        return false;
      }
      return navigateAcceptedRoute(route.route, query, event);
    },
    [libraryContextAvailable, metadata, navigateAcceptedRoute, reportConditionUrlRejected],
  );
}

export function useSearchTermHandler() {
  const { reportConditionUrlRejected } = useSearchFollowupActivation();
  const libraryContextAvailable = useLibraryAvailabilityStore((state) => state.available);
  const navigateAcceptedRoute = useAcceptedSearchFollowupNavigation();
  return useCallback(
    (term: string, seeds?: SearchFollowupSeedOptions, event?: FollowupActivationEvent) => {
      const query = term;
      if (!query.trim()) return false;

      // 연구 용어·다른 입장 클릭은 서버 왕복을 기다리지 않고 즉시 `/search?q=`
      // route로 이동한다(aspect:immediate-navigation). 연구 용어 seed만 URL
      // 파라미터로 운반된다. `다른 입장` 목적지는 query를 독립 검색 조건으로
      // 취급하고 출발 논문·입장·쟁점 trace를 운반하지 않는다. detached
      // (Ctrl/Cmd/가운데 클릭)는 같은 URL을 새 브라우저 탭에서 연다.
      // @check acceptance-check:search-results-suggest-english-terms-term-seed-preserved
      // @check acceptance-check:search-results-suggest-english-terms-prefilled-search
      const route = buildSearchTermFollowupRoute({
        query,
        seeds,
        libraryContextAvailable,
      });
      if (!route.ok) {
        reportConditionUrlRejected();
        return false;
      }
      return navigateAcceptedRoute(route.route, query, event);
    },
    [libraryContextAvailable, navigateAcceptedRoute, reportConditionUrlRejected],
  );
}

export function buildSearchTermFollowupRoute(params: {
  query: string;
  seeds?: SearchFollowupSeedOptions;
  libraryContextAvailable: boolean;
}): ConditionRouteBuildResult {
  return buildSearchRoutePageRoute({
    q: params.query,
    // 클라이언트가 이미 아는 availability(true)를 entry URL로 전달해 destination
    // search route가 reviewed-papers 조회 + live Moonlight fetch를 다시 하지 않게
    // 한다. false는 스토어 초기값과 구분이 안 되므로 보내지 않는다.
    libraryContextAvailable: params.libraryContextAvailable ? true : undefined,
    entry: params.seeds?.entry ?? "term",
    termSeed: params.seeds?.termSeed,
  });
}

export function buildTermSeed(params: {
  sourceQuery: string;
  candidate: EnglishTermCandidate;
}): SearchMetadata["termSeed"] {
  return {
    sourceQuery: params.sourceQuery,
    term: params.candidate.term,
    candidateType: params.candidate.type,
    supportCount: params.candidate.supportCount,
  };
}
