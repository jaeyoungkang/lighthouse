import { beforeEach, describe, expect, it } from "vitest";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

function createReactionDocument(): Extract<ResearchRoutePayload, { type: "search" }> {
  const now = "2026-04-07T00:00:00.000Z";
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-1",
    type: "search",
    title: "Paper",
    content: "search",
    createdBy: "user",
    metadata: {
      type: "search",
      query: "Paper",
      papers: [],
      total: 1,
    },
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: now,
    updatedAt: now,
    reaction: null,
  };
}

function createSearchView(): Extract<ResearchRoutePayload, { type: "search" }> {
  const now = "2026-04-07T00:00:00.000Z";
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-1",
    type: "search",
    title: "검색: AI for Science",
    content: "search",
    createdBy: "user",
    metadata: {
      type: "search",
      query: "AI for Science",
      papers: [],
      total: 0,
    },
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: now,
    updatedAt: now,
    reaction: null,
  };
}

describe("research-route-store reaction card history", () => {
  beforeEach(() => {
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  });

  it("hydrates the full persisted reaction history after reload", () => {
    const document = {
      ...createReactionDocument(),
      reaction: {
        id: "block-2",
        title: "방법 분석",
        body: "두 번째 카드",
        chips: [],
        timestamp: "2026-04-08T00:01:00.000Z",
      },
      reactionHistory: [
        {
          id: "block-1",
          title: "초기 요약",
          body: "첫 번째 카드",
          chips: [],
          timestamp: "2026-04-08T00:00:00.000Z",
        },
        {
          id: "block-2",
          title: "방법 분석",
          body: "두 번째 카드",
          chips: [],
          timestamp: "2026-04-08T00:01:00.000Z",
        },
      ],
    };
    useResearchRouteStore.getState().setCurrentView(document, "test-execution:87");

    expect(useResearchRouteStore.getState().routeAiComment?.id).toBe("block-2");
    expect(useResearchRouteStore.getState().reactionCardHistory).toEqual(document.reactionHistory);
  });

  it("clears stale local reaction history when hydration returns no persisted reaction", () => {
    useResearchRouteStore.getState().setCurrentView(createSearchView(), "test-execution:94");
    useResearchRouteStore.getState().setRouteAiComment(
      "search-1",
      {
        id: "old-search-reaction",
        title: "Old search comment",
        body: "This belongs to the previous query.",
        chips: [],
        timestamp: "2026-04-08T00:00:00.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    useResearchRouteStore.getState().setCurrentView(
      {
        ...createSearchView(),
        id: "search-2",
        title: "검색: new query",
        metadata: {
          type: "search",
          query: "new query",
          papers: [],
          total: 0,
        },
        reaction: null,
        reactionHistory: [],
      },
      "test-execution:103",
    );

    expect(useResearchRouteStore.getState().routeAiComment).toBeNull();
    expect(useResearchRouteStore.getState().reactionCardHistory).toEqual([]);
  });

  it("derives consumed follow-up prompts only from supported current reaction actions", () => {
    const initialReaction = {
      id: "block-search-1",
      title: "AI for Science 연구 35편",
      body: "초기 검색 반응은 바로 보인다.",
      chips: [],
      surface: {
        kind: "guided_tree" as const,
        groups: [
          {
            id: "search-explore",
            kind: "explore" as const,
            title: "탐색 가지",
            nodes: [
              {
                id: "search-follow-up-representative",
                label: "대표 논문 보기",
                action: {
                  type: "submit_prompt" as const,
                  prompt: "대표 논문 보기",
                },
              },
            ],
          },
        ],
      } as never,
      timestamp: "2026-04-08T00:00:00.000Z",
    };
    const representativeReaction = {
      id: "block-search-2",
      title: "대표 논문",
      body: "검색 결과에서 대표 논문을 골랐다.",
      chips: [],
      surface: {
        kind: "paper_cards" as const,
        intent: "representative" as const,
        cards: [],
      },
      timestamp: "2026-04-08T00:01:00.000Z",
    };
    useResearchRouteStore.getState().setCurrentView(
      {
        ...createSearchView(),
        reaction: representativeReaction,
        reactionHistory: [initialReaction, representativeReaction],
      },
      "test-execution:161",
    );

    expect(useResearchRouteStore.getState().reactionCardHistory).toEqual([
      initialReaction,
      representativeReaction,
    ]);
  });
});
