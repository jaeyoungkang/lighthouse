import { useEffect, useRef } from "react";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import {
  buildSearchBackgroundSnapshotTarget,
  buildSearchTermDiscoveryCommandV1,
  hasSameSearchBackgroundTarget,
  searchTermDiscoveryDeltaResponseV1Schema,
  type SearchTermDiscoveryDeltaResponseV1,
} from "@/app/domain/search-background-transport";
import { mergeTermDiscoveryDelta } from "@/app/components/research/background-search-tasks";
import { API_ROUTES } from "@/app/lib/api-routes";
import { fetchBackgroundRequest } from "@/app/lib/background-request";
import { trackResearchTermsViewedOnce } from "@/app/lib/track";
import {
  buildTermDiscoveryTaskKey,
  type TermDiscoveryPhase,
  type TermDiscoveryTask,
  useBackgroundTaskStore,
} from "@/app/stores/background-task-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { advanceUpdatedAtAfterCurrent } from "@/app/stores/research-route-store-internals";

/**
 * 연구 용어 background 추출이 지금 필요한 phase를 고른다. 검색 커밋 직후의
 * `pending` view만 initial 추출을 큐잉한다.
 */
export function getTermDiscoveryPhaseToQueue(params: {
  metadata: SearchMetadata;
}): TermDiscoveryPhase | null {
  if (params.metadata.abstractHydration?.status === "pending") return null;
  const discovery = params.metadata.englishTermDiscovery;
  if (!discovery) return null;
  if (discovery.status === "pending") return "initial";
  return null;
}

async function requestTermDiscoveryDocument(params: {
  metadata: SearchMetadata;
  signal: AbortSignal;
}): Promise<SearchTermDiscoveryDeltaResponseV1> {
  const command = await buildSearchTermDiscoveryCommandV1(params.metadata);
  params.signal.throwIfAborted();
  const response = await fetchBackgroundRequest(
    API_ROUTES.SEARCH_TERM_DISCOVERY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
      signal: params.signal,
    },
    "search term discovery request",
  );
  if (!response.ok) {
    throw new Error(`term discovery request failed: ${String(response.status)}`);
  }
  const raw: unknown = await response.json().catch((): unknown => null);
  const parsed = searchTermDiscoveryDeltaResponseV1Schema.safeParse(raw);
  if (!parsed.success || !hasSameSearchBackgroundTarget(parsed.data.target, command.target)) {
    throw new Error("term discovery response is invalid");
  }
  return parsed.data;
}

function hasSameSearchSnapshotTarget(current: SearchMetadata, original: SearchMetadata): boolean {
  return (
    current.query === original.query &&
    current.papers.length === original.papers.length &&
    current.papers.every((paper, index) => paper.paperId === original.papers[index]?.paperId)
  );
}

export async function runTermDiscoveryTask(params: {
  task: TermDiscoveryTask;
  controller: AbortController;
  clearTermDiscoveryTask: (taskKey: string) => void;
  setTermDiscoveryTaskState: (
    taskKey: string,
    updates: Partial<Omit<TermDiscoveryTask, "documentId" | "phase">>,
  ) => void;
}): Promise<void> {
  const { clearTermDiscoveryTask, controller, setTermDiscoveryTaskState, task } = params;
  const taskKey = buildTermDiscoveryTaskKey(task.executionId, task.documentId, task.phase);
  try {
    setTermDiscoveryTaskState(taskKey, { status: "running" });
    const result = await requestTermDiscoveryDocument({
      metadata: task.metadata,
      signal: controller.signal,
    });
    if (controller.signal.aborted) {
      // abort(unmount·route view 전환)에서 running entry를 남기면 같은 키의
      // 재큐잉이 영구히 막힌다. entry를 비워 다음 mount의 view scan이 다시 큐잉하게 한다.
      clearTermDiscoveryTask(taskKey);
      return;
    }
    if (
      !hasSameSearchBackgroundTarget(
        result.target,
        buildSearchBackgroundSnapshotTarget(task.metadata),
      )
    ) {
      throw new Error("term discovery response changed the result snapshot target");
    }
    const documentStore = useResearchRouteStore.getState();
    const currentView = documentStore.currentView;
    if (
      currentView?.id === task.documentId &&
      documentStore.activeExecutionId === task.executionId &&
      currentView.type === "search" &&
      currentView.ownerPrincipalId === task.ownerPrincipalId &&
      hasSameSearchSnapshotTarget(currentView.metadata, task.metadata)
    ) {
      const metadata = mergeTermDiscoveryDelta(result.delta, currentView.metadata);
      const didApply = documentStore.patchCurrentView(
        {
          ...currentView,
          metadata,
          updatedAt: advanceUpdatedAtAfterCurrent(currentView.updatedAt, result.updatedAt),
        },
        task.executionId,
      );
      if (didApply) {
        trackResearchTermsViewedOnce({
          ownerPrincipalId: task.ownerPrincipalId,
          documentId: task.documentId,
          phase: task.phase,
          source: metadata.englishTermDiscovery?.source ?? "llm",
          candidateCount: metadata.englishTermCandidates?.length ?? 0,
        });
      }
    }
    clearTermDiscoveryTask(taskKey);
  } catch (error) {
    if (controller.signal.aborted) {
      clearTermDiscoveryTask(taskKey);
      return;
    }
    // 용어 추출은 post-search enrichment다. 실패해도 커밋된 검색 결과는 보존하고,
    // error entry를 남겨 같은 세션의 무한 재큐잉을 막는다.
    console.warn("[search-term-discovery-background] extraction skipped:", error);
    setTermDiscoveryTaskState(taskKey, { status: "error" });
  }
}

