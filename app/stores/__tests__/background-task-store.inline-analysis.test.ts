import { afterEach, describe, expect, it } from "vitest";
import { buildInlineAnalysisCycleKey } from "@/app/lib/inline-analysis";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";

const metadata: SearchMetadata = {
  type: "search",
  query: "research agents",
  total: 2,
  papers: [
    {
      paperId: "paper-1",
      title: "Paper 1",
      abstract: "abstract 1",
      year: 2025,
      citationCount: 12,
      url: "https://example.com/paper-1",
      authors: [{ name: "Author 1", authorId: "a1" }],
    },
    {
      paperId: "paper-2",
      title: "Paper 2",
      abstract: "abstract 2",
      year: 2025,
      citationCount: 8,
      url: "https://example.com/paper-2",
      authors: [{ name: "Author 2", authorId: "a2" }],
    },
  ],
};

afterEach(() => {
  useBackgroundTaskStore.setState({
    inlineAnalysisTasks: {},
    termDiscoveryTasks: {},
  });
});

describe("background task store inline analysis", () => {
  it("guards inline-analysis task state updates by cycle key", () => {
    const documentId = "search-result-cycle-guard";
    const cycleKey = buildInlineAnalysisCycleKey(documentId, metadata);

    useBackgroundTaskStore.getState().enqueueInlineAnalysisTask({
      executionId: "exec-1",
      documentId,
      ownerPrincipalId: "principal-1",
      cycleKey,
      metadata,
      visiblePaperIds: ["paper-1", "paper-2"],
      visibleCount: 2,
      progressMap: new Map([
        ["paper-1", "queued"],
        ["paper-2", "queued"],
      ]),
    });

    useBackgroundTaskStore
      .getState()
      .setInlineAnalysisTaskState(documentId, { status: "settled" }, "stale-cycle");
    useBackgroundTaskStore.getState().clearInlineAnalysisTask(documentId, "stale-cycle");

    const task = useBackgroundTaskStore.getState().inlineAnalysisTasks[documentId];
    expect(task?.cycleKey).toBe(cycleKey);
    expect(task?.status).toBe("queued");

    useBackgroundTaskStore
      .getState()
      .setInlineAnalysisTaskState(documentId, { status: "settled" }, cycleKey);
    expect(useBackgroundTaskStore.getState().inlineAnalysisTasks[documentId]?.status).toBe(
      "settled",
    );

    useBackgroundTaskStore.getState().clearInlineAnalysisTask(documentId, cycleKey);
    expect(useBackgroundTaskStore.getState().inlineAnalysisTasks[documentId]).toBeUndefined();
  });
});
