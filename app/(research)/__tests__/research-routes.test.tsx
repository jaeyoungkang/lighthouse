import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import type * as RelationshipExecutionModule from "@/app/server/services/relationship-execution";
import type * as SearchExecutionModule from "@/app/server/services/search-execution";
import CitationPage from "@/app/(research)/citation/page";
import GapPage from "@/app/(research)/gap/page";
import ResearchLayout from "@/app/(research)/layout";
import SearchPage from "@/app/(research)/search/page";
import SimilarPage from "@/app/(research)/similar/page";
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
  mockPathname,
  mockSearchParams,
} = vi.hoisted(() => ({
  executeCitationLineageFromUrlMock: vi.fn<ExecuteCitationLineageFromUrl>(),
  executeGraphNeighborsFromUrlMock: vi.fn<ExecuteGraphNeighborsFromUrl>(),
  executeSearchFromUrlMock: vi.fn<ExecuteSearchFromUrl>(),
  notFoundMock: vi.fn(() => {
    throw new Error("notFound");
  }),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  researchRouteRuntimeMock: vi.fn(() => <div data-testid="research-route-runtime" />),
  resolveCurrentUserMock: vi.fn(),
  mockPathname: { value: "/search" },
  mockSearchParams: { value: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
  redirect: redirectMock,
  usePathname: () => mockPathname.value,
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams.value,
}));

vi.mock("@/app/components/research/ResearchRouteRuntime", () => ({
  ResearchRouteRuntime: researchRouteRuntimeMock,
}));

vi.mock("@/app/server/auth/identity", () => ({
  resolveCurrentUser: resolveCurrentUserMock,
}));

vi.mock("@/app/components/MoonlightAuthBootstrap", () => ({
  MoonlightAuthBootstrap: ({ fallback }: { readonly fallback: string }) => (
    <div data-testid="moonlight-auth-bootstrap" data-fallback={fallback} />
  ),
  refreshLightHouseMoonlightScholarSession: vi.fn(),
}));

vi.mock("@/app/components/research/ResearchBackgroundTasks", () => ({
  ResearchBackgroundTasks: () => <div data-testid="research-background-tasks" />,
}));

vi.mock("@/app/server/services/search-execution", async () => {
  const actual = await vi.importActual<typeof SearchExecutionModule>(
    "@/app/server/services/search-execution",
  );
  return {
    ...actual,
    executeSearchFromUrl: executeSearchFromUrlMock,
  };
});

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

function createSearchView(id: string, query = "graph retrieval"): ResearchRoutePayload {
  return {
    id,
    type: "search",
    title: query,
    content: "",
    createdBy: "user",
    metadata: {
      type: "search",
      query,
      papers: [
        {
          paperId: "paper-1",
          title: "Graph Retrieval",
          abstract: null,
          year: 2024,
          citationCount: 7,
          url: "https://example.com/paper-1",
          authors: [],
        },
      ],
      total: 1,
    },
    reaction: null,
    refs: [],
    ownerPrincipalId: "user-1",
    status: "ready",
    version: 0,
    reactionVersion: 0,
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z",
  };
}

function createCitationDocument(id: string): ResearchRoutePayload {
  const seedPaper = {
    paperId: "paper-1",
    title: "Graph Retrieval",
    abstract: null,
    year: 2024,
    citationCount: 7,
    url: "https://example.com/paper-1",
    authors: [],
  };
  return {
    id,
    type: "citation_lineage",
    title: "인용 계보: Graph Retrieval",
    content: "",
    createdBy: "user",
    metadata: {
      type: "citation_lineage",
      seedPaper,
      referenceIds: [],
      citationIds: [],
      papers: [],
      total: 0,
    },
    reaction: null,
    refs: [],
    ownerPrincipalId: "user-1",
    status: "ready",
    version: 0,
    reactionVersion: 0,
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z",
  };
}

function createGraphNeighborsView(id: string): ResearchRoutePayload {
  const seedPaper = {
    paperId: "12345",
    title: "Graph Retrieval",
    abstract: null,
    year: 2024,
    citationCount: 7,
    url: "https://example.com/paper-1",
    authors: [],
  };
  return {
    id,
    type: "graph_neighbors",
    title: "비슷한 논문: Graph Retrieval",
    content: "",
    createdBy: "user",
    metadata: {
      type: "graph_neighbors",
      seedPaper,
      papers: [],
      total: 0,
      coCited: [],
      coupled: [],
    },
    reaction: null,
    refs: [],
    ownerPrincipalId: "user-1",
    status: "ready",
    version: 0,
    reactionVersion: 0,
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z",
  };
}

async function resolveSuspenseChild(result: SuspenseElement): Promise<ReactElement> {
  const child = result.props.children;
  const childType = child.type as (props: typeof child.props) => Promise<ReactElement>;
  return childType(child.props);
}

describe("search research route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveCurrentUserMock.mockResolvedValue({ id: "user-1", email: "user-1@example.com" });
    executeSearchFromUrlMock.mockResolvedValue({
      view: createSearchView("search-ephemeral-1"),
      executed: true,
      failed: false,
    });
    executeCitationLineageFromUrlMock.mockResolvedValue({
      view: createCitationDocument("citation-ephemeral-1"),
      executed: true,
      failed: false,
    });
    executeGraphNeighborsFromUrlMock.mockResolvedValue({
      view: createGraphNeighborsView("graph-neighbors-ephemeral-1"),
      executed: true,
      failed: false,
    });
  });

  it("executes the search from the /search?q= URL without reserving a ResearchRoutePayload", async () => {
    const result = await SearchPage({
      searchParams: Promise.resolve({ q: "graph retrieval" }),
    });

    expect(resolveCurrentUserMock).toHaveBeenCalledTimes(1);
    expect(executeSearchFromUrlMock).not.toHaveBeenCalled();
    const fallbackProps = (result as SuspenseElement).props.fallback.props;
    expect(fallbackProps.runtimeId).toBe("anonymous");
    expect(fallbackProps.initialView?.id).toContain("search-");
    expect(fallbackProps.initialView?.status).toBe("pending");

    const resolved = await resolveSuspenseChild(result as SuspenseElement);
    expect(executeSearchFromUrlMock).toHaveBeenCalledTimes(1);
    const searchCall = executeSearchFromUrlMock.mock.calls[0][0];
    expect(searchCall.ownerPrincipalId).toBe("user-1");
    expect(searchCall.input).toMatchObject({
      query: "graph retrieval",
      canonicalKey: "q=graph+retrieval",
    });
    const resolvedProps = resolved.props as ResearchRouteRuntimeElementProps;
    expect(resolvedProps.runtimeId).toBe("user-1");
    expect(resolvedProps.initialView).toMatchObject({ id: "search-ephemeral-1" });
  });

  it("streams a route-owned processing view at the same /search?q= address", async () => {
    const result = await SearchPage({
      searchParams: Promise.resolve({ q: "graph retrieval" }),
    });

    expect(redirectMock).not.toHaveBeenCalled();
    const fallbackProps = (result as SuspenseElement).props.fallback.props;
    expect(fallbackProps.runtimeId).toBe("anonymous");
    expect(fallbackProps.initialView).toMatchObject({ type: "search", status: "pending" });
  });

  it("re-executes the search when the same query URL is reopened", async () => {
    const first = await SearchPage({
      searchParams: Promise.resolve({ q: "graph retrieval" }),
    });
    await resolveSuspenseChild(first as SuspenseElement);
    const second = await SearchPage({
      searchParams: Promise.resolve({ q: "graph retrieval" }),
    });
    await resolveSuspenseChild(second as SuspenseElement);

    expect(executeSearchFromUrlMock).toHaveBeenCalledTimes(2);
    const firstCall = executeSearchFromUrlMock.mock.calls[0][0];
    const secondCall = executeSearchFromUrlMock.mock.calls[1][0];
    expect(firstCall.input.canonicalKey).toBe(secondCall.input.canonicalKey);
  });

  it("carries sort, year, and facet conditions from the URL into the search execution", async () => {
    const result = await SearchPage({
      searchParams: Promise.resolve({
        q: "graph retrieval",
        sort: "citationCount",
        year: "2020-2024",
        field: ["Computer Science", "Medicine"],
        author: "Alice",
        venue: "NeurIPS",
        hasPdf: "true",
      }),
    });
    await resolveSuspenseChild(result as SuspenseElement);

    const searchCall = executeSearchFromUrlMock.mock.calls[0][0];
    expect(searchCall.ownerPrincipalId).toBe("user-1");
    expect(searchCall.input).toMatchObject({
      query: "graph retrieval",
      sort: "citationCount",
      providerSort: "citationCount",
      year: "2020-2024",
      facetFilters: {
        fieldsOfStudy: ["Computer Science", "Medicine"],
        authors: ["Alice"],
        venues: ["NeurIPS"],
        hasPdf: true,
      },
    });
  });

  it("rejects term and seed follow-up URLs without q before auth or provider execution", async () => {
    const termResult = await SearchPage({
      searchParams: Promise.resolve({
        termSourceQuery: "source",
        term: "term",
        termType: "direct",
        termSupport: "1",
      }),
    });
    const seedResult = await SearchPage({
      searchParams: Promise.resolve({
        seedPaperId: "paper-1",
        seedPaperTitle: "Paper",
      }),
    });
    const whitespaceTermResult = await SearchPage({
      searchParams: Promise.resolve({
        q: "   ",
        termSourceQuery: "source",
        term: "term",
        termType: "direct",
        termSupport: "1",
      }),
    });

    expect((termResult as ReactElement).type).toBe(ConditionUrlRejectedState);
    expect((seedResult as ReactElement).type).toBe(ConditionUrlRejectedState);
    expect((whitespaceTermResult as ReactElement).type).toBe(ConditionUrlRejectedState);
    expect(resolveCurrentUserMock).not.toHaveBeenCalled();
    expect(executeSearchFromUrlMock).not.toHaveBeenCalled();
  });

  it("renders the empty search entry for an unauthenticated visitor without executing or gating", async () => {
    resolveCurrentUserMock.mockResolvedValue(null);

    const result = await SearchPage({ searchParams: Promise.resolve({}) });

    // Search-first: server first paint의 빈 검색 entry는 익명 키를 쓴다.
    // post-mount bootstrap 401의 auth 전환은 ResearchRouteShell이 소유한다.
    expect(resolveCurrentUserMock).not.toHaveBeenCalled();
    expect(executeSearchFromUrlMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      props: { runtimeId: "anonymous", initialSearchEntry: true },
    });
  });

  it("leaves an unauthenticated query unresolved for the shared shell auth challenge", async () => {
    resolveCurrentUserMock.mockResolvedValue(null);

    const result = await SearchPage({
      searchParams: Promise.resolve({ q: "graph retrieval" }),
    });

    // Auth-on-demand: the destination keeps its pending URL-owned view while the
    // shared client shell owns the post-mount bootstrap 401 auth challenge.
    expect(executeSearchFromUrlMock).not.toHaveBeenCalled();
    const fallbackProps = (result as SuspenseElement).props.fallback.props;
    expect(fallbackProps.runtimeId).toBe("anonymous");
    expect(fallbackProps.initialView).toMatchObject({ type: "search", status: "pending" });

    const resolved = await resolveSuspenseChild(result as SuspenseElement);
    expect(executeSearchFromUrlMock).not.toHaveBeenCalled();
    expect(resolved).toBeNull();
  });
});

