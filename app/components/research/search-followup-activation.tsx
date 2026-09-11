"use client";

// @promise promise:search-results-suggest-english-terms
// @promise promise:search-query-route-transition
// @promise promise:similar-papers-discovery
// @promise promise:inline-analysis-auto-run
// @promise promise:gap-led-next-search
// @promise promise:citation-lineage
// @promise promise:graph-neighbor-papers
// @aspect aspect:immediate-navigation
// @check acceptance-check:search-results-suggest-english-terms-click-feedback
// @check acceptance-check:search-query-route-transition-submit-feedback
// @check acceptance-check:similar-papers-discovery-author-topic-search
// @check acceptance-check:inline-analysis-auto-run-search-click-feedback
// @check acceptance-check:gap-led-next-search-click-feedback
// @check acceptance-check:citation-lineage-keyword-click-feedback
// @check acceptance-check:graph-neighbor-papers-keyword-click-feedback

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export const SEARCH_FOLLOWUP_ACTIVATION_STALE_TIMEOUT_MS = 30_000;

export interface SearchJourneyAnalyticsContext {
  journeyContextId: string;
  searchContextId: string;
  parentSearchContextId?: string;
}

export interface PendingSearchFollowupActivation {
  id: number;
  route: string;
  query: string;
  originLocation: string;
  analyticsContext?: SearchJourneyAnalyticsContext;
}

export function runWithSearchActivationCleanup<T>(params: {
  activation: PendingSearchFollowupActivation | null | undefined;
  clearIfStillPending: (activation: PendingSearchFollowupActivation | null | undefined) => void;
  navigate: () => T;
}): T {
  try {
    return params.navigate();
  } catch (error) {
    params.clearIfStillPending(params.activation);
    throw error;
  }
}

interface SearchFollowupActivationContextValue {
  pending: PendingSearchFollowupActivation | null;
  conditionUrlRejected: boolean;
  startActivation: (params: {
    route: string;
    query: string;
    originLocation?: string;
  }) => PendingSearchFollowupActivation | null;
  clearIfStillPending: (activation: PendingSearchFollowupActivation | null | undefined) => void;
  acceptConditionUrl: () => void;
  reportConditionUrlRejected: () => void;
  currentAnalyticsContext: SearchJourneyAnalyticsContext | null;
  registerAnalyticsContext: (context: SearchJourneyAnalyticsContext) => void;
  clearAnalyticsContextIfCurrent: (context: SearchJourneyAnalyticsContext) => void;
}

const SearchFollowupActivationContext = createContext<SearchFollowupActivationContextValue | null>(
  null,
);
const EMPTY_SEARCH_FOLLOWUP_ACTIVATION_CONTEXT: SearchFollowupActivationContextValue = {
  pending: null,
  conditionUrlRejected: false,
  startActivation: () => null,
  clearIfStillPending: () => undefined,
  acceptConditionUrl: () => undefined,
  reportConditionUrlRejected: () => undefined,
  currentAnalyticsContext: null,
  registerAnalyticsContext: () => undefined,
  clearAnalyticsContextIfCurrent: () => undefined,
};

export function buildRouteLocation(
  pathname: string,
  searchParams: Pick<URLSearchParams, "toString">,
): string {
  const search = searchParams.toString();
  return search ? `${pathname}?${search}` : pathname;
}

function currentRouteLocation(): string {
  if (typeof window === "undefined") return "/";
  return buildRouteLocation(window.location.pathname, new URLSearchParams(window.location.search));
}

function sameActivation(
  first: PendingSearchFollowupActivation | null,
  second: PendingSearchFollowupActivation,
): boolean {
  return first !== null && first.id === second.id;
}

function sameAnalyticsContext(
  first: SearchJourneyAnalyticsContext | null,
  second: SearchJourneyAnalyticsContext,
): boolean {
  return (
    first !== null &&
    first.journeyContextId === second.journeyContextId &&
    first.searchContextId === second.searchContextId
  );
}

