export const REVIEWED_PAPER_STATE_CHANGED_EVENT = "lighthouse:reviewed-paper-state-changed";

export interface ReviewedPaperStateChangedDetail {
  paperId: string;
  reviewed: boolean;
}

export function dispatchReviewedPaperStateChanged(detail: ReviewedPaperStateChangedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REVIEWED_PAPER_STATE_CHANGED_EVENT, { detail }));
}