describe("gap opening route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveCurrentUserMock.mockImplementation(() => new Promise(() => undefined));
  });

  it("keeps the opening route empty without waiting for auth", async () => {
    const result = await GapPage({
      searchParams: Promise.resolve({ opening: "1" }),
    });

    expect(resolveCurrentUserMock).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});

describe("research route layout composition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.value = "/search";
    mockSearchParams.value = new URLSearchParams();
    resolveCurrentUserMock.mockImplementation(() => new Promise(() => undefined));
  });

  it("renders the /search?q= destination pending view through the real layout without auth", async () => {
    mockPathname.value = "/search";
    mockSearchParams.value = new URLSearchParams("q=graph+retrieval");

    const children = await SearchPage({
      searchParams: Promise.resolve({ q: "graph retrieval" }),
    });
    const markup = renderToStaticMarkup(ResearchLayout({ children }));

    expect(resolveCurrentUserMock).toHaveBeenCalledTimes(1);
    expect(markup).toContain('data-testid="research-route-runtime"');
    expect(markup).toContain('data-testid="research-background-tasks"');
  });

  it("keeps the /gap?opening=1 layout empty without auth", async () => {
    mockPathname.value = "/gap";
    mockSearchParams.value = new URLSearchParams("opening=1");

    const children = await GapPage({
      searchParams: Promise.resolve({ opening: "1" }),
    });
    const markup = renderToStaticMarkup(ResearchLayout({ children }));

    expect(resolveCurrentUserMock).not.toHaveBeenCalled();
    expect(markup).not.toContain('data-testid="route-transition-status"');
    expect(markup).toContain('data-testid="research-background-tasks"');
  });
});

