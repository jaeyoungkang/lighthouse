import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INLINE_ANALYSIS_VERSION, type AIAnalysis } from "@/app/domain/analysis";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import { GraphNeighborsView } from "@/app/components/research-route-renderers/GraphNeighborsView";
import { ResearchBackgroundTasks } from "@/app/components/research/ResearchBackgroundTasks";
import { API_ROUTES } from "@/app/lib/api-routes";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useReactionActionStore } from "@/app/stores/reaction-action-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

function getRequestUrl(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

const analysis: AIAnalysis = {
  summary: "이 논문은 그래프 어텐션으로 이웃 정보를 가중 집계한다.",
  objective: "그래프 구조에서 노드 표현을 더 잘 학습한다.",
  methodology: "이웃 노드에 attention weight를 부여하는 message passing을 사용한다.",
  results: "여러 그래프 벤치마크에서 경쟁력 있는 성능을 보인다.",
  keywords: ["graph attention", "message passing"],
  semanticProfile: {
    claim: "그래프 어텐션으로 이웃 정보를 가중 집계한다.",
    topics: ["graph attention", "message passing"],
    method: "attention weight 기반 message passing",
    finding: "그래프 벤치마크에서 경쟁력 있는 성능",
    quotedBasis: {
      claim: "graph attention",
      topics: ["graph attention", "message passing"],
      method: "attention weight",
      finding: "benchmark performance",
    },
  },
  confidence: "high",
  evidenceMap: {},
};

function createGraphNeighborsView(): ResearchRoutePayload {
  const now = "2026-04-13T00:00:00.000Z";
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "graph-inline-visible",
    type: "graph_neighbors",
    title: "비슷한 논문: Attention Is All You Need",
    content: "graph neighbors content",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: now,
    updatedAt: now,
    metadata: {
      type: "graph_neighbors",
      seedPaper: {
        paperId: "seed-1",
        title: "Attention Is All You Need",
        abstract: "seed abstract",
        year: 2017,
        citationCount: 1000,
        url: "https://sah.borca.ai/papers/seed-1",
        authors: [{ name: "Vaswani" }],
        openAccessPdf: null,
        doi: null,
      },
      papers: [],
      total: 0,
      coCited: [],
      coupled: [],
    },
    reaction: null,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
  useReactionActionStore.getState().registerSendMessage(vi.fn());
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
  useReactionActionStore.getState().unregisterSendMessage();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("GraphNeighborsView inline analysis and terms", () => {
  it("queues inline analysis for visible graph-neighbor axes", async () => {
    const doc = createGraphNeighborsView();
    if (doc.metadata.type !== "graph_neighbors") {
      throw new Error("expected graph_neighbors metadata");
    }
    const coCitedPapers = Array.from({ length: 12 }, (_unused, index) => ({
      paperId: `cc-axis-inline-${String(index)}`,
      title: `Co-cited Inline Paper ${String(index)}`,
      abstract: `Co-cited inline abstract ${String(index)} for graph retrieval.`,
      year: 2020,
      citationCount: index,
      url: `https://example.com/cc-axis-inline-${String(index)}`,
      authors: [{ name: "Co Author" }],
      openAccessPdf: null,
      doi: null,
      reviewed: false,
    }));
    const coupledPapers = Array.from({ length: 12 }, (_unused, index) => ({
      paperId: `cp-axis-inline-${String(index)}`,
      title: `Coupled Inline Paper ${String(index)}`,
      abstract: `Coupled inline abstract ${String(index)} for shared references.`,
      year: 2021,
      citationCount: index,
      url: `https://example.com/cp-axis-inline-${String(index)}`,
      authors: [{ name: "Coupled Author" }],
      openAccessPdf: null,
      doi: null,
      reviewed: false,
    }));
    doc.metadata.coCited = coCitedPapers.map((paper, index) => ({
      shared: 49 - index,
      paper,
    }));
    doc.metadata.coupled = coupledPapers.map((paper, index) => ({
      shared: 80 - index,
      paper,
    }));
    doc.metadata.papers = [...coCitedPapers, ...coupledPapers];
    doc.metadata.total = doc.metadata.papers.length;

    const container = document.createElement("div");
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(doc, "test-execution:143");

    act(() => {
      root?.render(<GraphNeighborsView document={doc} />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const task = useBackgroundTaskStore.getState().inlineAnalysisTasks[doc.id];
    expect(task).toBeDefined();
    expect(task?.metadata.type).toBe("graph_neighbors");
    expect(task?.visibleCount).toBe(20);
    expect(task?.progressMap.get("cc-axis-inline-9")).toBe("queued");
    expect(task?.progressMap.has("cc-axis-inline-10")).toBe(false);
    expect(task?.progressMap.get("cp-axis-inline-9")).toBe("queued");
    expect(task?.progressMap.has("cp-axis-inline-10")).toBe(false);
  });

  it("renders graph-neighbor research terms inside the AI comment frame", async () => {
    const paper: SearchMetadata["papers"][number] = {
      paperId: "cc-terms",
      title: "Graph Attention Networks",
      abstract: "We present graph attention networks for neural message passing.",
      year: 2017,
      citationCount: 25000,
      url: "https://example.com/cc-terms",
      authors: [{ name: "Velickovic" }],
      openAccessPdf: null,
      doi: null,
      reviewed: false,
      inlineAnalysis: {
        version: INLINE_ANALYSIS_VERSION,
        inputFingerprint: "a".repeat(64),
        analysis,
        source: "abstract",
      },
    };
    const doc = createGraphNeighborsView();
    if (doc.metadata.type !== "graph_neighbors") {
      throw new Error("expected graph_neighbors metadata");
    }
    doc.metadata.coCited = [{ shared: 49, paper }];
    doc.metadata.papers = [paper];
    doc.metadata.total = 1;

    const container = document.createElement("div");
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(doc, "test-execution:193");

    await act(async () => {
      root?.render(
        <GraphNeighborsView
          document={doc}
          reactionSlot={<div data-testid="mock-reaction-slot">비슷한 논문 comment</div>}
        />,
      );
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="mock-reaction-slot"]')).not.toBeNull();
    expect(container.textContent).toContain("주요 연구 용어");
    expect(container.textContent).toContain("graph attention");
  });

  it("does not derive relationship terms from legacy or whitespace-only inline analyses", async () => {
    const legacyPaper: SearchMetadata["papers"][number] = {
      paperId: "cc-legacy-terms",
      title: "Legacy Graph Attention",
      abstract: "A valid abstract whose old analysis must not be consumed.",
      year: 2017,
      citationCount: 10,
      url: "https://example.com/cc-legacy-terms",
      authors: [{ name: "Researcher" }],
      reviewed: false,
      inlineAnalysis: {
        version: INLINE_ANALYSIS_VERSION - 1,
        inputFingerprint: "b".repeat(64),
        analysis,
        source: "abstract",
      },
    };
    const blankPaper: SearchMetadata["papers"][number] = {
      ...legacyPaper,
      paperId: "cc-blank-terms",
      title: "Blank Graph Attention",
      abstract: " \n\t ",
      inlineAnalysis: {
        version: INLINE_ANALYSIS_VERSION,
        inputFingerprint: "c".repeat(64),
        analysis,
        source: "abstract",
      },
    };
    const doc = createGraphNeighborsView();
    if (doc.metadata.type !== "graph_neighbors") {
      throw new Error("expected graph_neighbors metadata");
    }
    doc.metadata.coCited = [
      { shared: 49, paper: legacyPaper },
      { shared: 40, paper: blankPaper },
    ];
    doc.metadata.papers = [legacyPaper, blankPaper];
    doc.metadata.total = 2;

    const container = document.createElement("div");
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(doc, "test-execution:terms-negative");

    await act(async () => {
      root?.render(<GraphNeighborsView document={doc} />);
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("주요 연구 용어");
    expect(container.textContent).not.toContain("graph attention");
  });

  it("runs and applies inline analysis only to rendered graph-neighbor cards", async () => {
    const doc = createGraphNeighborsView();
    if (doc.metadata.type !== "graph_neighbors") {
      throw new Error("expected graph_neighbors metadata");
    }
    const papers = Array.from({ length: 12 }, (_unused, index) => ({
      paperId: `cc-run-${String(index)}`,
      title: `Co-cited Run Paper ${String(index)}`,
      abstract: `Co-cited run abstract ${String(index)}.`,
      year: 2020,
      citationCount: index,
      url: `https://example.com/cc-run-${String(index)}`,
      authors: [{ name: "Co Author" }],
      openAccessPdf: null,
      doi: null,
      reviewed: false,
    }));
    doc.metadata.papers = papers;
    doc.metadata.coCited = papers.map((paper, index) => ({ shared: 50 - index, paper }));
    doc.metadata.total = papers.length;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = getRequestUrl(input);
        if (url !== API_ROUTES.PAPERS_ANALYZE_INLINE || typeof init?.body !== "string") {
          throw new Error(`unexpected fetch: ${url}`);
        }
        const request = JSON.parse(init.body) as { papers: Array<{ paperId: string }> };
        return Promise.resolve(
          new Response(
            JSON.stringify(
              request.papers.map(({ paperId }) => ({
                paperId,
                inputFingerprint: "b".repeat(64),
                source: "abstract",
                analysis: {
                  summary: `summary ${paperId}`,
                  objective: "objective",
                  methodology: "methodology",
                  results: "results",
                  keywords: [],
                  semanticProfile: {
                    claim: `claim ${paperId}`,
                    topics: [],
                    method: null,
                    finding: null,
                    quotedBasis: { claim: null, topics: [], method: null, finding: null },
                  },
                  confidence: "high",
                  evidenceMap: {},
                },
              })),
            ),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }),
    );

    const container = document.createElement("div");
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(doc, "test-execution:graph-run");

    await act(async () => {
      root?.render(
        <>
          <ResearchBackgroundTasks />
          <GraphNeighborsView document={doc} />
        </>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
      await Promise.resolve();
      await Promise.resolve();
    });

    const analyzeCalls = vi
      .mocked(global.fetch)
      .mock.calls.filter(([input]) =>
        getRequestUrl(input).includes(API_ROUTES.PAPERS_ANALYZE_INLINE),
      );
    expect(analyzeCalls).toHaveLength(2);
    const analyzedPaperIds = analyzeCalls.flatMap(([, init]) => {
      const body = JSON.parse(init?.body as string) as { papers: Array<{ paperId: string }> };
      return body.papers.map((paper) => paper.paperId);
    });
    expect(analyzedPaperIds).toEqual([
      "cc-run-0",
      "cc-run-1",
      "cc-run-2",
      "cc-run-3",
      "cc-run-4",
      "cc-run-5",
      "cc-run-6",
      "cc-run-7",
      "cc-run-8",
      "cc-run-9",
    ]);

    const currentView = useResearchRouteStore.getState().currentView;
    expect(currentView?.type).toBe("graph_neighbors");
    if (currentView?.type !== "graph_neighbors") throw new Error("expected graph neighbors");
    expect(currentView.metadata.papers[0]).toMatchObject({
      inlineAnalysis: { analysis: { summary: "summary cc-run-0" } },
    });
    expect("inlineAnalysis" in currentView.metadata.papers[10]).toBe(false);
    const task = useBackgroundTaskStore.getState().inlineAnalysisTasks[doc.id];
    expect(task?.progressMap.has("cc-run-10")).toBe(false);
    expect(task?.progressMap.has("cc-run-11")).toBe(false);
  });
});
