// @aspect aspect:ai-generated-content-feedback
"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { t } from "@/app/i18n/message-access";
import { track, trackAiContentFeedbackSubmitted } from "@/app/lib/track";

export type AiContentFeedbackValue = "helpful" | "not_helpful";

export interface AiContentFeedbackTarget {
  documentId: string | null;
  documentType?: string;
  surfaceId: string;
  surfaceKind: string;
  promiseRef: string;
  outputSnapshot: {
    title?: string;
    body: string;
    timestamp?: string;
  };
  metadata?: Record<string, string | number | boolean | null>;
}

interface AiContentFeedbackProps {
  target: AiContentFeedbackTarget;
  className?: string;
  compact?: boolean;
}

const FEEDBACK_STORAGE_PREFIX = "lighthouse.ai-content-feedback.v1";
const FEEDBACK_STORAGE_EVENT = "lighthouse:ai-content-feedback-change";

function buildFeedbackStorageKey(target: AiContentFeedbackTarget): string {
  return `${FEEDBACK_STORAGE_PREFIX}:${encodeURIComponent(
    JSON.stringify({
      documentId: target.documentId,
      surfaceId: target.surfaceId,
      surfaceKind: target.surfaceKind,
      promiseRef: target.promiseRef,
      outputSnapshot: target.outputSnapshot,
    }),
  )}`;
}

function getNextStatus(value: AiContentFeedbackValue): string {
  return value === "helpful"
    ? t("surface.label.ai-content-feedback.savedHelpful")
    : t("surface.label.ai-content-feedback.savedNotHelpful");
}

function readStoredFeedbackValue(storageKey: string): AiContentFeedbackValue | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(storageKey);
    return value === "helpful" || value === "not_helpful" ? value : null;
  } catch {
    return null;
  }
}

function writeStoredFeedbackValue(storageKey: string, value: AiContentFeedbackValue): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, value);
    window.dispatchEvent(new Event(FEEDBACK_STORAGE_EVENT));
  } catch {
    // The server-side event is the durable record; local storage only restores UI state.
  }
}

function subscribeFeedbackStore(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(FEEDBACK_STORAGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(FEEDBACK_STORAGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getFeedbackButtonClass(isSelected: boolean, compact: boolean): string {
  const sizeClass = compact ? "h-6 w-6" : "h-7 w-7";
  const baseClass = `inline-flex ${sizeClass} items-center justify-center border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`;

  if (isSelected) {
    return `${baseClass} border-accent-strong text-accent-strong shadow-sm`;
  }

  return `${baseClass} border-current/20 hover:border-foreground/50 hover:text-foreground`;
}

export function AiContentFeedback({
  target,
  className = "",
  compact = false,
}: AiContentFeedbackProps) {
  const storageKey = useMemo(() => buildFeedbackStorageKey(target), [target]);
  const selectedValue = useSyncExternalStore(
    subscribeFeedbackStore,
    () => readStoredFeedbackValue(storageKey),
    () => null,
  );
  const [failureStatus, setFailureStatus] = useState("");
  const status = failureStatus || (selectedValue ? getNextStatus(selectedValue) : "");

  const submitFeedback = useCallback(
    (value: AiContentFeedbackValue) => {
      if (selectedValue === value) {
        return;
      }

      const previousValue = selectedValue;
      setFailureStatus("");
      writeStoredFeedbackValue(storageKey, value);
      if (target.promiseRef === "promise:gap-overlay-decision-evidence") {
        track({
          type: "gap_overlay_decision_evidence",
          data: {
            documentId: target.documentId,
            selectionKind:
              typeof target.metadata?.selectionKind === "string"
                ? target.metadata.selectionKind
                : undefined,
          },
        });
      }

      try {
        trackAiContentFeedbackSubmitted({
          documentId: target.documentId,
          documentType: target.documentType,
          surfaceId: target.surfaceId,
          surfaceKind: target.surfaceKind,
          promiseRef: target.promiseRef,
          value,
          previousValue,
          outputSnapshot: target.outputSnapshot,
          metadata: target.metadata,
        });
      } catch {
        setFailureStatus(t("surface.label.ai-content-feedback.failed"));
      }
    },
    [selectedValue, storageKey, target],
  );

  return (
    <div
      className={`text-text-muted ${compact ? "flex shrink-0 items-center gap-1" : "mt-3 flex min-w-0 flex-wrap items-center gap-2 text-[11px]"} ${className}`}
      data-testid="ai-content-feedback"
      data-surface-id={target.surfaceId}
      data-promise-ref={target.promiseRef}
    >
      {compact ? null : (
        <span className="font-semibold tracking-[0.14em]">
          {t("surface.label.ai-content-feedback.prompt")}
        </span>
      )}
      <button
        type="button"
        aria-pressed={selectedValue === "helpful"}
        aria-label={t("surface.label.ai-content-feedback.helpful")}
        title={t("surface.label.ai-content-feedback.helpful")}
        data-testid="ai-content-feedback-helpful"
        onClick={() => {
          submitFeedback("helpful");
        }}
        className={getFeedbackButtonClass(selectedValue === "helpful", compact)}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            data-testid="ai-content-feedback-helpful-icon"
            d="M7 11v9M11 10l1-5a2 2 0 0 1 3.9.4V10h3.2a2 2 0 0 1 2 2.3l-1 6a2 2 0 0 1-2 1.7H7V11h4Z"
            fill={selectedValue === "helpful" ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        aria-pressed={selectedValue === "not_helpful"}
        aria-label={t("surface.label.ai-content-feedback.notHelpful")}
        title={t("surface.label.ai-content-feedback.notHelpful")}
        data-testid="ai-content-feedback-not-helpful"
        onClick={() => {
          submitFeedback("not_helpful");
        }}
        className={getFeedbackButtonClass(selectedValue === "not_helpful", compact)}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            data-testid="ai-content-feedback-not-helpful-icon"
            d="M17 13V4M13 14l-1 5a2 2 0 0 1-3.9-.4V14H4.9a2 2 0 0 1-2-2.3l1-6a2 2 0 0 1 2-1.7H17v10h-4Z"
            fill={selectedValue === "not_helpful" ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {status ? (
        <span
          className={`text-foreground text-lh-2xs font-semibold ${compact ? "sr-only" : ""}`}
          aria-live="polite"
        >
          {status}
        </span>
      ) : null}
    </div>
  );
}