function createSearchContextId(activationId: number): string {
  try {
    if (typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // Older browser and test runtimes use the activation-local fallback.
  }
  return `search-context-${Date.now().toString(36)}-${activationId.toString(36)}`;
}

function buildSearchActivationContext(params: {
  route: string;
  activationId: number;
  sourceContext: SearchJourneyAnalyticsContext | null;
}): SearchJourneyAnalyticsContext | undefined {
  let url: URL;
  try {
    url = new URL(params.route, "http://lighthouse.local");
  } catch {
    return params.sourceContext ?? undefined;
  }
  if (url.pathname !== "/search") return params.sourceContext ?? undefined;

  const searchContextId = createSearchContextId(params.activationId);
  return {
    journeyContextId: params.sourceContext?.journeyContextId ?? searchContextId,
    searchContextId,
    ...(params.sourceContext?.searchContextId
      ? { parentSearchContextId: params.sourceContext.searchContextId }
      : {}),
  };
}

function emitSearchActivationSubmitted(
  route: string,
  context: SearchJourneyAnalyticsContext | undefined,
): void {
  if (!context) return;
  let url: URL;
  try {
    url = new URL(route, "http://lighthouse.local");
  } catch {
    return;
  }
  if (url.pathname !== "/search") return;
  const query = url.searchParams.get("q")?.trim() ?? "";
  const entrySource = url.searchParams.get("entry");
  if (!query || !entrySource) return;
  if (
    entrySource !== "route-bar" &&
    entrySource !== "empty-entry" &&
    entrySource !== "requery" &&
    entrySource !== "term" &&
    entrySource !== "position" &&
    entrySource !== "similar"
  ) {
    return;
  }

  const yearFilter = url.searchParams.get("year");
  const seedPaperId = url.searchParams.get("seedPaperId");
  void import("@/app/lib/track")
    .then(({ trackSearchSubmitted }) => {
      trackSearchSubmitted({
        ...context,
        entrySource,
        queryLength: query.length,
        sort: url.searchParams.get("sort") ?? "unknown",
        ...(yearFilter ? { yearFilter } : {}),
        ...(seedPaperId ? { seedPaperId } : {}),
      });
    })
    .catch(() => undefined);
}

export function SearchFollowupActivationProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingSearchFollowupActivation | null>(null);
  const [conditionUrlRejected, setConditionUrlRejected] = useState(false);
  const [currentAnalyticsContext, setCurrentAnalyticsContext] =
    useState<SearchJourneyAnalyticsContext | null>(null);
  const nextActivationIdRef = useRef(0);

  const clearIfStillPending = useCallback(
    (activation: PendingSearchFollowupActivation | null | undefined) => {
      if (!activation) return;
      setPending((current) => (sameActivation(current, activation) ? null : current));
    },
    [],
  );

  const startActivation = useCallback(
    (params: { route: string; query: string; originLocation?: string }) => {
      const originLocation = params.originLocation ?? currentRouteLocation();
      setConditionUrlRejected(false);
      if (params.route === originLocation) return null;

      nextActivationIdRef.current += 1;
      const analyticsContext = buildSearchActivationContext({
        route: params.route,
        activationId: nextActivationIdRef.current,
        sourceContext: currentAnalyticsContext,
      });
      const activation: PendingSearchFollowupActivation = {
        id: nextActivationIdRef.current,
        route: params.route,
        query: params.query,
        originLocation,
        ...(analyticsContext ? { analyticsContext } : {}),
      };
      setPending(activation);
      emitSearchActivationSubmitted(params.route, analyticsContext);
      return activation;
    },
    [currentAnalyticsContext],
  );
  const acceptConditionUrl = useCallback(() => {
    setConditionUrlRejected(false);
  }, []);
  const reportConditionUrlRejected = useCallback(() => {
    setPending(null);
    setConditionUrlRejected(true);
  }, []);
  const registerAnalyticsContext = useCallback((context: SearchJourneyAnalyticsContext) => {
    setCurrentAnalyticsContext(context);
  }, []);
  const clearAnalyticsContextIfCurrent = useCallback((context: SearchJourneyAnalyticsContext) => {
    setCurrentAnalyticsContext((current) =>
      sameAnalyticsContext(current, context) ? null : current,
    );
  }, []);

  useEffect(() => {
    if (!pending) return;
    const timeout = globalThis.setTimeout(() => {
      clearIfStillPending(pending);
    }, SEARCH_FOLLOWUP_ACTIVATION_STALE_TIMEOUT_MS);
    return () => {
      globalThis.clearTimeout(timeout);
    };
  }, [clearIfStillPending, pending]);

  const value = useMemo(
    () => ({
      pending,
      conditionUrlRejected,
      startActivation,
      clearIfStillPending,
      acceptConditionUrl,
      reportConditionUrlRejected,
      currentAnalyticsContext,
      registerAnalyticsContext,
      clearAnalyticsContextIfCurrent,
    }),
    [
      acceptConditionUrl,
      clearAnalyticsContextIfCurrent,
      clearIfStillPending,
      conditionUrlRejected,
      currentAnalyticsContext,
      pending,
      registerAnalyticsContext,
      reportConditionUrlRejected,
      startActivation,
    ],
  );

  return (
    <SearchFollowupActivationContext.Provider value={value}>
      {children}
    </SearchFollowupActivationContext.Provider>
  );
}

export function useSearchFollowupActivation(): SearchFollowupActivationContextValue {
  return useContext(SearchFollowupActivationContext) ?? EMPTY_SEARCH_FOLLOWUP_ACTIVATION_CONTEXT;
}

export function useSearchJourneyAnalyticsContext(
  routeDocumentId: string,
): SearchJourneyAnalyticsContext {
  const { pending, registerAnalyticsContext, clearAnalyticsContextIfCurrent } =
    useSearchFollowupActivation();
  const [context] = useState<SearchJourneyAnalyticsContext>(() => {
    const arrivedActivation =
      pending && pending.route === currentRouteLocation() ? pending.analyticsContext : undefined;
    return (
      arrivedActivation ?? {
        journeyContextId: routeDocumentId,
        searchContextId: routeDocumentId,
      }
    );
  });

  useEffect(() => {
    registerAnalyticsContext(context);
    return () => {
      clearAnalyticsContextIfCurrent(context);
    };
  }, [clearAnalyticsContextIfCurrent, context, registerAnalyticsContext]);

  return context;
}
