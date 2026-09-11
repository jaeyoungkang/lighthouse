import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import type * as RelationshipExecutionModule from "@/app/server/services/relationship-execution";
import type * as SearchExecutionModule from "@/app/server/services/search-execution";
import {
  CitationSeedRoutePage,
  SimilarSeedRoutePage,
} from "@/app/(research)/relationship-route-page";
import { SearchRoutePage } from "@/app/(research)/search-route-page";
import { ConditionUrlRejectedState } from "@/app/components/research/ConditionUrlRejectedState";

type ExecuteSearchFromUrl = typeof SearchExecutionModule.executeSearchFromUrl;
type ExecuteCitationLineageFromUrl =
  typeof RelationshipExecutionModule.executeCitationLineageFromUrl;
type ExecuteGraphNeighborsFromUrl = typeof RelationshipExecutionModule.executeGraphNeighborsFromUrl;
type ResearchRouteRuntimeElementProps = {
  runtimeId: string;
  initialView?: ResearchRoutePayload;
};
type SuspenseElement = ReactElement<{
  children: ReactElement<Record<string, unknown>>;
  fallback: ReactElement<ResearchRouteRuntimeElementProps>;
}>;

const {
  executeCitationLineageFromUrlMock,
  executeGraphNeighborsFromUrlMock,
  executeSearchFromUrlMock,
  notFoundMock,
  redirectMock,
  researchRouteRuntimeMock,
  resolveCurrentUserMock,
  trackServerEventMock,
} = vi.hoisted(() => ({
  executeCitationLineageFromUrlMock: vi.fn<ExecuteCitationLineageFromUrl>(),
  executeGraphNeighborsFromUrlMock: vi.fn<ExecuteGraphNeighborsFromUrl>(),
  executeSearchFromUrlMock: vi.fn<ExecuteSearchFromUrl>(),
  notFoundMock: vi.fn(() => {
    throw new Error("notFound");
  }),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
  researchRouteRuntimeMock: vi.fn(() => <div data-testid="research-route-runtime" />),
  resolveCurrentUserMock: vi.fn(),
  trackServerEventMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
}));

vi.mock("@/app/components/research/ResearchRouteRuntime", () => ({
  ResearchRouteRuntime: researchRouteRuntimeMock,
}));

vi.mock("@/app/server/auth/identity", () => ({
  resolveCurrentUser: resolveCurrentUserMock,
}));

vi.mock("@/app/server/domain-access/server-analytics", () => ({
  trackServerEvent: trackServerEventMock,
}));

vi.mock("@/app/server/services/relationship-execution", async () => {
  const actual = await vi.importActual<typeof RelationshipExecutionModule>(
    "@/app/server/services/relationship-execution",
  );
  return {
    ...actual,
    executeCitationLineageFromUrl: executeCitationLineageFromUrlMock,
    executeGraphNeighborsFromUrl: executeGraphNeighborsFromUrlMock,
  };
});

vi.mock("@/app/server/services/search-execution", async () => {
  const actual = await vi.importActual<typeof SearchExecutionModule>(
    "@/app/server/services/search-execution",
  );
  return {
    ...actual,
    executeSearchFromUrl: executeSearchFromUrlMock,
  };
});

function createSearchView(id: string): ResearchRoutePayload {
  return {
    id,
    type: "search",
    title: "graph retrieval",
    content: "",
    createdBy: "user",
    metadata: {
      type: "search",
      query: "graph retrieval",
      papers: [],
      total: 0,
      totalMode: "not_computed",
    },
    reaction: null,
    refs: [],
    ownerPrincipalId: "user-1",
    status: "ready",
    version: 0,
    reactionVersion: 0,
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z",
  } as ResearchRoutePayload;
}

async function resolveSuspenseChild(result: SuspenseElement): Promise<ReactElement> {
  const child = result.props.children;
  const childType = child.type as (props: typeof child.props) => Promise<ReactElement>;
  return childType(child.props);
}

function createRelationshipDocument(
  id: string,
  type: "citation_lineage" | "graph_neighbors",
): ResearchRoutePayload {
  const seedPaper = {
    paperId: "12345",
    title: "Graph Retrieval",
    abstract: null,
    year: 2024,
    citationCount: 7,
    url: "https://example.com/paper-1",
    authors: [],
  };
  const metadata =
    type === "citation_lineage"
      ? {
          type,
          seedPaper,
          referenceIds: [],
          citationIds: [],
          papers: [],
          total: 0,
        }
      : {
          type,
          seedPaper,
          papers: [],
          total: 0,
          coCited: [],
          coupled: [],
        };
  return {
    id,
    type,
    title: "Graph Retrieval",
    content: "",
    createdBy: "user",
    metadata,
    reaction: null,
    refs: [],
    ownerPrincipalId: "user-1",
    status: "ready",
    version: 0,
    reactionVersion: 0,
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z",
  } as ResearchRoutePayload;
}

