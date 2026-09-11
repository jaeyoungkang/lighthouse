// @promise promise:search-results-suggest-english-terms
// @promise promise:search-query-route-transition
// @promise promise:similar-papers-discovery
// @promise promise:inline-analysis-auto-run
// @promise promise:gap-led-next-search
// @promise promise:citation-lineage
// @promise promise:graph-neighbor-papers
// @aspect aspect:immediate-navigation
// @aspect aspect:research-route-visual-hierarchy
// @check acceptance-check:search-results-suggest-english-terms-click-feedback
// @check acceptance-check:search-query-route-transition-submit-feedback
// @check acceptance-check:similar-papers-discovery-author-topic-search
// @check acceptance-check:inline-analysis-auto-run-search-click-feedback
// @check acceptance-check:gap-led-next-search-click-feedback
// @check acceptance-check:citation-lineage-keyword-click-feedback
// @check acceptance-check:graph-neighbor-papers-keyword-click-feedback

import { t } from "@/app/i18n/message-access";
import { DOCUMENT_CONTENT_RAIL_MAX_WIDTH_CLASS } from "./research-route-layout.shared";

export function SearchFollowupActivationStatus({
  query,
  conditionUrlRejected,
}: {
  query: string | null;
  conditionUrlRejected: boolean;
}) {
  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className="pointer-events-none sticky top-0 z-[70] h-0 shrink-0"
      data-testid="search-followup-activation-announcer"
      role="status"
    >
      {query || conditionUrlRejected ? (
        <div className="px-4 pt-3 sm:px-6 lg:px-8" data-testid="search-followup-activation-status">
          <div className={`mx-auto w-full ${DOCUMENT_CONTENT_RAIL_MAX_WIDTH_CLASS}`}>
            <div className="border-border-subtle bg-surface-panel lh-type-metadata lh-tone-secondary rounded-lh-md border px-3 py-2 shadow-sm">
              {conditionUrlRejected
                ? t("search.label.conditionUrl.rejected.body")
                : t("search.label.followupActivation.pending", { query: query ?? "" })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
