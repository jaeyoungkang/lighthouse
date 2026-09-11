import { act, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchRouteShell } from "@/app/(research)/research-route-shell";
import { assertCommonFooter } from "@/app/__tests__/site-footer.assertions";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { useLibraryAvailabilityStore } from "@/app/stores/library-availability-store";
import { useResearchRouteLibraryState } from "@/app/components/research/research-route-library-context";
import { API_ROUTES } from "@/app/lib/api-routes";
import type { LibraryContextAccessStatus } from "@/app/server/services/library-context-source";
import { useLibraryPapersStore } from "@/app/stores/library-papers-store";
import { useSearchFollowupActivation } from "@/app/components/research/search-followup-activation";

vi.mock("@/app/components/research/ResearchBackgroundTasks", () => ({
  ResearchBackgroundTasks: () => <div data-testid="research-background-tasks" />,
}));

vi.mock("@/app/components/research/ResearchRouteSearchBar", () => ({
  ResearchRouteSearchBar: ({
    userEmail,
    libraryPapers,
  }: {
    userEmail?: string;
    libraryPapers?: { paperId: string; title: string; folderName: string }[];
  }) => (
    <div
      data-testid="research-route-search-bar"
      data-user-email={userEmail ?? ""}
      data-library-paper-count={String(libraryPapers?.length ?? 0)}
    />
  ),
}));

const { mockPathname, mockSearchParams } = vi.hoisted(() => ({
  mockPathname: { value: "/search/doc-1" },
  mockSearchParams: { value: new URLSearchParams() },
}));
const navigationMocks = vi.hoisted(() => ({
  go: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
  useRouter: () => ({
    refresh: navigationMocks.refresh,
  }),
  useSearchParams: () => mockSearchParams.value,
}));

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
const MOONLIGHT_TOKEN_URL = "http://localhost:3000/api/auth/moonlight-scholar-token";

function createCompletedSearchView(
  metadata?: Partial<Extract<ResearchRoutePayload["metadata"], { type: "search" }>>,
): ResearchRoutePayload {
  const now = "2026-06-26T00:00:00.000Z";
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-doc-1",
    type: "search",
    title: "검색: graph retrieval",
    content: "",
    createdBy: "user",
    metadata: {
      type: "search",
      query: "graph retrieval",
      total: 1,
      papers: [
        {
          paperId: "paper-1",
          title: "Graph Retrieval for Agents",
          abstract: "abstract",
          year: 2026,
          citationCount: 12,
          url: "https://example.com/paper-1",
          authors: [{ name: "Alice" }],
          openAccessPdf: null,
          doi: null,
          referenceIds: null,
          citationIds: null,
        },
      ],
      ...metadata,
    },
    reaction: null,
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: now,
    updatedAt: now,
  };
}

function renderShell(
  libraryContextAvailable?: boolean,
  children = <div data-testid="research-route-content">content</div>,
  libraryAccessStatus: LibraryContextAccessStatus = "unavailable",
  serverUserEmail: string | false = "test@example.com",
) {
  const container = document.createElement("div");
  root = createRoot(container);

  act(() => {
    root?.render(
      <ResearchRouteShell
        userEmail={serverUserEmail === false ? undefined : serverUserEmail}
        libraryContextAvailable={libraryContextAvailable}
        libraryAccessStatus={libraryAccessStatus}
        libraryPapers={[
          {
            paperId: "corpus-101",
            title: "Retrieval-Augmented Agents",
            folderName: "Graph Retrieval",
          },
        ]}
      >
        {children}
      </ResearchRouteShell>,
    );
  });

  return container;
}

function rerenderShell(
  libraryContextAvailable?: boolean,
  children = <div data-testid="research-route-content">content</div>,
  libraryAccessStatus: LibraryContextAccessStatus = "unavailable",
) {
  act(() => {
    root?.render(
      <ResearchRouteShell
        userEmail="test@example.com"
        libraryContextAvailable={libraryContextAvailable}
        libraryAccessStatus={libraryAccessStatus}
        libraryPapers={[
          {
            paperId: "corpus-101",
            title: "Retrieval-Augmented Agents",
            folderName: "Graph Retrieval",
          },
          {
            paperId: "corpus-202",
            title: "Evaluation Agents",
            folderName: "Graph Retrieval",
          },
        ]}
      >
        {children}
      </ResearchRouteShell>,
    );
  });
}

