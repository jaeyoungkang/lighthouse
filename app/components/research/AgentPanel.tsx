"use client";

// @aspect aspect:visible-explanation-sufficiency
// @aspect aspect:knowledge-map-followup-surface
// @aspect aspect:progressive-content-spatial-stability
// @aspect aspect:research-route-visual-hierarchy
// @promise promise:route-view-ai-comment-inline-surface
// @promise promise:gap-network-detection-from-search
// @promise promise:search-reaction-summarizes-terrain
// @promise promise:citation-lineage
// @promise promise:graph-neighbor-papers
// @promise promise:search-results-fast-window
// @promise promise:search-results-suggest-english-terms
// @check acceptance-check:route-view-ai-comment-inline-surface-embedded-content-rail
// @check acceptance-check:route-view-ai-comment-inline-surface-owned-followup-action
// @check acceptance-check:route-view-ai-comment-inline-surface-regenerate-preserves-card
// @check acceptance-check:route-view-ai-comment-inline-surface-bounded-preview-flow
// @check acceptance-check:gap-network-detection-from-search-citation-source
// @check acceptance-check:search-results-fast-window-year-distribution
// @check acceptance-check:search-results-suggest-english-terms-result-basis

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { RouteAiComment } from "@/app/domain/route-ai-comment";
import { getResearchRouteViewerPrincipalId } from "@/app/domain/research-route-payload";
import { DisclosureChevron } from "@/app/components/DisclosureChevron";
import { InlinePendingReaction } from "@/app/components/research/agent-panel-frame";
import { INLINE_AI_COMMENT_GENERATED_REGION_CLASS } from "@/app/components/research/inline-ai-comment-treatment";
import { buildRouteAiCommentGenerationCommand } from "@/app/components/research/research-route-runtime.helpers";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { t } from "@/app/i18n/message-access";
import { useCollapsedOverflow } from "@/app/components/use-collapsed-overflow";
import {
  trackAiCommentCardExpandClicked,
  trackAiCommentCardViewedOnce,
  trackAiCommentRegenerateClicked,
} from "@/app/lib/track";

const EMPTY_REACTION_CARDS: RouteAiComment[] = [];

