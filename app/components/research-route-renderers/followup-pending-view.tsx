// @promise promise:citation-lineage
// @promise promise:graph-neighbor-papers
// @promise promise:route-view-ai-comment-inline-surface
// @aspect aspect:visible-explanation-sufficiency
// @aspect aspect:route-view-ai-reaction-rules
// @aspect aspect:provider-failure-degraded-mode
// @aspect aspect:research-route-visual-hierarchy
// @check acceptance-check:route-view-ai-comment-inline-surface-generation-pending-visible

// Test-only verification surface.
// reason: reaction-lifecycle evidence still cites its pending-frame fixture while production
// pending rendering is owned by the current route layout and runtime surfaces.
// owner: acceptance-check:route-view-ai-comment-inline-surface-generation-pending-visible.
// reviewWhen: the owning Evidence Ledger retires or replaces the followup-pending-view execution.

import type { ReactNode } from "react";
import { t } from "@/app/i18n/message-access";
import { RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS } from "../research/research-route-layout.shared";
import { InlineAiCommentFrame } from "../research/inline-ai-comment-frame";
import { ResearchRouteRendererShell } from "./ResearchRouteRendererShell";

// 즉시-이동 목적지의 pending 표면. 클릭 즉시 이동한 사용자가 빈 화면 대신 seed 논문
// 맥락 + 스켈레톤을 먼저 보고, 배경 생성이 실패하면 같은 통일 degraded copy + 재시도를
// 본다 (aspect:provider-failure-degraded-mode). citation/graph 두 surface가 공유한다.
export function FollowupPendingView(props: {
  seedTitle: string;
  failed: boolean;
  onRetry: () => void;
  loadingLabel: string;
  retryLabel: string;
  reactionSlot?: ReactNode;
}) {
  return (
    <ResearchRouteRendererShell>
      <div className={RESEARCH_ROUTE_ROUTE_CONTENT_SHELL_CLASS}>
        <header className="mb-4">
          <h1 className="lh-type-route-heading lh-tone-primary">{props.seedTitle}</h1>
        </header>
        <InlineAiCommentFrame
          reactionSlot={props.reactionSlot}
          hasGapNetworkInput={false}
          className="mb-4"
        />
        {props.failed ? (
          <div role="alert" data-testid="followup-pending-failed" className="space-y-2">
            <p className="lh-type-section-heading lh-tone-primary">
              {t("surface.label.agent-panel.documentReactionFailedTitle")}
            </p>
            <p className="lh-type-reading-body lh-tone-secondary">
              {t("surface.label.agent-panel.documentReactionFailedBody")}
            </p>
            <button
              type="button"
              onClick={props.onRetry}
              className="lh-type-control-label lh-tone-control rounded-lh-sm border px-3 py-1"
            >
              {props.retryLabel}
            </button>
          </div>
        ) : (
          <div data-testid="followup-pending-skeleton" aria-busy="true" className="space-y-3">
            <p className="lh-type-reading-body lh-tone-secondary">{props.loadingLabel}</p>
            {[0, 1, 2].map((row) => (
              <div key={row} className="bg-surface-panel h-16 animate-pulse rounded" />
            ))}
          </div>
        )}
      </div>
    </ResearchRouteRendererShell>
  );
}
