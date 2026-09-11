import { afterEach, describe, expect, it } from "vitest";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { buildEphemeralRouteAiCommentProjectionKey } from "@/app/lib/view-snapshot";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

function createSearchView(id: string): Extract<ResearchRoutePayload, { type: "search" }> {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id,
    type: "search",
    title: `검색 ${id}`,
    content: "",
    createdBy: "user",
    metadata: {
      type: "search",
      query: id,
      papers: [
        {
          paperId: "paper-1",
          title: "Paper 1",
          abstract: null,
          year: 2026,
          citationCount: 1,
          url: "https://example.test/paper-1",
          authors: [{ name: "Ada" }],
        },
      ],
      total: 1,
    },
    refs: [],
    ownerPrincipalId: "owner-1",
    createdAt: "2026-04-11T00:00:00.000Z",
    updatedAt: "2026-04-11T00:00:00.000Z",
    reaction: null,
  };
}

function createCitationView(
  id: string,
): Extract<ResearchRoutePayload, { type: "citation_lineage" }> {
  const seedPaper = {
    paperId: "seed-1",
    title: "Seed Paper",
    abstract: "Seed evidence",
    year: 2024,
    citationCount: 10,
    url: "https://example.test/seed-1",
    authors: [{ name: "Ada" }],
  };
  const referencePaper = {
    paperId: "reference-1",
    title: "Reference Paper",
    abstract: "Initial reference evidence",
    year: 2020,
    citationCount: 5,
    url: "https://example.test/reference-1",
    authors: [{ name: "Grace" }],
  };

  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id,
    type: "citation_lineage",
    title: `인용 ${id}`,
    content: "",
    createdBy: "user",
    metadata: {
      type: "citation_lineage",
      seedPaper,
      referenceIds: [referencePaper.paperId],
      citationIds: [],
      papers: [referencePaper],
      total: 1,
    },
    refs: [],
    ownerPrincipalId: "owner-1",
    createdAt: "2026-08-02T00:00:00.000Z",
    updatedAt: "2026-08-02T00:00:00.000Z",
    reaction: null,
  };
}

afterEach(() => {
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
});

