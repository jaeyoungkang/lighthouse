import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runSearchEnrichmentTask } from "@/app/components/research/background-search-tasks";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import {
  buildSearchBackgroundSnapshotTarget,
  SEARCH_BACKGROUND_COMMAND_VERSION,
} from "@/app/domain/search-background-transport";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { runSearchLibraryInputReplacementScenario } from "./research-background-tasks-test-support";

function createSearchResultDocument(): Extract<ResearchRoutePayload, { type: "search" }> {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-condition-ownership-1",
    type: "search",
    title: "검색: research agents",
    content: "",
    createdBy: "user",
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-04-07T00:00:01.000Z",
    updatedAt: "2026-04-07T00:00:01.000Z",
    metadata: {
      type: "search",
      query: "research agents",
      total: 1,
      abstractHydration: { status: "pending" },
      papers: [
        {
          paperId: "101",
          title: "Research Agents",
          abstract: "abstract",
          year: 2025,
          citationCount: 12,
          url: "https://example.com/paper-1",
          authors: [{ name: "Author 1", authorId: "a1" }],
          referenceIds: [],
          citationIds: [],
        },
      ],
    },
  };
}

function setCurrentDocument(document: ResearchRoutePayload): string {
  const executionId = `test:${document.id}`;
  useResearchRouteStore.getState().setCurrentView(document, executionId);
  return executionId;
}

const originalFetch = global.fetch;

