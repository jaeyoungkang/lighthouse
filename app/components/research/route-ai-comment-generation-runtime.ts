"use client";

// @promise promise:route-view-ai-comment-inline-surface
// @promise promise:search-reaction-summarizes-terrain
// @promise promise:graph-neighbor-papers
// @promise promise:reaction-from-visible-snapshot
// @aspect aspect:library-grounded-research
// @aspect aspect:route-view-ai-reaction-rules
// @check acceptance-check:search-reaction-summarizes-terrain-generation-boundary
// @check acceptance-check:route-view-ai-comment-inline-surface-generation-pending-visible
// @check acceptance-check:search-reaction-summarizes-terrain-library-grounding
// @check acceptance-check:graph-neighbor-papers-reaction-own-view
// @check acceptance-check:reaction-from-visible-snapshot-snapshot-input
// @check acceptance-check:reaction-from-visible-snapshot-basis-match
// @check acceptance-check:reaction-from-visible-snapshot-ephemeral-lifetime

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import {
  getResearchRouteViewerPrincipalId,
  type ResearchRoutePayload,
} from "@/app/domain/research-route-payload";
import type { RouteAiComment } from "@/app/domain/route-ai-comment";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { requestRouteAiCommentGeneration } from "@/app/components/research/route-ai-comment-generation-client";
import {
  ROUTE_AI_COMMENT_GENERATION_COALESCE_WINDOW_MS,
  drainNextRouteAiCommentGeneration,
  enqueueRouteAiCommentGeneration,
  type QueuedRouteAiCommentGeneration,
} from "@/app/components/research/route-ai-comment-generation-scheduler";
import {
  buildRouteAiCommentGenerationCommand,
  isRouteAiCommentGenerationWaitingForHydration,
} from "@/app/components/research/research-route-runtime.helpers";
import { buildViewSnapshotProjectionKey } from "@/app/domain/view-snapshot";

function useRouteAiCommentBootstrap(params: {
  executionId: string;
  document: ResearchRoutePayload | null;
  bootstrapViewId: string | null;
  lastBootstrappedReactionKeyRef: RefObject<string | null>;
  markRouteAiCommentGenerationPending: (documentId: string, executionId: string) => void;
  clearRouteAiCommentRegeneration: (documentId: string, executionId: string) => void;
  enqueueAndScheduleRouteAiCommentGeneration: (command: QueuedRouteAiCommentGeneration) => void;
}) {
  const {
    executionId,
    bootstrapViewId,
    document,
    lastBootstrappedReactionKeyRef,
    markRouteAiCommentGenerationPending,
    clearRouteAiCommentRegeneration,
    enqueueAndScheduleRouteAiCommentGeneration,
  } = params;
  useLayoutEffect(() => {
    if (!document || document.id !== bootstrapViewId) return;
    const routeState = useResearchRouteStore.getState();
    const command = buildRouteAiCommentGenerationCommand(document);
    if (routeState.activeExecutionId !== executionId) return;
    if (!command) {
      if (isRouteAiCommentGenerationWaitingForHydration(document)) {
        if (routeState.routeAiComment == null) {
          markRouteAiCommentGenerationPending(document.id, executionId);
        }
      } else {
        clearRouteAiCommentRegeneration(document.id, executionId);
      }
      return;
    }
    // The dedup key includes the reaction generation (advanced only when the
    // active reaction is cleared): metadata-only mutations stay deduped,
    // while a query transition owes a fresh route AI comment generation.
    const generation = routeState.reactionGeneration;
    const projectionKey = buildViewSnapshotProjectionKey(command.viewSnapshot);
    const key = [
      command.ownerPrincipalId,
      command.trigger,
      document.id,
      String(generation),
      projectionKey,
    ].join(":");
    if (lastBootstrappedReactionKeyRef.current === key) return;
    const hasSettledReaction = routeState.routeAiComment != null;
    const shouldResumeSettledRegeneration =
      hasSettledReaction && routeState.pendingRouteAiCommentRegeneration;
    if (!hasSettledReaction) {
      markRouteAiCommentGenerationPending(document.id, executionId);
    }
    // Unfaceted search terrain is fixed before first reveal. Hydration-dependent
    // facets and lightweight graph-neighbor authors wait for their one stable
    // visible projection while the host keeps the pending state visible.
    lastBootstrappedReactionKeyRef.current = key;
    if (hasSettledReaction && !shouldResumeSettledRegeneration) return;
    enqueueAndScheduleRouteAiCommentGeneration({
      executionId,
      trigger: command.trigger,
      createdAt: Date.now(),
      ownerPrincipalId: command.ownerPrincipalId,
      targetRoutePayloadId: command.targetRoutePayloadId,
      viewSnapshot: command.viewSnapshot,
      reactionGeneration: generation,
    });
  }, [
    bootstrapViewId,
    clearRouteAiCommentRegeneration,
    document,
    enqueueAndScheduleRouteAiCommentGeneration,
    executionId,
    lastBootstrappedReactionKeyRef,
    markRouteAiCommentGenerationPending,
  ]);
}

