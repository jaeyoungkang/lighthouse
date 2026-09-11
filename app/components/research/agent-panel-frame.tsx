// @promise promise:route-view-ai-comment-inline-surface
// @aspect aspect:progressive-content-spatial-stability
// @aspect aspect:research-route-visual-hierarchy
"use client";

import { t } from "@/app/i18n/message-access";
import { INLINE_AI_COMMENT_GENERATED_REGION_CLASS } from "@/app/components/research/inline-ai-comment-treatment";

export function InlinePendingReaction() {
  return (
    <article
      className={`bg-surface-panel-strong/80 rounded-lh-sm flex w-full max-w-full min-w-0 items-start gap-3 overflow-hidden px-3 py-2 ${INLINE_AI_COMMENT_GENERATED_REGION_CLASS}`}
      data-testid="agent-panel-inline-pending"
      data-generated-content-region="route-ai-comment"
      data-layout="inline"
      data-state="loading"
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          className="border-accent/25 border-t-accent mt-1 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="lh-type-metadata lh-tone-primary">
            {t("surface.label.agent-panel.inlinePending")}
          </p>
          <p className="lh-type-metadata lh-tone-secondary mt-0.5">
            {t("surface.label.agent-panel.inlinePendingBody")}
          </p>
        </div>
      </div>
    </article>
  );
}
