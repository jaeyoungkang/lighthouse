import type { InlineAnalysisRetryCommand } from "@/app/domain/analysis";
import type {
  PaperWithReviewStatus,
  ResearchRoutePayload,
  SearchMetadata,
} from "@/app/domain/research-route-payload";
import {
  buildInlineAnalysisCycleKey,
  buildInlineAnalysisPayload,
  type AnalysisResult,
  type InlineAnalysisResponseResult,
  hasSameInlineAnalysisInput,
  mergeInlineAnalysisIntoPapers,
  updateInlineAnalysisProgress,
} from "@/app/lib/inline-analysis";
import { API_ROUTES } from "@/app/lib/api-routes";
import { fetchBackgroundRequest } from "@/app/lib/background-request";
import {
  useBackgroundTaskStore,
  type InlineAnalysisTask,
} from "@/app/stores/background-task-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { advanceUpdatedAtAfterCurrent } from "@/app/stores/research-route-store-internals";

const INLINE_ANALYSIS_START_DELAY_MS = 300;

export class InlineAnalysisRequestError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`inline analysis request failed with status ${String(status)}`);
    this.name = "InlineAnalysisRequestError";
    this.status = status;
  }
}

export async function requestInlineAnalysis(
  papers: ReturnType<typeof buildInlineAnalysisPayload>,
  signal?: AbortSignal,
  retryCommand: InlineAnalysisRetryCommand = "automatic",
): Promise<InlineAnalysisResponseResult[]> {
  const response = await fetchBackgroundRequest(
    API_ROUTES.PAPERS_ANALYZE_INLINE,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ papers, retryCommand }),
      ...(signal ? { signal } : {}),
    },
    "inline analysis request",
  );

  if (!response.ok) throw new InlineAnalysisRequestError(response.status);
  return (await response.json()) as InlineAnalysisResponseResult[];
}

export async function persistInlineAnalysis(
  documentId: string,
  updatedPapers: SearchMetadata["papers"],
  expectedCycleKey: string | undefined,
  expectedExecutionId: string,
): Promise<ResearchRoutePayload | null> {
  // Preserve the existing asynchronous persistence command boundary after the
  // store dependency moved from dynamic acquisition to this static effect owner.
  await Promise.resolve();
  const routeState = useResearchRouteStore.getState();
  const currentView = routeState.currentView;
  if (
    !currentView ||
    currentView.id !== documentId ||
    !isInlineAnalysisResearchRoutePayload(currentView)
  ) {
    return null;
  }
  if (routeState.activeExecutionId !== expectedExecutionId) return null;
  if (
    expectedCycleKey &&
    buildInlineAnalysisCycleKey(currentView.id, currentView.metadata) !== expectedCycleKey
  ) {
    return null;
  }
  const updatedPaperById = new Map(updatedPapers.map((paper) => [paper.paperId, paper]));
  const papers = currentView.metadata.papers.map((paper) => {
    const updatedPaper = updatedPaperById.get(paper.paperId);
    const inlineAnalysis = (updatedPaper as PaperWithReviewStatus | undefined)?.inlineAnalysis;
    return inlineAnalysis && updatedPaper && hasSameInlineAnalysisInput(paper, updatedPaper)
      ? { ...paper, inlineAnalysis }
      : paper;
  });
  const updatedDocument = buildInlineAnalysisUpdatedDocument(currentView, papers);
  useResearchRouteStore.getState().patchCurrentView(updatedDocument, expectedExecutionId);
  return updatedDocument;
}

function hasPendingInlineAnalysisProgress(
  progressMap: ReadonlyMap<string, "queued" | "running" | "done" | "error">,
): boolean {
  return [...progressMap.values()].some((status) => status === "queued" || status === "running");
}

function finalizeInlineAnalysisTask(params: {
  documentId: string;
  cycleKey: string;
  progressMap: ReadonlyMap<string, "queued" | "running" | "done" | "error">;
  clearInlineAnalysisTask: (documentId: string, expectedCycleKey?: string) => void;
  setInlineAnalysisTaskState: (
    documentId: string,
    updates: Partial<Omit<InlineAnalysisTask, "documentId">>,
    expectedCycleKey?: string,
  ) => void;
}): void {
  if (hasPendingInlineAnalysisProgress(params.progressMap)) return;
  if ([...params.progressMap.values()].some((status) => status === "error")) {
    params.setInlineAnalysisTaskState(params.documentId, { status: "settled" }, params.cycleKey);
  } else {
    params.clearInlineAnalysisTask(params.documentId, params.cycleKey);
  }
}

function getLatestInlineAnalysisTask(task: InlineAnalysisTask): InlineAnalysisTask | null {
  const latestTask = useBackgroundTaskStore.getState().inlineAnalysisTasks[task.documentId];
  if (
    !latestTask ||
    latestTask.executionId !== task.executionId ||
    latestTask.cycleKey !== task.cycleKey
  ) {
    return null;
  }
  return latestTask;
}