export function getAiCommentGenerationForTargetPayload(
  targetRoutePayloadId: string | null | undefined,
  expectedExecutionId: string,
) {
  if (targetRoutePayloadId == null) return undefined;
  const state = useResearchRouteStore.getState();
  if (state.currentView?.id !== targetRoutePayloadId) return undefined;
  if (state.activeExecutionId !== expectedExecutionId) {
    return undefined;
  }
  return state.reactionGeneration;
}

function clearQueuedRegenerationFlags(
  queue: readonly QueuedRouteAiCommentGeneration[],
  clearRouteAiCommentRegeneration: (documentId: string, executionId: string) => void,
) {
  for (const command of queue) {
    clearRouteAiCommentRegeneration(command.targetRoutePayloadId, command.executionId);
  }
}

function clearCurrentActiveRegenerationFlag(
  activeCommandRef: RefObject<QueuedRouteAiCommentGeneration | null>,
  clearRouteAiCommentRegeneration: (documentId: string, executionId: string) => void,
) {
  const command = activeCommandRef.current;
  if (command) {
    clearRouteAiCommentRegeneration(command.targetRoutePayloadId, command.executionId);
  }
}

function useRouteAiCommentGenerationTimeoutCleanup(params: {
  flushRef: RefObject<number | null>;
  pendingRouteAiCommentGenerationsRef: RefObject<QueuedRouteAiCommentGeneration[]>;
  activeRouteAiCommentCommandRef: RefObject<QueuedRouteAiCommentGeneration | null>;
  activeRouteAiCommentAbortControllerRef: RefObject<AbortController | null>;
  clearRouteAiCommentRegeneration: (documentId: string, executionId: string) => void;
}) {
  const {
    activeRouteAiCommentAbortControllerRef,
    activeRouteAiCommentCommandRef,
    clearRouteAiCommentRegeneration,
    flushRef,
    pendingRouteAiCommentGenerationsRef,
  } = params;
  useEffect(() => {
    return () => {
      if (flushRef.current != null) {
        window.clearTimeout(flushRef.current);
        flushRef.current = null;
      }
      activeRouteAiCommentAbortControllerRef.current?.abort();
      activeRouteAiCommentAbortControllerRef.current = null;
      clearQueuedRegenerationFlags(
        pendingRouteAiCommentGenerationsRef.current,
        clearRouteAiCommentRegeneration,
      );
      clearCurrentActiveRegenerationFlag(
        activeRouteAiCommentCommandRef,
        clearRouteAiCommentRegeneration,
      );
      pendingRouteAiCommentGenerationsRef.current = [];
    };
  }, [
    activeRouteAiCommentAbortControllerRef,
    activeRouteAiCommentCommandRef,
    clearRouteAiCommentRegeneration,
    flushRef,
    pendingRouteAiCommentGenerationsRef,
  ]);
}

function isCurrentExecutionReactionCommand(command: QueuedRouteAiCommentGeneration): boolean {
  const documentStoreState = useResearchRouteStore.getState();
  const currentView = documentStoreState.currentView;
  return (
    currentView?.id === command.targetRoutePayloadId &&
    documentStoreState.activeExecutionId === command.executionId &&
    getResearchRouteViewerPrincipalId(currentView) === command.ownerPrincipalId
  );
}