describe("ResearchBackgroundTasks search condition ownership", () => {
  beforeEach(() => {
    useResearchRouteStore.getState().setCurrentView(null, "test:empty");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("rejects enrichment whose response query differs from the URL execution query", async () => {
    const pendingDocument = createSearchResultDocument();
    const legacyMetadata: SearchMetadata = {
      ...pendingDocument.metadata,
      abstractHydration: { status: "pending", personalize: true },
    };
    const legacyDocument = { ...pendingDocument, metadata: legacyMetadata };
    const supplement = {
      ...legacyMetadata.papers[0],
      paperId: "202",
      title: "Different query supplement",
    };
    const executionId = setCurrentDocument(legacyDocument);

    global.fetch = vi.fn(async () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            metadata: {
              ...legacyMetadata,
              query: "different query",
              papers: [...legacyMetadata.papers, supplement],
              total: 2,
              abstractHydration: { status: "ready", personalize: true },
            },
            updatedAt: "2026-04-07T00:00:04.000Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await runSearchEnrichmentTask({
      task: {
        executionId,
        documentId: legacyDocument.id,
        ownerPrincipalId: legacyDocument.ownerPrincipalId,
        query: legacyMetadata.query,
        metadata: legacyMetadata,
      },
      controller: new AbortController(),
    });

    expect(result?.metadata.type === "search" ? result.metadata.query : null).toBe(
      "research agents",
    );
    expect(result?.metadata.type === "search" ? result.metadata.total : null).toBe(1);
    expect(
      result?.metadata.type === "search"
        ? result.metadata.papers.map((paper) => paper.paperId)
        : null,
    ).toEqual(["101"]);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    const current = useResearchRouteStore.getState().currentView;
    expect(
      current?.metadata.type === "search"
        ? current.metadata.papers.map((paper) => paper.paperId)
        : null,
    ).toEqual(["101"]);
    expect(current?.metadata.type === "search" ? current.metadata.abstractHydration : null).toEqual(
      { status: "ready", personalize: true, repairAttempted: true },
    );
  });

  it("rejects legacy enrichment that moves a supplement ahead of the committed snapshot", async () => {
    const pendingDocument = createSearchResultDocument();
    const legacyMetadata: SearchMetadata = {
      ...pendingDocument.metadata,
      abstractHydration: { status: "pending", personalize: true },
    };
    const legacyDocument = { ...pendingDocument, metadata: legacyMetadata };
    const supplement = {
      ...legacyMetadata.papers[0],
      paperId: "202",
      title: "Library supplement",
    };
    const executionId = setCurrentDocument(legacyDocument);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    global.fetch = vi.fn(async () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            metadata: {
              ...legacyMetadata,
              papers: [supplement, ...legacyMetadata.papers],
              total: 2,
              abstractHydration: { status: "ready", personalize: true },
            },
            updatedAt: "2026-04-07T00:00:04.000Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const result = await runSearchEnrichmentTask({
      task: {
        executionId,
        documentId: legacyDocument.id,
        ownerPrincipalId: legacyDocument.ownerPrincipalId,
        query: legacyMetadata.query,
        metadata: legacyMetadata,
      },
      controller: new AbortController(),
    });

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(
      result?.metadata.type === "search"
        ? result.metadata.papers.map((paper) => paper.paperId)
        : null,
    ).toEqual(["101"]);
    const current = useResearchRouteStore.getState().currentView;
    expect(
      current?.metadata.type === "search"
        ? current.metadata.papers.map((paper) => paper.paperId)
        : null,
    ).toEqual(["101"]);
  });

  it("rejects enrichment after the current query changes inside the same execution", async () => {
    const pendingDocument = createSearchResultDocument();
    const executionId = setCurrentDocument(pendingDocument);

    let resolveFetch: ((response: Response) => void) | null = null;
    global.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const enrichPromise = runSearchEnrichmentTask({
      task: {
        executionId,
        documentId: pendingDocument.id,
        ownerPrincipalId: pendingDocument.ownerPrincipalId,
        query: pendingDocument.metadata.query,
        metadata: pendingDocument.metadata,
      },
      controller: new AbortController(),
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      useResearchRouteStore.getState().patchCurrentView(
        {
          ...pendingDocument,
          updatedAt: "2026-04-07T00:00:02.000Z",
          metadata: { ...pendingDocument.metadata, query: "different query" },
        },
        executionId,
      ),
    ).toBe(true);

    await act(async () => {
      resolveFetch?.(
        new Response(
          JSON.stringify({
            schemaVersion: SEARCH_BACKGROUND_COMMAND_VERSION,
            target: buildSearchBackgroundSnapshotTarget(pendingDocument.metadata),
            delta: {
              papers: [],
              abstractHydration: { status: "ready" },
            },
            updatedAt: "2026-04-07T00:00:04.000Z",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      expect(await enrichPromise).toBeNull();
    });

    const current = useResearchRouteStore.getState().currentView;
    expect(current?.metadata.type === "search" ? current.metadata.query : null).toBe(
      "different query",
    );
    expect(current?.metadata.type === "search" ? current.metadata.abstractHydration : null).toEqual(
      { status: "pending" },
    );
  });
});

describe("ResearchBackgroundTasks canonical search enrichment input", () => {
  beforeEach(() => {
    useResearchRouteStore.getState().setCurrentView(null, "test:empty");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("accepts enrichment when the current query differs only by canonical whitespace", async () => {
    const pendingDocument = createSearchResultDocument();
    const currentDocument = {
      ...pendingDocument,
      metadata: { ...pendingDocument.metadata, query: "  research agents  " },
    };
    const executionId = setCurrentDocument(currentDocument);
    global.fetch = vi.fn(() =>
      Promise.resolve(
        Response.json({
          schemaVersion: SEARCH_BACKGROUND_COMMAND_VERSION,
          target: buildSearchBackgroundSnapshotTarget(pendingDocument.metadata),
          delta: {
            papers: pendingDocument.metadata.papers.map((paper) => ({
              paperId: paper.paperId,
              abstract: paper.abstract,
              authors: paper.authors,
            })),
            abstractHydration: { status: "ready" },
          },
          updatedAt: "2026-04-07T00:00:04.000Z",
        }),
      ),
    );

    const result = await runSearchEnrichmentTask({
      task: {
        executionId,
        documentId: pendingDocument.id,
        ownerPrincipalId: pendingDocument.ownerPrincipalId,
        query: pendingDocument.metadata.query,
        metadata: pendingDocument.metadata,
      },
      controller: new AbortController(),
    });

    expect(result?.metadata.type === "search" ? result.metadata.query : null).toBe(
      "  research agents  ",
    );
    expect(result?.metadata.type === "search" ? result.metadata.abstractHydration : null).toEqual({
      status: "ready",
    });
  });

  it("replaces a same-execution hydration attempt when library exclusions change", async () => {
    const scenario = await runSearchLibraryInputReplacementScenario(createSearchResultDocument());

    expect(scenario).toMatchObject({
      initialRequestCount: 1,
      replacementRequestCount: 2,
      stableTargetRequestCount: 2,
      postLoserRequestCount: 2,
      firstRequestAborted: true,
    });
    expect(
      scenario.currentViewAfterLoser?.metadata.type === "search"
        ? scenario.currentViewAfterLoser.metadata.abstractHydration
        : null,
    ).toEqual({ status: "pending" });
    expect(
      scenario.currentViewAfterWinner?.metadata.type === "search"
        ? scenario.currentViewAfterWinner.metadata.libraryContext?.libraryOnlyPaperIds
        : null,
    ).toEqual(["141"]);
    expect(
      scenario.currentViewAfterWinner?.metadata.type === "search"
        ? scenario.currentViewAfterWinner.metadata.abstractHydration
        : null,
    ).toEqual({ status: "ready" });
  });
});
