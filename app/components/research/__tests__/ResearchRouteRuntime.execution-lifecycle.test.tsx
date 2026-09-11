import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchRouteRuntime } from "@/app/components/research/ResearchRouteRuntime";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

vi.mock("@/app/components/research/ResearchRouteLayout", () => ({
  ResearchRouteLayout: () => <div data-testid="research-route-layout" />,
}));

vi.mock("@/app/lib/track", () => ({
  track: () => undefined,
}));

let root: Root | null = null;

function createSearchView(updatedAt = "2026-04-09T00:00:00.000Z"): ResearchRoutePayload {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-1",
    type: "search",
    title: "Search llm",
    content: "search content",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt,
    metadata: {
      type: "search",
      query: "llm",
      total: 1,
      papers: [
        {
          paperId: "paper-1",
          title: "Paper 1",
          abstract: "abstract",
          year: 2024,
          citationCount: 7,
          url: "https://example.com/1",
          authors: [{ name: "Alice" }],
        },
      ],
    },
    reaction: null,
  };
}

function getGenerationCalls() {
  return vi.mocked(globalThis.fetch).mock.calls.filter(([input]) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    return url.includes("/route-ai-comments/generate");
  });
}

function getRequestBody(index: number) {
  const body = getGenerationCalls().at(index)?.[1]?.body;
  return typeof body === "string" ? (JSON.parse(body) as Record<string, unknown>) : {};
}

async function flushRuntime() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderRuntime(
  initialView: ComponentProps<typeof ResearchRouteRuntime>["initialView"],
  executionKey = "execution-1",
) {
  if (!root) {
    root = createRoot(document.createElement("div"));
  }
  act(() => {
    root?.render(
      <ResearchRouteRuntime
        renderViewBody={() => null}
        key={executionKey}
        runtimeId="principal-1"
        initialView={initialView}
      />,
    );
  });
}

describe("ResearchRouteRuntime execution lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useReactionActionStore.getState().unregisterSendMessage();
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const snapshotId = decodeURIComponent(
          url.split("/api/route-ai-comments/generate/")[1] ?? "",
        );
        return Promise.resolve(
          new Response(
            JSON.stringify({
              snapshotId,
              snapshotKind: "search",
              reaction: {
                id: `generated-${snapshotId}`,
                title: "Generated reaction",
                body: "Generated body",
                chips: [],
                timestamp: "2026-06-01T00:00:00.000Z",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }),
    );
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  });

  it("resets and bootstraps a new mount that reuses the same id and updatedAt", async () => {
    const view = createSearchView();
    renderRuntime(view, "execution-1");
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    await flushRuntime();

    expect(getGenerationCalls()).toHaveLength(1);
    expect(useResearchRouteStore.getState().routeAiComment?.id).toBe("generated-search-1");

    const firstExecutionId = useResearchRouteStore.getState().activeExecutionId;
    renderRuntime({ ...view, reactionHistory: [] }, "execution-2");
    await flushRuntime();

    const resetState = useResearchRouteStore.getState();
    expect(resetState.routeAiComment).toBeNull();
    expect(resetState.pendingRouteAiCommentRegeneration).toBe(true);
    expect(resetState.activeExecutionId).not.toBe(firstExecutionId);

    act(() => {
      vi.advanceTimersByTime(1300);
    });
    await flushRuntime();

    expect(getGenerationCalls()).toHaveLength(2);
    expect(getRequestBody(1)).toMatchObject({
      trigger: "user_search",
      reactionGeneration: 0,
      viewSnapshot: {
        snapshotId: view.id,
        snapshotKind: "search",
        content: { kind: "search", query: "llm" },
      },
    });
  });

  it("keeps the same execution token on a simple rerender", async () => {
    const view = createSearchView();
    renderRuntime(view, "execution-1");
    const executionId = useResearchRouteStore.getState().activeExecutionId;

    renderRuntime(view, "execution-1");
    await flushRuntime();

    expect(useResearchRouteStore.getState().activeExecutionId).toBe(executionId);
  });

  it("resets and bootstraps a new execution in the same React instance", async () => {
    const firstView = createSearchView();
    renderRuntime(firstView, "shared-instance");
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    await flushRuntime();
    expect(getGenerationCalls()).toHaveLength(1);
    const firstExecutionId = useResearchRouteStore.getState().activeExecutionId;

    const replacementView = createSearchView("2026-04-09T00:00:01.000Z");
    renderRuntime(replacementView, "shared-instance");
    await flushRuntime();
    expect(useResearchRouteStore.getState().activeExecutionId).not.toBe(firstExecutionId);

    act(() => {
      vi.advanceTimersByTime(1300);
    });
    await flushRuntime();

    expect(getGenerationCalls()).toHaveLength(2);
    expect(getRequestBody(1)).toMatchObject({
      trigger: "user_search",
      viewSnapshot: {
        snapshotId: replacementView.id,
        snapshotKind: "search",
        content: { kind: "search", query: "llm" },
      },
    });
  });
});