const BlockCard = memo(function BlockCard({
  block,
  fillAvailableSpace = false,
  footerAction,
  inlineBodyAppendSlot,
  onExpand,
}: {
  block: RouteAiComment;
  fillAvailableSpace?: boolean;
  footerAction?: ReactNode;
  inlineBodyAppendSlot?: ReactNode;
  onExpand?: (block: RouteAiComment) => void;
}) {
  const bodyId = useId();
  const [expanded, setExpanded] = useState(false);
  const { ref: bodyRef, isOverflowing } = useCollapsedOverflow<HTMLParagraphElement>({
    contentKey: block.body,
    collapsed: !expanded,
  });

  return (
    <article
      className={`flex w-full max-w-full min-w-0 flex-col overflow-hidden ${
        fillAvailableSpace ? "flex-1" : ""
      }`}
      data-testid="agent-panel-reaction-card"
      data-layout="inline"
    >
      <p
        ref={bodyRef}
        id={bodyId}
        className={`lh-type-reading-body lh-tone-primary min-w-0 break-words whitespace-pre-wrap ${
          expanded ? "" : "line-clamp-3"
        }`}
        data-testid="agent-panel-reaction-body"
      >
        {block.body}
      </p>
      {inlineBodyAppendSlot ? (
        <div className="mt-2 min-w-0" data-testid="agent-panel-inline-body-append-slot">
          {inlineBodyAppendSlot}
        </div>
      ) : null}
      {isOverflowing || footerAction ? (
        <div
          className={`flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 ${
            fillAvailableSpace ? "mt-auto pt-1.5" : "mt-1.5"
          }`}
          data-testid="agent-panel-comment-footer"
        >
          {isOverflowing ? (
            <button
              type="button"
              className="lh-type-control-label lh-tone-control hover:text-foreground inline-flex w-fit items-center underline-offset-4 hover:underline"
              aria-expanded={expanded}
              aria-controls={bodyId}
              data-testid="agent-panel-reaction-disclosure"
              onClick={() => {
                if (!expanded) onExpand?.(block);
                setExpanded(!expanded);
              }}
            >
              {t(
                expanded
                  ? "surface.label.agent-panel.reactionCard.collapse"
                  : "surface.label.agent-panel.reactionCard.expand",
              )}
              <DisclosureChevron
                className={`ml-1 h-3 w-3 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                testId="agent-panel-reaction-disclosure-icon"
              />
            </button>
          ) : null}
          {footerAction}
        </div>
      ) : null}
    </article>
  );
});

const AgentPanelExpandedContent = memo(function AgentPanelExpandedContent({
  hasPanelContent,
  isLoading,
  isRegenerating,
  onRegenerate,
  onExpand,
  visibleBlocks,
  inlineBodyAppendSlot,
  reactionScopeKey,
}: {
  hasPanelContent: boolean;
  isLoading: boolean;
  isRegenerating: boolean;
  onRegenerate?: () => void;
  onExpand?: (block: RouteAiComment) => void;
  visibleBlocks: RouteAiComment[];
  inlineBodyAppendSlot?: ReactNode;
  reactionScopeKey: string;
}) {
  // A 다시 생성 action is offered on every settled comment (success or failure),
  // never while a comment is still generating — route-owned comments expose regenerate only after generation settles.
  const showRegenerate = hasPanelContent && !isLoading && !isRegenerating && onRegenerate != null;
  const regenerateAction = showRegenerate ? (
    <button
      type="button"
      onClick={onRegenerate}
      data-testid="agent-panel-regenerate"
      className="lh-type-control-label lh-tone-control hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
    >
      <svg
        className="h-3.5 w-3.5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth={2}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.023 9.348h4.992V4.356M3.985 19.644v-4.992h4.992M19.5 9.348a8.25 8.25 0 00-15-2.25M4.5 14.652a8.25 8.25 0 0015 2.25"
        />
      </svg>
      {t("surface.label.agent-panel.regenerate")}
    </button>
  ) : undefined;

  return (
    <div
      className={`flex min-w-0 flex-col ${INLINE_AI_COMMENT_GENERATED_REGION_CLASS}`}
      data-generated-content-region="route-ai-comment"
    >
      {!hasPanelContent && isLoading ? <InlinePendingReaction /> : null}
      <div className="flex min-w-0 flex-1 flex-col" data-testid="agent-panel-scroll-body">
        {hasPanelContent ? (
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {visibleBlocks.map((block, index) => {
              const isLatest = index === visibleBlocks.length - 1;
              return (
                <BlockCard
                  key={`${reactionScopeKey}:${block.id}:${block.timestamp}`}
                  block={block}
                  fillAvailableSpace={isLatest}
                  footerAction={isLatest ? regenerateAction : undefined}
                  inlineBodyAppendSlot={isLatest ? inlineBodyAppendSlot : undefined}
                  onExpand={onExpand}
                />
              );
            })}
          </div>
        ) : null}
      </div>
      {hasPanelContent && isRegenerating ? (
        <div
          className="lh-type-metadata lh-tone-secondary mt-2 inline-flex min-w-0 items-center gap-2"
          data-testid="agent-panel-regenerate-pending"
          role="status"
          aria-live="polite"
        >
          <span
            className="border-text-muted/25 border-t-text-muted inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2"
            aria-hidden="true"
          />
          <span className="min-w-0 truncate">{t("surface.label.agent-panel.regenerating")}</span>
        </div>
      ) : null}
    </div>
  );
});

export function AgentPanel({
  documentId,
  isLoading,
  inlineBodyAppendSlot,
}: {
  documentId: string | null;
  isLoading: boolean;
  inlineBodyAppendSlot?: ReactNode;
}) {
  const currentView = useResearchRouteStore((state) =>
    documentId && state.currentView?.id === documentId ? state.currentView : undefined,
  );
  const reactionCards = useResearchRouteStore((state) =>
    documentId && state.currentView?.id === documentId
      ? state.reactionCardHistory
      : EMPTY_REACTION_CARDS,
  );
  const isRegenerating = useResearchRouteStore((s) =>
    documentId && s.currentView?.id === documentId ? s.pendingRouteAiCommentRegeneration : false,
  );
  const activeExecutionId = useResearchRouteStore((state) => state.activeExecutionId);
  const requestRouteAiCommentRegeneration = useResearchRouteStore(
    (state) => state.requestRouteAiCommentRegeneration,
  );
  const emitSystemEvent = useReactionActionStore((s) => s.emitSystemEvent);
  const trackedCommentKeysRef = useRef(new Set<string>());
  const visibleBlocks = reactionCards;
  const currentBlock = visibleBlocks.at(-1);
  const hasBlock = currentBlock !== undefined;
  const hasPanelContent = hasBlock;
  const currentReactionDocumentId = currentView?.id ?? documentId ?? "";
  const currentReactionKey = hasBlock
    ? `${currentReactionDocumentId}:${currentBlock.id}:${currentBlock.timestamp}`
    : null;
  useEffect(() => {
    if (!hasBlock || !currentReactionKey || !currentView) {
      return;
    }
    if (trackedCommentKeysRef.current.has(currentReactionKey)) return;
    trackedCommentKeysRef.current.add(currentReactionKey);
    trackAiCommentCardViewedOnce({
      ownerPrincipalId: getResearchRouteViewerPrincipalId(currentView),
      documentId: currentView.id,
      reactionKey: currentReactionKey,
    });
  }, [currentView, currentReactionKey, hasBlock]);

  // Only documents whose AI comment can actually be re-generated are regenerable;
  // when buildRouteAiCommentGenerationCommand returns null (e.g. a 0-result search),
  // the 다시 생성 action is hidden so it never becomes a silent no-op button.
  const regenerateCommand = useMemo(
    () => (currentView ? buildRouteAiCommentGenerationCommand(currentView) : null),
    [currentView],
  );
  const handleRegenerate = useCallback(() => {
    if (!currentView || !regenerateCommand) return;
    // Advance the reaction generation without removing the settled card, then
    // re-fire the owning ResearchRoutePayload's reaction generation command through the scheduler.
    if (!activeExecutionId) return;
    requestRouteAiCommentRegeneration(currentView.id, activeExecutionId);
    emitSystemEvent(regenerateCommand.trigger, "", regenerateCommand.targetRoutePayloadId);
    trackAiCommentRegenerateClicked({
      type: "ai_comment_regenerate_clicked",
      data: {
        ownerPrincipalId: getResearchRouteViewerPrincipalId(currentView),
        documentId: currentView.id,
        documentType: currentView.type,
      },
    });
  }, [
    activeExecutionId,
    currentView,
    regenerateCommand,
    emitSystemEvent,
    requestRouteAiCommentRegeneration,
  ]);
  const handleExpand = useCallback(
    (block: RouteAiComment) => {
      if (!currentView) return;
      trackAiCommentCardExpandClicked({
        ownerPrincipalId: getResearchRouteViewerPrincipalId(currentView),
        documentId: currentView.id,
        reactionKey: `${currentView.id}:${block.id}:${block.timestamp}`,
      });
    },
    [currentView],
  );

  return (
    <div
      className="w-full max-w-full min-w-0 overflow-hidden"
      data-testid="research-route-inline-reaction-content"
    >
      <AgentPanelExpandedContent
        hasPanelContent={hasPanelContent}
        isLoading={isLoading}
        isRegenerating={isRegenerating}
        onRegenerate={regenerateCommand ? handleRegenerate : undefined}
        onExpand={handleExpand}
        visibleBlocks={visibleBlocks}
        inlineBodyAppendSlot={inlineBodyAppendSlot}
        reactionScopeKey={`${currentReactionDocumentId}:${activeExecutionId ?? "no-execution"}`}
      />
    </div>
  );
}
