"use client";

// Test-and-collector-only verification surface.
// reason: local-navigation tests and the Q3 guarded-tree inventory still inspect this retired
// inline citation path even though current production renderers do not import it.
// owner: promise:research-route-cap-feedback evidence and Architecture Fitness Q3 workload.
// reviewWhen: the mixed local-navigation fixture and Q3 product-file inventory stop naming it.

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSearchFollowupActivation } from "@/app/components/research/search-followup-activation";
import { t } from "@/app/i18n/message-access";
import { buildResearchRoutePageRoute } from "@/app/lib/api-routes";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

interface CitationLinkProps {
  docId: string;
  paperId?: string;
}

export function CitationLink({ docId, paperId }: CitationLinkProps) {
  const doc = useResearchRouteStore((state) =>
    state.currentView?.id === docId ? state.currentView : null,
  );
  const router = useRouter();
  const { acceptConditionUrl, reportConditionUrlRejected } = useSearchFollowupActivation();
  const exists = !!doc;
  const handleClick = useCallback(() => {
    if (doc) {
      const route = buildResearchRoutePageRoute(doc);
      if (!route.ok) {
        reportConditionUrlRejected();
        return;
      }
      acceptConditionUrl();
      router.push(route.route);
      if (paperId) {
        window.dispatchEvent(
          new CustomEvent("lighthouse:reveal-paper", {
            detail: { documentId: doc.id, paperId },
          }),
        );
      }
    }
  }, [acceptConditionUrl, doc, paperId, reportConditionUrlRejected, router]);

  const label = doc?.title
    ? doc.title.length > 20
      ? doc.title.slice(0, 20) + "\u2026"
      : doc.title
    : docId.slice(0, 8);

  if (!exists) {
    return (
      <span
        className="lh-inline-ref cursor-default"
        data-missing="true"
        title={t("document.error.citation-link", { docId })}
      >
        <svg
          className="h-3 w-3"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101"
          />
        </svg>
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="lh-inline-ref cursor-pointer align-baseline"
      title={paperId ? `${doc.title} > ${paperId}` : doc.title}
    >
      <svg
        className="h-3 w-3 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101"
        />
      </svg>
      {label}
    </button>
  );
}
