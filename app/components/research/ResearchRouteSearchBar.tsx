"use client";

// @promise promise:research-route-cap-feedback
// @promise promise:search-query-route-transition
// @promise promise:gap-led-next-search
// @promise promise:search-result-library-add
// @promise promise:search-results-fast-window
// @aspect aspect:search-first-url-model
// @aspect aspect:immediate-navigation
// @aspect aspect:library-grounded-research
// @aspect aspect:research-route-visual-hierarchy
// @check acceptance-check:research-route-cap-feedback-route-search-visible
// @check acceptance-check:search-query-route-transition-immediate-submit
// @check acceptance-check:search-query-route-transition-submit-feedback
// @check acceptance-check:search-results-fast-window-post-search-layout-about
// @check acceptance-check:search-results-fast-window-brand-mark-home-link
// @check acceptance-check:search-results-fast-window-reviewed-papers-context-source
// @check acceptance-check:search-results-fast-window-personalization-opt-out
// @check acceptance-check:search-result-library-add-reviewed-papers-basis
// @check acceptance-check:search-result-library-add-analytics
// @check acceptance-check:gap-led-next-search-seed-launches-search

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/app/components/BrandLogo";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { t } from "@/app/i18n/message-access";
import { API_ROUTES, buildSearchRoutePageRoute } from "@/app/lib/api-routes";
import { containsEpisteme3PaperRef } from "@/app/lib/episteme-paper-ref";
import { resolveSearchConditionRouteKind } from "@/app/lib/search-condition-url-budget";
import { dispatchReviewedPaperStateChanged } from "@/app/lib/reviewed-paper-state-event";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { useLibraryAvailabilityStore } from "@/app/stores/library-availability-store";
import { type LibraryPresetPaper, useLibraryPapersStore } from "@/app/stores/library-papers-store";
import { SearchNavigationButtonContent } from "@/app/components/research/SearchNavigationButtonContent";
import { useSearchFollowupActivation } from "@/app/components/research/search-followup-activation";
import {
  DOCUMENT_CONTENT_RAIL_MAX_WIDTH_CLASS,
  RESEARCH_ROUTE_ROUTE_PANEL_MAX_WIDTH_CLASS,
} from "@/app/components/research/research-route-layout.shared";

function getShellQuerySeed(document: ResearchRoutePayload | undefined): string {
  if (document?.type !== "search") return "";
  return document.metadata.query;
}

function getUrlQuerySeed(pathname: string | null, searchParams: URLSearchParams): string | null {
  if (!pathname || resolveSearchConditionRouteKind(pathname) !== "search") return null;
  return searchParams.get("q") ?? "";
}

interface ReviewedPaperListItem {
  paperId: string;
  title?: string | null;
  url?: string | null;
  authors?: { name: string }[];
  year?: number | null;
  citationCount?: number | null;
  reviewedAt?: string;
}

function dispatchReviewedPaperDiff(
  previousPapers: readonly LibraryPresetPaper[],
  nextPapers: readonly LibraryPresetPaper[],
) {
  const previousIds = new Set(previousPapers.map((paper) => paper.paperId));
  const nextIds = new Set(nextPapers.map((paper) => paper.paperId));

  for (const paperId of nextIds) {
    if (!previousIds.has(paperId)) {
      dispatchReviewedPaperStateChanged({ paperId, reviewed: true });
    }
  }

  for (const paperId of previousIds) {
    if (!nextIds.has(paperId)) {
      dispatchReviewedPaperStateChanged({ paperId, reviewed: false });
    }
  }
}

function isReviewedPaperList(value: unknown): value is ReviewedPaperListItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (paper) =>
        paper !== null &&
        typeof paper === "object" &&
        typeof (paper as { paperId?: unknown }).paperId === "string",
    )
  );
}

function toLibraryPresetPaper(paper: ReviewedPaperListItem): LibraryPresetPaper {
  return {
    paperId: paper.paperId,
    title:
      typeof paper.title === "string" && paper.title.trim().length > 0
        ? paper.title
        : t("search.label.research-route-search-bar.libraryList.unknownPaperTitle"),
    folderName: t("search.label.research-route-search-bar.libraryList.folder"),
    url: paper.url ?? null,
    authors: paper.authors ?? [],
    year: paper.year ?? null,
    citationCount: paper.citationCount ?? null,
    reviewedAt: paper.reviewedAt,
  };
}

