// @promise promise:graph-neighbor-papers
// @check acceptance-check:graph-neighbor-papers-card-data-hydration

import type {
  GraphNeighborsMetadata,
  GraphNeighborsResearchRoutePayload,
  ResearchRoutePayload,
} from "@/app/domain/research-route-payload";
import { API_ROUTES } from "@/app/lib/api-routes";
import { fetchBackgroundRequest, waitForBackgroundRetry } from "@/app/lib/background-request";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { mergeBackgroundPaperDetails } from "@/app/components/research/background-search-tasks";
import { advanceUpdatedAtAfterCurrent } from "@/app/stores/research-route-store-internals";
import {
  getApiErrorRetryDelayMs,
  isApiErrorRetryable,
  readApiResponseError,
} from "@/app/lib/api-error-response";

export interface GraphNeighborHydrationTask {
  executionId: string;
  documentId: string;
  ownerPrincipalId: string;
  metadata: GraphNeighborsMetadata;
}

interface GraphNeighborHydrationResponse {
  metadata: GraphNeighborsMetadata;
  updatedAt: string;
}

const GRAPH_NEIGHBOR_HYDRATION_MAX_ATTEMPTS = 3;
const GRAPH_NEIGHBOR_HYDRATION_RETRY_DELAY_MS = 500;

export function isGraphNeighborHydrationPending(metadata: GraphNeighborsMetadata): boolean {
  return metadata.cardDataHydration?.status === "pending";
}

function isGraphNeighborDocumentReady(
  document: ResearchRoutePayload,
): document is GraphNeighborsResearchRoutePayload {
  return document.status === "ready" && document.type === "graph_neighbors";
}

function graphAxisIds(axis: GraphNeighborsMetadata["coCited"]): string[] {
  return axis.map((entry) => entry.paper.paperId);
}

interface GraphNeighborSnapshotTarget {
  seedPaperId: string;
  paperIds: string[];
  coCitedPaperIds: string[];
  coupledPaperIds: string[];
}

function buildGraphNeighborSnapshotTarget(
  metadata: GraphNeighborsMetadata,
): GraphNeighborSnapshotTarget {
  return {
    seedPaperId: metadata.seedPaper.paperId,
    paperIds: metadata.papers.map((paper) => paper.paperId),
    coCitedPaperIds: graphAxisIds(metadata.coCited),
    coupledPaperIds: graphAxisIds(metadata.coupled),
  };
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((paperId, index) => paperId === right[index]);
}

function hasSameGraphNeighborSnapshotTarget(
  current: GraphNeighborsMetadata,
  original: GraphNeighborsMetadata,
): boolean {
  const currentTarget = buildGraphNeighborSnapshotTarget(current);
  const originalTarget = buildGraphNeighborSnapshotTarget(original);
  return (
    currentTarget.seedPaperId === originalTarget.seedPaperId &&
    sameIds(currentTarget.paperIds, originalTarget.paperIds) &&
    sameIds(currentTarget.coCitedPaperIds, originalTarget.coCitedPaperIds) &&
    sameIds(currentTarget.coupledPaperIds, originalTarget.coupledPaperIds)
  );
}

export function shouldQueueGraphNeighborHydration(
  document: ResearchRoutePayload,
): document is GraphNeighborsResearchRoutePayload {
  if (!isGraphNeighborDocumentReady(document)) {
    return false;
  }
  return isGraphNeighborHydrationPending(document.metadata) && document.metadata.papers.length > 0;
}

export function getGraphNeighborHydrationAttemptKey(document: ResearchRoutePayload): string {
  if (!isGraphNeighborDocumentReady(document)) return `${document.id}:not-ready`;
  return JSON.stringify({
    id: document.id,
    target: buildGraphNeighborSnapshotTarget(document.metadata),
  });
}

async function requestGraphNeighborHydration(params: {
  metadata: GraphNeighborsMetadata;
  signal: AbortSignal;
}): Promise<GraphNeighborHydrationResponse> {
  const response = await fetchBackgroundRequest(
    API_ROUTES.GRAPH_NEIGHBORS_HYDRATION,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metadata: params.metadata }),
      signal: params.signal,
    },
    "graph-neighbor hydration request",
    { preserveErrorBody: true },
  );
  if (!response.ok) {
    throw await readApiResponseError(response, "graph-neighbor hydration request failed");
  }
  const raw: unknown = await response.json().catch((): unknown => null);
  if (raw == null || typeof raw !== "object") {
    throw new Error("graph-neighbor hydration response is invalid");
  }
  const candidate = raw as Partial<GraphNeighborHydrationResponse>;
  if (!candidate.metadata || typeof candidate.updatedAt !== "string") {
    throw new Error("graph-neighbor hydration response is invalid");
  }
  return {
    metadata: candidate.metadata,
    updatedAt: candidate.updatedAt,
  };
}