function RouteLibraryStateProbe() {
  const state = useResearchRouteLibraryState();
  return (
    <div
      data-testid="route-library-state-probe"
      data-library-context-available={state.libraryContextAvailable ? "true" : "false"}
    />
  );
}

function SearchFollowupActivationTrigger({ query, route }: { query: string; route: string }) {
  const { startActivation } = useSearchFollowupActivation();
  useLayoutEffect(() => {
    startActivation({ originLocation: "/search?q=agent+memory", query, route });
  }, [query, route, startActivation]);
  return <div data-testid="research-route-content">origin results</div>;
}

function buildSearchFollowupActivation(route: string, query: string) {
  return <SearchFollowupActivationTrigger route={route} query={query} />;
}

function fetchInputUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function createLibraryBootstrapResponse(
  libraryAccessStatus: LibraryContextAccessStatus = "available",
  libraryContextAvailable = true,
): Response {
  return new Response(
    JSON.stringify({
      userEmail: "test@example.com",
      libraryContextAvailable,
      libraryAccessStatus,
      libraryPapers: [
        {
          paperId: "corpus-101",
          title: "Retrieval-Augmented Agents",
          folderName: "Graph Retrieval",
        },
      ],
    }),
    { status: 200 },
  );
}

function findFetchCall(url: string, method?: string): Parameters<typeof fetch> | undefined {
  return vi
    .mocked(fetch)
    .mock.calls.find(
      ([input, init]) => fetchInputUrl(input) === url && (!method || init?.method === method),
    );
}

beforeEach(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear();
  useResearchRouteStore.getState().setCurrentView(null, "test-execution:222");
  useLibraryAvailabilityStore.setState({ available: false });
  useLibraryPapersStore.setState({ papers: [] });
  mockPathname.value = "/search/doc-1";
  mockSearchParams.value = new URLSearchParams();
  navigationMocks.refresh.mockClear();
  navigationMocks.go.mockClear();
  vi.spyOn(window.history, "go").mockImplementation(navigationMocks.go);
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      if (fetchInputUrl(input) === API_ROUTES.LIBRARY_CONTEXT_BOOTSTRAP) {
        // Most cases in this file verify the server-seeded shell before the
        // post-paint bootstrap completes. Keep that transport pending unless a
        // test explicitly owns and flushes the bootstrap response.
        return new Promise<Response>(() => undefined);
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    }),
  );
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  sessionStorage.clear();
  useResearchRouteStore.getState().setCurrentView(null, "test-execution:246");
  useLibraryAvailabilityStore.setState({ available: false });
  useLibraryPapersStore.setState({ papers: [] });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ResearchRouteShell", () => {
  it("renders the route search bar above content without top-bar tabs", () => {
    const container = renderShell();

    const searchBar = container.querySelector('[data-testid="research-route-search-bar"]');
    expect(searchBar?.getAttribute("data-user-email")).toBe("test@example.com");
  });

  it("hydrates the current account chrome from the post-paint library bootstrap", async () => {
    let resolveBootstrap: (response: Response) => void = () => undefined;
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      if (fetchInputUrl(input) === API_ROUTES.LIBRARY_CONTEXT_BOOTSTRAP) {
        return new Promise<Response>((resolve) => {
          resolveBootstrap = resolve;
        });
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    });
    const container = renderShell(
      false,
      <div data-testid="research-route-content">content</div>,
      "unavailable",
      false,
    );

    let searchBar = container.querySelector('[data-testid="research-route-search-bar"]');
    expect(searchBar?.getAttribute("data-user-email")).toBe("");

    await act(async () => {
      resolveBootstrap(createLibraryBootstrapResponse());
      await Promise.resolve();
      await Promise.resolve();
    });

    searchBar = container.querySelector('[data-testid="research-route-search-bar"]');
    expect(searchBar?.getAttribute("data-user-email")).toBe("test@example.com");
  });

  it("hides the route search bar on the initial empty search route", () => {
    mockPathname.value = "/search";
    mockSearchParams.value = new URLSearchParams();

    const container = renderShell();

    const contentSlot = container.querySelector('[data-testid="research-route-content-slot"]');
    expect(container.querySelector('[data-testid="research-route-search-bar"]')).toBeNull();
    expect(container.querySelector('[data-testid="research-route-utility-controls"]')).toBeNull();
    expect((contentSlot as HTMLElement).style.minHeight).toBe("100dvh");
    assertCommonFooter(container, "research-route-footer");
  });

  it("provides server-seeded library state to route children", () => {
    mockPathname.value = "/search";
    mockSearchParams.value = new URLSearchParams("personalize=false");

    const container = renderShell(true, <RouteLibraryStateProbe />);

    const probe = container.querySelector('[data-testid="route-library-state-probe"]');
    expect(probe?.getAttribute("data-library-context-available")).toBe("true");
    expect(probe?.hasAttribute("data-personalize")).toBe(false);
  });

  it("shows the Moonlight library access notice when the compatibility path reports denied access", () => {
    const container = renderShell(
      false,
      <div data-testid="research-route-content">content</div>,
      "moonlight_scholar_access_not_allowed",
    );

    const notice = container.querySelector('[data-testid="moonlight-library-access-notice"]');
    expect(notice?.getAttribute("role")).toBe("note");
    expect(notice?.textContent).toContain("Scholar allowlist");
    expect(useLibraryAvailabilityStore.getState().available).toBe(false);
  });
});