function ReviewedPapersLibraryMenu() {
  const setLibraryAvailable = useLibraryAvailabilityStore((state) => state.setAvailable);
  const libraryPapers = useLibraryPapersStore((state) => state.papers);
  const setLibraryPapers = useLibraryPapersStore((state) => state.setPapers);
  const removeLibraryPaper = useLibraryPapersStore((state) => state.removePaper);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isLibraryRefreshing, setIsLibraryRefreshing] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [removingLibraryPaperIds, setRemovingLibraryPaperIds] = useState<Set<string>>(
    () => new Set(),
  );
  const libraryMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isLibraryOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (libraryMenuRef.current?.contains(target)) return;
      setIsLibraryOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLibraryOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLibraryOpen]);

  const refreshLibraryPapers = async () => {
    const refreshStartedAtRevision = useLibraryPapersStore.getState().revision;
    setIsLibraryRefreshing(true);
    setLibraryError(null);
    try {
      const response = await fetch(API_ROUTES.PAPERS_REVIEWED);
      if (!response.ok) {
        throw new Error(`reviewed papers load failed: ${String(response.status)}`);
      }
      const raw: unknown = await response.json().catch((): unknown => null);
      if (!isReviewedPaperList(raw)) {
        throw new Error("reviewed papers response shape mismatch");
      }
      const nextPapers = raw.map(toLibraryPresetPaper);
      const currentLibraryState = useLibraryPapersStore.getState();
      if (currentLibraryState.revision !== refreshStartedAtRevision) {
        return;
      }
      setLibraryPapers(nextPapers);
      setLibraryAvailable(containsEpisteme3PaperRef(nextPapers));
      dispatchReviewedPaperDiff(currentLibraryState.papers, nextPapers);
    } catch (error) {
      console.error("[search] reviewed papers list load failed:", error);
      setLibraryError(t("search.label.research-route-search-bar.libraryList.loadFailed"));
    } finally {
      setIsLibraryRefreshing(false);
    }
  };

  const setLibraryPaperRemoving = (paperId: string, removing: boolean) => {
    setRemovingLibraryPaperIds((current) => {
      const next = new Set(current);
      if (removing) {
        next.add(paperId);
      } else {
        next.delete(paperId);
      }
      return next;
    });
  };

  const handleLibraryButtonClick = () => {
    const nextOpen = !isLibraryOpen;
    setIsLibraryOpen(nextOpen);
    if (nextOpen) {
      void refreshLibraryPapers();
    }
  };

  const handleRemoveLibraryPaper = async (paper: LibraryPresetPaper) => {
    if (removingLibraryPaperIds.has(paper.paperId)) return;
    setLibraryPaperRemoving(paper.paperId, true);
    setLibraryError(null);
    try {
      const response = await fetch(API_ROUTES.PAPERS_REVIEWED, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paperId: paper.paperId }),
      });
      if (!response.ok) {
        throw new Error(`reviewed paper delete failed: ${String(response.status)}`);
      }
      removeLibraryPaper(paper.paperId);
      const nextPapers = useLibraryPapersStore
        .getState()
        .papers.filter((current) => current.paperId !== paper.paperId);
      setLibraryAvailable(containsEpisteme3PaperRef(nextPapers));
      dispatchReviewedPaperStateChanged({ paperId: paper.paperId, reviewed: false });
    } catch (error) {
      console.error("[search] reviewed paper delete failed:", error);
      setLibraryError(t("search.label.research-route-search-bar.libraryList.removeFailed"));
    } finally {
      setLibraryPaperRemoving(paper.paperId, false);
    }
  };

  return (
    <div
      ref={libraryMenuRef}
      className="relative min-w-0 justify-self-start sm:justify-self-end"
      data-testid="research-route-library-menu-root"
    >
      <button
        type="button"
        onClick={handleLibraryButtonClick}
        aria-haspopup="menu"
        aria-expanded={isLibraryOpen}
        aria-controls={isLibraryOpen ? "research-route-library-menu" : undefined}
        data-testid="research-route-library-menu-button"
        className="lh-control lh-type-control-label border-border-subtle bg-surface-panel text-foreground rounded-lh-sm flex h-9 max-w-full items-center gap-1.5 border px-2.5"
      >
        <svg
          aria-hidden="true"
          className="text-text-subtle h-3.5 w-3.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z"
          />
        </svg>
        <span className="truncate">
          {t("search.label.research-route-search-bar.libraryList.label")}
        </span>
        {libraryPapers.length > 0 ? (
          <span
            className="lh-type-metadata lh-tone-secondary border-border-subtle rounded-full border px-1.5"
            data-testid="research-route-library-count"
          >
            {libraryPapers.length}
          </span>
        ) : null}
        <svg
          aria-hidden="true"
          className="text-text-subtle h-3.5 w-3.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {isLibraryOpen ? (
        <div
          id="research-route-library-menu"
          role="menu"
          data-testid="research-route-library-menu"
          className="border-border-subtle bg-surface-panel rounded-lh-md absolute right-auto left-0 z-50 mt-2 w-[20rem] max-w-[calc(100vw-2rem)] border p-2 shadow-lg lg:right-0 lg:left-auto"
        >
          <div className="border-sidebar-border/70 flex min-h-9 items-center justify-between gap-3 border-b px-2 pb-2">
            <p className="lh-type-paper-title lh-tone-primary truncate">
              {t("search.label.research-route-search-bar.libraryList.title")}
            </p>
            {isLibraryRefreshing ? (
              <span
                className="lh-type-metadata lh-tone-secondary inline-flex shrink-0 items-center gap-1.5"
                data-testid="research-route-library-loading"
              >
                <span
                  className="border-accent/25 border-t-accent h-3 w-3 animate-spin rounded-full border-2"
                  aria-hidden="true"
                />
                {t("search.label.research-route-search-bar.libraryList.loading")}
              </span>
            ) : null}
          </div>
          {libraryError ? (
            <p
              className="lh-type-metadata text-error mt-2 px-2"
              data-testid="research-route-library-error"
            >
              {libraryError}
            </p>
          ) : null}
          {libraryPapers.length === 0 && !isLibraryRefreshing ? (
            <p
              className="lh-type-reading-body lh-tone-secondary px-2 py-4"
              data-testid="research-route-library-empty"
            >
              {t("search.label.research-route-search-bar.libraryList.empty")}
            </p>
          ) : (
            <ul className="max-h-[22rem] overflow-y-auto py-1">
              {libraryPapers.map((paper) => {
                const isRemoving = removingLibraryPaperIds.has(paper.paperId);
                return (
                  <li
                    key={paper.paperId}
                    className="hover:bg-surface-panel-strong/70 rounded-lh-sm flex min-h-14 items-start gap-2 px-2 py-2"
                    data-testid="research-route-library-paper"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="lh-type-paper-title lh-tone-primary truncate">{paper.title}</p>
                      <p className="lh-type-metadata lh-tone-secondary mt-1 truncate">
                        {paper.folderName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void handleRemoveLibraryPaper(paper);
                      }}
                      disabled={isRemoving}
                      aria-label={t(
                        "search.label.research-route-search-bar.libraryList.removeLabel",
                        { title: paper.title },
                      )}
                      data-testid="research-route-library-remove"
                      className="lh-type-control-label lh-tone-control hover:text-error rounded-lh-sm shrink-0 px-2 py-1 transition-colors disabled:opacity-50"
                    >
                      {t("search.label.research-route-search-bar.libraryList.remove")}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ResearchRouteSearchBar({
  userEmail,
}: {
  userEmail?: string;
  libraryPapers?: LibraryPresetPaper[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeView = useResearchRouteStore((state) => state.currentView ?? undefined);
  const { clearIfStillPending, pending, reportConditionUrlRejected, startActivation } =
    useSearchFollowupActivation();
  const libraryContextAvailable = useLibraryAvailabilityStore((state) => state.available);
  const searchParamString = searchParams.toString();
  const baseSeedQuery = (() => {
    const urlSeed = getUrlQuerySeed(pathname, new URLSearchParams(searchParamString));
    return urlSeed ?? getShellQuerySeed(activeView);
  })();
  const [query, setQuery] = useState(baseSeedQuery);
  const [lastBaseSeedQuery, setLastBaseSeedQuery] = useState(baseSeedQuery);
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (lastBaseSeedQuery !== baseSeedQuery) {
    setLastBaseSeedQuery(baseSeedQuery);
    setQuery(baseSeedQuery);
  }

  const trimmedQuery = query.trim();
  const canSubmit = trimmedQuery.length > 0;
  const sortParam = searchParams.get("sort");
  const sort =
    sortParam === "relevance" ||
    sortParam === "citationCount" ||
    sortParam === "year" ||
    sortParam === "yearAsc"
      ? sortParam
      : undefined;
  const submitRouteResult = canSubmit
    ? buildSearchRoutePageRoute({
        q: query,
        sort,
        year: searchParams.get("year") ?? undefined,
        libraryContextAvailable: libraryContextAvailable ? true : undefined,
        entry: "route-bar",
      })
    : null;
  const submitRoute = submitRouteResult?.ok ? submitRouteResult.route : null;
  const isSearchNavigationPending = submitRoute !== null && pending?.route === submitRoute;

  // Submitting moves IMMEDIATELY to the `/search?q=` route
  // (aspect:immediate-navigation): no client-side result placeholder holds the transition.
  // The server route emits the canonical submit event and executes the provider
  // run at the same address.
  const handleSubmit = () => {
    if (submitRouteResult && !submitRouteResult.ok) {
      reportConditionUrlRejected();
      return;
    }
    if (!submitRoute || isSearchNavigationPending) return;
    const activation = startActivation({ route: submitRoute, query: trimmedQuery });
    try {
      router.push(submitRoute, { scroll: false });
    } catch (error) {
      clearIfStillPending(activation);
      console.error("[research-route-search] navigation failed:", error);
    }
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      const { createClient } = await import("@/app/lib/supabase/client");
      const { error } = await createClient().auth.signOut();
      if (error) {
        setIsSigningOut(false);
        window.alert(t("auth.error.signoutFailed"));
        return;
      }
      void import("@/app/lib/analytics/amplitude-unified-client")
        .then(({ resetLoadedAmplitudeModule }) => {
          resetLoadedAmplitudeModule();
        })
        .catch(() => undefined);
      void fetch(API_ROUTES.AUTH_MOONLIGHT_SCHOLAR_SESSION, { method: "DELETE" }).catch(() => {
        // Supabase sign-out remains authoritative for the fallback session; the
        // Moonlight handoff cookie clear is best-effort client cleanup.
      });
      router.push("/");
    } catch {
      setIsSigningOut(false);
      window.alert(t("auth.error.signoutFailed"));
    }
  };

  return (
    <div className="bg-surface-app border-sidebar-border/70 sticky top-0 z-40 border-b px-4 py-2.5 sm:px-6 lg:px-8">
      <div
        className={`lh-research-route-search-rail mx-auto grid w-full ${RESEARCH_ROUTE_ROUTE_PANEL_MAX_WIDTH_CLASS} grid-cols-1 gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4`}
        data-testid="research-route-search-rail"
      >
        <div>
          <Link href="/" data-testid="research-route-brand-home-link">
            <BrandLogo placement="topbar" priority testId="research-route-brand-logo" />
          </Link>
        </div>
        <div
          className={`grid w-full min-w-0 justify-self-center ${DOCUMENT_CONTENT_RAIL_MAX_WIDTH_CLASS} grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-2`}
          data-testid="research-route-search-input-column"
        >
          <div className="relative min-w-0" data-testid="research-route-search-input-frame">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg
                className="text-text-subtle h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
            </div>
            <input
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSubmit();
                }
              }}
              placeholder={t("search.label.search-view-content.9")}
              aria-label={t("search.label.search-view-content.10")}
              data-testid="research-route-search-input"
              className="lh-input lh-type-reading-body rounded-lh-md w-full py-2.5 pr-4 pl-9"
            />
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSearchNavigationPending}
            aria-busy={isSearchNavigationPending}
            data-testid="research-route-search-submit"
            className="lh-control-accent lh-type-control-label rounded-lh-sm inline-flex items-center justify-center gap-2 px-4 py-2.5 disabled:opacity-50"
          >
            <SearchNavigationButtonContent pending={isSearchNavigationPending}>
              {t("search.label.search-view-content.heroButton")}
            </SearchNavigationButtonContent>
          </button>
        </div>
        {userEmail ? <ReviewedPapersLibraryMenu /> : null}
        {userEmail ? (
          <div
            className="lh-type-compact-control lh-tone-secondary flex max-w-full min-w-0 items-center justify-self-end text-right"
            data-testid="research-route-current-account"
          >
            <span
              className="max-w-[12rem] truncate"
              data-testid="research-route-current-account-email"
            >
              {userEmail}
            </span>
            <button
              type="button"
              onClick={() => {
                void handleSignOut();
              }}
              disabled={isSigningOut}
              className="lh-type-compact-control lh-tone-tertiary hover:text-foreground rounded-lh-sm ml-3 shrink-0 px-1.5 py-1 transition-colors disabled:opacity-50"
              data-testid="research-route-sign-out"
            >
              {t("common.label.sidebar.6")}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
