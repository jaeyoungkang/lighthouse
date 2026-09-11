import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { CitationLineageView } from "@/app/components/research-route-renderers/CitationLineageView";
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

function createCitationLineageView(): ResearchRoutePayload {
  const now = "2026-04-13T00:00:00.000Z";
  const paperIds = Array.from({ length: 12 }, (_unused, index) => `ref-inline-${String(index)}`);
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "citation-inline-budget",
    type: "citation_lineage",
    title: "인용 계보: Attention Is All You Need",
    content: "citation lineage content",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: now,
    updatedAt: now,
    metadata: {
      type: "citation_lineage",
      seedPaper: {
        paperId: "seed-1",
        title: "Attention Is All You Need",
        abstract: "seed abstract",
        year: 2017,
        citationCount: 1000,
        url: "https://sah.borca.ai/papers/seed-1",
        authors: [{ name: "Vaswani" }],
      },
      referenceIds: paperIds,
      citationIds: [],
      papers: paperIds.map((paperId, index) => ({
        paperId,
        title: `Reference Inline Paper ${String(index)}`,
        abstract: `Reference inline abstract ${String(index)} for message passing.`,
        year: 2020,
        citationCount: index,
        url: `https://example.com/${paperId}`,
        authors: [{ name: "Author" }],
        openAccessPdf: null,
        doi: null,
        reviewed: false,
      })),
      total: paperIds.length,
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

describe("CitationLineageView inline analysis budget", () => {
  it("queues inline analysis for citation-lineage cards inside the first visible budget", async () => {
    const doc = createCitationLineageView();
    const container = document.createElement("div");
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(doc, "test-execution:92");

    await act(async () => {
      root?.render(<CitationLineageView document={doc} />);
      await Promise.resolve();
    });

    const task = useBackgroundTaskStore.getState().inlineAnalysisTasks[doc.id];
    expect(task).toBeDefined();
    expect(task?.metadata.type).toBe("citation_lineage");
    expect(task?.visibleCount).toBe(10);
    expect(task?.progressMap.get("ref-inline-0")).toBe("queued");
    expect(task?.progressMap.get("ref-inline-9")).toBe("queued");
    expect(task?.progressMap.has("ref-inline-10")).toBe(false);
    expect(task?.progressMap.has("ref-inline-11")).toBe(false);
    expect(container.textContent).toContain("분석 대기");
  });

  it("queues inline analysis for visible reference and citation sections", async () => {
    const doc = createCitationLineageView();
    if (doc.metadata.type !== "citation_lineage") {
      throw new Error("expected citation_lineage metadata");
    }
    const citationIds = Array.from(
      { length: 12 },
      (_unused, index) => `cit-inline-${String(index)}`,
    );
    const citationPapers = citationIds.map((paperId, index) => ({
      paperId,
      title: `Citation Inline Paper ${String(index)}`,
      abstract: `Citation inline abstract ${String(index)} for retrieval.`,
      year: 2021,
      citationCount: index,
      url: `https://example.com/${paperId}`,
      authors: [{ name: "Citation Author" }],
      openAccessPdf: null,
      doi: null,
      reviewed: false,
    }));
    doc.metadata.citationIds = citationIds;
    doc.metadata.papers = [...doc.metadata.papers, ...citationPapers];
    doc.metadata.total = doc.metadata.papers.length;

    const container = document.createElement("div");
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(doc, "test-execution:137");

    act(() => {
      root?.render(<CitationLineageView document={doc} />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const task = useBackgroundTaskStore.getState().inlineAnalysisTasks[doc.id];
    expect(task).toBeDefined();
    expect(task?.visibleCount).toBe(20);
    expect(task?.progressMap.get("ref-inline-9")).toBe("queued");
    expect(task?.progressMap.has("ref-inline-10")).toBe(false);
    expect(task?.progressMap.get("cit-inline-9")).toBe("queued");
    expect(task?.progressMap.has("cit-inline-10")).toBe(false);
  });

  it("runs and applies inline analysis only to rendered citation-lineage cards", async () => {
    const doc = createCitationLineageView();
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
                inputFingerprint: "a".repeat(64),
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
    useResearchRouteStore.getState().setCurrentView(doc, "test-execution:relationship-run");

    await act(async () => {
      root?.render(
        <>
          <ResearchBackgroundTasks />
          <CitationLineageView document={doc} />
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
      "ref-inline-0",
      "ref-inline-1",
      "ref-inline-2",
      "ref-inline-3",
      "ref-inline-4",
      "ref-inline-5",
      "ref-inline-6",
      "ref-inline-7",
      "ref-inline-8",
      "ref-inline-9",
    ]);

    const currentView = useResearchRouteStore.getState().currentView;
    expect(currentView?.type).toBe("citation_lineage");
    if (currentView?.type !== "citation_lineage") throw new Error("expected citation lineage");
    expect(currentView.metadata.papers[0]).toMatchObject({
      inlineAnalysis: { analysis: { summary: "summary ref-inline-0" } },
    });
    expect("inlineAnalysis" in currentView.metadata.papers[10]).toBe(false);
    const task = useBackgroundTaskStore.getState().inlineAnalysisTasks[doc.id];
    expect(task?.progressMap.has("ref-inline-10")).toBe(false);
    expect(task?.progressMap.has("ref-inline-11")).toBe(false);
  });
});
