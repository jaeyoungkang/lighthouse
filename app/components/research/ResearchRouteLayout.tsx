// @promise promise:route-view-ai-comment-inline-surface
// @promise promise:research-route-cap-feedback
// @promise promise:search-results-fast-window
// @aspect aspect:route-view-ai-reaction-rules
// @aspect aspect:visible-explanation-sufficiency
// @aspect aspect:document-content-width-governance
// @aspect aspect:research-route-visual-hierarchy
// @check acceptance-check:research-route-cap-feedback-route-search-visible
// @check acceptance-check:search-results-fast-window-result-basis-visible
// @check acceptance-check:search-results-fast-window-post-search-layout-about
// @check acceptance-check:route-view-ai-comment-inline-surface-embedded-content-rail
// @check acceptance-check:route-view-ai-comment-inline-surface-consistent-document-layout
// @check acceptance-check:route-view-ai-comment-inline-surface-active-document-content-only
// @check acceptance-check:route-view-ai-comment-inline-surface-empty-state-no-reserve
// @check acceptance-check:route-view-ai-comment-inline-surface-generation-pending-visible

"use client";

import { memo } from "react";
import type { ReactNode } from "react";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { t } from "@/app/i18n/message-access";
import { AgentPanel } from "@/app/components/research/AgentPanel";
import {
  RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS,
  RESEARCH_ROUTE_ROUTE_PANEL_MAX_WIDTH_CLASS,
} from "@/app/components/research/research-route-layout.shared";
import { InitialSearchScreen } from "@/app/components/research/InitialSearchScreen";
import { useResearchRouteLibraryState } from "@/app/components/research/research-route-library-context";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

interface ResearchRouteLayoutProps {
  currentView: ResearchRoutePayload | null;
  renderViewBody: (view: ResearchRoutePayload, reactionSlot: ReactNode) => ReactNode;
  /** Empty `/search` start route: render the route-owned initial search screen. */
  initialSearchEntry?: boolean;
}

export function ResearchRoutePayloadRendererLoading() {
  const visibleView = useResearchRouteStore((state) => state.currentView);
  const visibleViewId = visibleView?.id ?? null;
  const hasReactionContent = useResearchRouteStore((state) => {
    if (!visibleViewId) return false;
    if (state.currentView?.id !== visibleViewId) return false;
    return state.reactionCardHistory.length > 0;
  });
  const isRegenerating = useResearchRouteStore((state) =>
    visibleViewId && state.currentView?.id === visibleViewId
      ? state.pendingRouteAiCommentRegeneration
      : false,
  );
  const isReactionLoading = isRegenerating;
  const showAgentPanel =
    visibleView != null &&
    shouldRenderAgentPanel(visibleView) &&
    (hasReactionContent || isReactionLoading);
  const reactionSlot = showAgentPanel ? (
    <div
      className="w-full max-w-full min-w-0 overflow-hidden"
      data-testid="research-route-inline-reaction"
    >
      <AgentPanel documentId={visibleViewId} isLoading={isReactionLoading} />
    </div>
  ) : null;

  return (
    <div
      className={RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS}
      data-testid="document-renderer-loading-shell"
    >
      {reactionSlot}
      <div
        className="lh-type-metadata lh-tone-tertiary flex min-h-[40vh] items-center justify-center text-center"
        data-testid="document-renderer-loading"
        role={reactionSlot ? undefined : "status"}
        aria-live={reactionSlot ? undefined : "polite"}
      >
        {t("search.label.document-renderer.loading")}
      </div>
    </div>
  );
}

function shouldRenderAgentPanel(view: ResearchRoutePayload): boolean {
  return view.type !== "gap_network";
}

export function ResearchRouteLayout(props: ResearchRouteLayoutProps) {
  return <SingleViewLayout {...props} />;
}

function SingleViewLayout({
  currentView,
  renderViewBody,
  initialSearchEntry = false,
}: ResearchRouteLayoutProps) {
  const routeLibraryState = useResearchRouteLibraryState();

  return (
    <div className="bg-surface-research min-h-full px-4 py-2 sm:px-6 sm:py-3 lg:px-8 lg:py-4">
      <section
        className={`mx-auto flex w-full min-w-0 flex-col ${RESEARCH_ROUTE_ROUTE_PANEL_MAX_WIDTH_CLASS}`}
      >
        {currentView ? (
          <ResearchRoutePayloadPanel view={currentView} renderViewBody={renderViewBody} />
        ) : initialSearchEntry ? (
          <InitialSearchScreen
            libraryContextAvailable={routeLibraryState.libraryContextAvailable}
          />
        ) : null}
      </section>
    </div>
  );
}

const ResearchRoutePayloadPanel = memo(function ResearchRoutePayloadPanel({
  view,
  renderViewBody,
}: {
  view: ResearchRoutePayload;
  renderViewBody: (view: ResearchRoutePayload, reactionSlot: ReactNode) => ReactNode;
}) {
  const hasReactionContent = useResearchRouteStore((state) => {
    if (state.currentView?.id !== view.id) return false;
    return state.reactionCardHistory.length > 0;
  });
  const isRegenerating = useResearchRouteStore(
    (state) => state.currentView?.id === view.id && state.pendingRouteAiCommentRegeneration,
  );
  const isReactionLoading = isRegenerating;
  const showAgentPanel = shouldRenderAgentPanel(view) && (isReactionLoading || hasReactionContent);

  const panelLayoutWidthClass = RESEARCH_ROUTE_ROUTE_PANEL_MAX_WIDTH_CLASS;
  const mainPanelClass = "min-w-0";
  const reactionSlot = showAgentPanel ? (
    <div
      className="w-full max-w-full min-w-0 overflow-hidden"
      data-testid="research-route-inline-reaction"
    >
      <AgentPanel documentId={view.id} isLoading={isReactionLoading} />
    </div>
  ) : null;

  return (
    <div
      className={[
        "mx-auto",
        "grid min-h-[calc(100dvh-var(--lh-header-offset))] w-full min-w-0 grid-cols-1",
        "lg:grid-cols-[minmax(0,1fr)]",
        panelLayoutWidthClass,
      ]
        .filter(Boolean)
        .join(" ")}
      data-doc-id={view.id}
      data-testid="document-panel-layout"
      data-panel-width-mode="inline"
    >
      <div className={mainPanelClass} data-testid="document-panel-main">
        {renderViewBody(view, reactionSlot)}
      </div>
    </div>
  );
});