describe("ResearchRouteShell Moonlight session handoff", () => {
  it("uses the shared auth surface when the compatibility path rejects the token", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = fetchInputUrl(input);
      if (url === API_ROUTES.LIBRARY_CONTEXT_BOOTSTRAP) {
        return Promise.resolve(
          createLibraryBootstrapResponse("moonlight_scholar_session_invalid", false),
        );
      }
      if (url === MOONLIGHT_TOKEN_URL) {
        return Promise.resolve(
          new Response(JSON.stringify({ token: "fresh-scholar-token" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      }
      if (url === API_ROUTES.AUTH_MOONLIGHT_SCHOLAR_SESSION && init?.method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    });

    renderShell(
      false,
      <div data-testid="research-route-content">content</div>,
      "moonlight_scholar_session_invalid",
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      MOONLIGHT_TOKEN_URL,
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    const [, sessionPostInit] =
      findFetchCall(API_ROUTES.AUTH_MOONLIGHT_SCHOLAR_SESSION, "POST") ?? [];
    expect(sessionPostInit).toMatchObject({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "fresh-scholar-token" }),
    });
    expect(sessionPostInit?.signal).toBeInstanceOf(AbortSignal);
    expect(navigationMocks.go).toHaveBeenCalledWith(0);
    expect(navigationMocks.refresh).not.toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.filter(
        ([input]) => fetchInputUrl(input) === API_ROUTES.LIBRARY_CONTEXT_BOOTSTRAP,
      ),
    ).toHaveLength(1);
    expect(useLibraryAvailabilityStore.getState().available).toBe(false);
  });

  it("clears the stale Moonlight Scholar session when token reissue fails", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = fetchInputUrl(input);
      if (url === API_ROUTES.LIBRARY_CONTEXT_BOOTSTRAP) {
        return Promise.resolve(createLibraryBootstrapResponse("moonlight_scholar_session_invalid"));
      }
      if (url === MOONLIGHT_TOKEN_URL) {
        return Promise.resolve(new Response(null, { status: 401 }));
      }
      if (url === API_ROUTES.AUTH_MOONLIGHT_SCHOLAR_SESSION && init?.method === "DELETE") {
        return Promise.resolve(new Response(null, { status: 200 }));
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    });

    renderShell(
      false,
      <div data-testid="research-route-content">content</div>,
      "moonlight_scholar_session_invalid",
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(
      findFetchCall(API_ROUTES.AUTH_MOONLIGHT_SCHOLAR_SESSION, "DELETE")?.[1]?.signal,
    ).toBeInstanceOf(AbortSignal);
    expect(navigationMocks.go).not.toHaveBeenCalled();
    expect(navigationMocks.refresh).not.toHaveBeenCalled();
  });

  it("does not clear the stale Moonlight Scholar session after aborting handoff on unmount", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = fetchInputUrl(input);
      if (url === API_ROUTES.LIBRARY_CONTEXT_BOOTSTRAP) {
        return Promise.resolve(createLibraryBootstrapResponse("moonlight_scholar_session_invalid"));
      }
      if (url !== MOONLIGHT_TOKEN_URL) {
        return Promise.resolve(new Response(null, { status: 200 }));
      }
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        if (signal?.aborted) {
          reject(new Error("Aborted"));
          return;
        }
        signal?.addEventListener(
          "abort",
          () => {
            reject(new Error("Aborted"));
          },
          { once: true },
        );
      });
    });

    renderShell(
      false,
      <div data-testid="research-route-content">content</div>,
      "moonlight_scholar_session_invalid",
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      root?.unmount();
      root = null;
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(findFetchCall(MOONLIGHT_TOKEN_URL)).toBeDefined();
    expect(findFetchCall(API_ROUTES.AUTH_MOONLIGHT_SCHOLAR_SESSION, "DELETE")).toBeUndefined();
    expect(navigationMocks.refresh).not.toHaveBeenCalled();
  });

  it("falls back after token reissue and stale-session cleanup both fail", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = fetchInputUrl(input);
      if (url === API_ROUTES.LIBRARY_CONTEXT_BOOTSTRAP) {
        return Promise.resolve(createLibraryBootstrapResponse("moonlight_scholar_session_invalid"));
      }
      if (url === MOONLIGHT_TOKEN_URL) {
        return Promise.resolve(new Response(null, { status: 401 }));
      }
      if (url === API_ROUTES.AUTH_MOONLIGHT_SCHOLAR_SESSION && init?.method === "DELETE") {
        return Promise.reject(new Error("cleanup failed"));
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    });

    renderShell(
      false,
      <div data-testid="research-route-content">content</div>,
      "moonlight_scholar_session_invalid",
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      findFetchCall(API_ROUTES.AUTH_MOONLIGHT_SCHOLAR_SESSION, "DELETE")?.[1]?.signal,
    ).toBeInstanceOf(AbortSignal);
    expect(navigationMocks.go).not.toHaveBeenCalled();
    expect(navigationMocks.refresh).not.toHaveBeenCalled();
  });
});