describe("research-route-store scalar reaction generation", () => {
  it("clears a settled reaction and rejects its late commit after the ViewSnapshot projection changes", () => {
    const view = createSearchView("search-1");
    const initialProjectionKey = buildEphemeralRouteAiCommentProjectionKey(view);
    if (!initialProjectionKey) throw new Error("search projection key is required");
    useResearchRouteStore.getState().setCurrentView(view, "exec-1");
    useResearchRouteStore.getState().setRouteAiComment(
      view.id,
      {
        id: "block-1",
        title: "검색 반응",
        body: "초기 반응",
        chips: [],
        timestamp: view.updatedAt,
      },
      "exec-1",
      initialProjectionKey,
    );

    useResearchRouteStore.getState().patchCurrentView(
      {
        id: view.id,
        type: "search",
        updatedAt: "2026-04-11T00:01:00.000Z",
        metadata: {
          ...view.metadata,
          sortOption: "interest",
        },
      },
      "exec-1",
    );

    expect(useResearchRouteStore.getState()).toMatchObject({
      routeAiComment: null,
      reactionGeneration: 1,
      pendingRouteAiCommentRegeneration: false,
      reactionCardHistory: [],
    });

    useResearchRouteStore.getState().setRouteAiComment(
      view.id,
      {
        id: "stale-block",
        title: "검색 반응",
        body: "이전 결과 반응",
        chips: [],
        timestamp: view.updatedAt,
      },
      "exec-1",
      initialProjectionKey,
    );

    expect(useResearchRouteStore.getState().routeAiComment).toBeNull();
    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(false);
  });

  it("preserves a settled search reaction when background card details hydrate", () => {
    const baseView = createSearchView("search-1");
    const view: Extract<ResearchRoutePayload, { type: "search" }> = {
      ...baseView,
      metadata: {
        ...baseView.metadata,
        abstractHydration: { status: "pending" },
        papers: baseView.metadata.papers.map((paper) => ({
          ...paper,
          abstract: null,
          authors: [],
          venue: null,
          fieldsOfStudy: null,
          openAccessPdf: null,
        })),
      },
    };
    useResearchRouteStore.getState().setCurrentView(view, "exec-1");
    useResearchRouteStore.getState().setRouteAiComment(
      view.id,
      {
        id: "block-1",
        title: "검색 반응",
        body: "첫 결과 기준 반응",
        chips: [],
        timestamp: view.updatedAt,
      },
      "exec-1",
    );

    useResearchRouteStore.getState().patchCurrentView(
      {
        id: view.id,
        type: "search",
        updatedAt: "2026-04-11T00:01:00.000Z",
        metadata: {
          ...view.metadata,
          abstractHydration: { status: "ready" },
          papers: view.metadata.papers.map((paper) => ({
            ...paper,
            abstract: "Hydrated abstract",
            authors: [{ name: "Hydrated Author" }],
            venue: "Hydrated Venue",
            fieldsOfStudy: ["Computer Science"],
            openAccessPdf: { url: "https://example.test/paper-1.pdf" },
          })),
        },
      },
      "exec-1",
    );

    expect(useResearchRouteStore.getState()).toMatchObject({
      routeAiComment: { id: "block-1" },
      reactionGeneration: 0,
      pendingRouteAiCommentRegeneration: false,
    });
  });

  it("marks automatic generation pending without advancing generation", () => {
    useResearchRouteStore.getState().setCurrentView(createSearchView("search-1"), "exec-1");

    useResearchRouteStore.getState().markRouteAiCommentGenerationPending("search-1", "exec-1");

    expect(useResearchRouteStore.getState()).toMatchObject({
      reactionGeneration: 0,
      pendingRouteAiCommentRegeneration: true,
    });
  });

  it("ignores stale ids and stale execution tokens", () => {
    useResearchRouteStore.getState().setCurrentView(createSearchView("search-1"), "exec-2");

    useResearchRouteStore.getState().markRouteAiCommentGenerationPending("missing", "exec-2");
    useResearchRouteStore.getState().markRouteAiCommentGenerationPending("search-1", "exec-1");

    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(false);
  });

  it("regenerates without clearing the settled reaction and clears pending on success", () => {
    useResearchRouteStore.getState().setCurrentView(createSearchView("search-1"), "exec-1");
    useResearchRouteStore.getState().setRouteAiComment(
      "search-1",
      {
        id: "block-1",
        title: "검색 반응",
        body: "초기 반응",
        chips: [],
        timestamp: "2026-04-08T00:00:00.000Z",
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );

    useResearchRouteStore.getState().requestRouteAiCommentRegeneration("search-1", "exec-1");
    expect(useResearchRouteStore.getState()).toMatchObject({
      routeAiComment: { id: "block-1" },
      reactionGeneration: 1,
      pendingRouteAiCommentRegeneration: true,
    });

    useResearchRouteStore.getState().setRouteAiComment(
      "search-1",
      {
        id: "block-2",
        title: "검색 반응",
        body: "새 반응",
        chips: [],
        timestamp: "2026-04-08T00:01:00.000Z",
      },
      "exec-1",
    );
    expect(useResearchRouteStore.getState()).toMatchObject({
      routeAiComment: { id: "block-2" },
      pendingRouteAiCommentRegeneration: false,
    });
  });

  it("clears regeneration progress without replacing the reaction", () => {
    const view = createSearchView("search-1");
    useResearchRouteStore.getState().setCurrentView(view, "exec-1");
    useResearchRouteStore.getState().setRouteAiComment(
      view.id,
      {
        id: "block-1",
        title: "검색 반응",
        body: "초기 반응",
        chips: [],
        timestamp: view.updatedAt,
      },
      useResearchRouteStore.getState().activeExecutionId ?? "test-execution",
    );
    useResearchRouteStore.getState().requestRouteAiCommentRegeneration(view.id, "exec-1");

    useResearchRouteStore.getState().clearRouteAiCommentRegeneration(view.id, "exec-1");

    expect(useResearchRouteStore.getState().routeAiComment?.id).toBe("block-1");
    expect(useResearchRouteStore.getState().pendingRouteAiCommentRegeneration).toBe(false);
  });

  it("resets generation state when another execution becomes active", () => {
    useResearchRouteStore.getState().setCurrentView(createSearchView("search-1"), "exec-1");
    useResearchRouteStore.getState().requestRouteAiCommentRegeneration("search-1", "exec-1");

    useResearchRouteStore.getState().setCurrentView(createSearchView("search-2"), "exec-2");

    expect(useResearchRouteStore.getState()).toMatchObject({
      reactionGeneration: 0,
      pendingRouteAiCommentRegeneration: false,
      routeAiCommentGenerationStarted: false,
    });
  });
});

describe("research-route-store citation evidence projection", () => {
  it("invalidates a citation reaction and rejects its late commit when evidence changes", () => {
    const view = createCitationView("citation-1");
    const initialProjectionKey = buildEphemeralRouteAiCommentProjectionKey(view);
    if (!initialProjectionKey) throw new Error("citation projection key is required");
    useResearchRouteStore.getState().setCurrentView(view, "exec-1");
    useResearchRouteStore.getState().setRouteAiComment(
      view.id,
      {
        id: "citation-block-1",
        title: "인용 흐름",
        body: "초기 근거 반응",
        chips: [],
        timestamp: view.updatedAt,
      },
      "exec-1",
      initialProjectionKey,
    );

    useResearchRouteStore.getState().patchCurrentView(
      {
        id: view.id,
        type: "citation_lineage",
        updatedAt: "2026-08-02T00:01:00.000Z",
        metadata: {
          ...view.metadata,
          papers: view.metadata.papers.map((paper) => ({
            ...paper,
            abstract: "Changed reference evidence",
          })),
        },
      },
      "exec-1",
    );

    expect(useResearchRouteStore.getState()).toMatchObject({
      routeAiComment: null,
      reactionGeneration: 1,
    });

    useResearchRouteStore.getState().setRouteAiComment(
      view.id,
      {
        id: "stale-citation-block",
        title: "인용 흐름",
        body: "이전 근거 반응",
        chips: [],
        timestamp: view.updatedAt,
      },
      "exec-1",
      initialProjectionKey,
    );

    expect(useResearchRouteStore.getState().routeAiComment).toBeNull();
  });
});
