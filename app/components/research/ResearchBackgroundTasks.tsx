"use client";

// @promise promise:inline-analysis-auto-run
// @promise promise:search-query-route-transition
// @promise promise:graph-neighbor-papers
// @aspect aspect:provider-failure-degraded-mode
// @check acceptance-check:inline-analysis-auto-run-exposed-card-start
// @check acceptance-check:inline-analysis-auto-run-visible-first-priority
// @check acceptance-check:search-query-route-transition-route-owned-render
// @check acceptance-check:graph-neighbor-papers-card-data-hydration

import { useEffect, useRef } from "react";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { selectInlineAnalysisBatch, updateInlineAnalysisProgress } from "@/app/lib/inline-analysis";
import { INLINE_ANALYSIS_BATCH_SIZE } from "@/app/components/research-route-renderers/use-inline-analysis";
import { runInlineAnalysisTask } from "@/app/components/research/background-inline-analysis";
import {
  runSearchEnrichmentTask,
  getSearchEnrichmentAttemptKey,
  shouldQueueSearchEnrichment,
  type SearchEnrichmentTask,
} from "@/app/components/research/background-search-tasks";
import {
  getGraphNeighborHydrationAttemptKey,
  runGraphNeighborHydrationTask,
  shouldQueueGraphNeighborHydration,
  type GraphNeighborHydrationTask,
} from "@/app/components/research/background-graph-neighbor-hydration";
import { useTermDiscoveryBackgroundTasks } from "@/app/components/research/background-term-discovery";

function definedTaskValues<T>(tasks: Partial<Record<string, T>>): T[] {
  return Object.values(tasks).filter((task): task is T => task != null);
}

interface ActiveHydrationAttempt {
  attemptKey: string;
  controller: AbortController;
}

