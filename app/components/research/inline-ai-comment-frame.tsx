"use client";

// @promise promise:route-view-ai-comment-inline-surface
// @aspect aspect:route-view-ai-reaction-rules
// @aspect aspect:progressive-content-spatial-stability
// @check acceptance-check:route-view-ai-comment-inline-surface-visual-treatment-parity
// @check acceptance-check:route-view-ai-comment-inline-surface-owned-followup-action

import type { MouseEvent, ReactNode } from "react";
import { t } from "@/app/i18n/message-access";
import { attachInlineAiCommentBodySlot } from "@/app/components/research/attach-inline-ai-comment-body-slot";
import {
  INLINE_AI_COMMENT_ACTION_BUTTON_CLASS,
  INLINE_AI_COMMENT_FRAME_CLASS,
  INLINE_AI_COMMENT_TREATMENT,
} from "@/app/components/research/inline-ai-comment-treatment";

interface InlineAiCommentFrameProps {
  reactionSlot?: ReactNode;
  inlineBodyAppendSlot?: ReactNode;
  /** host-owned 후속 액션. 입력이 있을 때만 '연구 공백 지도 만들기'를 노출한다. */
  onOpenGapNetwork?: () => void;
  hasGapNetworkInput: boolean;
  className?: string;
}

/**
 * citation-lineage / graph-neighbors 등 relationship view의 top inline AI comment를
 * 공통 frame/action treatment로 감싼다. reactionSlot이 없으면 아무것도 그리지 않는다.
 */
export function InlineAiCommentFrame({
  reactionSlot,
  inlineBodyAppendSlot,
  onOpenGapNetwork,
  hasGapNetworkInput,
  className,
}: InlineAiCommentFrameProps) {
  if (!reactionSlot) {
    return null;
  }

  const handleGapNetworkAction = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.type === "auxclick" && event.button !== 1) {
      return;
    }
    onOpenGapNetwork?.();
  };

  const gapNetworkAction =
    onOpenGapNetwork && hasGapNetworkInput ? (
      <div
        className="mb-2 flex min-w-0 flex-wrap items-center justify-end text-right"
        data-testid="relationship-view-ai-comment-actions"
      >
        <button
          type="button"
          onClick={handleGapNetworkAction}
          onAuxClick={handleGapNetworkAction}
          className={INLINE_AI_COMMENT_ACTION_BUTTON_CLASS}
          data-testid="relationship-view-gap-network-action"
        >
          {t("search.label.search-results-content-rail.relationshipGapMapAction")}
        </button>
      </div>
    ) : null;
  const reactionSlotWithInlineBody = attachInlineAiCommentBodySlot(
    reactionSlot,
    inlineBodyAppendSlot,
  );

  return (
    <div className={className}>
      {gapNetworkAction}
      <div
        className={INLINE_AI_COMMENT_FRAME_CLASS}
        data-ai-comment-treatment={INLINE_AI_COMMENT_TREATMENT}
        data-testid="relationship-view-ai-comment-frame"
      >
        {reactionSlotWithInlineBody}
      </div>
    </div>
  );
}