function patchCurrentGraphNeighborDocument(params: {
  task: GraphNeighborHydrationTask;
  metadata: GraphNeighborsMetadata;
  updatedAt: string;
}): ResearchRoutePayload | null {
  const documentStore = useResearchRouteStore.getState();
  const currentDocument = documentStore.currentView;
  if (
    currentDocument?.id === params.task.documentId &&
    documentStore.activeExecutionId === params.task.executionId &&
    currentDocument.type === "graph_neighbors" &&
    currentDocument.ownerPrincipalId === params.task.ownerPrincipalId &&
    hasSameGraphNeighborSnapshotTarget(currentDocument.metadata, params.task.metadata)
  ) {
    const papers = mergeBackgroundPaperDetails(
      params.metadata.papers,
      currentDocument.metadata.papers,
    );
    const mergedByPaperId = new Map(papers.map((paper) => [paper.paperId, paper] as const));
    const mergeAxis = (
      incomingAxis: GraphNeighborsMetadata["coCited"],
      currentAxis: GraphNeighborsMetadata["coCited"],
    ) => {
      const currentByPaperId = new Map(
        currentAxis.map((entry) => [entry.paper.paperId, entry.paper] as const),
      );
      return incomingAxis.map((entry) => {
        const currentPaper = currentByPaperId.get(entry.paper.paperId);
        const axisPaper = currentPaper
          ? (mergeBackgroundPaperDetails([entry.paper], [currentPaper])[0] ?? entry.paper)
          : entry.paper;
        return {
          ...entry,
          paper: mergedByPaperId.get(entry.paper.paperId) ?? axisPaper,
        };
      });
    };
    const resultDocument: ResearchRoutePayload = {
      ...currentDocument,
      metadata: {
        ...currentDocument.metadata,
        papers,
        total: papers.length,
        coCited: mergeAxis(params.metadata.coCited, currentDocument.metadata.coCited),
        coupled: mergeAxis(params.metadata.coupled, currentDocument.metadata.coupled),
        cardDataHydration: params.metadata.cardDataHydration,
      },
      updatedAt: advanceUpdatedAtAfterCurrent(currentDocument.updatedAt, params.updatedAt),
    };
    return documentStore.patchCurrentView(resultDocument, params.task.executionId)
      ? resultDocument
      : null;
  }
  return null;
}

function settleCurrentGraphNeighborHydration(
  task: GraphNeighborHydrationTask,
): ResearchRoutePayload | null {
  return patchCurrentGraphNeighborDocument({
    task,
    metadata: {
      ...task.metadata,
      cardDataHydration: { status: "ready" },
    },
    updatedAt: new Date().toISOString(),
  });
}

export async function runGraphNeighborHydrationTask(params: {
  task: GraphNeighborHydrationTask;
  controller: AbortController;
}): Promise<ResearchRoutePayload | null> {
  const { controller, task } = params;
  for (let attempt = 1; attempt <= GRAPH_NEIGHBOR_HYDRATION_MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await requestGraphNeighborHydration({
        metadata: task.metadata,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return null;
      if (!hasSameGraphNeighborSnapshotTarget(result.metadata, task.metadata)) {
        throw new Error("graph-neighbor hydration response changed the snapshot target");
      }
      return patchCurrentGraphNeighborDocument({
        task,
        metadata: result.metadata,
        updatedAt: result.updatedAt,
      });
    } catch (error) {
      if (controller.signal.aborted) return null;
      if (!isApiErrorRetryable(error) || attempt >= GRAPH_NEIGHBOR_HYDRATION_MAX_ATTEMPTS) {
        console.warn("[graph-neighbor-hydration-background] hydration skipped:", error);
        return settleCurrentGraphNeighborHydration(task);
      }
      console.warn("[graph-neighbor-hydration-background] hydration retrying:", error);
      await waitForBackgroundRetry(
        controller.signal,
        getApiErrorRetryDelayMs(error, GRAPH_NEIGHBOR_HYDRATION_RETRY_DELAY_MS),
      );
    }
  }
  return null;
}