/**
 * 연구 용어 background 추출의 큐잉·실행·정리를 한곳에 모은 hook. view 상태에서
 * 직접 phase를 계산하므로 사용자 검색, agent 검색, 재로드 복귀를 같은 규칙으로
 * 덮는다. 그래프 support background task와 같은 수명주기 패턴을 따른다.
 */
export function useTermDiscoveryBackgroundTasks(): void {
  const currentView = useResearchRouteStore((state) => state.currentView);
  const activeExecutionId = useResearchRouteStore((state) => state.activeExecutionId);
  const termDiscoveryTasks = useBackgroundTaskStore((state) => state.termDiscoveryTasks);
  const enqueueTermDiscoveryTask = useBackgroundTaskStore(
    (state) => state.enqueueTermDiscoveryTask,
  );
  const setTermDiscoveryTaskState = useBackgroundTaskStore(
    (state) => state.setTermDiscoveryTaskState,
  );
  const clearTermDiscoveryTask = useBackgroundTaskStore((state) => state.clearTermDiscoveryTask);
  const activeControllersRef = useRef(new Map<string, AbortController>());

  useEffect(() => {
    const controllers = activeControllersRef.current;
    return () => {
      for (const controller of controllers.values()) {
        controller.abort();
      }
      controllers.clear();
    };
  }, []);

  useEffect(() => {
    for (const [taskKey, task] of Object.entries(termDiscoveryTasks)) {
      if (!task || task.executionId === activeExecutionId) continue;
      activeControllersRef.current.get(taskKey)?.abort();
      activeControllersRef.current.delete(taskKey);
      clearTermDiscoveryTask(taskKey);
    }
  }, [activeExecutionId, clearTermDiscoveryTask, termDiscoveryTasks]);

  useEffect(() => {
    const document = currentView;
    if (!document || !activeExecutionId || document.type !== "search") {
      return;
    }
    const phase = getTermDiscoveryPhaseToQueue({
      metadata: document.metadata,
    });
    if (!phase) {
      return;
    }
    if (termDiscoveryTasks[buildTermDiscoveryTaskKey(activeExecutionId, document.id, phase)]) {
      return;
    }
    enqueueTermDiscoveryTask({
      executionId: activeExecutionId,
      documentId: document.id,
      ownerPrincipalId: document.ownerPrincipalId,
      query: document.metadata.query,
      metadata: document.metadata,
      phase,
    });
  }, [activeExecutionId, currentView, enqueueTermDiscoveryTask, termDiscoveryTasks]);

  useEffect(() => {
    for (const [taskKey, task] of Object.entries(termDiscoveryTasks)) {
      if (!task || task.status !== "queued" || task.executionId !== activeExecutionId) {
        continue;
      }
      if (activeControllersRef.current.has(taskKey)) {
        continue;
      }

      const controller = new AbortController();
      activeControllersRef.current.set(taskKey, controller);

      void runTermDiscoveryTask({
        task,
        controller,
        clearTermDiscoveryTask,
        setTermDiscoveryTaskState,
      }).finally(() => {
        if (activeControllersRef.current.get(taskKey) === controller) {
          activeControllersRef.current.delete(taskKey);
        }
      });
    }
  }, [activeExecutionId, clearTermDiscoveryTask, setTermDiscoveryTaskState, termDiscoveryTasks]);
}
