"use client";

// @promise promise:search-result-library-add
// @promise promise:search-results-fast-window
// @aspect aspect:paper-card-presentation-consistency
// @aspect aspect:research-route-visual-hierarchy
// @check acceptance-check:search-result-library-add-card-action
// @check acceptance-check:search-results-fast-window-card-triage-metadata

import type { PaperCore } from "@/app/domain/paper";
import { t } from "@/app/i18n/message-access";
import type { FollowupActivationEvent } from "./search-view.helpers";
import { SimilarPaperIcon } from "./search-result-item.shared";

function LibraryActionIcon({ active }: { active: boolean }) {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
      data-testid="search-result-library-icon"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 4.75C7 3.78 7.78 3 8.75 3h6.5C16.22 3 17 3.78 17 4.75V21l-5-3-5 3V4.75Z"
      />
    </svg>
  );
}

export function SimilarPaperActionButton({
  action,
  paper,
  isLoading,
  onActivate,
  onOpenGraphNeighbors,
  onFindSimilar,
}: {
  action: "graph" | "fallback" | null;
  paper: PaperCore;
  isLoading?: boolean;
  onActivate?: () => void;
  onOpenGraphNeighbors?: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
  onFindSimilar?: (paper: PaperCore, event?: FollowupActivationEvent) => boolean;
}) {
  if (!action) return null;

  const isGraphAction = action === "graph";
  const label = t(
    isGraphAction
      ? "search.label.search-result-item.graphNeighbors"
      : "search.label.search-result-item.findSimilar",
  );

  return (
    <button
      onClick={(event) => {
        const didNavigate = isGraphAction
          ? onOpenGraphNeighbors?.(paper, event)
          : onFindSimilar?.(paper, event);
        if (didNavigate) onActivate?.();
      }}
      onAuxClick={(event) => {
        if (event.button !== 1) return;
        const didNavigate = isGraphAction
          ? onOpenGraphNeighbors?.(paper, event)
          : onFindSimilar?.(paper, event);
        if (didNavigate) onActivate?.();
      }}
      disabled={isLoading}
      className="lh-chip lh-card-action lh-type-compact-control inline-flex items-center gap-1 transition-colors disabled:opacity-40"
      title={label}
    >
      {isLoading ? (
        <span
          className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        <SimilarPaperIcon kind={action} />
      )}
      {label}
    </button>
  );
}

export function LibraryActionButton({
  paper,
  isInLibrary,
  isPending = false,
  onToggleLibrary,
}: {
  paper: PaperCore;
  isInLibrary: boolean;
  isPending?: boolean;
  onToggleLibrary?: (paper: PaperCore) => void;
}) {
  if (!onToggleLibrary) return null;

  const actionLabel = t(
    isInLibrary
      ? "search.label.search-result-item.libraryRemove"
      : "search.label.search-result-item.libraryAdd",
  );
  const className = isInLibrary
    ? "border-success/60 bg-success/10 text-success hover:border-success hover:bg-success/20"
    : "border-accent/45 bg-surface-panel text-accent-strong hover:bg-accent-soft/55";

  return (
    <button
      type="button"
      aria-pressed={isInLibrary}
      aria-label={actionLabel}
      data-library-state={isInLibrary ? "saved" : "unsaved"}
      data-testid="search-result-library-action"
      disabled={isPending}
      className={`rounded-lh-sm inline-flex h-7 w-7 shrink-0 items-center justify-center border transition-colors disabled:opacity-40 ${className}`}
      title={actionLabel}
      onClick={() => {
        onToggleLibrary(paper);
      }}
    >
      <LibraryActionIcon active={isInLibrary} />
      <span className="sr-only">{actionLabel}</span>
    </button>
  );
}
