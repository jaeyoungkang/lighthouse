import { act } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAgentPanelTestHarness } from "@/app/components/research/__tests__/agent-panel-test-support";
import type { RouteAiComment } from "@/app/domain/route-ai-comment";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

const agentPanelHarness = createAgentPanelTestHarness();
const { renderAgentPanel } = agentPanelHarness;

function createSearchView() {
  return {
    status: "ready" as const,
    version: 0,
    reactionVersion: 0,
    id: "search-1",
    type: "search" as const,
    title: "검색: ai for science",
    content: "search content",
    createdBy: "user" as const,
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt: "2026-04-09T00:00:00.000Z",
    metadata: {
      type: "search" as const,
      query: "ai for science",
      total: 1,
      papers: [
        {
          paperId: "paper-1",
          title: "The AI Scientist",
          abstract: "abstract",
          year: 2024,
          citationCount: 10,
          url: "https://example.com/1",
          authors: [{ name: "Alice" }],
        },
      ],
    },
    reaction: null,
  };
}

describe("AgentPanel auto-expand", () => {
  beforeEach(() => {
    agentPanelHarness.setup();
  });

  afterEach(() => {
    agentPanelHarness.cleanup();
  });

  it("keeps new reaction block content visible without collapse chrome", () => {
    useResearchRouteStore.getState().setCurrentView(createSearchView(), "test-execution:85");
    const firstReaction: RouteAiComment = {
      id: "block-a1",
      title: "첫 반응",
      body: "첫 번째 본문.",
      surface: undefined,
      chips: [],
      timestamp: "2026-04-09T00:00:00.000Z",
    };
    useResearchRouteStore
      .getState()
      .setRouteAiComment(
        "search-1",
        firstReaction,
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );

    const container = renderAgentPanel("search-1");
    expect(container.textContent).toContain("첫 번째 본문.");
    expect(container.textContent).not.toContain("접기");

    const nextReaction: RouteAiComment = {
      id: "block-a2",
      title: "새 반응",
      body: "두 번째 본문.",
      chips: [],
      surface: {
        kind: "guided_tree",
        groups: [
          {
            id: "group-2",
            kind: "explore",
            title: "탐색 가지",
            nodes: [
              {
                id: "node-2",
                label: "후속 가지",
                action: {
                  type: "submit_prompt",
                  prompt: "후속 가지",
                },
              },
            ],
          },
        ],
      } as never,
      timestamp: "2026-04-09T00:01:00.000Z",
    };
    act(() => {
      useResearchRouteStore
        .getState()
        .setRouteAiComment(
          "search-1",
          nextReaction,
          useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
        );
    });

    expect(container.textContent).toContain("두 번째 본문.");
    expect(container.textContent).not.toContain("후속 가지");
  });

  it("keeps refreshed reaction content visible without collapse chrome", () => {
    useResearchRouteStore.getState().setCurrentView(createSearchView(), "test-execution:136");
    const initialReaction: RouteAiComment = {
      id: "block-stable",
      title: "안내",
      body: "이전 본문.",
      chips: [],
      timestamp: "2026-04-09T00:00:00.000Z",
    };
    useResearchRouteStore
      .getState()
      .setRouteAiComment(
        "search-1",
        initialReaction,
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );

    const container = renderAgentPanel("search-1");
    expect(container.textContent).toContain("이전 본문.");
    expect(container.textContent).not.toContain("접기");

    act(() => {
      useResearchRouteStore.getState().setRouteAiComment(
        "search-1",
        {
          ...initialReaction,
          body: "갱신된 본문.",
          timestamp: "2026-04-09T00:01:00.000Z",
        },
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );
    });

    expect(container.textContent).toContain("갱신된 본문.");
  });
});