describe("relationship seed research routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveCurrentUserMock.mockResolvedValue({ id: "user-1", email: "user-1@example.com" });
    executeCitationLineageFromUrlMock.mockResolvedValue({
      view: createCitationDocument("citation-ephemeral-1"),
      executed: true,
      failed: false,
    });
    executeGraphNeighborsFromUrlMock.mockResolvedValue({
      view: createGraphNeighborsView("graph-neighbors-ephemeral-1"),
      executed: true,
      failed: false,
    });
  });

  it("executes citation lineage from seed URL params without redirecting to an owned ResearchRoutePayload", async () => {
    const result = await CitationPage({
      searchParams: Promise.resolve({
        seedPaperId: "paper-1",
        seedPaperTitle: "Graph Retrieval",
        seedPaperYear: "2024",
        seedPaperUrl: "https://example.com/paper-1",
        seedPaperCitations: "7",
      }),
    });

    expect(executeCitationLineageFromUrlMock).toHaveBeenCalledTimes(1);
    const citationCall = executeCitationLineageFromUrlMock.mock.calls[0][0];
    expect(citationCall.ownerPrincipalId).toBe("user-1");
    expect(citationCall.input.canonicalKey).toBe(
      "seedPaperId=paper-1&seedPaperTitle=Graph+Retrieval&seedPaperYear=2024&seedPaperUrl=https%3A%2F%2Fexample.com%2Fpaper-1&seedPaperCitations=7",
    );
    expect(citationCall.input.seedPaper).toMatchObject({
      paperId: "paper-1",
      title: "Graph Retrieval",
      year: 2024,
    });
    expect(redirectMock).not.toHaveBeenCalled();
    const routeProps = (result as ReactElement<ResearchRouteRuntimeElementProps>).props;
    expect(routeProps.runtimeId).toBe("user-1");
    expect(routeProps.initialView).toMatchObject({ id: "citation-ephemeral-1" });
  });

  it("executes graph neighbors from seed URL params without redirecting to an owned ResearchRoutePayload", async () => {
    const result = await SimilarPage({
      searchParams: Promise.resolve({
        seedPaperId: "12345",
        seedPaperTitle: "Graph Retrieval",
        seedPaperYear: "2024",
        seedPaperUrl: "https://example.com/paper-1",
        seedPaperCitations: "7",
      }),
    });

    expect(executeGraphNeighborsFromUrlMock).toHaveBeenCalledTimes(1);
    const graphCall = executeGraphNeighborsFromUrlMock.mock.calls[0][0];
    expect(graphCall.ownerPrincipalId).toBe("user-1");
    expect(graphCall.input.seedPaper).toMatchObject({
      paperId: "12345",
      title: "Graph Retrieval",
      citationCount: 7,
    });
    expect(redirectMock).not.toHaveBeenCalled();
    const routeProps = (result as ReactElement<ResearchRouteRuntimeElementProps>).props;
    expect(routeProps.runtimeId).toBe("user-1");
    expect(routeProps.initialView).toMatchObject({ id: "graph-neighbors-ephemeral-1" });
  });
});