describe("ResearchRouteShell route chrome", () => {
  it("renders a common footer on non-search research routes", () => {
    mockPathname.value = "/citation";

    const container = renderShell();

    expect(container.querySelector('[data-testid="research-route-search-bar"]')).not.toBeNull();
    assertCommonFooter(container, "research-route-footer");
  });

  it("renders a common footer while a query search route is still processing", () => {
    mockPathname.value = "/search";
    mockSearchParams.value = new URLSearchParams("q=graph+retrieval");

    const container = renderShell();

    expect(container.querySelector('[data-testid="research-route-search-bar"]')).not.toBeNull();
    assertCommonFooter(container, "research-route-footer");
  });

  it("owns one common footer after completed search result content", () => {
    const searchDocument = createCompletedSearchView({ sortOption: "relevance" });
    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:528");
    mockPathname.value = "/search";
    mockSearchParams.value = new URLSearchParams("q=graph+retrieval");

    const container = renderShell(
      false,
      <div data-testid="completed-search-results">result content</div>,
    );

    const resultContent = container.querySelector('[data-testid="completed-search-results"]');
    const footer = container.querySelector('[data-testid="research-route-footer"]');
    expect(container.querySelector('[data-testid="search-results-footer-about"]')).toBeNull();
    expect(container.querySelectorAll('[data-testid="research-route-footer"]')).toHaveLength(1);
    expect(container.querySelectorAll("footer")).toHaveLength(1);
    assertCommonFooter(container, "research-route-footer");
    expect(resultContent?.compareDocumentPosition(footer as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it.each([
    ["/search", "q=graph+retrieval&year=%202024%20"],
    ["/search", "q=graph+retrieval&year=2024&year=2023"],
    ["/", "q=graph+retrieval&year=2020abc"],
    ["/citation", "seed=101&seed=102"],
    ["/similar", "seed=101&seed=102"],
  ])("does not bootstrap auth for rejected %s URL %s", (pathname, routeQuery) => {
    const searchDocument = createCompletedSearchView({ yearFilter: "2024" });
    useResearchRouteStore.getState().setCurrentView(searchDocument, "test-execution:stale-year");
    mockPathname.value = pathname;
    mockSearchParams.value = new URLSearchParams(routeQuery);

    assertCommonFooter(renderShell(), "research-route-footer");
    expect(document.querySelector('[data-testid="research-background-tasks"]')).toBeNull();
    expect(findFetchCall(API_ROUTES.LIBRARY_CONTEXT_BOOTSTRAP)).toBeUndefined();
  });

  it("keeps the shared footer below a header-offset content slot during loading states", () => {
    mockPathname.value = "/similar";
    mockSearchParams.value = new URLSearchParams("source=source-1&seed=seed-1");

    const container = renderShell(
      false,
      <div data-testid="research-route-short-loading" aria-busy="true">
        불러오는 중...
      </div>,
    );

    const contentSlot = container.querySelector('[data-testid="research-route-content-slot"]');
    const footer = container.querySelector('[data-testid="research-route-footer"]');
    expect(container.querySelector('[data-testid="research-route-short-loading"]')).not.toBeNull();
    expect(contentSlot).not.toBeNull();
    expect((contentSlot as HTMLElement).style.minHeight).toBe(
      "calc(100dvh - var(--lh-header-offset))",
    );
    expect(contentSlot?.compareDocumentPosition(footer as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("shows keyword activation feedback without replacing the origin content", () => {
    mockPathname.value = "/search";
    mockSearchParams.value = new URLSearchParams("q=agent+memory");
    const container = renderShell(
      false,
      buildSearchFollowupActivation(
        "/search?q=scientific+discovery&entry=term",
        "scientific discovery",
      ),
    );

    const status = container.querySelector('[data-testid="search-followup-activation-status"]');
    const announcer = container.querySelector(
      '[data-testid="search-followup-activation-announcer"]',
    );
    expect(announcer?.getAttribute("role")).toBe("status");
    expect(announcer?.getAttribute("aria-busy")).toBeNull();
    expect(announcer?.classList.contains("sticky")).toBe(true);
    expect(announcer?.classList.contains("top-0")).toBe(true);
    expect(status?.textContent).toContain("‘scientific discovery’ 검색으로 이동 중");
    expect(container.querySelector('[data-testid="research-route-content"]')).not.toBeNull();
  });

  it("clears keyword activation feedback after the destination route arrives", () => {
    mockPathname.value = "/search";
    mockSearchParams.value = new URLSearchParams("q=agent+memory");
    const container = renderShell(
      false,
      buildSearchFollowupActivation(
        "/search?q=scientific+discovery&entry=term",
        "scientific discovery",
      ),
    );
    expect(
      container.querySelector('[data-testid="search-followup-activation-status"]'),
    ).not.toBeNull();

    mockSearchParams.value = new URLSearchParams("q=scientific+discovery&entry=term");
    rerenderShell(false, <div data-testid="research-route-content">destination</div>);

    expect(container.querySelector('[data-testid="search-followup-activation-status"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="search-followup-activation-announcer"]'),
    ).not.toBeNull();
  });

  it("keeps the newest keyword activation when an older destination arrives", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const olderRoute = "/search?q=scientific+discovery&entry=term";
    const newestRoute = "/search?q=research+agents&entry=term";
    mockPathname.value = "/search";
    mockSearchParams.value = new URLSearchParams("q=agent+memory");
    const container = renderShell(
      false,
      buildSearchFollowupActivation(olderRoute, "scientific discovery"),
    );

    rerenderShell(false, buildSearchFollowupActivation(newestRoute, "research agents"));
    expect(
      container.querySelector('[data-testid="search-followup-activation-status"]')?.textContent,
    ).toContain("‘research agents’ 검색으로 이동 중");

    mockSearchParams.value = new URLSearchParams("q=scientific+discovery&entry=term");
    rerenderShell(false, <div data-testid="research-route-content">older destination</div>);
    expect(
      container.querySelector('[data-testid="search-followup-activation-status"]')?.textContent,
    ).toContain("‘research agents’ 검색으로 이동 중");

    mockSearchParams.value = new URLSearchParams("q=research+agents&entry=term");
    rerenderShell(false, <div data-testid="research-route-content">newest destination</div>);
    expect(container.querySelector('[data-testid="search-followup-activation-status"]')).toBeNull();
  });

  it("seeds the library availability store from the compatibility initial prop", () => {
    expect(useLibraryAvailabilityStore.getState().available).toBe(false);

    renderShell(true);

    expect(useLibraryAvailabilityStore.getState().available).toBe(true);
  });

  it("seeds internal reviewed_papers while the initial search route hides the top bar", () => {
    mockPathname.value = "/search";
    mockSearchParams.value = new URLSearchParams();

    const container = renderShell(true);

    expect(useLibraryPapersStore.getState().papers).toEqual([
      expect.objectContaining({
        paperId: "corpus-101",
        title: "Retrieval-Augmented Agents",
        folderName: "Graph Retrieval",
      }),
    ]);
    expect(container.querySelector('[data-testid="research-route-search-bar"]')).toBeNull();
  });

  it("keeps internal reviewed_papers on query routes as the current basis", () => {
    mockPathname.value = "/search";
    mockSearchParams.value = new URLSearchParams("q=graph+retrieval");

    renderShell(true);

    expect(useLibraryPapersStore.getState().papers.map((paper) => paper.paperId)).toEqual([
      "corpus-101",
    ]);
  });

  it("refreshes the internal library list when the server list refreshes", () => {
    mockPathname.value = "/search";
    mockSearchParams.value = new URLSearchParams();

    renderShell(true);
    expect(useLibraryPapersStore.getState().papers.map((paper) => paper.paperId)).toEqual([
      "corpus-101",
    ]);

    mockPathname.value = "/search/search-doc-1";
    mockSearchParams.value = new URLSearchParams();
    rerenderShell(true);

    expect(useLibraryPapersStore.getState().papers.map((paper) => paper.paperId)).toEqual([
      "corpus-101",
      "corpus-202",
    ]);
  });

  it("seeds the internal list from reviewed_papers with explicit keyword basis", () => {
    mockPathname.value = "/search";
    mockSearchParams.value = new URLSearchParams("q=graph+retrieval&personalize=false");

    renderShell(true);

    expect(useLibraryPapersStore.getState().papers.map((paper) => paper.paperId)).toEqual([
      "corpus-101",
    ]);
  });

  it("seeds the internal list from reviewed_papers on keyword-basis routes", () => {
    mockPathname.value = "/search";
    mockSearchParams.value = new URLSearchParams("q=graph+retrieval&personalize=false");

    renderShell(true);

    expect(useLibraryPapersStore.getState().papers.map((paper) => paper.paperId)).toEqual([
      "corpus-101",
    ]);
  });

  it("seeds availability false when the compatibility initial prop has no context", () => {
    useLibraryAvailabilityStore.setState({ available: true });

    renderShell(false);

    expect(useLibraryAvailabilityStore.getState().available).toBe(false);
  });
});
