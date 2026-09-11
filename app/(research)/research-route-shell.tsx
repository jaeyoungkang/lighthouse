"use client";

// @promise promise:research-route-cap-feedback
// @promise promise:search-results-fast-window
// @promise promise:search-results-suggest-english-terms
// @promise promise:search-query-route-transition
// @promise promise:similar-papers-discovery
// @promise promise:inline-analysis-auto-run
// @promise promise:gap-led-next-search
// @promise promise:citation-lineage
// @promise promise:graph-neighbor-papers
// @aspect aspect:search-first-url-model
// @aspect aspect:common-page-footer
// @aspect aspect:library-grounded-research
// @aspect aspect:immediate-navigation
// @check acceptance-check:research-route-cap-feedback-route-search-visible
// @check acceptance-check:research-route-cap-feedback-condition-overflow
// @check acceptance-check:search-results-fast-window-reviewed-papers-context-source
// @check acceptance-check:search-results-fast-window-bootstrap-auth-challenge
// @check acceptance-check:search-results-fast-window-library-bootstrap-outcomes
// @check acceptance-check:search-results-fast-window-personalization-opt-out
// @check acceptance-check:search-results-suggest-english-terms-prefilled-search
// @check acceptance-check:search-results-suggest-english-terms-click-feedback
// @check acceptance-check:search-query-route-transition-submit-feedback
// @check acceptance-check:similar-papers-discovery-author-topic-search
// @check acceptance-check:inline-analysis-auto-run-search-click-feedback
// @check acceptance-check:gap-led-next-search-click-feedback
// @check acceptance-check:citation-lineage-keyword-click-feedback
// @check acceptance-check:graph-neighbor-papers-keyword-click-feedback

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { MoonlightAuthBootstrap } from "@/app/components/MoonlightAuthBootstrap";
import { AuthSessionTouch } from "@/app/components/AuthSessionTouch";
import { ResearchRouteSearchBar } from "@/app/components/research/ResearchRouteSearchBar";
import { ResearchBackgroundTasks } from "@/app/components/research/ResearchBackgroundTasks";
import { SearchFollowupActivationStatus } from "@/app/components/research/SearchFollowupActivationStatus";
import {
  buildRouteLocation,
  SearchFollowupActivationProvider,
  useSearchFollowupActivation,
} from "@/app/components/research/search-followup-activation";
import { SiteFooter } from "@/app/components/SiteFooter";
import { t } from "@/app/i18n/message-access";
import { API_ROUTES } from "@/app/lib/api-routes";
import {
  resolveSearchConditionRouteKind,
  validateSearchConditionUrl,
} from "@/app/lib/search-condition-url-budget";
import { trackResearchAuthChallengeViewed } from "@/app/lib/track";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { useLibraryAvailabilityStore } from "@/app/stores/library-availability-store";
import { ResearchRouteLibraryProvider } from "@/app/components/research/research-route-library-context";
import type { LibraryContextAccessStatus } from "@/app/server/services/library-context-source";
import { type LibraryPresetPaper, useLibraryPapersStore } from "@/app/stores/library-papers-store";

interface ResearchRouteShellProps {
  children: React.ReactNode;
  userEmail?: string;
  libraryContextAvailable?: boolean;
  libraryAccessStatus?: LibraryContextAccessStatus;
  libraryPapers?: LibraryPresetPaper[];
}

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const LIBRARY_CONTEXT_ACCESS_STATUS_VALUES = [
  "available",
  "unavailable",
  "moonlight_scholar_access_not_allowed",
  "moonlight_scholar_session_invalid",
] satisfies LibraryContextAccessStatus[];
const LIBRARY_CONTEXT_ACCESS_STATUSES = new Set<string>(LIBRARY_CONTEXT_ACCESS_STATUS_VALUES);

function LibraryAccessNotice({ accessStatus }: { accessStatus: LibraryContextAccessStatus }) {
  if (accessStatus !== "moonlight_scholar_access_not_allowed") return null;

  return (
    <div
      role="note"
      className="border-border-subtle bg-surface-panel text-text-muted border-b px-5 py-2 text-sm leading-5"
      data-testid="moonlight-library-access-notice"
    >
      {t("search.notice.moonlight-library-access-denied")}
    </div>
  );
}

