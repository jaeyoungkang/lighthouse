"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import {
  ResearchRouteRuntime,
  type ResearchRouteRuntimeProps,
} from "@/app/components/research/ResearchRouteRuntime";
import { ResearchRoutePayloadRendererLoading } from "@/app/components/research/ResearchRouteLayout";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";

type RouteRuntimeProps = Omit<ResearchRouteRuntimeProps, "renderViewBody">;

interface ViewRendererWithReactionProps {
  document: ResearchRoutePayload;
  reactionSlot: ReactNode;
}

interface ViewRendererProps {
  document: ResearchRoutePayload;
  gapAdmissionBlocked?: boolean;
}

const SearchViewRenderer = dynamic<ViewRendererWithReactionProps>(
  () =>
    import("@/app/components/research-route-renderers/SearchView").then((mod) => mod.SearchView),
  { loading: ResearchRoutePayloadRendererLoading },
);

const CitationLineageViewRenderer = dynamic<ViewRendererWithReactionProps>(
  () =>
    import("@/app/components/research-route-renderers/CitationLineageView").then(
      (mod) => mod.CitationLineageView,
    ),
  { loading: ResearchRoutePayloadRendererLoading },
);

const GraphNeighborsViewRenderer = dynamic<ViewRendererWithReactionProps>(
  () =>
    import("@/app/components/research-route-renderers/GraphNeighborsView").then(
      (mod) => mod.GraphNeighborsView,
    ),
  { loading: ResearchRoutePayloadRendererLoading },
);

const GapNetworkViewRenderer = dynamic<ViewRendererProps>(
  () =>
    import("@/app/components/research-route-renderers/GapNetworkView").then(
      (mod) => mod.GapNetworkView,
    ),
  { loading: ResearchRoutePayloadRendererLoading },
);

export function SearchResearchRouteRuntime(props: RouteRuntimeProps) {
  return (
    <ResearchRouteRuntime
      {...props}
      renderViewBody={(view, reactionSlot) => (
        <SearchViewRenderer document={view} reactionSlot={reactionSlot} />
      )}
    />
  );
}

export function CitationResearchRouteRuntime(props: RouteRuntimeProps) {
  return (
    <ResearchRouteRuntime
      {...props}
      renderViewBody={(view, reactionSlot) => (
        <CitationLineageViewRenderer document={view} reactionSlot={reactionSlot} />
      )}
    />
  );
}

export function SimilarResearchRouteRuntime(props: RouteRuntimeProps) {
  return (
    <ResearchRouteRuntime
      {...props}
      renderViewBody={(view, reactionSlot) => (
        <GraphNeighborsViewRenderer document={view} reactionSlot={reactionSlot} />
      )}
    />
  );
}

export function GapResearchRouteRuntime({
  gapAdmissionBlocked = false,
  ...runtimeProps
}: RouteRuntimeProps & { gapAdmissionBlocked?: boolean }) {
  return (
    <ResearchRouteRuntime
      {...runtimeProps}
      // `key`로 report 정체성마다 remount한다. GapNetworkView는 마운트 시 한 번만
      // 잡히는 애니메이션 클럭(startedPending/elapsedMs)을 들고 있어, 같은 runtime
      // 인스턴스가 다른 gap report(view.id)로 재사용되면 이전 클럭이 남아 staged
      // pacing이 틀어진다. view.id는 in-place build lifecycle(patchCurrentView)에서는
      // 그대로라 진행 중 클럭은 보존되고, 다른 report로 바뀔 때만 리셋된다.
      renderViewBody={(view) => (
        <GapNetworkViewRenderer
          key={view.id}
          document={view}
          gapAdmissionBlocked={gapAdmissionBlocked}
        />
      )}
    />
  );
}
