import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mergeSearchBackgroundMetadata,
  mergeTermDiscoveryMetadata,
  runSearchEnrichmentTask,
  shouldQueueSearchEnrichment,
} from "@/app/components/research/background-search-tasks";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import {
  buildSearchBackgroundSnapshotTarget,
  projectSearchEnrichmentPaperDelta,
  SEARCH_BACKGROUND_COMMAND_VERSION,
} from "@/app/domain/search-background-transport";
import { API_ROUTES } from "@/app/lib/api-routes";
import { BACKGROUND_REQUEST_SILENCE_TIMEOUT_MS } from "@/app/lib/background-request";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import {
  getRequestUrl,
  NULL_STANCE_PROFILE,
  runSearchTargetReplacementScenario,
  setSearchDocumentStoreDocuments,
  withNumericSearchPaperIds,
} from "./research-background-tasks-test-support";

function enrichmentDeltaResponse(metadata: SearchMetadata, updatedAt: string) {
  return {
    schemaVersion: SEARCH_BACKGROUND_COMMAND_VERSION,
    target: buildSearchBackgroundSnapshotTarget(metadata),
    delta: {
      papers: metadata.papers.map(projectSearchEnrichmentPaperDelta),
      abstractHydration: {
        status: "ready" as const,
        ...(metadata.abstractHydration?.repairAttempted ? { repairAttempted: true } : {}),
      },
    },
    updatedAt,
  };
}