function isCurrentViewReactionCommand(command: QueuedRouteAiCommentGeneration): boolean {
  if (!isCurrentExecutionReactionCommand(command)) return false;
  const currentView = useResearchRouteStore.getState().currentView;
  if (!currentView) return false;
  const currentCommand = buildRouteAiCommentGenerationCommand(currentView);
  return (
    currentCommand != null &&
    currentCommand.trigger === command.trigger &&
    buildViewSnapshotProjectionKey(currentCommand.viewSnapshot) ===
      buildViewSnapshotProjectionKey(command.viewSnapshot)
  );
}

function isSameActiveRouteAiCommentGeneration(
  activeCommand: QueuedRouteAiCommentGeneration | null,
  nextCommand: QueuedRouteAiCommentGeneration,
): boolean {
  return (
    activeCommand?.trigger === nextCommand.trigger &&
    activeCommand.executionId === nextCommand.executionId &&
    activeCommand.targetRoutePayloadId === nextCommand.targetRoutePayloadId &&
    buildViewSnapshotProjectionKey(activeCommand.viewSnapshot) ===
      buildViewSnapshotProjectionKey(nextCommand.viewSnapshot) &&
    activeCommand.reactionGeneration === nextCommand.reactionGeneration
  );
}

function resolveQueuedCommandCurrentFreshness(command: QueuedRouteAiCommentGeneration): {
  rebasedCommand: QueuedRouteAiCommentGeneration | null;
  shouldClearRegeneration: boolean;
  shouldWaitForHydration: boolean;
} {
  const routeState = useResearchRouteStore.getState();
  const currentView = routeState.currentView;
  if (
    currentView?.id !== command.targetRoutePayloadId ||
    routeState.activeExecutionId !== command.executionId ||
    getResearchRouteViewerPrincipalId(currentView) !== command.ownerPrincipalId
  ) {
    return {
      rebasedCommand: null,
      shouldClearRegeneration: false,
      shouldWaitForHydration: false,
    };
  }
  const sameGeneration = routeState.reactionGeneration === command.reactionGeneration;
  if (!sameGeneration) {
    return {
      rebasedCommand: null,
      shouldClearRegeneration: false,
      shouldWaitForHydration: false,
    };
  }
  const currentCommand = buildRouteAiCommentGenerationCommand(currentView);
  const shouldWaitForHydration = isRouteAiCommentGenerationWaitingForHydration(currentView);
  return {
    rebasedCommand:
      currentCommand?.trigger === command.trigger
        ? {
            ...command,
            createdAt: Date.now(),
            viewSnapshot: currentCommand.viewSnapshot,
          }
        : null,
    shouldClearRegeneration: currentCommand == null && !shouldWaitForHydration,
    shouldWaitForHydration,
  };
}

function isRouteAiCommentGenerationResultForCommand(
  command: QueuedRouteAiCommentGeneration,
  result: Awaited<ReturnType<typeof requestRouteAiCommentGeneration>>,
): boolean {
  return (
    result.snapshotId === command.targetRoutePayloadId &&
    result.snapshotKind === command.viewSnapshot.snapshotKind
  );
}

function logRouteAiCommentGenerationFailure(
  command: QueuedRouteAiCommentGeneration,
  expectedGeneration: number,
  error: unknown,
) {
  console.error("[route-ai-comment-generation] request failed", {
    ownerPrincipalId: command.ownerPrincipalId,
    documentId: command.targetRoutePayloadId,
    trigger: command.trigger,
    reactionGeneration: expectedGeneration,
    error,
  });
}

interface RouteAiCommentGenerationRunnerParams {
  activeCommandRef: RefObject<QueuedRouteAiCommentGeneration | null>;
  activeAbortControllerRef: RefObject<AbortController | null>;
  setRouteAiComment: RouteAiCommentGenerationRuntimeParams["setRouteAiComment"];
  markRouteAiCommentGenerationStarted: RouteAiCommentGenerationRuntimeParams["markRouteAiCommentGenerationStarted"];
  clearRouteAiCommentRegeneration: RouteAiCommentGenerationRuntimeParams["clearRouteAiCommentRegeneration"];
}

