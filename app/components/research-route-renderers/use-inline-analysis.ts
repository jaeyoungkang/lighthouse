"use client";

import { useEffect, useMemo } from "react";
import { INLINE_ANALYSIS_REQUEST_PAPER_LIMIT } from "@/app/domain/analysis";
import type {
  CitationLineageMetadata,
  ResearchRoutePayload,
  GraphNeighborsMetadata,
  SearchMetadata,
} from "@/app/domain/research-route-payload";
import {
  type AnalysisProgressState,
  type AnalysisResult,
  buildInlineAnalysisCycleKey,
  buildInlineAnalysisMap,
  buildInlineAnalysisProgressMap,
  hasPendingInlineAnalysis,
  hasSameInlineAnalysisInput,
  queueVisibleInlineAnalysis,
} from "@/app/lib/inline-analysis";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

interface UseInlineAnalysisParams {
  documentId: string;
  ownerPrincipalId: string;
  metadata: SearchMetadata | CitationLineageMetadata | GraphNeighborsMetadata;
  analysisPapers?: SearchMetadata["papers"];
  visiblePaperIds?: readonly string[];
  visibleCount: number;
  onPersistedDocument?: (document: ResearchRoutePayload) => void;
}

export const INLINE_ANALYSIS_BATCH_SIZE = INLINE_ANALYSIS_REQUEST_PAPER_LIMIT;
export const INLINE_ANALYSIS_MAX_MISSING_RETRIES = 2;

