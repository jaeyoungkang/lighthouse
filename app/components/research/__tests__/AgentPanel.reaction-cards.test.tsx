import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAgentPanelTestHarness } from "@/app/components/research/__tests__/agent-panel-test-support";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

const agentPanelHarness = createAgentPanelTestHarness({ attachToDocument: true });
const { renderAgentPanel } = agentPanelHarness;

function createSearchView(): ResearchRoutePayload {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-1",
    type: "search",
    title: "검색: AI for Science",
    content: "search content",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt: "2026-04-09T00:00:00.000Z",
    metadata: {
      type: "search",
      query: "AI for Science",
      total: 2,
      papers: [],
    },
    reaction: null,
  };
}

function createSearchViewWithPapers(): ResearchRoutePayload {
  const document = createSearchView();
  if (document.metadata.type === "search") {
    document.metadata.papers = [
      {
        paperId: "p1",
        title: "Paper 1",
        abstract: "abstract",
        year: 2024,
        citationCount: 5,
        url: "https://example.com/p1",
        authors: [{ name: "Alice" }],
      },
    ];
  }
  return document;
}

describe("AgentPanel reaction cards", () => {
  beforeEach(() => {
    agentPanelHarness.setup();
  });

  afterEach(() => {
    agentPanelHarness.cleanup();
    vi.unstubAllGlobals();
  });

  it("does not start follow-up card history from unsupported AI-comment button surfaces", () => {
    const sendMessage = vi.fn();
    const document = createSearchView();
    useReactionActionStore.getState().registerSendMessage(sendMessage);
    useResearchRouteStore.getState().setCurrentView(document, "test-execution:89");
    useResearchRouteStore.getState().setRouteAiComment(
      document.id,
      {
        id: "block-search-stack-1",
        title: "검색 요약",
        body: "다음 읽을 축을 짧게 정리했다.",
        chips: [],
        surface: {
          kind: "guided_tree",
          groups: [
            {
              id: "search-explore",
              kind: "explore",
              title: "다음 보기",
              nodes: [
                {
                  id: "search-followup",
                  label: "주제 축 정리",
                  action: {
                    type: "submit_prompt",
                    prompt: "주제 축 정리",
                  },
                },
              ],
            },
          ],
        } as never,
        timestamp: "2026-04-09T00:00:00.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    const container = renderAgentPanel(document.id);
    const followupButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("주제 축 정리"),
    );

    const cards = container.querySelectorAll('[data-testid="agent-panel-reaction-card"]');
    expect(followupButton).toBeUndefined();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(cards).toHaveLength(1);
    expect(container.textContent).toContain("다음 읽을 축을 짧게 정리했다.");
    expect(container.textContent).not.toContain("주제 축 정리");
  });

  it("keeps the current reaction and re-fires owning-route AI comment generation when 다시 생성 is clicked", () => {
    const sendMessage = vi.fn();
    const document = createSearchViewWithPapers();
    useReactionActionStore.getState().registerSendMessage(sendMessage);
    useResearchRouteStore.getState().setCurrentView(document, "test-execution:135");
    useResearchRouteStore.getState().setRouteAiComment(
      document.id,
      {
        id: "block-regenerate-1",
        title: "검색 요약",
        body: "주제 축 정리로 이어질 수 있다.",
        chips: [],
        timestamp: "2026-04-09T00:00:00.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    const container = renderAgentPanel(document.id);
    const regenerateButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="agent-panel-regenerate"]',
    );
    if (!regenerateButton) {
      throw new Error("expected regenerate button on a settled comment");
    }

    act(() => {
      regenerateButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // 다시 생성 advances the reaction generation without removing the settled
    // card, then re-fires the owning ResearchRoutePayload's reaction generation command through the scheduler.
    expect(useResearchRouteStore.getState().routeAiComment?.id).toBe("block-regenerate-1");
    expect(useResearchRouteStore.getState().reactionGeneration).toBe(1);
    expect(container.textContent).toContain("주제 축 정리로 이어질 수 있다.");
    expect(container.querySelector('[data-testid="agent-panel-regenerate"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="agent-panel-regenerate-pending"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("다시 생성 중...");
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "user_search", targetRoutePayloadId: document.id }),
    );

    act(() => {
      useResearchRouteStore.getState().setRouteAiComment(
        document.id,
        {
          id: "block-regenerate-2",
          title: "검색 요약",
          body: "새로 만든 코멘트입니다.",
          chips: [],
          timestamp: "2026-04-09T00:01:00.000Z",
        },
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
      );
    });

    expect(container.querySelector('[data-testid="agent-panel-regenerate-pending"]')).toBeNull();
    expect(container.querySelector('[data-testid="agent-panel-regenerate"]')).not.toBeNull();
    expect(container.textContent).toContain("새로 만든 코멘트입니다.");
  });

  it("does not offer 다시 생성 while a comment is still generating", () => {
    const searchDocument = createSearchViewWithPapers();
    useReactionActionStore.getState().registerSendMessage(vi.fn());
    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:188");

    const container = renderAgentPanelLoading(searchDocument.id);
    expect(container.querySelector('[data-testid="agent-panel-regenerate"]')).toBeNull();
    expect(container.querySelector('[data-testid="agent-panel-inline-pending"]')).not.toBeNull();
  });

  it("renders the comment body but not retired representative paper-card content", () => {
    const document = createSearchViewWithPapers();
    useResearchRouteStore.getState().setCurrentView(document, "test-execution:197");
    useResearchRouteStore.getState().setRouteAiComment(
      document.id,
      {
        id: "legacy-representative-card",
        title: "대표 논문",
        body: "현재 검색에서 눈여겨볼 대표 논문을 골랐다.",
        chips: [],
        surface: {
          kind: "paper_cards",
          intent: "representative",
          cards: [
            {
              paperId: "p1",
              title: "Paper 1",
              headline: "대표",
              insight: "unsupported card",
            },
          ],
        },
        timestamp: "2026-04-09T00:00:00.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    const container = renderAgentPanel(document.id);

    expect(container.querySelector('[data-testid="agent-panel-reaction-card"]')).not.toBeNull();
    expect(container.textContent).toContain("대표 논문");
    expect(container.textContent).toContain("현재 검색에서 눈여겨볼 대표 논문을 골랐다.");
    expect(container.textContent).not.toContain("Paper 1");
    expect(container.textContent).not.toContain("unsupported card");
  });
});

function renderAgentPanelLoading(documentId: string) {
  return renderAgentPanel(documentId, true);
}
