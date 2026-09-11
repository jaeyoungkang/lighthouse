import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAgentPanelTestHarness } from "@/app/components/research/__tests__/agent-panel-test-support";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const agentPanelHarness = createAgentPanelTestHarness();
const { renderAgentPanel } = agentPanelHarness;

function createCitationLineageView() {
  const firstPaper = {
    paperId: "paper-1",
    title: "The AI Scientist",
    abstract: "abstract",
    year: 2024,
    citationCount: 10,
    url: "https://example.com/1",
    authors: [{ name: "Alice" }],
  };
  const citationPaper = {
    paperId: "paper-cit-1",
    title: "BERT: Pre-training of Deep Bidirectional Transformers",
    abstract: "citation abstract",
    year: 2019,
    citationCount: 900,
    url: "https://example.com/paper-cit-1",
    authors: [{ name: "Devlin" }],
  };

  return {
    status: "ready" as const,
    version: 0,
    reactionVersion: 0,
    id: "citation-1",
    type: "citation_lineage" as const,
    title: "인용 계보: ai for science",
    content: "citation content",
    createdBy: "user" as const,
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt: "2026-04-09T00:00:00.000Z",
    metadata: {
      type: "citation_lineage" as const,
      seedPaper: {
        paperId: "seed-1",
        title: "Attention Is All You Need",
        abstract: "seed abstract",
        year: 2017,
        citationCount: 1000,
        url: "https://example.com/seed-1",
        authors: [{ name: "Vaswani" }],
      },
      referenceIds: ["paper-1"],
      citationIds: ["paper-cit-1"],
      total: 2,
      papers: [firstPaper, citationPaper],
    },
    reaction: null,
  };
}

function createGraphNeighborsView() {
  return {
    status: "ready" as const,
    version: 0,
    reactionVersion: 0,
    id: "graph-1",
    type: "graph_neighbors" as const,
    title: "비슷한 논문: Attention Is All You Need",
    content: "graph content",
    createdBy: "user" as const,
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-09T00:00:00.000Z",
    updatedAt: "2026-04-09T00:00:00.000Z",
    metadata: {
      type: "graph_neighbors" as const,
      seedPaper: {
        paperId: "seed-1",
        title: "Attention Is All You Need",
        abstract: "seed abstract",
        year: 2017,
        citationCount: 1000,
        url: "https://example.com/seed-1",
        authors: [{ name: "Vaswani" }],
        openAccessPdf: null,
        doi: null,
      },
      papers: [
        {
          paperId: "graph-paper-1",
          title: "Graph Attention Networks",
          abstract: "graph attention abstract",
          year: 2017,
          citationCount: 25000,
          url: "https://example.com/graph-paper-1",
          authors: [{ name: "Velickovic" }],
          openAccessPdf: null,
          doi: null,
          reviewed: false,
        },
      ],
      total: 1,
      coCited: [],
      coupled: [],
    },
    reaction: null,
  };
}

describe("AgentPanel citation_lineage surfaces", () => {
  beforeEach(() => {
    agentPanelHarness.setup();
    mockPush.mockClear();
  });

  afterEach(() => {
    agentPanelHarness.cleanup();
    vi.restoreAllMocks();
  });

  it("renders the citation_lineage reaction card and defers the gap action to the host", () => {
    useResearchRouteStore
      .getState()
      .setCurrentView(createCitationLineageView(), "test-execution:162");
    useResearchRouteStore.getState().setRouteAiComment(
      "citation-1",
      {
        id: "block-citation-body-only",
        title: "Transformer 논문의 인용 맥락",
        body: "선행 1편을 중심으로 흐름이 갈린다. 후속 인용은 아직 없다.",
        chips: [],
        timestamp: "2026-04-09T00:01:35.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    const container = renderAgentPanel("citation-1");

    expect(container.textContent).toContain("선행 1편을 중심으로 흐름이 갈린다");
    expect(container.querySelector('[data-testid="agent-panel-reaction-card"]')).not.toBeNull();
    // The gap follow-up is host-owned ("연구 공백 지도 만들기"); AgentPanel renders host-owned behavior instead of it inline.
    expect(container.textContent).not.toContain("연구 공백 찾기");
  });

  it("renders the graph_neighbors reaction card and defers the gap action to the host", () => {
    useResearchRouteStore
      .getState()
      .setCurrentView(createGraphNeighborsView(), "test-execution:180");
    useResearchRouteStore.getState().setRouteAiComment(
      "graph-1",
      {
        id: "block-graph-body-only",
        title: "Transformer 주변의 비슷한 논문",
        body: "함께 인용되는 논문이 attention 계열을 넓힌다.",
        chips: [],
        timestamp: "2026-04-09T00:01:35.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    const container = renderAgentPanel("graph-1");

    expect(container.textContent).toContain("함께 인용되는 논문");
    expect(container.textContent).not.toContain("연구 공백 찾기");
  });

  it("ignores unsupported AI-comment gap button surfaces for citation_lineage", () => {
    const sendMessage = vi.fn();
    useReactionActionStore.getState().registerSendMessage(sendMessage);
    useResearchRouteStore
      .getState()
      .setCurrentView(createCitationLineageView(), "test-execution:198");
    useResearchRouteStore.getState().setRouteAiComment(
      "citation-1",
      {
        id: "block-citation-gap-action",
        title: "Transformer 논문의 인용 맥락",
        body: "후속 연구가 BERT 계열 사전학습으로 이어진다.",
        chips: [],
        surface: {
          kind: "guided_tree",
          groups: [
            {
              id: "citation-lineage-gap",
              kind: "navigate",
              title: "연구 공백",
              nodes: [
                {
                  id: "citation-lineage-gap-open",
                  label: "연구 공백 찾기",
                  action: {
                    type: "open_gap_network",
                    lens: "E2",
                  },
                },
              ],
            },
          ],
        } as never,
        timestamp: "2026-04-09T00:01:35.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    const container = renderAgentPanel("citation-1");
    const action = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("연구 공백 찾기"),
    );

    // Host owns the gap action; unsupported AI-comment button surfaces stay hidden inside AgentPanel.
    expect(action).toBeUndefined();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("ignores retired AI-comment gap button surfaces for graph_neighbors", () => {
    useResearchRouteStore
      .getState()
      .setCurrentView(createGraphNeighborsView(), "test-execution:239");
    useResearchRouteStore.getState().setRouteAiComment(
      "graph-1",
      {
        id: "block-graph-gap-action",
        title: "Transformer 주변의 비슷한 논문",
        body: "함께 인용되는 논문이 attention 계열을 넓힌다.",
        chips: [],
        surface: {
          kind: "guided_tree",
          groups: [
            {
              id: "graph-neighbors-gap",
              kind: "navigate",
              title: "연구 공백",
              nodes: [
                {
                  id: "graph-neighbors-gap-open",
                  label: "연구 공백 찾기",
                  action: {
                    type: "open_gap_network",
                    lens: "E2",
                  },
                },
              ],
            },
          ],
        } as never,
        timestamp: "2026-04-09T00:01:35.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    const container = renderAgentPanel("graph-1");
    const action = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("연구 공백 찾기"),
    );

    expect(action).toBeUndefined();
    expect(mockPush).not.toHaveBeenCalled();
  });
});