const SEED_PARAMS = {
  seedPaperId: "12345",
  seedPaperTitle: "Graph Retrieval",
  seedPaperYear: "2024",
  seedPaperUrl: "https://example.com/paper-1",
  seedPaperCitations: "7",
};

const LEGACY_SEED_PARAMS = {
  seedPaperId: "legacy-paper",
  seedPaperTitle: "Graph Retrieval for Legacy Records",
  seedPaperYear: "2023",
  seedPaperUrl: "https://example.com/legacy-paper",
  seedPaperCitations: "11",
};

describe("relationship seed route pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveCurrentUserMock.mockResolvedValue({ id: "user-1", email: "user-1@example.com" });
    executeSearchFromUrlMock.mockResolvedValue({
      view: createSearchView("search-ephemeral-1"),
      executed: true,
      failed: false,
    });
    executeCitationLineageFromUrlMock.mockResolvedValue({
      view: createRelationshipDocument("citation-ephemeral-1", "citation_lineage"),
      executed: true,
      failed: false,
    });
    executeGraphNeighborsFromUrlMock.mockResolvedValue({
      view: createRelationshipDocument("graph-neighbors-ephemeral-1", "graph_neighbors"),
      executed: true,
      failed: false,
    });
  });

  it("executes search from query URL params in place", async () => {
    const result = await SearchRoutePage({
      searchParams: Promise.resolve({ q: "graph retrieval", sort: "year" }),
    });

    expect(executeSearchFromUrlMock).not.toHaveBeenCalled();
    const fallbackProps = (result as SuspenseElement).props.fallback.props;
    expect(fallbackProps.runtimeId).toBe("anonymous");
    expect(fallbackProps.initialView?.status).toBe("pending");

    const resolved = await resolveSuspenseChild(result as SuspenseElement);
    const searchCall = executeSearchFromUrlMock.mock.calls[0][0];
    expect(searchCall.ownerPrincipalId).toBe("user-1");
    expect(searchCall.input).toMatchObject({
      canonicalKey: "q=graph+retrieval&sort=year",
      query: "graph retrieval",
      sort: "year",
    });
    const resolvedProps = resolved.props as ResearchRouteRuntimeElementProps;
    expect(resolvedProps.runtimeId).toBe("user-1");
    expect(resolvedProps.initialView).toMatchObject({ id: "search-ephemeral-1" });
  });

  it("rejects an oversized external search condition before auth or provider execution", async () => {
    const result = await SearchRoutePage({
      searchParams: Promise.resolve({ q: "a".repeat(1_025) }),
    });

    expect((result as ReactElement).type).toBe(ConditionUrlRejectedState);
    expect(resolveCurrentUserMock).not.toHaveBeenCalled();
    expect(executeSearchFromUrlMock).not.toHaveBeenCalled();
  });

  it("executes a reversed publication-year range in place with canonical conditions", async () => {
    const result = await SearchRoutePage({
      searchParams: Promise.resolve({ q: "graph retrieval", year: "2024-2021" }),
    });

    expect(redirectMock).not.toHaveBeenCalled();
    await resolveSuspenseChild(result as SuspenseElement);
    expect(executeSearchFromUrlMock.mock.calls[0]?.[0].input).toMatchObject({
      year: "2021-2024",
      canonicalKey: "q=graph+retrieval&year=2021-2024",
    });
  });

  it("rejects a malformed publication-year range before auth or provider execution", async () => {
    const result = await SearchRoutePage({
      searchParams: Promise.resolve({ q: "graph retrieval", year: "2020abc" }),
    });

    expect((result as ReactElement).type).toBe(ConditionUrlRejectedState);
    expect(resolveCurrentUserMock).not.toHaveBeenCalled();
    expect(executeSearchFromUrlMock).not.toHaveBeenCalled();
  });

  it("rejects oversized citation and similar seeds before provider execution", async () => {
    const oversizedParams = {
      ...SEED_PARAMS,
      seedPaperTitle: "a".repeat(769),
    };

    const citationResult = await CitationSeedRoutePage({
      searchParams: Promise.resolve(oversizedParams),
    });
    const similarResult = await SimilarSeedRoutePage({
      searchParams: Promise.resolve(oversizedParams),
    });

    expect((citationResult as ReactElement).type).toBe(ConditionUrlRejectedState);
    expect((similarResult as ReactElement).type).toBe(ConditionUrlRejectedState);
    expect(resolveCurrentUserMock).not.toHaveBeenCalled();
    expect(executeCitationLineageFromUrlMock).not.toHaveBeenCalled();
    expect(executeGraphNeighborsFromUrlMock).not.toHaveBeenCalled();
  });

  it("executes citation lineage from seed URL params without redirect or a retired server analytics mirror", async () => {
    const result = await CitationSeedRoutePage({
      searchParams: Promise.resolve(SEED_PARAMS),
    });

    const citationCall = executeCitationLineageFromUrlMock.mock.calls[0][0];
    expect(citationCall.ownerPrincipalId).toBe("user-1");
    expect(citationCall.input.seedPaper).toMatchObject({
      paperId: "12345",
      title: "Graph Retrieval",
    });
    const routeProps = (result as ReactElement<ResearchRouteRuntimeElementProps>).props;
    expect(routeProps.runtimeId).toBe("user-1");
    expect(routeProps.initialView).toMatchObject({ id: "citation-ephemeral-1" });
    expect(trackServerEventMock).not.toHaveBeenCalled();
  });

  it("executes graph neighbors from seed URL params without redirecting to an owned ResearchRoutePayload", async () => {
    const result = await SimilarSeedRoutePage({
      searchParams: Promise.resolve(SEED_PARAMS),
    });

    const graphCall = executeGraphNeighborsFromUrlMock.mock.calls[0][0];
    expect(graphCall.ownerPrincipalId).toBe("user-1");
    expect(graphCall.input.seedPaper).toMatchObject({
      paperId: "12345",
      title: "Graph Retrieval",
    });
    const routeProps = (result as ReactElement<ResearchRouteRuntimeElementProps>).props;
    expect(routeProps.runtimeId).toBe("user-1");
    expect(routeProps.initialView).toMatchObject({ id: "graph-neighbors-ephemeral-1" });
    await vi.waitFor(() => {
      expect(trackServerEventMock).toHaveBeenCalledWith(
        "user-1@example.com",
        "graph_neighbors_viewed",
        {
          owner_principal_id: "user-1",
          document_id: "graph-neighbors-ephemeral-1",
          seed_paper_id: "12345",
          co_cited_count: 0,
          coupled_count: 0,
        },
      );
    });
  });

  it("executes graph neighbors for an Episteme 3 canonical paper uid", async () => {
    await SimilarSeedRoutePage({
      searchParams: Promise.resolve({ ...SEED_PARAMS, seedPaperId: "pap_e3_native_123" }),
    });

    expect(redirectMock).not.toHaveBeenCalled();
    expect(executeGraphNeighborsFromUrlMock.mock.calls[0]?.[0].input.seedPaper.paperId).toBe(
      "pap_e3_native_123",
    );
  });

  it("redirects legacy non-corpus similar seed URLs to the seeded search fallback", async () => {
    await expect(
      SimilarSeedRoutePage({
        searchParams: Promise.resolve(LEGACY_SEED_PARAMS),
      }),
    ).rejects.toThrow("redirect:/search?");

    expect(executeGraphNeighborsFromUrlMock).not.toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledTimes(1);
    const redirectedUrl = redirectMock.mock.calls[0][0];
    const parsed = new URL(redirectedUrl, "https://lighthouse.local");
    expect(parsed.pathname).toBe("/search");
    expect(parsed.searchParams.get("q")).toBe("Graph Retrieval for Legacy Records");
    expect(parsed.searchParams.get("entry")).toBe("similar");
    expect(parsed.searchParams.get("seedPaperId")).toBe("legacy-paper");
    expect(parsed.searchParams.get("seedPaperTitle")).toBe("Graph Retrieval for Legacy Records");
    expect(parsed.searchParams.get("seedPaperYear")).toBe("2023");
    expect(parsed.searchParams.get("seedPaperUrl")).toBe("https://example.com/legacy-paper");
    expect(parsed.searchParams.get("seedPaperCitations")).toBe("11");
  });

  it("does not mirror a failed citation view into retired server analytics", async () => {
    executeCitationLineageFromUrlMock.mockResolvedValue({
      view: {
        ...createRelationshipDocument("citation-ephemeral-1", "citation_lineage"),
        status: "failed",
      },
      executed: false,
      failed: true,
    });

    await CitationSeedRoutePage({
      searchParams: Promise.resolve(SEED_PARAMS),
    });

    expect(trackServerEventMock).not.toHaveBeenCalled();
  });

  it("emits graph neighbors failed analytics when the similar seed route renders a failed view", async () => {
    executeGraphNeighborsFromUrlMock.mockResolvedValue({
      view: {
        ...createRelationshipDocument("graph-neighbors-ephemeral-1", "graph_neighbors"),
        status: "failed",
      },
      executed: false,
      failed: true,
    });

    await SimilarSeedRoutePage({
      searchParams: Promise.resolve(SEED_PARAMS),
    });

    await vi.waitFor(() => {
      expect(trackServerEventMock).toHaveBeenCalledWith(
        "user-1@example.com",
        "graph_neighbors_failed",
        {
          owner_principal_id: "user-1",
          seed_paper_id: "12345",
        },
      );
    });
  });
});