function useRouteAiCommentGenerationRunner(params: RouteAiCommentGenerationRunnerParams) {
  const {
    activeAbortControllerRef,
    activeCommandRef,
    clearRouteAiCommentRegeneration,
    markRouteAiCommentGenerationStarted,
    setRouteAiComment,
  } = params;
  const settleFailure = useCallback(
    (command: QueuedRouteAiCommentGeneration, expectedGeneration: number) => {
      if (!isCurrentViewReactionCommand(command)) return;
      const currentGeneration = useResearchRouteStore.getState().reactionGeneration;
      if (currentGeneration !== expectedGeneration) return;
      clearRouteAiCommentRegeneration(command.targetRoutePayloadId, command.executionId);
    },
    [clearRouteAiCommentRegeneration],
  );
  const applyResult = useCallback(
    (
      command: QueuedRouteAiCommentGeneration,
      result: Awaited<ReturnType<typeof requestRouteAiCommentGeneration>>,
    ) => {
      if (!isCurrentExecutionReactionCommand(command)) return;
      if (!isCurrentViewReactionCommand(command)) return;
      const currentGeneration = useResearchRouteStore.getState().reactionGeneration;
      const expectedGeneration = command.reactionGeneration;
      if (currentGeneration !== expectedGeneration) return;
      if (!isRouteAiCommentGenerationResultForCommand(command, result) || !result.reaction) {
        clearRouteAiCommentRegeneration(command.targetRoutePayloadId, command.executionId);
        return;
      }
      setRouteAiComment(
        command.targetRoutePayloadId,
        result.reaction,
        command.executionId,
        buildViewSnapshotProjectionKey(command.viewSnapshot),
      );
    },
    [clearRouteAiCommentRegeneration, setRouteAiComment],
  );
  return useCallback(
    async (command: QueuedRouteAiCommentGeneration) => {
      if (!isCurrentViewReactionCommand(command)) return;
      const expectedGeneration = command.reactionGeneration;

      activeCommandRef.current = command;
      const abortController = new AbortController();
      activeAbortControllerRef.current = abortController;
      markRouteAiCommentGenerationStarted(command.targetRoutePayloadId, command.executionId);
      try {
        const result = await requestRouteAiCommentGeneration({
          documentId: command.targetRoutePayloadId,
          trigger: command.trigger,
          reactionGeneration: expectedGeneration,
          createdAt: command.createdAt,
          viewSnapshot: command.viewSnapshot,
          signal: abortController.signal,
        });
        if (abortController.signal.aborted) return;
        applyResult(command, result);
      } catch (error) {
        if (!abortController.signal.aborted) {
          logRouteAiCommentGenerationFailure(command, expectedGeneration, error);
          settleFailure(command, expectedGeneration);
        }
      } finally {
        if (activeCommandRef.current === command) activeCommandRef.current = null;
        if (activeAbortControllerRef.current === abortController) {
          activeAbortControllerRef.current = null;
        }
      }
    },
    [
      activeAbortControllerRef,
      activeCommandRef,
      applyResult,
      markRouteAiCommentGenerationStarted,
      settleFailure,
    ],
  );
}

interface RouteAiCommentGenerationRuntimeParams {
  executionId: string;
  document: ResearchRoutePayload | null;
  bootstrapViewId: string | null;
  setRouteAiComment: (
    documentId: string,
    reaction: RouteAiComment | null,
    executionId: string,
    expectedViewSnapshotProjectionKey?: string,
  ) => void;
  markRouteAiCommentGenerationPending: (documentId: string, executionId: string) => void;
  markRouteAiCommentGenerationStarted: (documentId: string, executionId: string) => void;
  clearRouteAiCommentRegeneration: (documentId: string, executionId: string) => void;
}

