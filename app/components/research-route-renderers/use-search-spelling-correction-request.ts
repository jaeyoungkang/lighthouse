"use client";

import { useEffect } from "react";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import {
  buildSearchSpellingCorrectionCommandV1,
  searchSpellingCorrectionDeltaResponseV1Schema,
} from "@/app/domain/search-background-transport";
import { API_ROUTES } from "@/app/lib/api-routes";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { advanceUpdatedAtAfterCurrent } from "@/app/stores/research-route-store-internals";
import { isApiErrorRetryable, readApiResponseError } from "@/app/lib/api-error-response";

// Search result subtrees can remount while one request is in flight. Module-scoped
// tracking dedupes that work inside an execution, while the execution id ensures a
// same-URL re-entry can evaluate again and cannot accept the prior completion.
const SPELLING_CORRECTION_CLIENT_TIMEOUT_MS = 25_000;

interface InFlightSpellingCorrectionRequest {
  cancellation: Promise<never>;
  cancel: (reason?: DOMException) => void;
  cleanup: () => void;
  controller: AbortController;
}

const inFlightRequests = new Map<string, InFlightSpellingCorrectionRequest>();
let resolvedRequestKey: string | null = null;

export function __resetSpellingCorrectionRequestTrackingForTests(): void {
  for (const request of inFlightRequests.values()) {
    request.cancel();
    request.cleanup();
  }
  inFlightRequests.clear();
  resolvedRequestKey = null;
}

function createInFlightSpellingCorrectionRequest(params: {
  executionId: string;
  requestKey: string;
}): InFlightSpellingCorrectionRequest {
  const controller = new AbortController();
  let rejectCancellation: (error: DOMException) => void = () => undefined;
  let cancelled = false;
  let cleaned = false;
  const cancellation = new Promise<never>((_resolve, reject) => {
    rejectCancellation = reject;
  });
  const cancel = (
    reason: DOMException = new DOMException("spelling correction request cancelled", "AbortError"),
  ) => {
    if (cancelled) return;
    cancelled = true;
    controller.abort(reason);
    rejectCancellation(reason);
  };
  const unsubscribe = useResearchRouteStore.subscribe((state) => {
    if (state.activeExecutionId !== params.executionId) cancel();
  });
  const timeout = globalThis.setTimeout(() => {
    cancel(new DOMException("spelling correction request timed out", "TimeoutError"));
  }, SPELLING_CORRECTION_CLIENT_TIMEOUT_MS);
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    globalThis.clearTimeout(timeout);
    unsubscribe();
    if (inFlightRequests.get(params.requestKey) === request) {
      inFlightRequests.delete(params.requestKey);
    }
  };
  const request = { cancellation, cancel, cleanup, controller };
  return request;
}

function rememberResolvedRequest(requestKey: string): void {
  resolvedRequestKey = requestKey;
}

export function useSearchSpellingCorrectionRequest(params: {
  activeExecutionId: string | null;
  metadata: SearchMetadata;
  isSearching: boolean;
  sourceSnapshotId: string;
  patchCurrentView: (document: ResearchRoutePayload, expectedExecutionId: string) => void;
}) {
  const { activeExecutionId, isSearching, metadata, patchCurrentView, sourceSnapshotId } = params;
  useEffect(() => {
    const normalizedQuery = metadata.query.trim();
    if (!normalizedQuery || metadata.spellingCorrection || isSearching || !activeExecutionId) {
      return;
    }
    const routeStateBeforeRequest = useResearchRouteStore.getState();
    const targetView = routeStateBeforeRequest.currentView;
    if (
      routeStateBeforeRequest.activeExecutionId !== activeExecutionId ||
      targetView?.id !== sourceSnapshotId ||
      targetView.metadata.type !== "search" ||
      targetView.metadata !== metadata ||
      targetView.metadata.query.trim() !== normalizedQuery
    ) {
      return;
    }
    const requestKey = `${activeExecutionId}:${sourceSnapshotId}:${normalizedQuery}`;
    if (inFlightRequests.has(requestKey) || resolvedRequestKey === requestKey) return;

    const inFlightRequest = createInFlightSpellingCorrectionRequest({
      executionId: activeExecutionId,
      requestKey,
    });
    inFlightRequests.set(requestKey, inFlightRequest);
    const request = (async () => {
      if (inFlightRequest.controller.signal.aborted) {
        throw new DOMException("spelling correction request cancelled", "AbortError");
      }
      const response = (await fetch(API_ROUTES.SEARCH_SPELLING_CORRECTION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildSearchSpellingCorrectionCommandV1(normalizedQuery)),
        signal: inFlightRequest.controller.signal,
      })) as Response | undefined;
      if (!response) throw new TypeError("spelling correction response is missing");
      if (!response.ok) {
        throw await readApiResponseError(response, "spelling correction request failed");
      }
      const payload = searchSpellingCorrectionDeltaResponseV1Schema.safeParse(
        await response.json().catch((): unknown => null),
      );
      if (!payload.success || payload.data.target.query !== normalizedQuery) {
        throw new Error("spelling correction response is invalid");
      }
      return { payload: payload.data };
    })();
    const settledRequest = Promise.race([request, inFlightRequest.cancellation]);
    if (useResearchRouteStore.getState().activeExecutionId !== activeExecutionId) {
      inFlightRequest.cancel();
    }
    void settledRequest
      .then((result) => {
        const { payload } = result;
        const spellingCorrection = payload.delta.spellingCorrection;
        if (spellingCorrection) {
          const routeState = useResearchRouteStore.getState();
          const currentView = routeState.currentView;
          if (
            routeState.activeExecutionId === activeExecutionId &&
            currentView?.id === sourceSnapshotId &&
            currentView.type === "search" &&
            currentView.metadata.query.trim() === normalizedQuery
          ) {
            patchCurrentView(
              {
                ...currentView,
                metadata: {
                  ...currentView.metadata,
                  spellingCorrection,
                },
                updatedAt: advanceUpdatedAtAfterCurrent(currentView.updatedAt, payload.updatedAt),
              },
              activeExecutionId,
            );
          }
        }
        rememberResolvedRequest(requestKey);
      })
      .catch((error: unknown) => {
        if (!isApiErrorRetryable(error)) {
          rememberResolvedRequest(requestKey);
        }
        // Only transport, overload, transient server, or malformed-response
        // failures remain retryable on a later mount.
      })
      .finally(() => {
        inFlightRequest.cleanup();
      });
  }, [
    activeExecutionId,
    isSearching,
    metadata,
    metadata.query,
    metadata.spellingCorrection,
    patchCurrentView,
    sourceSnapshotId,
  ]);
}