export function useInlineAnalysis({
  documentId,
  ownerPrincipalId,
  metadata,
  analysisPapers,
  visiblePaperIds,
  visibleCount,
}: UseInlineAnalysisParams): {
  analysisMap: Map<string, AnalysisResult>;
  analysisProgressMap: Map<string, AnalysisProgressState>;
} {
  const inlineAnalysisCycleKey = useMemo(
    () => buildInlineAnalysisCycleKey(documentId, metadata),
    [documentId, metadata],
  );
  const inlineAnalysisTask = useBackgroundTaskStore(
    (state) => state.inlineAnalysisTasks[documentId],
  );
  const enqueueInlineAnalysisTask = useBackgroundTaskStore(
    (state) => state.enqueueInlineAnalysisTask,
  );
  const activeExecutionId = useResearchRouteStore((state) => state.activeExecutionId);
  const setInlineAnalysisTaskState = useBackgroundTaskStore(
    (state) => state.setInlineAnalysisTaskState,
  );

  const targetPapers = analysisPapers ?? metadata.papers;
  const analysisVisibleCount = visibleCount;
  const visiblePaperIdSet = useMemo(
    () => (visiblePaperIds == null ? undefined : new Set(visiblePaperIds)),
    [visiblePaperIds],
  );
  const analysisMap = useMemo(() => buildInlineAnalysisMap(metadata.papers), [metadata.papers]);
  const changedInputPaperIds = useMemo(() => {
    if (
      inlineAnalysisTask == null ||
      inlineAnalysisTask.executionId !== activeExecutionId ||
      inlineAnalysisTask.cycleKey !== inlineAnalysisCycleKey
    ) {
      return new Set<string>();
    }
    return findChangedInlineAnalysisInputPaperIds(
      inlineAnalysisTask.analysisPapers ?? inlineAnalysisTask.metadata.papers,
      targetPapers,
    );
  }, [activeExecutionId, inlineAnalysisCycleKey, inlineAnalysisTask, targetPapers]);

  const analysisProgressMap = useMemo(() => {
    const baseProgressMap = queueVisibleInlineAnalysis({
      papers: targetPapers,
      visibleCount: analysisVisibleCount,
      visiblePaperIds: visiblePaperIdSet,
      analysisMap,
      analysisProgressMap: buildInlineAnalysisProgressMap(targetPapers),
    });

    if (
      inlineAnalysisTask == null ||
      inlineAnalysisTask.executionId !== activeExecutionId ||
      inlineAnalysisTask.cycleKey !== inlineAnalysisCycleKey
    ) {
      return baseProgressMap;
    }

    const nextProgressMap = new Map(baseProgressMap);
    for (const [paperId, status] of inlineAnalysisTask.progressMap) {
      if (changedInputPaperIds.has(paperId)) {
        continue;
      }
      if (nextProgressMap.get(paperId) === "done") {
        continue;
      }
      nextProgressMap.set(paperId, status);
    }

    return nextProgressMap;
  }, [
    analysisMap,
    analysisVisibleCount,
    activeExecutionId,
    changedInputPaperIds,
    inlineAnalysisCycleKey,
    inlineAnalysisTask,
    targetPapers,
    visiblePaperIdSet,
  ]);

  useEffect(() => {
    const hasPendingVisibleInlineAnalysis = hasPendingInlineAnalysis(
      targetPapers,
      analysisMap,
      analysisProgressMap,
      analysisVisibleCount,
      visiblePaperIdSet,
    );

    if (
      inlineAnalysisTask != null &&
      inlineAnalysisTask.executionId === activeExecutionId &&
      inlineAnalysisTask.cycleKey === inlineAnalysisCycleKey
    ) {
      const inputChanged = changedInputPaperIds.size > 0;
      const retryCountMap = inputChanged
        ? new Map(
            [...inlineAnalysisTask.retryCountMap].filter(
              ([paperId]) => !changedInputPaperIds.has(paperId),
            ),
          )
        : inlineAnalysisTask.retryCountMap;
      if (inlineAnalysisTask.status === "running") {
        if (
          inputChanged ||
          inlineAnalysisTask.visibleCount !== analysisVisibleCount ||
          !arePaperIdsEqual(inlineAnalysisTask.visiblePaperIds, visiblePaperIds) ||
          !areProgressMapsEqual(inlineAnalysisTask.progressMap, analysisProgressMap)
        ) {
          setInlineAnalysisTaskState(documentId, {
            metadata,
            analysisPapers: targetPapers,
            visiblePaperIds,
            progressMap: analysisProgressMap,
            retryCountMap,
            ...(inputChanged ? { retryNotBeforeAt: undefined } : {}),
            status: "running",
            visibleCount: analysisVisibleCount,
          });
        }
        return;
      }

      if (
        !inputChanged &&
        inlineAnalysisTask.visibleCount === analysisVisibleCount &&
        arePaperIdsEqual(inlineAnalysisTask.visiblePaperIds, visiblePaperIds) &&
        areProgressMapsEqual(inlineAnalysisTask.progressMap, analysisProgressMap)
      ) {
        return;
      }

      setInlineAnalysisTaskState(documentId, {
        metadata,
        analysisPapers: targetPapers,
        visiblePaperIds,
        progressMap: analysisProgressMap,
        retryCountMap,
        ...(inputChanged ? { retryNotBeforeAt: undefined } : {}),
        status: hasPendingVisibleInlineAnalysis ? "queued" : inlineAnalysisTask.status,
        visibleCount: analysisVisibleCount,
      });
      return;
    }
    if (!hasPendingVisibleInlineAnalysis) {
      return;
    }

    if (!activeExecutionId) return;
    enqueueInlineAnalysisTask({
      executionId: activeExecutionId,
      documentId,
      ownerPrincipalId,
      cycleKey: inlineAnalysisCycleKey,
      metadata,
      analysisPapers: targetPapers,
      visiblePaperIds,
      progressMap: analysisProgressMap,
      visibleCount: analysisVisibleCount,
    });
  }, [
    analysisVisibleCount,
    analysisMap,
    analysisProgressMap,
    changedInputPaperIds,
    ownerPrincipalId,
    documentId,
    activeExecutionId,
    enqueueInlineAnalysisTask,
    inlineAnalysisCycleKey,
    inlineAnalysisTask,
    metadata,
    setInlineAnalysisTaskState,
    targetPapers,
    visiblePaperIdSet,
    visiblePaperIds,
  ]);

  return { analysisMap, analysisProgressMap };
}

function arePaperIdsEqual(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined,
): boolean {
  if (left == null && right == null) {
    return true;
  }
  if (left == null || right == null) {
    return false;
  }
  if (left.length !== right.length) {
    return false;
  }
  return left.every((paperId, index) => paperId === right[index]);
}

function areProgressMapsEqual(
  left: ReadonlyMap<string, AnalysisProgressState>,
  right: ReadonlyMap<string, AnalysisProgressState>,
): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const [paperId, status] of left) {
    if (right.get(paperId) !== status) {
      return false;
    }
  }

  return true;
}

function findChangedInlineAnalysisInputPaperIds(
  previousPapers: SearchMetadata["papers"],
  currentPapers: SearchMetadata["papers"],
): Set<string> {
  const previousPaperById = new Map(previousPapers.map((paper) => [paper.paperId, paper]));
  return new Set(
    currentPapers.flatMap((paper) => {
      const previousPaper = previousPaperById.get(paper.paperId);
      return previousPaper && !hasSameInlineAnalysisInput(previousPaper, paper)
        ? [paper.paperId]
        : [];
    }),
  );
}