type InlineAnalysisResearchRoutePayload = Extract<
  ResearchRoutePayload,
  { type: "search" | "citation_lineage" | "graph_neighbors" }
>;

function isInlineAnalysisResearchRoutePayload(
  document: ResearchRoutePayload | null,
): document is InlineAnalysisResearchRoutePayload {
  return (
    document != null &&
    (document.type === "search" ||
      document.type === "citation_lineage" ||
      document.type === "graph_neighbors")
  );
}

function buildInlineAnalysisUpdatedDocument(
  currentView: InlineAnalysisResearchRoutePayload,
  papers: SearchMetadata["papers"],
): InlineAnalysisResearchRoutePayload {
  const updatedAt = advanceUpdatedAtAfterCurrent(currentView.updatedAt, currentView.updatedAt);
  switch (currentView.type) {
    case "search":
      return { ...currentView, metadata: { ...currentView.metadata, papers }, updatedAt };
    case "citation_lineage":
      return { ...currentView, metadata: { ...currentView.metadata, papers }, updatedAt };
    case "graph_neighbors":
      return { ...currentView, metadata: { ...currentView.metadata, papers }, updatedAt };
  }
}

function isCurrentDocumentCycle(task: InlineAnalysisTask): boolean {
  const routeState = useResearchRouteStore.getState();
  const currentDocument = routeState.currentView;
  if (
    !isInlineAnalysisResearchRoutePayload(currentDocument) ||
    routeState.activeExecutionId !== task.executionId ||
    currentDocument.id !== task.documentId ||
    currentDocument.metadata.type !== task.metadata.type ||
    currentDocument.ownerPrincipalId !== task.ownerPrincipalId
  ) {
    return false;
  }
  const metadata = currentDocument.metadata;
  return buildInlineAnalysisCycleKey(currentDocument.id, metadata) === task.cycleKey;
}

function partitionCurrentInlineAnalysisBatch(
  task: InlineAnalysisTask,
  batch: SearchMetadata["papers"],
): { currentPaperIds: string[]; stalePaperIds: string[] } {
  const currentDocument = useResearchRouteStore.getState().currentView;
  if (!currentDocument || currentDocument.id !== task.documentId || !isCurrentDocumentCycle(task)) {
    return { currentPaperIds: [], stalePaperIds: batch.map((paper) => paper.paperId) };
  }
  const currentPaperById = new Map(
    currentDocument.metadata.papers.map((paper) => [paper.paperId, paper] as const),
  );
  const currentPaperIds: string[] = [];
  const stalePaperIds: string[] = [];
  for (const paper of batch) {
    const currentPaper = currentPaperById.get(paper.paperId);
    (currentPaper && hasSameInlineAnalysisInput(paper, currentPaper)
      ? currentPaperIds
      : stalePaperIds
    ).push(paper.paperId);
  }
  return { currentPaperIds, stalePaperIds };
}

function deleteInlineAnalysisRetryCounts(
  retryCountMap: ReadonlyMap<string, number>,
  paperIds: readonly string[],
): Map<string, number> {
  const nextRetryCountMap = new Map(retryCountMap);
  for (const paperId of paperIds) nextRetryCountMap.delete(paperId);
  return nextRetryCountMap;
}

function settleRunError(params: {
  error: unknown;
  task: InlineAnalysisTask;
  batch: SearchMetadata["papers"];
  update: (
    documentId: string,
    updates: Partial<Omit<InlineAnalysisTask, "documentId">>,
    expectedCycleKey?: string,
  ) => void;
}): void {
  const currentTask = getLatestInlineAnalysisTask(params.task);
  if (!currentTask) return;
  const { currentPaperIds, stalePaperIds } = partitionCurrentInlineAnalysisBatch(
    params.task,
    params.batch,
  );
  let progressMap = updateInlineAnalysisProgress(currentTask.progressMap, stalePaperIds, "queued");
  progressMap = updateInlineAnalysisProgress(progressMap, currentPaperIds, "error");
  params.update(
    params.task.documentId,
    {
      progressMap,
      retryCountMap: deleteInlineAnalysisRetryCounts(currentTask.retryCountMap, stalePaperIds),
      retryCommand: undefined,
      status: hasPendingInlineAnalysisProgress(progressMap) ? "queued" : "settled",
    },
    params.task.cycleKey,
  );
  if ((params.error as { name?: unknown } | null)?.name !== "AbortError") {
    console.error("[search-background] inline analysis failed:", params.error);
  }
}