export function ResearchBackgroundTasks() {
  const currentView = useResearchRouteStore((state) => state.currentView);
  const activeExecutionId = useResearchRouteStore((state) => state.activeExecutionId);
  const pendingRouteAiCommentRegeneration = useResearchRouteStore(
    (state) => state.pendingRouteAiCommentRegeneration,
  );
  const routeAiCommentGenerationStarted = useResearchRouteStore(
    (state) => state.routeAiCommentGenerationStarted,
  );
  const inlineAnalysisTasks = useBackgroundTaskStore((state) => state.inlineAnalysisTasks);
  const clearInlineAnalysisTask = useBackgroundTaskStore((state) => state.clearInlineAnalysisTask);
  const setInlineAnalysisTaskState = useBackgroundTaskStore(
    (state) => state.setInlineAnalysisTaskState,
  );
  const activeInlineAnalysisControllersRef = useRef(new Map<string, AbortController>());
  const activeSearchEnrichmentControllersRef = useRef(new Map<string, ActiveHydrationAttempt>());
  const activeGraphNeighborHydrationControllersRef = useRef(
    new Map<string, ActiveHydrationAttempt>(),
  );
  const completedNoopSearchEnrichmentKeyRef = useRef<string | null>(null);
  const completedGraphNeighborHydrationKeyRef = useRef<string | null>(null);

  // 연구 용어 background 추출은 자체 hook이 큐잉·실행·정리를 담당한다.
  useTermDiscoveryBackgroundTasks();

  useEffect(() => {
    const inlineAnalysisControllers = activeInlineAnalysisControllersRef.current;
    const searchEnrichmentControllers = activeSearchEnrichmentControllersRef.current;
    const graphNeighborHydrationControllers = activeGraphNeighborHydrationControllersRef.current;

    return () => {
      for (const controller of inlineAnalysisControllers.values()) {
        controller.abort();
      }
      inlineAnalysisControllers.clear();

      for (const attempt of searchEnrichmentControllers.values()) {
        attempt.controller.abort();
      }
      searchEnrichmentControllers.clear();

      for (const attempt of graphNeighborHydrationControllers.values()) {
        attempt.controller.abort();
      }
      graphNeighborHydrationControllers.clear();
    };
  }, []);

  // Background 작업의 수명은 현재 route 뷰에 귀속된다. 뷰가 다른 route view로
  // 바뀌면(route 전환 포함) 떠난 뷰의 inline 분석·enrichment는 중단하고
  // 폐기한다 — 갱신할 화면이 없는 작업이 LLM/provider 호출을 계속 소모하지
  // 않게 한다.
  // @check acceptance-check:search-query-route-transition-route-owned-render
  useEffect(() => {
    const currentViewId = currentView?.id ?? null;
    const currentExecutionId = activeExecutionId;

    for (const [executionId, controller] of activeInlineAnalysisControllersRef.current) {
      if (executionId === currentExecutionId) continue;
      controller.abort();
      activeInlineAnalysisControllersRef.current.delete(executionId);
    }

    for (const task of definedTaskValues(inlineAnalysisTasks)) {
      if (task.documentId === currentViewId && task.executionId === currentExecutionId) {
        continue;
      }
      clearInlineAnalysisTask(task.documentId);
    }

    for (const [executionId, attempt] of activeSearchEnrichmentControllersRef.current) {
      if (executionId === currentExecutionId) {
        continue;
      }
      attempt.controller.abort();
      activeSearchEnrichmentControllersRef.current.delete(executionId);
    }

    for (const [executionId, attempt] of activeGraphNeighborHydrationControllersRef.current) {
      if (executionId === currentExecutionId) {
        continue;
      }
      attempt.controller.abort();
      activeGraphNeighborHydrationControllersRef.current.delete(executionId);
    }
  }, [activeExecutionId, clearInlineAnalysisTask, currentView, inlineAnalysisTasks]);

  useEffect(() => {
    const document = currentView;
    if (!document || !activeExecutionId || document.type !== "search") {
      return;
    }
    if (!shouldQueueSearchEnrichment(document)) {
      return;
    }
    const attemptKey = getSearchEnrichmentAttemptKey(document);
    const executionAttemptKey = `${activeExecutionId}:${attemptKey}`;
    if (completedNoopSearchEnrichmentKeyRef.current === executionAttemptKey) {
      return;
    }
    const activeAttempt = activeSearchEnrichmentControllersRef.current.get(activeExecutionId);
    if (activeAttempt?.attemptKey === attemptKey) {
      return;
    }
    activeAttempt?.controller.abort();
    const controller = new AbortController();
    const attempt: ActiveHydrationAttempt = { attemptKey, controller };
    activeSearchEnrichmentControllersRef.current.set(activeExecutionId, attempt);
    const task: SearchEnrichmentTask = {
      executionId: activeExecutionId,
      documentId: document.id,
      ownerPrincipalId: document.ownerPrincipalId,
      query: document.metadata.query,
      metadata: document.metadata,
    };

    void runSearchEnrichmentTask({
      task,
      controller,
    })
      .then((resultDocument) => {
        if (!resultDocument && !controller.signal.aborted) {
          const routeState = useResearchRouteStore.getState();
          const latestDocument = routeState.currentView;
          if (
            routeState.activeExecutionId === activeExecutionId &&
            latestDocument?.id === document.id &&
            shouldQueueSearchEnrichment(latestDocument) &&
            getSearchEnrichmentAttemptKey(latestDocument) === attemptKey
          ) {
            completedNoopSearchEnrichmentKeyRef.current = executionAttemptKey;
          }
          return;
        }
        if (
          resultDocument &&
          shouldQueueSearchEnrichment(resultDocument) &&
          getSearchEnrichmentAttemptKey(resultDocument) === attemptKey
        ) {
          completedNoopSearchEnrichmentKeyRef.current = executionAttemptKey;
        }
      })
      .finally(() => {
        if (activeSearchEnrichmentControllersRef.current.get(activeExecutionId) === attempt) {
          activeSearchEnrichmentControllersRef.current.delete(activeExecutionId);
        }
      });
  }, [activeExecutionId, currentView]);

  useEffect(() => {
    const document = currentView;
    if (!document || !activeExecutionId || !shouldQueueGraphNeighborHydration(document)) {
      return;
    }
    const attemptKey = getGraphNeighborHydrationAttemptKey(document);
    const executionAttemptKey = `${activeExecutionId}:${attemptKey}`;
    if (completedGraphNeighborHydrationKeyRef.current === executionAttemptKey) {
      return;
    }
    const activeAttempt = activeGraphNeighborHydrationControllersRef.current.get(activeExecutionId);
    if (activeAttempt?.attemptKey === attemptKey) {
      return;
    }
    activeAttempt?.controller.abort();
    const controller = new AbortController();
    const attempt: ActiveHydrationAttempt = { attemptKey, controller };
    activeGraphNeighborHydrationControllersRef.current.set(activeExecutionId, attempt);
    const task: GraphNeighborHydrationTask = {
      executionId: activeExecutionId,
      documentId: document.id,
      ownerPrincipalId: document.ownerPrincipalId,
      metadata: document.metadata,
    };

    void runGraphNeighborHydrationTask({
      task,
      controller,
    })
      .then((resultDocument) => {
        if (
          resultDocument &&
          shouldQueueGraphNeighborHydration(resultDocument) &&
          getGraphNeighborHydrationAttemptKey(resultDocument) === attemptKey
        ) {
          completedGraphNeighborHydrationKeyRef.current = executionAttemptKey;
        }
      })
      .finally(() => {
        if (activeGraphNeighborHydrationControllersRef.current.get(activeExecutionId) === attempt) {
          activeGraphNeighborHydrationControllersRef.current.delete(activeExecutionId);
        }
      });
  }, [activeExecutionId, currentView]);

  useEffect(() => {
    for (const task of definedTaskValues(inlineAnalysisTasks)) {
      if (task.status !== "queued") {
        continue;
      }
      if (task.executionId !== activeExecutionId) {
        continue;
      }
      if (activeInlineAnalysisControllersRef.current.has(task.executionId)) {
        continue;
      }
      if (
        currentView?.id === task.documentId &&
        pendingRouteAiCommentRegeneration &&
        !routeAiCommentGenerationStarted
      ) {
        continue;
      }

      const analysisPapers = task.analysisPapers ?? task.metadata.papers;
      const visiblePaperIds =
        task.visiblePaperIds == null ? undefined : new Set(task.visiblePaperIds);
      const batch = selectInlineAnalysisBatch({
        papers: analysisPapers,
        visibleCount: task.visibleCount,
        visiblePaperIds,
        analysisProgressMap: task.progressMap,
        batchSize: INLINE_ANALYSIS_BATCH_SIZE,
      });
      if (batch.length === 0) {
        const hasError = [...task.progressMap.values()].some((status) => status === "error");
        if (hasError) {
          setInlineAnalysisTaskState(task.documentId, { status: "settled" }, task.cycleKey);
        } else {
          clearInlineAnalysisTask(task.documentId, task.cycleKey);
        }
        continue;
      }

      const batchIds = batch.map((paper) => paper.paperId);
      const controller = new AbortController();
      activeInlineAnalysisControllersRef.current.set(task.executionId, controller);

      setInlineAnalysisTaskState(
        task.documentId,
        {
          progressMap: updateInlineAnalysisProgress(task.progressMap, batchIds, "running"),
          status: "running",
        },
        task.cycleKey,
      );

      void runInlineAnalysisTask({
        task: {
          ...task,
          progressMap: updateInlineAnalysisProgress(task.progressMap, batchIds, "running"),
          status: "running",
        },
        batch,
        controller,
        clearInlineAnalysisTask,
        setInlineAnalysisTaskState,
      }).finally(() => {
        if (activeInlineAnalysisControllersRef.current.get(task.executionId) === controller) {
          activeInlineAnalysisControllersRef.current.delete(task.executionId);
        }
        const latestTask = useBackgroundTaskStore.getState().inlineAnalysisTasks[task.documentId];
        if (latestTask?.executionId === task.executionId && latestTask.status === "queued") {
          setInlineAnalysisTaskState(task.documentId, { status: "queued" }, latestTask.cycleKey);
        }
      });
    }
  }, [
    clearInlineAnalysisTask,
    activeExecutionId,
    inlineAnalysisTasks,
    currentView?.id,
    pendingRouteAiCommentRegeneration,
    routeAiCommentGenerationStarted,
    setInlineAnalysisTaskState,
  ]);

  return null;
}