function createSearchResultDocument(): Extract<ResearchRoutePayload, { type: "search" }> {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-hydrate-1",
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
          paperId: "paper-1",
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

function createInlineAnalysis(summary: string, inputFingerprint = "a".repeat(64)) {
  return {
    version: 1,
    inputFingerprint,
    source: "abstract" as const,
    analysis: {
      summary,
      objective: `${summary} objective`,
      methodology: `${summary} method`,
      results: `${summary} result`,
      keywords: [summary],
      semanticProfile: {
        claim: `${summary} claim`,
        topics: [summary],
        method: `${summary} method`,
        finding: `${summary} finding`,
        conclusion: null,
        quotedBasis: { claim: null, topics: [], method: null, finding: null },
      },
      stanceProfile: NULL_STANCE_PROFILE,
      confidence: "medium" as const,
      evidenceMap: {},
    },
  };
}

const originalFetch = global.fetch;

function registerSearchEnrichmentTestHooks() {
  beforeEach(() => {
    setSearchDocumentStoreDocuments([]);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
}

describe("ResearchBackgroundTasks search enrichment merge", () => {
  registerSearchEnrichmentTestHooks();

  it("queues enrichment only after search run fills the result window", () => {
    const reservedPendingDocument: ResearchRoutePayload = {
      ...createSearchResultDocument(),
      status: "pending",
      metadata: {
        ...createSearchResultDocument().metadata,
        papers: [],
        total: 0,
        abstractHydration: { status: "pending" },
      },
    };
    const readyPendingHydrationDocument = withNumericSearchPaperIds(createSearchResultDocument());
    readyPendingHydrationDocument.metadata.papers[0].paperId = "pap_e3_only";
    const readyButLightweightDocument: Extract<ResearchRoutePayload, { type: "search" }> = {
      ...readyPendingHydrationDocument,
      metadata: {
        ...readyPendingHydrationDocument.metadata,
        abstractHydration: { status: "ready" },
        papers: readyPendingHydrationDocument.metadata.papers.map((paper) => ({
          ...paper,
          abstract: null,
          authors: [],
          fieldsOfStudy: null,
          openAccessPdf: null,
          referenceCount: null,
        })),
      },
    };
    const alreadyAttemptedRepairDocument: Extract<ResearchRoutePayload, { type: "search" }> = {
      ...readyButLightweightDocument,
      metadata: {
        ...readyButLightweightDocument.metadata,
        abstractHydration: { status: "ready", repairAttempted: true },
      },
    };
    const settledKeywordOnlyDocument: Extract<ResearchRoutePayload, { type: "search" }> = {
      ...readyPendingHydrationDocument,
      metadata: {
        ...readyPendingHydrationDocument.metadata,
        abstractHydration: { status: "ready" },
      },
    };

    expect(shouldQueueSearchEnrichment(reservedPendingDocument)).toBe(false);
    expect(shouldQueueSearchEnrichment(readyPendingHydrationDocument)).toBe(true);
    expect(shouldQueueSearchEnrichment(readyButLightweightDocument)).toBe(true);
    expect(shouldQueueSearchEnrichment(alreadyAttemptedRepairDocument)).toBe(false);
    expect(shouldQueueSearchEnrichment(settledKeywordOnlyDocument)).toBe(false);
  });

  it("retains the completed repair marker when current hydration is already ready", () => {
    const existing = createSearchResultDocument().metadata;
    const incoming: SearchMetadata = {
      ...existing,
      abstractHydration: { status: "ready", repairAttempted: true },
    };

    expect(mergeSearchBackgroundMetadata(incoming, existing).abstractHydration).toMatchObject({
      status: "ready",
      repairAttempted: true,
    });
  });

  it("keeps existing term candidates when an equal-rank completion has none", () => {
    const metadata = createSearchResultDocument().metadata;
    const existing: SearchMetadata = {
      ...metadata,
      englishTermDiscovery: { status: "ready", source: "llm" },
      englishTermCandidates: [
        {
          term: "research agents",
          type: "direct",
          confidence: "high",
          supportCount: 1,
          samplePaperIds: ["paper-1"],
          basis: "existing result evidence",
        },
      ],
    };
    const incoming: SearchMetadata = {
      ...metadata,
      englishTermDiscovery: { status: "ready", source: "llm" },
      englishTermCandidates: [],
    };

    expect(mergeTermDiscoveryMetadata(incoming, existing).englishTermCandidates).toEqual(
      existing.englishTermCandidates,
    );
  });

  it("keeps whitespace-only abstracts out of the client-rebuilt term basis", () => {
    const metadata = createSearchResultDocument().metadata;
    const existing: SearchMetadata = {
      ...metadata,
      graphSupport: {
        version: 1,
        source: "episteme-paper-neighborhood",
        basis: "loaded_result_sample",
        status: "ready",
        samplePaperIds: ["paper-1"],
        generatedAt: "2026-07-17T00:00:00.000Z",
        paperScores: {
          "paper-1": {
            defaultScore: 0.9,
            graphScore: 0.8,
            semanticScore: 0.1,
            sharedCiters: 2,
            sharedRefs: 1,
            seedCount: 1,
            sources: ["co_cited"],
          },
        },
      },
      papers: metadata.papers.map((paper) => ({ ...paper, abstract: " \n\t " })),
      englishTermDiscovery: { status: "ready", source: "llm" },
      englishTermCandidates: [
        {
          term: "research agents",
          type: "narrower",
          confidence: "low",
          supportCount: 1,
          supportPaperIds: ["paper-1"],
          samplePaperIds: ["paper-1"],
          basis: "stale basis",
        },
      ],
    };

    expect(mergeTermDiscoveryMetadata(existing, existing).englishTermCandidates?.[0]?.basis).toBe(
      "제목 + 첫 검색 결과의 라이브러리 그래프 근거에서 1편이 뒷받침합니다. 예: Research Agents",
    );
  });

  it("keeps a newer current inline analysis when stale hydration carries an older analysis", () => {
    const base = withNumericSearchPaperIds(createSearchResultDocument()).metadata;
    const incoming: SearchMetadata = {
      ...base,
      abstractHydration: { status: "ready" },
      papers: base.papers.map((paper) => ({
        ...paper,
        abstract: null,
        inlineAnalysis: createInlineAnalysis("stale analysis"),
      })),
    };
    const current: SearchMetadata = {
      ...base,
      papers: base.papers.map((paper) => ({
        ...paper,
        inlineAnalysis: createInlineAnalysis("current success"),
      })),
    };

    const merged = mergeSearchBackgroundMetadata(incoming, current, base);

    expect(merged.papers[0]).toMatchObject({
      inlineAnalysis: { analysis: { summary: "current success" } },
    });
  });

  it("uses the incoming exact cache when the same paper input has a different fingerprint", () => {
    const base = withNumericSearchPaperIds(createSearchResultDocument()).metadata;
    const current: SearchMetadata = {
      ...base,
      papers: base.papers.map((paper) => ({
        ...paper,
        inlineAnalysis: createInlineAnalysis("stale identity", "a".repeat(64)),
      })),
    };
    const incoming: SearchMetadata = {
      ...base,
      abstractHydration: { status: "ready" },
      papers: base.papers.map((paper) => ({
        ...paper,
        inlineAnalysis: createInlineAnalysis("exact identity", "b".repeat(64)),
      })),
    };

    const merged = mergeSearchBackgroundMetadata(incoming, current, base);

    expect(merged.papers[0]).toMatchObject({
      inlineAnalysis: {
        inputFingerprint: "b".repeat(64),
        analysis: { summary: "exact identity" },
      },
    });
  });

  it.each(["title", "abstract", "year"] as const)(
    "replaces current inline analysis when hydration changes only its %s input",
    (changedField) => {
      const base = withNumericSearchPaperIds(createSearchResultDocument()).metadata;
      const current: SearchMetadata = {
        ...base,
        papers: base.papers.map((paper) => ({
          ...paper,
          inlineAnalysis: createInlineAnalysis("old input", "a".repeat(64)),
        })),
      };
      const incoming: SearchMetadata = {
        ...base,
        abstractHydration: { status: "ready" },
        papers: base.papers.map((paper) => {
          const changedInput =
            changedField === "title"
              ? { title: `${paper.title} corrected` }
              : changedField === "abstract"
                ? { abstract: `${paper.abstract ?? ""} corrected` }
                : { year: (paper.year ?? 2025) + 1 };
          return {
            ...paper,
            ...changedInput,
            inlineAnalysis: createInlineAnalysis("corrected input", "b".repeat(64)),
          };
        }),
      };

      const merged = mergeSearchBackgroundMetadata(incoming, current, base);

      expect(merged.papers[0]).toMatchObject({
        inlineAnalysis: {
          inputFingerprint: "b".repeat(64),
          analysis: { summary: "corrected input" },
        },
      });
    },
  );

  it("rejects a late personalized supplement after the first result pool is revealed", () => {
    const pendingDocument = withNumericSearchPaperIds(createSearchResultDocument());
    const baseMetadata: SearchMetadata = {
      ...pendingDocument.metadata,
      sortOption: "relevance",
      abstractHydration: { status: "pending", personalize: true },
    };
    const supplement = {
      ...baseMetadata.papers[0],
      paperId: "202",
      title: "Library-near supplement",
    };
    const incomingMetadata: SearchMetadata = {
      ...baseMetadata,
      papers: [...baseMetadata.papers, supplement],
      total: 2,
      sortOption: "interest",
      libraryContextAvailable: true,
      libraryContext: {
        folders: [{ name: "Agents" }],
        signalPresent: true,
        interestWeights: { "101": 0.5, "202": 0.9 },
        libraryOnlyPaperIds: ["202"],
      },
      abstractHydration: { status: "ready", personalize: true },
    };
    const current: SearchMetadata = {
      ...baseMetadata,
      facetFilters: {
        fieldsOfStudy: ["Computer Science"],
        authors: [],
        venues: [],
        hasPdf: true,
      },
    };

    const merged = mergeSearchBackgroundMetadata(incomingMetadata, current, baseMetadata);

    expect(merged).toBe(current);
    expect(merged.papers.map((paper) => paper.paperId)).toEqual(["101"]);
    expect(merged.libraryContext).toBeUndefined();
  });

  it("preserves the first-reveal basis when card hydration returns", () => {
    const base = withNumericSearchPaperIds(createSearchResultDocument()).metadata;
    const personalizedBase: SearchMetadata = {
      ...base,
      sortOption: "relevance",
      abstractHydration: { status: "pending", personalize: true },
    };
    const incoming: SearchMetadata = {
      ...personalizedBase,
      papers: personalizedBase.papers.map((paper) => ({
        ...paper,
        abstract: "Hydrated abstract",
      })),
      sortOption: "interest",
      libraryContext: {
        folders: [{ name: "Agents" }],
        signalPresent: true,
        interestWeights: { "202": 1 },
        libraryOnlyPaperIds: ["202"],
      },
      abstractHydration: { status: "ready", personalize: true },
    };
    const current: SearchMetadata = { ...personalizedBase, sortOption: "yearAsc" };

    const merged = mergeSearchBackgroundMetadata(incoming, current, personalizedBase);

    expect(merged.sortOption).toBe("yearAsc");
    expect(merged.libraryContext).toBeUndefined();
    expect(merged.papers.map((paper) => paper.paperId)).toEqual(["101"]);
    expect(merged.papers[0]?.abstract).toBe("Hydrated abstract");
  });
});

describe("ResearchBackgroundTasks search enrichment execution", () => {
  registerSearchEnrichmentTestHooks();

  it("replaces a same-execution hydration attempt when a later paper target changes", async () => {
    const scenario = await runSearchTargetReplacementScenario(createSearchResultDocument());

    expect(scenario).toMatchObject({
      initialRequestCount: 1,
      replacementRequestCount: 2,
      stableTargetRequestCount: 2,
      postLoserRequestCount: 2,
      firstRequestAborted: true,
    });
    const winnerMetadata =
      scenario.currentViewAfterWinner?.metadata.type === "search"
        ? scenario.currentViewAfterWinner.metadata
        : undefined;
    expect(winnerMetadata?.papers[40]?.paperId).toBe("999");
    expect(winnerMetadata?.abstractHydration).toEqual({ status: "ready" });
  });

  it("retries search enrichment before leaving a pending result in place", async () => {
    vi.useFakeTimers();
    const pendingDocument = createSearchResultDocument();
    const hydratedDocument: ResearchRoutePayload = {
      ...pendingDocument,
      updatedAt: "2026-04-07T00:00:03.000Z",
      metadata: {
        ...pendingDocument.metadata,
        abstractHydration: { status: "ready" },
      },
    };
    setSearchDocumentStoreDocuments([pendingDocument]);

    const fetchMock = vi
      .fn<(input: RequestInfo | URL) => Promise<Response>>()
      .mockRejectedValueOnce(new Error("temporary network failure"))
      .mockRejectedValueOnce(new Error("temporary server failure"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            enrichmentDeltaResponse(hydratedDocument.metadata, hydratedDocument.updatedAt),
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    global.fetch = fetchMock;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const enrichPromise = runSearchEnrichmentTask({
      task: {
        executionId: useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
        documentId: pendingDocument.id,
        ownerPrincipalId: pendingDocument.ownerPrincipalId,
        query: pendingDocument.metadata.query,
        metadata: pendingDocument.metadata,
      },
      controller: new AbortController(),
    });

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(500);
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(500);
      await enrichPromise;
    });

    expect(
      fetchMock.mock.calls.filter(
        ([input]) => getRequestUrl(input) === API_ROUTES.SEARCH_ENRICHMENT,
      ),
    ).toHaveLength(3);
    const replacedDocument = (
      [useResearchRouteStore.getState().currentView].filter(Boolean) as NonNullable<
        ReturnType<typeof useResearchRouteStore.getState>["currentView"]
      >[]
    )[0] as ResearchRoutePayload & {
      metadata: SearchMetadata;
    };
    expect(replacedDocument.id).toBe(hydratedDocument.id);
    expect(replacedDocument.updatedAt).toBe(hydratedDocument.updatedAt);
    expect(replacedDocument.metadata.type).toBe("search");
    expect(replacedDocument.metadata.abstractHydration).toEqual({ status: "ready" });
  });

  it("terminates abort-ignoring enrichment attempts and releases the runner", async () => {
    vi.useFakeTimers();
    const pendingDocument = withNumericSearchPaperIds(createSearchResultDocument());
    setSearchDocumentStoreDocuments([pendingDocument]);
    const requestSignals: AbortSignal[] = [];
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal) requestSignals.push(init.signal);
      return new Promise<Response>(() => undefined);
    });
    global.fetch = fetchMock;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const enrichPromise = runSearchEnrichmentTask({
      task: {
        executionId: useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
        documentId: pendingDocument.id,
        ownerPrincipalId: pendingDocument.ownerPrincipalId,
        query: pendingDocument.metadata.query,
        metadata: pendingDocument.metadata,
      },
      controller: new AbortController(),
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BACKGROUND_REQUEST_SILENCE_TIMEOUT_MS);
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(BACKGROUND_REQUEST_SILENCE_TIMEOUT_MS);
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(BACKGROUND_REQUEST_SILENCE_TIMEOUT_MS);
    });

    await expect(enrichPromise).resolves.toMatchObject({
      metadata: {
        abstractHydration: { status: "ready", repairAttempted: true },
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(requestSignals).toHaveLength(3);
    expect(requestSignals.every((signal) => signal.aborted)).toBe(true);
    const settledDocument = useResearchRouteStore.getState().currentView;
    expect(
      settledDocument?.metadata.type === "search"
        ? settledDocument.metadata.abstractHydration
        : null,
    ).toEqual({ status: "ready", repairAttempted: true });
    expect(
      settledDocument?.metadata.type === "search" ? settledDocument.metadata.graphSupport : null,
    ).toBeUndefined();
  });

  it("preserves completed term discovery and first-payload graph support when hydration arrives later", async () => {
    const pendingBase = withNumericSearchPaperIds(createSearchResultDocument());
    const graphSupport: NonNullable<SearchMetadata["graphSupport"]> = {
      version: 2,
      source: "episteme-paper-neighborhood",
      basis: "library_anchor_neighborhood",
      status: "ready",
      anchorPaperCount: 1,
      samplePaperIds: ["101"],
      generatedAt: "2026-07-14T00:00:00.000Z",
      candidateCounts: {
        providerReturned: 1,
        hydrated: 1,
        keywordOverlap: 1,
        admittedSupplement: 0,
        deferredByQueryRelevance: 0,
        filteredOut: {
          candidateCap: 0,
          hydrationUnavailable: 0,
          publicationYear: 0,
          nonPositiveScore: 0,
          titleFamilyDuplicate: 0,
        },
      },
      paperScores: {
        "101": {
          defaultScore: 0.9,
          graphScore: 0.8,
          semanticScore: 0.1,
          sharedCiters: 2,
          sharedRefs: 1,
          seedCount: 1,
          sources: ["co_cited"],
        },
      },
    };
    const pendingDocument = {
      ...pendingBase,
      metadata: { ...pendingBase.metadata, graphSupport },
    };
    const enrichedMetadata: SearchMetadata = {
      ...pendingDocument.metadata,
      abstractHydration: { status: "ready" },
    };
    setSearchDocumentStoreDocuments([pendingDocument]);

    let resolveFetch: ((response: Response) => void) | null = null;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    global.fetch = fetchMock;

    const enrichPromise = runSearchEnrichmentTask({
      task: {
        executionId: useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
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

    useResearchRouteStore.getState().patchCurrentView(
      {
        ...pendingDocument,
        metadata: {
          ...pendingDocument.metadata,
          sortOption: "yearAsc",
          yearFilter: "2024-2026",
          facetFilters: {
            fieldsOfStudy: ["Computer Science"],
            authors: [],
            venues: [],
            hasPdf: true,
          },
          englishTermDiscovery: { status: "ready", source: "llm" },
          englishTermCandidates: [
            {
              term: "research agents",
              type: "direct",
              confidence: "high",
              supportCount: 1,
              supportPaperIds: ["101"],
              samplePaperIds: ["101"],
              basis: "llm basis",
            },
          ],
        },
        updatedAt: "2026-04-07T00:00:05.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    await act(async () => {
      resolveFetch?.(
        new Response(
          JSON.stringify(enrichmentDeltaResponse(enrichedMetadata, "2026-04-07T00:00:04.000Z")),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
      await enrichPromise;
    });

    const currentView = useResearchRouteStore.getState().currentView;
    const metadata = currentView?.metadata.type === "search" ? currentView.metadata : undefined;
    expect(metadata?.englishTermDiscovery).toEqual({ status: "ready", source: "llm" });
    expect(metadata?.englishTermCandidates?.[0]).toMatchObject({
      term: "research agents",
      graphSupportCount: 1,
    });
    expect(metadata?.englishTermCandidates?.[0]?.basis).toContain(
      "첫 검색 결과의 라이브러리 그래프 근거",
    );
    expect(metadata?.graphSupport?.status).toBe("ready");
    expect(metadata).toMatchObject({
      sortOption: "yearAsc",
      yearFilter: "2024-2026",
      facetFilters: { fieldsOfStudy: ["Computer Science"], hasPdf: true },
    });
    expect(currentView?.updatedAt).toBe("2026-04-07T00:00:05.001Z");
  });

  it("rejects enrichment from a prior execution that reused the same view snapshot", async () => {
    const pendingDocument = createSearchResultDocument();
    setSearchDocumentStoreDocuments([pendingDocument]);
    const priorExecutionId = useResearchRouteStore.getState().activeExecutionId;
    if (!priorExecutionId) {
      throw new Error("expected active execution");
    }

    let resolveFetch: ((response: Response) => void) | null = null;
    global.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const enrichPromise = runSearchEnrichmentTask({
      task: {
        executionId: priorExecutionId,
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

    useResearchRouteStore
      .getState()
      .setCurrentView(pendingDocument, "test:search-hydrate-1:new-execution");

    await act(async () => {
      resolveFetch?.(
        new Response(
          JSON.stringify(
            enrichmentDeltaResponse(
              {
                ...pendingDocument.metadata,
                abstractHydration: { status: "ready" },
              },
              "2026-04-07T00:00:04.000Z",
            ),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      expect(await enrichPromise).toBeNull();
    });

    const current = useResearchRouteStore.getState();
    expect(current.activeExecutionId).toBe("test:search-hydrate-1:new-execution");
    expect(
      current.currentView?.metadata.type === "search"
        ? current.currentView.metadata.abstractHydration
        : null,
    ).toEqual({ status: "pending" });
  });
});