function useRouteAiCommentGenerationExecutionReset(params: {
  executionId: string;
  pendingRef: RefObject<QueuedRouteAiCommentGeneration[]>;
  flushRef: RefObject<number | null>;
  lastBootstrapKeyRef: RefObject<string | null>;
  activeCommandRef: RefObject<QueuedRouteAiCommentGeneration | null>;
  activeAbortControllerRef: RefObject<AbortController | null>;
  clearRouteAiCommentRegeneration: (documentId: string, executionId: string) => void;
}) {
  const {
    activeAbortControllerRef,
    activeCommandRef,
    clearRouteAiCommentRegeneration,
    executionId,
    flushRef,
    lastBootstrapKeyRef,
    pendingRef,
  } = params;
  useLayoutEffect(() => {
    activeAbortControllerRef.current?.abort();
    activeAbortControllerRef.current = null;
    clearQueuedRegenerationFlags(pendingRef.current, clearRouteAiCommentRegeneration);
    clearCurrentActiveRegenerationFlag(activeCommandRef, clearRouteAiCommentRegeneration);
    pendingRef.current = [];
    lastBootstrapKeyRef.current = null;
    activeCommandRef.current = null;
    if (flushRef.current != null) {
      window.clearTimeout(flushRef.current);
      flushRef.current = null;
    }
  }, [
    activeAbortControllerRef,
    activeCommandRef,
    clearRouteAiCommentRegeneration,
    executionId,
    flushRef,
    lastBootstrapKeyRef,
    pendingRef,
  ]);
}