type LibraryContextBootstrapPayload = {
  userEmail?: string;
  libraryContextAvailable: boolean;
  libraryAccessStatus: LibraryContextAccessStatus;
  libraryPapers: LibraryPresetPaper[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLibraryContextAccessStatus(value: unknown): value is LibraryContextAccessStatus {
  return typeof value === "string" && LIBRARY_CONTEXT_ACCESS_STATUSES.has(value);
}

function isLibraryPresetPaper(value: unknown): value is LibraryPresetPaper {
  return (
    isRecord(value) &&
    typeof value.paperId === "string" &&
    typeof value.title === "string" &&
    typeof value.folderName === "string"
  );
}

function parseLibraryContextBootstrapPayload(
  value: unknown,
): LibraryContextBootstrapPayload | null {
  if (!isRecord(value)) return null;
  if ("userEmail" in value && typeof value.userEmail !== "string") return null;
  if (typeof value.libraryContextAvailable !== "boolean") return null;
  if (!isLibraryContextAccessStatus(value.libraryAccessStatus)) return null;
  if (!Array.isArray(value.libraryPapers) || !value.libraryPapers.every(isLibraryPresetPaper)) {
    return null;
  }

  return {
    userEmail: typeof value.userEmail === "string" ? value.userEmail : undefined,
    libraryContextAvailable: value.libraryContextAvailable,
    libraryAccessStatus: value.libraryAccessStatus,
    libraryPapers: value.libraryPapers,
  };
}

function ResearchRouteShellContent({
  children,
  userEmail,
  libraryContextAvailable = false,
  libraryAccessStatus = "unavailable",
  libraryPapers = [],
}: ResearchRouteShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKind = resolveSearchConditionRouteKind(pathname);
  const routeQuery = (searchParams.get("q") ?? "").trim();
  // Search-first: 루트 `/`도 쿼리 없는 `/search`와 같은 중앙 정렬 검색 entry다.
  const isInitialSearchRoute = routeKind === "search" && routeQuery.length === 0;
  const conditionUrlRejectedByRoute =
    routeKind !== null &&
    !validateSearchConditionUrl(routeKind, new URLSearchParams(searchParams.toString())).ok;
  const {
    pending: pendingSearchFollowupActivation,
    conditionUrlRejected,
    clearIfStillPending: clearSearchFollowupActivationIfStillPending,
  } = useSearchFollowupActivation();
  const currentSearchFollowupLocation = buildRouteLocation(pathname, searchParams);
  const searchFollowupDestinationArrived =
    pendingSearchFollowupActivation !== null &&
    currentSearchFollowupLocation === pendingSearchFollowupActivation.route;
  const searchFollowupReceiptVisible =
    pendingSearchFollowupActivation !== null && !searchFollowupDestinationArrived;
  const activeExecutionId = useResearchRouteStore((state) => state.activeExecutionId);
  const clearCurrentView = useResearchRouteStore((state) => state.clearCurrentView);
  // Keep the compatibility initial prop in sync, then let the post-mount
  // bootstrap and shared library store drive route context while the shell remains mounted.
  // @aspect aspect:library-grounded-research
  const setLibraryAvailable = useLibraryAvailabilityStore((state) => state.setAvailable);
  const setLibraryPapers = useLibraryPapersStore((state) => state.setPapers);
  const [effectiveUserEmail, setEffectiveUserEmail] = useState(userEmail);
  const [effectiveLibraryContextAvailable, setEffectiveLibraryContextAvailable] =
    useState(libraryContextAvailable);
  const [effectiveLibraryAccessStatus, setEffectiveLibraryAccessStatus] =
    useState(libraryAccessStatus);
  const [authenticationRequirement, setAuthenticationRequirement] = useState<
    "library_bootstrap_401" | "moonlight_session_invalid" | null
  >(null);
  const authenticationRequired = authenticationRequirement !== null && !conditionUrlRejectedByRoute;
  const applyUnavailableLibraryContext = useCallback(() => {
    setLibraryAvailable(false);
    setLibraryPapers([]);
    setEffectiveLibraryAccessStatus("unavailable");
  }, [setLibraryAvailable, setLibraryPapers]);
  const navigateAfterSessionRecovery = useCallback(() => {
    window.history.go(0);
  }, []);
  const enterAuthenticationRequired = useCallback(
    (source: "library_bootstrap_401" | "moonlight_session_invalid") => {
      setAuthenticationRequirement(source);
      setEffectiveUserEmail(undefined);
      applyUnavailableLibraryContext();
    },
    [applyUnavailableLibraryContext],
  );
  useEffect(() => {
    if (!authenticationRequirement) return;
    void trackResearchAuthChallengeViewed(authenticationRequirement);
  }, [authenticationRequirement]);
  useIsomorphicLayoutEffect(() => {
    setEffectiveUserEmail(userEmail);
    setLibraryAvailable(libraryContextAvailable);
    setEffectiveLibraryContextAvailable(libraryContextAvailable);
  }, [libraryContextAvailable, setLibraryAvailable, userEmail]);
  useEffect(() => {
    setEffectiveLibraryAccessStatus(libraryAccessStatus);
  }, [libraryAccessStatus]);
  useEffect(() => {
    if (!effectiveUserEmail) return;
    void import("@/app/lib/track")
      .then(({ identifyUser }) => {
        identifyUser(effectiveUserEmail);
      })
      .catch(() => undefined);
  }, [effectiveUserEmail]);
  useEffect(
    () =>
      useLibraryAvailabilityStore.subscribe((state) => {
        setEffectiveLibraryContextAvailable(state.available);
      }),
    [],
  );
  useIsomorphicLayoutEffect(() => {
    setLibraryPapers(libraryPapers);
  }, [libraryPapers, setLibraryPapers]);
  useEffect(() => {
    if (conditionUrlRejectedByRoute) return;
    let active = true;
    const abortController = new AbortController();

    void fetch(API_ROUTES.LIBRARY_CONTEXT_BOOTSTRAP, {
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          if (!active) return;
          enterAuthenticationRequired("library_bootstrap_401");
          return;
        }
        if (!response.ok) throw new Error(`library bootstrap failed: ${String(response.status)}`);
        const payload = parseLibraryContextBootstrapPayload(await response.json());
        if (!payload) throw new Error("library bootstrap response shape mismatch");
        if (!active) return;
        if (payload.libraryAccessStatus === "moonlight_scholar_session_invalid") {
          enterAuthenticationRequired("moonlight_session_invalid");
          return;
        }
        setEffectiveUserEmail(payload.userEmail);
        setLibraryAvailable(payload.libraryContextAvailable);
        setLibraryPapers(payload.libraryPapers);
        setEffectiveLibraryAccessStatus(payload.libraryAccessStatus);
      })
      .catch((error: unknown) => {
        if (!active || abortController.signal.aborted) return;
        setEffectiveUserEmail(undefined);
        applyUnavailableLibraryContext();
        console.warn("[research-route-shell] library bootstrap failed:", error);
      });

    return () => {
      active = false;
      abortController.abort();
    };
  }, [
    applyUnavailableLibraryContext,
    enterAuthenticationRequired,
    conditionUrlRejectedByRoute,
    setLibraryAvailable,
    setLibraryPapers,
  ]);
  useEffect(() => {
    if (!authenticationRequired) return;
    if (activeExecutionId) {
      clearCurrentView(activeExecutionId);
    }
  }, [activeExecutionId, authenticationRequired, clearCurrentView]);
  const [fromOnboarding, setFromOnboarding] = useState(() => {
    if (typeof sessionStorage === "undefined") return false;
    if (sessionStorage.getItem("from-onboarding") === "1") {
      sessionStorage.removeItem("from-onboarding");
      return true;
    }
    return false;
  });

  useEffect(() => {
    if (!fromOnboarding) return;
    const timer = setTimeout(() => {
      setFromOnboarding(false);
    }, 1300);
    return () => {
      clearTimeout(timer);
    };
  }, [fromOnboarding]);

  useEffect(() => {
    if (pendingSearchFollowupActivation && searchFollowupDestinationArrived) {
      clearSearchFollowupActivationIfStillPending(pendingSearchFollowupActivation);
    }
  }, [
    clearSearchFollowupActivationIfStillPending,
    pendingSearchFollowupActivation,
    searchFollowupDestinationArrived,
  ]);

  return (
    <ResearchRouteLibraryProvider libraryContextAvailable={effectiveLibraryContextAvailable}>
      <div
        className="lh-research-route-frame flex min-h-screen w-full flex-col"
        {...(fromOnboarding ? { "data-entrance": "1" } : {})}
      >
        {authenticationRequired || conditionUrlRejectedByRoute ? null : <ResearchBackgroundTasks />}
        {!authenticationRequired && !conditionUrlRejectedByRoute && effectiveUserEmail ? (
          <AuthSessionTouch />
        ) : null}
        {!authenticationRequired && !isInitialSearchRoute ? (
          <ResearchRouteSearchBar userEmail={effectiveUserEmail} />
        ) : null}
        <main className="bg-surface-research flex min-h-0 flex-1 flex-col overflow-y-auto">
          {authenticationRequired ? null : (
            <>
              <LibraryAccessNotice accessStatus={effectiveLibraryAccessStatus} />
              <SearchFollowupActivationStatus
                query={searchFollowupReceiptVisible ? pendingSearchFollowupActivation.query : null}
                conditionUrlRejected={conditionUrlRejected}
              />
            </>
          )}
          <div
            className={authenticationRequired ? "flex shrink-0 flex-col" : "shrink-0"}
            data-testid="research-route-content-slot"
            style={{
              minHeight:
                authenticationRequired || isInitialSearchRoute
                  ? "100dvh"
                  : "calc(100dvh - var(--lh-header-offset))",
            }}
          >
            {authenticationRequired ? (
              <MoonlightAuthBootstrap
                fallback="email-gate"
                onSessionNavigation={navigateAfterSessionRecovery}
              />
            ) : (
              children
            )}
          </div>
          {authenticationRequired ? null : (
            <SiteFooter fullBleed className="mt-8" testId="research-route-footer" />
          )}
        </main>
      </div>
    </ResearchRouteLibraryProvider>
  );
}

export function ResearchRouteShell(props: ResearchRouteShellProps) {
  return (
    <SearchFollowupActivationProvider>
      <ResearchRouteShellContent {...props} />
    </SearchFollowupActivationProvider>
  );
}
