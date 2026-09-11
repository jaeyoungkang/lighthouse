import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAgentPanelTestHarness } from "@/app/components/research/__tests__/agent-panel-test-support";
import { INLINE_AI_COMMENT_GENERATED_REGION_CLASS } from "@/app/components/research/inline-ai-comment-treatment";
import { INLINE_ANALYSIS_VERSION, type AIAnalysis } from "@/app/domain/analysis";
import { trackAiCommentCardExpandClicked, trackAiCommentCardViewedOnce } from "@/app/lib/track";
import type * as TrackModule from "@/app/lib/track";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/app/lib/track", async (importOriginal) => {
  const actual = await importOriginal<typeof TrackModule>();
  return {
    ...actual,
    trackAiCommentCardViewedOnce: vi.fn(),
    trackAiCommentCardExpandClicked: vi.fn(),
  };
});

const agentPanelHarness = createAgentPanelTestHarness();
const { renderAgentPanel } = agentPanelHarness;
const trackAiCommentCardViewedOnceMock = vi.mocked(trackAiCommentCardViewedOnce);
const trackAiCommentCardExpandClickedMock = vi.mocked(trackAiCommentCardExpandClicked);

function setOverflowMeasurements(
  element: Element | null,
  { clientHeight, scrollHeight }: { clientHeight: number; scrollHeight: number },
) {
  if (!(element instanceof HTMLElement)) throw new Error("expected measurable element");
  Object.defineProperty(element, "clientHeight", { configurable: true, value: clientHeight });
  Object.defineProperty(element, "scrollHeight", { configurable: true, value: scrollHeight });
  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

const inlineAnalysis: AIAnalysis = {
  summary: "summary",
  objective: "objective",
  methodology: "methodology",
  results: "results",
  keywords: ["agent", "science"],
  semanticProfile: {
    claim: "objective",
    topics: ["agent", "science"],
    method: "methodology",
    finding: "results",
    quotedBasis: {
      claim: "objective evidence",
      topics: ["agent", "science"],
      method: "method evidence",
      finding: "result evidence",
    },
  },
  confidence: "high",
  evidenceMap: {},
};

function createSearchView(options?: {
  withInlineAnalysis?: boolean;
  query?: string;
  papers?: Array<{
    paperId: string;
    title: string;
    abstract: string | null;
    year: number | null;
    citationCount: number;
    url: string;
    authors: Array<{ name: string }>;
    reviewed?: boolean;
    inlineAnalysis?: {
      version: number;
      analysis: AIAnalysis;
      source: "abstract";
    };
  }>;
}) {
  const firstPaper = options?.withInlineAnalysis
    ? {
        paperId: "paper-1",
        title: "The AI Scientist",
        abstract: "abstract",
        year: 2024,
        citationCount: 10,
        url: "https://example.com/1",
        authors: [{ name: "Alice" }],
        reviewed: false,
        inlineAnalysis: {
          version: INLINE_ANALYSIS_VERSION,
          analysis: inlineAnalysis,
          source: "abstract" as const,
        },
      }
    : {
        paperId: "paper-1",
        title: "The AI Scientist",
        abstract: "abstract",
        year: 2024,
        citationCount: 10,
        url: "https://example.com/1",
        authors: [{ name: "Alice" }],
      };
  const papers = options?.papers ?? [firstPaper];

  return {
    status: "ready" as const,
    version: 0,
    reactionVersion: 0,
    id: "search-1",
    type: "search" as const,
    title: `검색: ${options?.query ?? "ai for science"}`,
    content: "search content",
    createdBy: "user" as const,
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt: "2026-04-09T00:00:00.000Z",
    metadata: {
      type: "search" as const,
      query: options?.query ?? "ai for science",
      total: papers.length,
      papers,
    },
    reaction: null,
  };
}

function resetTestDoubles() {
  vi.unstubAllGlobals();
  mockPush.mockClear();
  trackAiCommentCardViewedOnceMock.mockClear();
  trackAiCommentCardExpandClickedMock.mockClear();
}

function registerAgentPanelLifecycle() {
  beforeEach(() => {
    agentPanelHarness.setup();
    resetTestDoubles();
  });

  afterEach(() => {
    agentPanelHarness.cleanup();
  });
}

describe("AgentPanel interactions", () => {
  registerAgentPanelLifecycle();

  it("ignores unsupported AI-comment prompt button surfaces", () => {
    const sendMessage = vi.fn();
    useReactionActionStore.getState().registerSendMessage(sendMessage);
    useResearchRouteStore.getState().setCurrentView(createSearchView(), "test-execution:178");
    useResearchRouteStore.getState().setRouteAiComment(
      "search-1",
      {
        id: "block-1",
        title: "AI for Science 연구 35편",
        body: "세 갈래가 보인다.",
        chips: [],
        surface: {
          kind: "guided_tree",
          groups: [
            {
              id: "search-explore",
              kind: "explore",
              title: "탐색 가지",
              nodes: [
                {
                  id: "branch-1",
                  label: "주제 축 정리",
                  summary: "세 갈래로 전체 지형을 본다",
                  children: [
                    {
                      id: "leaf-1",
                      label: "바이오·분자 기초모델",
                      action: {
                        type: "submit_prompt",
                        prompt: "AI for Science에서 바이오·분자 기초모델 갈래를 정리해줘",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        } as never,
        timestamp: "2026-04-09T00:00:00.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    const container = renderAgentPanel("search-1");
    const unsupportedButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("주제 축 정리"),
    );

    expect(unsupportedButton).toBeUndefined();
    expect(container.textContent).toContain("세 갈래가 보인다.");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("does not expose unsupported AI-comment prompt button surfaces", () => {
    const sendMessage = vi.fn();
    useReactionActionStore.getState().registerSendMessage(sendMessage);
    useResearchRouteStore.getState().setCurrentView(createSearchView(), "test-execution:227");
    useResearchRouteStore.getState().setRouteAiComment(
      "search-1",
      {
        id: "block-double-click-1",
        title: "AI for Science 연구 35편",
        body: "세 갈래가 보인다.",
        chips: [],
        surface: {
          kind: "guided_tree",
          groups: [
            {
              id: "search-explore",
              kind: "explore",
              title: "탐색 가지",
              nodes: [
                {
                  id: "leaf-double-click",
                  label: "주제 축 정리",
                  action: {
                    type: "submit_prompt",
                    prompt: "AI for Science에서 주제 축을 정리해줘",
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

    const container = renderAgentPanel("search-1");
    const actionButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("주제 축 정리"),
    );

    expect(actionButton).toBeUndefined();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("ignores unsupported recover button actions", () => {
    const sendMessage = vi.fn();
    useReactionActionStore.getState().registerSendMessage(sendMessage);
    useResearchRouteStore.getState().setCurrentView(createSearchView(), "test-execution:268");
    useResearchRouteStore.getState().setRouteAiComment(
      "search-1",
      {
        id: "block-recover-1",
        title: "검색 결과 일부만 도착",
        body: "현재 결과로 시작하거나 다시 검색할 수 있다.",
        chips: [],
        surface: {
          kind: "guided_tree",
          groups: [
            {
              id: "search-recover",
              kind: "recover",
              title: "복구",
              nodes: [
                {
                  id: "retry-search",
                  label: "다시 검색",
                  action: {
                    type: "submit_prompt",
                    prompt: "다시 검색",
                  },
                },
              ],
            },
          ],
        } as never,
        timestamp: "2026-04-09T00:00:30.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    const container = renderAgentPanel("search-1");

    const recoverButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("다시 검색"),
    );

    expect(recoverButton).toBeUndefined();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("keeps search gap navigation owned by the host action row", () => {
    const sendMessage = vi.fn();
    useReactionActionStore.getState().registerSendMessage(sendMessage);
    useResearchRouteStore.getState().setCurrentView(createSearchView(), "test-execution:310");
    useResearchRouteStore.getState().setRouteAiComment(
      "search-1",
      {
        id: "block-2",
        title: "AI for Science 연구 35편",
        body: "공백 리포트로 이어질 수 있다.",
        chips: [],
        surface: {
          kind: "guided_tree",
          groups: [
            {
              id: "search-navigate",
              kind: "navigate",
              title: "문서 이동",
              nodes: [
                {
                  id: "gap-open",
                  label: "연구 공백 탐색",
                  action: {
                    type: "open_gap_network",
                    lens: "E2",
                  },
                },
              ],
            },
          ],
        } as never,
        timestamp: "2026-04-09T00:01:00.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    const container = renderAgentPanel("search-1");
    const unsupportedNavigateButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent.includes("연구 공백 탐색"),
    );

    expect(unsupportedNavigateButton).toBeUndefined();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("AgentPanel progressive content stability", () => {
  registerAgentPanelLifecycle();

  it("keeps pending and settled comments in one bounded region until the user expands", () => {
    const view = createSearchView();
    useResearchRouteStore.getState().setCurrentView(view, "test-execution:stable");
    const container = renderAgentPanel(
      view.id,
      true,
      <span data-testid="agent-panel-test-research-terms">주요 연구 용어</span>,
    );

    const pending = container.querySelector('[data-testid="agent-panel-inline-pending"]');
    const pendingRegion = container.querySelector(
      '[data-generated-content-region="route-ai-comment"]',
    );
    for (const className of INLINE_AI_COMMENT_GENERATED_REGION_CLASS.split(" ")) {
      expect(pending?.className).toContain(className);
      expect(pendingRegion?.className).toContain(className);
    }

    const longBody =
      "이 코멘트는 사용자가 현재 읽고 있는 논문 위치를 잃지 않도록 자동 생성 단계에서는 세 줄까지만 보여 준다. " +
      "추가 맥락과 비교 기준이 더 길게 이어지더라도 사용자가 직접 펼치기를 선택하기 전에는 카드 전체 높이를 늘리지 않는다.";
    act(() => {
      useResearchRouteStore.getState().setRouteAiComment(
        view.id,
        {
          id: "stable-comment",
          title: "검색 요약",
          body: longBody,
          chips: [],
          timestamp: "2026-07-16T00:00:00.000Z",
        },
        useResearchRouteStore.getState().activeExecutionId ?? "test-execution:stable",
      );
    });
    renderAgentPanel(
      view.id,
      false,
      <span data-testid="agent-panel-test-research-terms">주요 연구 용어</span>,
    );

    const settledRegion = container.querySelector(
      '[data-generated-content-region="route-ai-comment"]',
    );
    const settledBody = container.querySelector('[data-testid="agent-panel-scroll-body"]');
    const settledCard = container.querySelector('[data-testid="agent-panel-reaction-card"]');
    const body = container.querySelector('[data-testid="agent-panel-reaction-body"]');
    setOverflowMeasurements(body, { clientHeight: 72, scrollHeight: 96 });
    const disclosure = container.querySelector<HTMLButtonElement>(
      '[data-testid="agent-panel-reaction-disclosure"]',
    );
    const regenerate = container.querySelector<HTMLButtonElement>(
      '[data-testid="agent-panel-regenerate"]',
    );
    for (const className of INLINE_AI_COMMENT_GENERATED_REGION_CLASS.split(" ")) {
      expect(settledRegion?.className).toContain(className);
    }
    expect(body?.className).toContain("line-clamp-3");
    expect(disclosure?.getAttribute("aria-expanded")).toBe("false");
    expect(
      container.querySelector('[data-testid="agent-panel-test-research-terms"]'),
    ).not.toBeNull();
    expect(disclosure?.parentElement).toBe(regenerate?.parentElement);
    expect(disclosure?.parentElement?.getAttribute("data-testid")).toBe(
      "agent-panel-comment-footer",
    );
    expect(settledBody?.className).toContain("flex-1");
    expect(settledCard?.className).toContain("flex-1");
    expect(disclosure?.parentElement?.className).toContain("mt-auto");
    expect(disclosure?.parentElement?.className).toContain("pt-1.5");
    expect(
      container
        .querySelector('[data-testid="agent-panel-reaction-disclosure-icon"]')
        ?.getAttribute("class"),
    ).not.toContain("rotate-180");

    act(() => {
      disclosure?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(body?.className).not.toContain("line-clamp-3");
    expect(disclosure?.getAttribute("aria-expanded")).toBe("true");
    expect(disclosure?.textContent).toContain("접기");
    expect(
      container
        .querySelector('[data-testid="agent-panel-reaction-disclosure-icon"]')
        ?.getAttribute("class"),
    ).toContain("rotate-180");
    expect(trackAiCommentCardExpandClickedMock).toHaveBeenCalledWith({
      ownerPrincipalId: "principal-1",
      documentId: view.id,
      reactionKey: `${view.id}:stable-comment:2026-07-16T00:00:00.000Z`,
    });

    act(() => {
      useResearchRouteStore.getState().setCurrentView(view, "test-execution:replacement");
      useResearchRouteStore.getState().setRouteAiComment(
        view.id,
        {
          id: "stable-comment",
          title: "검색 요약",
          body: longBody,
          chips: [],
          timestamp: "2026-07-16T00:00:00.000Z",
        },
        "test-execution:replacement",
      );
    });
    setOverflowMeasurements(container.querySelector('[data-testid="agent-panel-reaction-body"]'), {
      clientHeight: 72,
      scrollHeight: 96,
    });

    expect(
      container
        .querySelector('[data-testid="agent-panel-reaction-disclosure"]')
        ?.getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("keeps a short comment in the preview without rendering a disclosure", () => {
    const view = createSearchView();
    useResearchRouteStore.getState().setCurrentView(view, "test-execution:short");
    useResearchRouteStore.getState().setRouteAiComment(
      view.id,
      {
        id: "short-comment",
        title: "검색 요약",
        body: "짧은 코멘트는 별도 펼치기 없이 모두 읽힌다.",
        chips: [],
        timestamp: "2026-07-16T00:01:00.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution:short",
    );

    const container = renderAgentPanel(view.id);
    expect(
      container.querySelector('[data-testid="agent-panel-reaction-body"]')?.className,
    ).toContain("line-clamp-3");
    expect(container.querySelector('[data-testid="agent-panel-reaction-disclosure"]')).toBeNull();
  });

  it("offers disclosure for a short body that actually overflows because of line breaks", () => {
    const view = createSearchView();
    useResearchRouteStore.getState().setCurrentView(view, "test-execution:line-breaks");
    useResearchRouteStore.getState().setRouteAiComment(
      view.id,
      {
        id: "line-break-comment",
        title: "검색 요약",
        body: "첫 줄\n둘째 줄\n셋째 줄\n넷째 줄",
        chips: [],
        timestamp: "2026-07-16T00:02:00.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution:line-breaks",
    );

    const container = renderAgentPanel(view.id);
    setOverflowMeasurements(container.querySelector('[data-testid="agent-panel-reaction-body"]'), {
      clientHeight: 72,
      scrollHeight: 96,
    });

    expect(
      container
        .querySelector('[data-testid="agent-panel-reaction-disclosure"]')
        ?.getAttribute("aria-expanded"),
    ).toBe("false");
  });
});

describe("AgentPanel follow-up surfaces", () => {
  registerAgentPanelLifecycle();

  it("renders the comment body but not retired representative paper-card surfaces", () => {
    useResearchRouteStore
      .getState()
      .setCurrentView(createSearchView({ withInlineAnalysis: true }), "test-execution:354");
    useResearchRouteStore.getState().setRouteAiComment(
      "search-1",
      {
        id: "block-cards-1",
        title: "대표 논문 요약",
        body: "현재 검색에서 눈여겨볼 대표 논문을 골랐다.",
        chips: [],
        surface: {
          kind: "paper_cards",
          intent: "representative",
          cards: [
            {
              paperId: "paper-1",
              title: "The AI Scientist",
              headline: "실험 자동화 대표",
              insight: "연구 루프 자동화를 전면에 둔 대표 사례다.",
            },
          ],
        },
        timestamp: "2026-04-09T00:01:40.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    const container = renderAgentPanel("search-1");

    expect(container.textContent).toContain("현재 검색에서 눈여겨볼 대표 논문을 골랐다.");
    expect(container.textContent).not.toContain("The AI Scientist");
    expect(container.textContent).not.toContain("실험 자동화 대표");
    expect(container.textContent).not.toContain("연구 루프 자동화를 전면에 둔 대표 사례다.");
  });

  it("renders reaction content without a collapse affordance", () => {
    useResearchRouteStore.getState().setCurrentView(
      createSearchView({
        papers: [
          {
            paperId: "paper-1",
            title: "The AI Scientist",
            abstract: "abstract",
            year: null,
            citationCount: 10,
            url: "https://example.com/1",
            authors: [{ name: "Alice" }],
          },
        ],
      }),
      "test-execution:384",
    );
    useResearchRouteStore.getState().setRouteAiComment(
      "search-1",
      {
        id: "block-c1",
        title: "요약 제목",
        body: "본문 내용이 여기에 표시된다.",
        chips: [],
        surface: {
          kind: "guided_tree",
          groups: [
            {
              id: "group-1",
              kind: "explore",
              title: "탐색 가지",
              nodes: [
                {
                  id: "node-1",
                  label: "연구 공백 탐색",
                  action: {
                    type: "open_gap_network",
                    lens: "E2",
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

    const container = renderAgentPanel("search-1");

    expect(container.textContent).toContain("본문 내용이 여기에 표시된다.");
    expect(container.textContent).not.toContain("연구 공백 탐색");
    expect(container.querySelector('[data-testid="gap-network-action-strip"]')).toBeNull();
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="접기"]')).toBeNull();
  });

  it("renders inline comments as aligned text without an outline", () => {
    useResearchRouteStore.getState().setCurrentView(createSearchView(), "test-execution:436");
    useResearchRouteStore.getState().setRouteAiComment(
      "search-1",
      {
        id: "block-inline-style",
        title: "검색 반응",
        body: "검색 결과의 결을 짧게 정리한다.",
        chips: [],
        timestamp: "2026-04-09T00:00:00.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    const container = renderAgentPanel("search-1");
    const card = container.querySelector<HTMLElement>('[data-testid="agent-panel-reaction-card"]');

    expect(card?.className).not.toContain("bg-surface-muted/80");
    expect(card?.className).not.toContain("px-4");
    expect(card?.className).not.toContain("py-3");
    expect(card?.className).not.toContain("border ");
    expect(card?.className).not.toContain("border-sidebar-border");
    expect(card?.querySelector("p")?.className).toContain("lh-type-reading-body");
    expect(card?.querySelector("p")?.className).toContain("lh-tone-primary");
    expect(container.textContent).toContain("검색 결과의 결을 짧게 정리한다.");
  });

  it("fills an inline comment surface with a pending state while the reaction is generating", () => {
    useResearchRouteStore.getState().setCurrentView(createSearchView(), "test-execution:459");

    const container = renderAgentPanel("search-1", true);
    const pending = container.querySelector<HTMLElement>(
      '[data-testid="agent-panel-inline-pending"]',
    );

    expect(pending).not.toBeNull();
    expect(pending?.className).toContain("bg-surface-panel-strong/80");
    expect(pending?.className).not.toContain("border ");
    expect(pending?.getAttribute("data-state")).toBe("loading");
    expect(pending?.getAttribute("role")).toBe("status");
    expect(container.textContent).toContain("AI comment를 생성하고 있습니다.");
  });

  it("tracks viewed AI reaction cards when the inline route reaction surface is visible", () => {
    useResearchRouteStore.getState().setCurrentView(createSearchView(), "test-execution:475");
    useResearchRouteStore.getState().setRouteAiComment(
      "search-1",
      {
        id: "block-search-viewed",
        title: "검색 반응",
        body: "reaction body",
        chips: [],
        timestamp: "2026-04-09T00:00:00.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    renderAgentPanel("search-1");

    expect(trackAiCommentCardViewedOnceMock).toHaveBeenCalledTimes(1);
    expect(trackAiCommentCardViewedOnceMock).toHaveBeenCalledWith({
      ownerPrincipalId: "principal-1",
      documentId: "search-1",
      reactionKey: "search-1:block-search-viewed:2026-04-09T00:00:00.000Z",
    });
  });
});