export async function runInlineAnalysisTask(params: {
  task: InlineAnalysisTask;
  batch: SearchMetadata["papers"];
  controller: AbortController;
  clearInlineAnalysisTask: (documentId: string, expectedCycleKey?: string) => void;
  setInlineAnalysisTaskState: (
    documentId: string,
    updates: Partial<Omit<InlineAnalysisTask, "documentId">>,
    expectedCycleKey?: string,
  ) => void;
}): Promise<void> {
  const { batch, controller, task } = params;
  if (batch.length === 0) {
    finalizeInlineAnalysisTask({
      documentId: task.documentId,
      cycleKey: task.cycleKey,
      progressMap: task.progressMap,
      clearInlineAnalysisTask: params.clearInlineAnalysisTask,
      setInlineAnalysisTaskState: params.setInlineAnalysisTaskState,
    });
    return;
  }

  if (![...task.progressMap.values()].some((status) => status === "done" || status === "error")) {
    await new Promise((resolve) => window.setTimeout(resolve, INLINE_ANALYSIS_START_DELAY_MS));
  }
  if (controller.signal.aborted) return;

  try {
    const response = await requestInlineAnalysis(
      buildInlineAnalysisPayload(batch),
      controller.signal,
      task.retryCommand ?? "automatic",
    );
    const currentTask = getLatestInlineAnalysisTask(task);
    const currentDocument = useResearchRouteStore.getState().currentView;
    if (
      !currentTask ||
      !isCurrentDocumentCycle(task) ||
      !isInlineAnalysisResearchRoutePayload(currentDocument)
    )
      return;

    const { currentPaperIds, stalePaperIds } = partitionCurrentInlineAnalysisBatch(task, batch);
    const currentPaperIdSet = new Set(currentPaperIds);
    const requestedById = new Map(batch.map((paper) => [paper.paperId, paper] as const));
    const currentById = new Map(
      currentDocument.metadata.papers.map((paper) => [paper.paperId, paper] as const),
    );
    const failureMap = new Map(
      response.flatMap((result) => ("status" in result ? [[result.paperId, result] as const] : [])),
    );
    const resultMap = new Map<string, AnalysisResult>(
      response.flatMap((result) => {
        if ("status" in result) return [];
        const { paperId, ...analysis } = result;
        const requested = requestedById.get(paperId);
        const current = currentById.get(paperId);
        return currentPaperIdSet.has(paperId) &&
          requested &&
          current &&
          hasSameInlineAnalysisInput(requested, current)
          ? [[paperId, analysis] as const]
          : [];
      }),
    );

    const progressMap = updateInlineAnalysisProgress(
      currentTask.progressMap,
      stalePaperIds,
      "queued",
    );
    for (const paperId of currentPaperIds) {
      progressMap.set(paperId, resultMap.has(paperId) ? "done" : "error");
    }
    const recoveryMap = new Map(currentTask.recoveryMap);
    for (const paperId of [...stalePaperIds, ...currentPaperIds]) recoveryMap.delete(paperId);
    for (const [paperId, failure] of failureMap) {
      if (!currentPaperIdSet.has(paperId)) continue;
      recoveryMap.set(paperId, {
        ...(failure.cooldownUntil ? { cooldownUntil: failure.cooldownUntil } : {}),
        retryRequiresExplicit: true,
      });
    }

    const nextMetadata = {
      ...currentDocument.metadata,
      papers: mergeInlineAnalysisIntoPapers(currentDocument.metadata.papers, resultMap),
    } as typeof currentTask.metadata;
    const nextAnalysisPapers = currentTask.analysisPapers
      ? mergeInlineAnalysisIntoPapers(currentTask.analysisPapers, resultMap)
      : undefined;
    params.setInlineAnalysisTaskState(
      task.documentId,
      {
        metadata: nextMetadata,
        ...(nextAnalysisPapers ? { analysisPapers: nextAnalysisPapers } : {}),
        progressMap,
        retryCountMap: deleteInlineAnalysisRetryCounts(currentTask.retryCountMap, currentPaperIds),
        recoveryMap,
        retryCommand: undefined,
        status: hasPendingInlineAnalysisProgress(progressMap) ? "queued" : "settled",
      },
      task.cycleKey,
    );

    if (resultMap.size > 0) {
      await persistInlineAnalysis(
        task.documentId,
        nextMetadata.papers,
        task.cycleKey,
        task.executionId,
      );
    }
    if (!getLatestInlineAnalysisTask(task) || !isCurrentDocumentCycle(task)) return;
    finalizeInlineAnalysisTask({
      documentId: task.documentId,
      cycleKey: task.cycleKey,
      progressMap,
      clearInlineAnalysisTask: params.clearInlineAnalysisTask,
      setInlineAnalysisTaskState: params.setInlineAnalysisTaskState,
    });
  } catch (error) {
    settleRunError({
      error,
      task,
      batch,
      update: params.setInlineAnalysisTaskState,
    });
  }
}
