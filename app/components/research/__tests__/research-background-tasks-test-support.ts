import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { ResearchBackgroundTasks } from "@/app/components/research/ResearchBackgroundTasks";
import type { StanceProfile } from "@/app/domain/analysis";
import type {
  GraphNeighborsMetadata,
  ResearchRoutePayload,
  SearchMetadata,
} from "@/app/domain/research-route-payload";
import {
  buildSearchBackgroundSnapshotTarget,
  projectSearchEnrichmentPaperDelta,
  SEARCH_BACKGROUND_COMMAND_VERSION,
} from "@/app/domain/search-background-transport";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

// Shared no-signal stance profile fixture — keeps inline-analysis test fixtures
// short enough to stay under this directory's per-file line budget.
export const NULL_STANCE_PROFILE: StanceProfile = {
  mainPosition: null,
  debateAxis: null,
  limitations: null,
  counterSearchQueries: [],
};

export function flushTasks(): Promise<void> {
  return act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

export function getRequestUrl(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

export function withNumericSearchPaperIds(
  document: Extract<ResearchRoutePayload, { type: "search" }>,
): Extract<ResearchRoutePayload, { type: "search" }> {
  return {
    ...document,
    metadata: {
      ...document.metadata,
      papers: document.metadata.papers.map((paper, index) => ({
        ...paper,
        paperId: String(101 + index),
      })),
    },
  };
}

export function setSearchDocumentStoreDocuments(documents: ResearchRoutePayload[]): void {
  const view = documents.at(0) ?? null;
  useResearchRouteStore.getState().setCurrentView(view, view ? `test:${view.id}` : "test:empty");
}

interface HydrationReplacementScenarioResult {
  initialRequestCount: number;
  replacementRequestCount: number;
  stableTargetRequestCount: number;
  postLoserRequestCount: number;
  firstRequestAborted: boolean;
  currentViewAfterWinner: ResearchRoutePayload | null;
  currentViewAfterLoser: ResearchRoutePayload | null;
}

async function runSameExecutionHydrationReplacementScenario(params: {
  replacementDocument: ResearchRoutePayload;
  stableTargetDocument: ResearchRoutePayload;
  winnerResponse: Response;
  loserResponse: Response;
}): Promise<HydrationReplacementScenarioResult> {
  const executionId = useResearchRouteStore.getState().activeExecutionId;
  if (!executionId) throw new Error("expected active execution");

  const requests: Array<{
    resolve: (response: Response) => void;
    signal: AbortSignal;
  }> = [];
  global.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((resolve) => {
      requests.push({ resolve, signal: init?.signal as AbortSignal });
    })) as typeof fetch;

  const root = createRoot(document.createElement("div"));
  act(() => {
    root.render(createElement(ResearchBackgroundTasks));
  });
  await flushTasks();
  const initialRequestCount = requests.length;

  act(() => {
    useResearchRouteStore.getState().patchCurrentView(params.replacementDocument, executionId);
  });
  await flushTasks();
  const replacementRequestCount = requests.length;
  const firstRequestAborted = requests[0]?.signal.aborted ?? false;

  act(() => {
    useResearchRouteStore.getState().patchCurrentView(params.stableTargetDocument, executionId);
  });
  await flushTasks();
  const stableTargetRequestCount = requests.length;

  await act(async () => {
    requests[0]?.resolve(params.loserResponse);
    await Promise.resolve();
    await Promise.resolve();
  });
  const currentViewAfterLoser = useResearchRouteStore.getState().currentView;
  act(() => {
    useResearchRouteStore
      .getState()
      .patchCurrentView({ ...params.stableTargetDocument }, executionId);
  });
  await flushTasks();
  const postLoserRequestCount = requests.length;

  await act(async () => {
    requests[1]?.resolve(params.winnerResponse);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  const currentViewAfterWinner = useResearchRouteStore.getState().currentView;
  act(() => {
    root.unmount();
  });

  return {
    initialRequestCount,
    replacementRequestCount,
    stableTargetRequestCount,
    postLoserRequestCount,
    firstRequestAborted,
    currentViewAfterWinner,
    currentViewAfterLoser,
  };
}

async function runSearchReplacementScenario(
  baseDocument: Extract<ResearchRoutePayload, { type: "search" }>,
  replaceMetadata: (metadata: SearchMetadata) => SearchMetadata,
): Promise<HydrationReplacementScenarioResult> {
  const papers = Array.from({ length: 41 }, (_, index) => ({
    ...baseDocument.metadata.papers[0],
    paperId: String(101 + index),
    title: `Research Agent ${String(index + 1)}`,
  }));
  const initialDocument = {
    ...baseDocument,
    metadata: { ...baseDocument.metadata, papers, total: papers.length },
  };
  useResearchRouteStore.getState().setCurrentView(initialDocument, `test:${initialDocument.id}`);
  const replacementDocument = {
    ...initialDocument,
    metadata: replaceMetadata(initialDocument.metadata),
  };
  const readyMetadata: SearchMetadata = {
    ...replacementDocument.metadata,
    sortOption: "yearAsc",
    abstractHydration: { status: "ready" },
  };
  return runSameExecutionHydrationReplacementScenario({
    replacementDocument,
    stableTargetDocument: {
      ...replacementDocument,
      metadata: { ...replacementDocument.metadata, sortOption: "yearAsc" },
    },
    winnerResponse: Response.json({
      schemaVersion: SEARCH_BACKGROUND_COMMAND_VERSION,
      target: buildSearchBackgroundSnapshotTarget(readyMetadata),
      delta: {
        papers: readyMetadata.papers.map(projectSearchEnrichmentPaperDelta),
        abstractHydration: { status: "ready" },
      },
      updatedAt: "2026-04-07T00:00:03.000Z",
    }),
    loserResponse: Response.json({
      schemaVersion: SEARCH_BACKGROUND_COMMAND_VERSION,
      target: buildSearchBackgroundSnapshotTarget(initialDocument.metadata),
      delta: {
        papers: initialDocument.metadata.papers.map(projectSearchEnrichmentPaperDelta),
        abstractHydration: { status: "ready" },
      },
      updatedAt: "2026-04-07T00:00:02.000Z",
    }),
  });
}

export function runSearchTargetReplacementScenario(
  baseDocument: Extract<ResearchRoutePayload, { type: "search" }>,
): Promise<HydrationReplacementScenarioResult> {
  return runSearchReplacementScenario(baseDocument, (metadata) => ({
    ...metadata,
    papers: metadata.papers.map((paper, index) =>
      index === 40 ? { ...paper, paperId: "999" } : paper,
    ),
  }));
}

export function runSearchLibraryInputReplacementScenario(
  baseDocument: Extract<ResearchRoutePayload, { type: "search" }>,
): Promise<HydrationReplacementScenarioResult> {
  return runSearchReplacementScenario(baseDocument, (metadata) => ({
    ...metadata,
    libraryContext: {
      folders: [{ name: "Agents" }],
      signalPresent: true,
      interestWeights: { [metadata.papers[40]?.paperId ?? ""]: 1 },
      libraryOnlyPaperIds: [metadata.papers[40]?.paperId ?? ""],
    },
  }));
}

export async function runGraphTargetReplacementScenario(
  graphDocument: Extract<ResearchRoutePayload, { type: "graph_neighbors" }>,
): Promise<HydrationReplacementScenarioResult> {
  useResearchRouteStore.getState().setCurrentView(graphDocument, `test:${graphDocument.id}`);
  const replacementAxisPaper = {
    ...graphDocument.metadata.coCited[0].paper,
    paperId: "202",
  };
  const replacementDocument = {
    ...graphDocument,
    metadata: {
      ...graphDocument.metadata,
      coCited: [{ ...graphDocument.metadata.coCited[0], paper: replacementAxisPaper }],
    },
  };
  const hydratedAxisPaper = {
    ...replacementAxisPaper,
    abstract: "Hydrated replacement axis abstract.",
    authors: [{ name: "Hydrated Axis Author" }],
  };
  const hydratedMetadata: GraphNeighborsMetadata = {
    ...replacementDocument.metadata,
    graphLoadFailed: true,
    coCited: [{ ...replacementDocument.metadata.coCited[0], paper: hydratedAxisPaper }],
    cardDataHydration: { status: "ready" },
  };
  return runSameExecutionHydrationReplacementScenario({
    replacementDocument,
    stableTargetDocument: {
      ...replacementDocument,
      metadata: { ...replacementDocument.metadata, graphLoadFailed: true },
    },
    winnerResponse: Response.json({
      metadata: hydratedMetadata,
      updatedAt: "2026-07-06T00:00:02.000Z",
    }),
    loserResponse: Response.json({
      metadata: {
        ...graphDocument.metadata,
        cardDataHydration: { status: "ready" },
      },
      updatedAt: "2026-07-06T00:00:01.000Z",
    }),
  });
}