export function useRouteAiCommentGenerationRuntime(params: RouteAiCommentGenerationRuntimeParams) {
  const {
    executionId,
    bootstrapViewId,
    clearRouteAiCommentRegeneration,
    document,
    markRouteAiCommentGenerationPending,
    markRouteAiCommentGenerationStarted,
    setRouteAiComment,
  } = params;
  const pendingRouteAiCommentGenerationsRef = useRef<QueuedRouteAiCommentGeneration[]>([]);
  const routeAiCommentGenerationFlushRef = useRef<number | null>(null);
  const lastBootstrappedReactionKeyRef = useRef<string | null>(null);
  const activeRouteAiCommentCommandRef = useRef<QueuedRouteAiCommentGeneration | null>(null);
  const activeRouteAiCommentAbortControllerRef = useRef<AbortController | null>(null);

  useRouteAiCommentGenerationExecutionReset({
    executionId,
    pendingRef: pendingRouteAiCommentGenerationsRef,
    flushRef: routeAiCommentGenerationFlushRef,
    lastBootstrapKeyRef: lastBootstrappedReactionKeyRef,
    activeCommandRef: activeRouteAiCommentCommandRef,
    activeAbortControllerRef: activeRouteAiCommentAbortControllerRef,
    clearRouteAiCommentRegeneration,
  });

  useLayoutEffect(() => {
    const activeCommand = activeRouteAiCommentCommandRef.current;
    if (!activeCommand) return;
    const currentCommand = document ? buildRouteAiCommentGenerationCommand(document) : null;
    const currentProjectionKey = currentCommand
      ? buildViewSnapshotProjectionKey(currentCommand.viewSnapshot)
      : null;
    if (
      currentCommand?.trigger !== activeCommand.trigger ||
      currentProjectionKey !== buildViewSnapshotProjectionKey(activeCommand.viewSnapshot)
    ) {
      if (
        document &&
        currentCommand == null &&
        isRouteAiCommentGenerationWaitingForHydration(document)
      ) {
        lastBootstrappedReactionKeyRef.current = null;
      }
      activeRouteAiCommentAbortControllerRef.current?.abort();
    }
  }, [document]);

  const runRouteAiCommentGeneration = useRouteAiCommentGenerationRunner({
    activeCommandRef: activeRouteAiCommentCommandRef,
    activeAbortControllerRef: activeRouteAiCommentAbortControllerRef,
    setRouteAiComment,
    markRouteAiCommentGenerationStarted,
    clearRouteAiCommentRegeneration,
  });

  const flushNextRouteAiCommentGeneration = useCallback(() => {
    if (routeAiCommentGenerationFlushRef.current != null) {
      window.clearTimeout(routeAiCommentGenerationFlushRef.current);
      routeAiCommentGenerationFlushRef.current = null;
    }
    // Keep scalar command/generation/controller ownership honest. A new
    // reaction generation waits for the active transport to settle.
    if (activeRouteAiCommentAbortControllerRef.current != null) {
      return;
    }

    let nextCommand: QueuedRouteAiCommentGeneration | null = null;
    for (;;) {
      const drained = drainNextRouteAiCommentGeneration(
        pendingRouteAiCommentGenerationsRef.current,
      );
      pendingRouteAiCommentGenerationsRef.current = drained.remaining;
      if (!drained.nextCommand) return;

      if (!isCurrentViewReactionCommand(drained.nextCommand)) {
        const resolution = resolveQueuedCommandCurrentFreshness(drained.nextCommand);
        if (resolution.rebasedCommand) {
          nextCommand = resolution.rebasedCommand;
          break;
        }
        if (resolution.shouldWaitForHydration) {
          // The command's snapshot may still be projection-equivalent while
          // hydration-owned facets are unresolved. Drop this pre-ready command
          // and let destination bootstrap enqueue the terminal ready snapshot.
          lastBootstrappedReactionKeyRef.current = null;
        }
        if (resolution.shouldClearRegeneration) {
          clearRouteAiCommentRegeneration(
            drained.nextCommand.targetRoutePayloadId,
            drained.nextCommand.executionId,
          );
        }
        continue;
      }
      const currentGeneration = useResearchRouteStore.getState().reactionGeneration;
      if (currentGeneration !== drained.nextCommand.reactionGeneration) {
        continue;
      }
      nextCommand = drained.nextCommand;
      break;
    }

    void runRouteAiCommentGeneration(nextCommand).finally(() => {
      if (
        pendingRouteAiCommentGenerationsRef.current.length > 0 &&
        routeAiCommentGenerationFlushRef.current == null
      ) {
        queueMicrotask(flushNextRouteAiCommentGeneration);
      }
    });
  }, [
    activeRouteAiCommentAbortControllerRef,
    clearRouteAiCommentRegeneration,
    runRouteAiCommentGeneration,
  ]);

  const scheduleRouteAiCommentGenerationFlush = useCallback(
    (delayMs: number) => {
      if (routeAiCommentGenerationFlushRef.current != null) {
        window.clearTimeout(routeAiCommentGenerationFlushRef.current);
      }

      routeAiCommentGenerationFlushRef.current = window.setTimeout(() => {
        flushNextRouteAiCommentGeneration();
      }, delayMs);
    },
    [flushNextRouteAiCommentGeneration],
  );

  const enqueueAndScheduleRouteAiCommentGeneration = useCallback(
    (command: QueuedRouteAiCommentGeneration) => {
      if (!isCurrentViewReactionCommand(command)) {
        return;
      }
      if (
        isSameActiveRouteAiCommentGeneration(activeRouteAiCommentCommandRef.current, command) &&
        !activeRouteAiCommentAbortControllerRef.current?.signal.aborted
      ) {
        return;
      }
      if (
        activeRouteAiCommentCommandRef.current != null &&
        buildViewSnapshotProjectionKey(activeRouteAiCommentCommandRef.current.viewSnapshot) !==
          buildViewSnapshotProjectionKey(command.viewSnapshot)
      ) {
        activeRouteAiCommentAbortControllerRef.current?.abort();
      }
      markRouteAiCommentGenerationPending(command.targetRoutePayloadId, command.executionId);
      pendingRouteAiCommentGenerationsRef.current = enqueueRouteAiCommentGeneration(
        pendingRouteAiCommentGenerationsRef.current,
        command,
      );
      scheduleRouteAiCommentGenerationFlush(ROUTE_AI_COMMENT_GENERATION_COALESCE_WINDOW_MS);
    },
    [
      activeRouteAiCommentAbortControllerRef,
      activeRouteAiCommentCommandRef,
      markRouteAiCommentGenerationPending,
      scheduleRouteAiCommentGenerationFlush,
    ],
  );

  useRouteAiCommentBootstrap({
    executionId,
    bootstrapViewId,
    document,
    lastBootstrappedReactionKeyRef,
    markRouteAiCommentGenerationPending,
    clearRouteAiCommentRegeneration,
    enqueueAndScheduleRouteAiCommentGeneration,
  });

  useRouteAiCommentGenerationTimeoutCleanup({
    flushRef: routeAiCommentGenerationFlushRef,
    pendingRouteAiCommentGenerationsRef,
    activeRouteAiCommentCommandRef,
    activeRouteAiCommentAbortControllerRef,
    clearRouteAiCommentRegeneration,
  });

  return {
    enqueueAndScheduleRouteAiCommentGeneration,
  };
}
