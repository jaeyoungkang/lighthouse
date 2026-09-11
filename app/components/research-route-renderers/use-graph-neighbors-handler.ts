// @promise promise:graph-neighbor-papers
// @promise promise:citation-lineage
// @check acceptance-check:graph-neighbor-papers-neighbor-card-action-parity
// @check acceptance-check:graph-neighbor-papers-reaction-own-view

"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { PaperCore } from "@/app/domain/paper";
import { buildCitationSeedPageRoute, buildSimilarSeedPageRoute } from "@/app/lib/api-routes";
import {
  runWithSearchActivationCleanup,
  useSearchFollowupActivation,
} from "@/app/components/research/search-followup-activation";
import { type FollowupActivationEvent } from "./search-view.helpers";
import { navigateFollowupRoute, shouldOpenFollowupInNewWindow } from "./view-followup-window";
import type { EmitSystemEvent } from "./use-search-view-controller.shared";

function isGraphNeighborsForceRefetchOption(
  value: { forceRefetch?: boolean } | FollowupActivationEvent | undefined,
): value is { forceRefetch?: boolean } {
  return Boolean(value && "forceRefetch" in value);
}

// Citation lineage entry: click navigates immediately to a seed URL. The
// destination route executes from URL seed context instead of looking up an
// owned source ResearchRoutePayload, so this handler does not fetch, add, or emit.
export function useCitationLineageHandler(params: {
  sourceDocumentId: string;
  ownerPrincipalId: string;
}) {
  void params.sourceDocumentId;
  void params.ownerPrincipalId;
  const router = useRouter();
  const { acceptConditionUrl, clearIfStillPending, reportConditionUrlRejected, startActivation } =
    useSearchFollowupActivation();

  const handleOpenCitationLineage = useCallback(
    (paper: PaperCore, event?: FollowupActivationEvent) => {
      const refIds = paper.referenceIds ?? [];
      const citIds = paper.citationIds ?? [];
      const canLazyFetchCitationLineage =
        (paper.referenceCount ?? 0) > 0 ||
        paper.citationCount > 0 ||
        paper.referenceAvailability?.available === false ||
        paper.citationAvailability?.available === false ||
        paper.referenceAvailability?.truncated === true ||
        paper.citationAvailability?.truncated === true;
      if (refIds.length === 0 && citIds.length === 0 && !canLazyFetchCitationLineage) return false;

      const route = buildCitationSeedPageRoute(paper);
      if (!route.ok) {
        reportConditionUrlRejected();
        return false;
      }
      acceptConditionUrl();
      const activation = shouldOpenFollowupInNewWindow(event)
        ? null
        : startActivation({ route: route.route, query: "" });
      return runWithSearchActivationCleanup({
        activation,
        clearIfStillPending,
        navigate: () =>
          navigateFollowupRoute(
            route.route,
            (route) => {
              router.push(route);
            },
            event,
          ),
      });
    },
    [acceptConditionUrl, clearIfStillPending, reportConditionUrlRejected, router, startActivation],
  );

  return { handleOpenCitationLineage, citationLineageLoadingPaperId: null as string | null };
}

// 비슷한 논문 진입은 즉시 `/similar?seedPaperId=` seed route로 이동한다.
// degraded 재시도도 같은 조건 URL을 다시 실행하므로 클라이언트가 관계 view를
// 생성하거나 현재 route-owned view를 swap하지 않는다.
export function useGraphNeighborsHandler(params: {
  sourceDocumentId: string;
  emitSystemEvent: EmitSystemEvent;
}) {
  void params.emitSystemEvent;
  const router = useRouter();
  const { acceptConditionUrl, clearIfStillPending, reportConditionUrlRejected, startActivation } =
    useSearchFollowupActivation();
  const [graphNeighborsLoadingPaperId, setGraphNeighborsLoadingPaperId] = useState<string | null>(
    null,
  );

  const handleOpenGraphNeighbors = useCallback(
    (paper: PaperCore, optsOrEvent?: { forceRefetch?: boolean } | FollowupActivationEvent) => {
      const opts = isGraphNeighborsForceRefetchOption(optsOrEvent) ? optsOrEvent : undefined;
      const event = isGraphNeighborsForceRefetchOption(optsOrEvent) ? undefined : optsOrEvent;

      if (graphNeighborsLoadingPaperId) return false;
      if (opts?.forceRefetch) {
        setGraphNeighborsLoadingPaperId(paper.paperId);
      }
      const route = buildSimilarSeedPageRoute(paper);
      if (!route.ok) {
        reportConditionUrlRejected();
        setGraphNeighborsLoadingPaperId(null);
        return false;
      }
      acceptConditionUrl();
      const activation = shouldOpenFollowupInNewWindow(event)
        ? null
        : startActivation({ route: route.route, query: "" });
      const didNavigate = runWithSearchActivationCleanup({
        activation,
        clearIfStillPending,
        navigate: () =>
          navigateFollowupRoute(
            route.route,
            (route) => {
              router.push(route);
            },
            event,
          ),
      });
      if (opts?.forceRefetch) {
        setGraphNeighborsLoadingPaperId(null);
      }
      return didNavigate;
    },
    [
      acceptConditionUrl,
      clearIfStillPending,
      graphNeighborsLoadingPaperId,
      reportConditionUrlRejected,
      router,
      startActivation,
    ],
  );

  return { handleOpenGraphNeighbors, graphNeighborsLoadingPaperId };
}
