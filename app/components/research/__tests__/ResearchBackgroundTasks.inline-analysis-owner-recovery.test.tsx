import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildInlineAnalysisCycleKey } from "@/app/lib/inline-analysis";
import { runInlineAnalysisTask } from "@/app/components/research/background-inline-analysis";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import {
  retryInlineAnalysisForPaper,
  useBackgroundTaskStore,
  type InlineAnalysisTask,
} from "@/app/stores/background-task-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

function createSearchView(): Extract<ResearchRoutePayload, { type: "search" }> {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-explicit-recovery",
    type: "search",
    title: "검색: explicit recovery",
    content: "",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
    metadata: {
      type: "search",
      query: "explicit recovery",
      total: 1,
      papers: [
        {
          paperId: "paper-1",
          title: "Explicit recovery",
          abstract: "A paper used to verify user-command recovery.",
          year: 2026,
          citationCount: 1,
          url: "https://example.com/paper-1",
          authors: [{ name: "Author", authorId: "author-1" }],
        },
      ],
    },
  };
}

function seedTask(): { document: ReturnType<typeof createSearchView>; task: InlineAnalysisTask } {
  const document = createSearchView();
  const executionId = "execution-explicit-recovery";
  const cycleKey = buildInlineAnalysisCycleKey(document.id, document.metadata);
  useResearchRouteStore.getState().setCurrentView(document, executionId);
  useBackgroundTaskStore.getState().enqueueInlineAnalysisTask({
    executionId,
    documentId: document.id,
    ownerPrincipalId: document.ownerPrincipalId,
    cycleKey,
    metadata: document.metadata,
    visibleCount: 1,
    progressMap: new Map([["paper-1", "running"]]),
  });
  useBackgroundTaskStore
    .getState()
    .setInlineAnalysisTaskState(document.id, { status: "running" }, cycleKey);
  const task = useBackgroundTaskStore.getState().inlineAnalysisTasks[document.id];
  if (!task) throw new Error("inline-analysis task is required");
  return { document, task };
}

async function runTask(task: InlineAnalysisTask, document: ReturnType<typeof createSearchView>) {
  const store = useBackgroundTaskStore.getState();
  const pending = runInlineAnalysisTask({
    task,
    batch: document.metadata.papers,
    controller: new AbortController(),
    clearInlineAnalysisTask: store.clearInlineAnalysisTask,
    setInlineAnalysisTaskState: store.setInlineAnalysisTaskState,
  });
  await vi.advanceTimersByTimeAsync(350);
  await pending;
}

const originalFetch = global.fetch;

beforeEach(() => {
  vi.useFakeTimers();
  useBackgroundTaskStore.setState({ inlineAnalysisTasks: {} });
  useResearchRouteStore.setState({ currentView: null });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("inline analysis explicit recovery", () => {
  it("settles provider failure without an automatic retry", async () => {
    const { document, task } = seedTask();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      Response.json([
        {
          paperId: "paper-1",
          status: "error",
          failureKind: "cooldown",
          cooldownUntil: "2026-07-30T00:05:00.000Z",
          retryRequiresExplicit: true,
        },
      ]),
    );
    global.fetch = fetchMock;

    await runTask(task, document);
    await vi.advanceTimersByTimeAsync(60_000);

    const settled = useBackgroundTaskStore.getState().inlineAnalysisTasks[document.id];
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(settled?.progressMap.get("paper-1")).toBe("error");
    expect(settled?.status).toBe("settled");
    expect(settled?.recoveryMap?.get("paper-1")).toEqual({
      cooldownUntil: "2026-07-30T00:05:00.000Z",
      retryRequiresExplicit: true,
    });
  });

  it("sends a second request only after the explicit retry command", async () => {
    const { document, task } = seedTask();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json([
          {
            paperId: "paper-1",
            status: "error",
            failureKind: "terminal",
            retryRequiresExplicit: true,
          },
        ]),
      )
      .mockResolvedValueOnce(
        Response.json([
          {
            paperId: "paper-1",
            inputFingerprint: "a".repeat(64),
            source: "abstract",
            analysis: {
              summary: "summary",
              objective: "objective",
              methodology: "method",
              results: "result",
              keywords: [],
              semanticProfile: {
                claim: "claim",
                topics: [],
                method: "method",
                finding: "result",
                quotedBasis: {
                  claim: "claim",
                  topics: [],
                  method: "method",
                  finding: "result",
                },
              },
              confidence: "medium",
              evidenceMap: {},
            },
          },
        ]),
      );
    global.fetch = fetchMock;

    await runTask(task, document);
    expect(retryInlineAnalysisForPaper("paper-1")).toBe(true);
    const retryTask = useBackgroundTaskStore.getState().inlineAnalysisTasks[document.id];
    expect(retryTask?.retryCommand).toBe("explicit_retry");
    if (!retryTask) throw new Error("retry task is required");
    await runTask(retryTask, document);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = fetchMock.mock.calls[1]?.[1]?.body;
    expect(typeof body === "string" ? JSON.parse(body) : null).toMatchObject({
      retryCommand: "explicit_retry",
    });
  });
});
