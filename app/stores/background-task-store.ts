// @promise promise:inline-analysis-auto-run
// @promise promise:search-results-suggest-english-terms
// @check acceptance-check:inline-analysis-auto-run-visible-first-priority
// @check acceptance-check:inline-analysis-auto-run-explicit-failure-retry
// @check acceptance-check:search-results-suggest-english-terms-background-llm-primary

import { create } from "zustand";
import type { InlineAnalysisRetryCommand } from "@/app/domain/analysis";
import type {
  CitationLineageMetadata,
  GraphNeighborsMetadata,
  SearchMetadata,
} from "@/app/domain/research-route-payload";
import type { AnalysisProgressState } from "@/app/lib/inline-analysis";

export interface InlineAnalysisTask {
  executionId: string;
  documentId: string;
  ownerPrincipalId: string;
  cycleKey: string;
  /** Canonical ResearchRoutePayload metadata used when persisting inline-analysis caches. */
  metadata: SearchMetadata | CitationLineageMetadata | GraphNeighborsMetadata;
  /** Current sorted/filtered paper pool used only to choose analysis batches. */
  analysisPapers?: SearchMetadata["papers"];
  /** Paper cards currently eligible for visible-window inline analysis. */
  visiblePaperIds?: readonly string[];
  visibleCount: number;
  progressMap: Map<string, AnalysisProgressState>;
  retryCountMap: Map<string, number>;
  /** Retained as an inert compatibility field for existing task producers. */
  retryNotBeforeAt?: number;
  recoveryMap?: Map<string, { cooldownUntil?: string; retryRequiresExplicit: boolean }>;
  retryCommand?: InlineAnalysisRetryCommand;
  status: "queued" | "running" | "settled";
}

export type TermDiscoveryPhase = "initial";

/**
 * 연구 용어 background 추출 task. `error`는 같은 세션에서 같은
 * (documentId, phase) 재큐잉을 막기 위해 entry를 남긴 채로 기록한다.
 */
export interface TermDiscoveryTask {
  executionId: string;
  documentId: string;
  ownerPrincipalId: string;
  query: string;
  metadata: SearchMetadata;
  phase: TermDiscoveryPhase;
  status: "queued" | "running" | "error";
}

export function buildTermDiscoveryTaskKey(
  executionId: string,
  documentId: string,
  phase: TermDiscoveryPhase,
): string {
  return `${executionId}:${documentId}:${phase}`;
}

interface BackgroundTaskState {
  inlineAnalysisTasks: Partial<Record<string, InlineAnalysisTask>>;
  enqueueInlineAnalysisTask: (task: Omit<InlineAnalysisTask, "status" | "retryCountMap">) => void;
  setInlineAnalysisTaskState: (
    documentId: string,
    updates: Partial<Omit<InlineAnalysisTask, "documentId">>,
    expectedCycleKey?: string,
  ) => void;
  clearInlineAnalysisTask: (documentId: string, expectedCycleKey?: string) => void;
  termDiscoveryTasks: Partial<Record<string, TermDiscoveryTask>>;
  enqueueTermDiscoveryTask: (task: Omit<TermDiscoveryTask, "status">) => void;
  setTermDiscoveryTaskState: (
    taskKey: string,
    updates: Partial<Omit<TermDiscoveryTask, "documentId" | "phase">>,
  ) => void;
  clearTermDiscoveryTask: (taskKey: string) => void;
}

function omitKey<T>(
  record: Partial<Record<string, T>>,
  keyToRemove: string,
): Partial<Record<string, T>> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== keyToRemove),
  ) as Partial<Record<string, T>>;
}

export const useBackgroundTaskStore = create<BackgroundTaskState>((set) => ({
  inlineAnalysisTasks: {},

  enqueueInlineAnalysisTask: (task) => {
    set((state) => ({
      inlineAnalysisTasks: {
        ...state.inlineAnalysisTasks,
        [task.documentId]: {
          ...task,
          retryCountMap: new Map(),
          status: "queued",
        },
      },
    }));
  },

  setInlineAnalysisTaskState: (documentId, updates, expectedCycleKey) => {
    set((state) => {
      const current = state.inlineAnalysisTasks[documentId];
      if (!current) {
        return state;
      }
      if (expectedCycleKey && current.cycleKey !== expectedCycleKey) {
        return state;
      }

      return {
        inlineAnalysisTasks: {
          ...state.inlineAnalysisTasks,
          [documentId]: {
            ...current,
            ...updates,
          },
        },
      };
    });
  },

  clearInlineAnalysisTask: (documentId, expectedCycleKey) => {
    set((state) => {
      const current = state.inlineAnalysisTasks[documentId];
      if (expectedCycleKey && current?.cycleKey !== expectedCycleKey) {
        return state;
      }
      return { inlineAnalysisTasks: omitKey(state.inlineAnalysisTasks, documentId) };
    });
  },

  termDiscoveryTasks: {},

  enqueueTermDiscoveryTask: (task) => {
    set((state) => {
      const taskKey = buildTermDiscoveryTaskKey(task.executionId, task.documentId, task.phase);
      if (state.termDiscoveryTasks[taskKey]) {
        return state;
      }
      return {
        termDiscoveryTasks: {
          ...state.termDiscoveryTasks,
          [taskKey]: {
            ...task,
            status: "queued",
          },
        },
      };
    });
  },

  setTermDiscoveryTaskState: (taskKey, updates) => {
    set((state) => {
      const current = state.termDiscoveryTasks[taskKey];
      if (!current) return state;
      return {
        termDiscoveryTasks: {
          ...state.termDiscoveryTasks,
          [taskKey]: {
            ...current,
            ...updates,
          },
        },
      };
    });
  },

  clearTermDiscoveryTask: (taskKey) => {
    set((state) => {
      return { termDiscoveryTasks: omitKey(state.termDiscoveryTasks, taskKey) };
    });
  },
}));

export function retryInlineAnalysisForPaper(paperId: string): boolean {
  const store = useBackgroundTaskStore.getState();
  const task = Object.values(store.inlineAnalysisTasks).find(
    (candidate) => candidate?.progressMap.get(paperId) === "error",
  );
  if (!task) return false;
  const progressMap = new Map(task.progressMap);
  progressMap.set(paperId, "queued");
  const retryCountMap = new Map(task.retryCountMap);
  retryCountMap.delete(paperId);
  const recoveryMap = new Map(task.recoveryMap);
  recoveryMap.delete(paperId);
  store.setInlineAnalysisTaskState(
    task.documentId,
    {
      progressMap,
      retryCountMap,
      recoveryMap,
      retryCommand: "explicit_retry",
      status: "queued",
    },
    task.cycleKey,
  );
  return true;
}
