import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchRouteSearchBar } from "@/app/components/research/ResearchRouteSearchBar";
import {
  SearchFollowupActivationProvider,
  useSearchFollowupActivation,
} from "@/app/components/research/search-followup-activation";
import {
  DOCUMENT_CONTENT_RAIL_MAX_WIDTH_CLASS,
  RESEARCH_ROUTE_ROUTE_PANEL_MAX_WIDTH_CLASS,
} from "@/app/components/research/research-route-layout.shared";
import { API_ROUTES } from "@/app/lib/api-routes";
import { track } from "@/app/lib/track";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { useLibraryAvailabilityStore } from "@/app/stores/library-availability-store";
import { useLibraryPapersStore } from "@/app/stores/library-papers-store";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import { createMetadata } from "@/app/components/research-route-renderers/__tests__/search-view-content.fixtures";

// Local fixture mirroring the shape of the retired store `createSearchView`
// placeholder. The production placeholder was removed in the route-owned initial
// search migration; this keeps the existing search-bar fixtures valid.
function createSearchView(
  ownerPrincipalId: string,
): Extract<ResearchRoutePayload, { type: "search" }> {
  return {
    id: `search-${crypto.randomUUID()}`,
    type: "search",
    title: "Search",
    content: "",
    createdBy: "user",
    metadata: { type: "search", query: "", papers: [], total: 0 },
    reaction: null,
    refs: [],
    ownerPrincipalId,
    status: "ready",
    version: 0,
    reactionVersion: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function seedActiveSearch(opts: { papers?: number; libraryContextAvailable?: boolean }) {
  const metadata: SearchMetadata = {
    ...createMetadata(opts.papers ?? 3),
    libraryContextAvailable: opts.libraryContextAvailable ?? true,
  };
  const doc: ResearchRoutePayload = { ...createSearchView("principal-1"), metadata };
  useResearchRouteStore.getState().setCurrentView(doc, "test-execution:47");
  return doc;
}

const { mockPathname, mockPush, mockSearchParams } = vi.hoisted(() => ({
  mockPathname: { value: "/search" },
  mockPush: vi.fn(),
  mockSearchParams: { value: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams.value,
}));

vi.mock("@/app/lib/track", () => ({
  track: vi.fn(),
}));

vi.mock("@/app/components/research-route-renderers/SearchView", () => ({
  SearchView: () => null,
}));

const { mockSignOut } = vi.hoisted(() => ({
  mockSignOut: vi.fn(),
}));

vi.mock("@/app/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: mockSignOut,
    },
  }),
}));

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

function RejectionProbe() {
  const { conditionUrlRejected } = useSearchFollowupActivation();
  return <span data-testid="condition-url-rejected">{String(conditionUrlRejected)}</span>;
}

function renderSearchBar(
  userEmail?: string,
  libraryPapers: { paperId: string; title: string; folderName: string }[] = [],
) {
  const container = document.createElement("div");
  root = createRoot(container);
  useLibraryPapersStore.getState().setPapers(libraryPapers);

  act(() => {
    root?.render(
      <SearchFollowupActivationProvider>
        <ResearchRouteSearchBar userEmail={userEmail} libraryPapers={libraryPapers} />
        <RejectionProbe />
      </SearchFollowupActivationProvider>,
    );
  });

  return container;
}

function typeInto(input: HTMLInputElement | null, value: string) {
  if (!input) return;
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function assertActiveSearchViewLibraryPapersOnCanonicalRoute() {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  useLibraryAvailabilityStore.setState({ available: true });
  const metadata: SearchMetadata = {
    ...createMetadata(2),
    query: "agent memory",
    abstractHydration: {
      status: "ready",
      libraryPaperIds: ["corpus-202"],
    },
  };
  const activeView: ResearchRoutePayload = {
    ...createSearchView("principal-1"),
    id: "search-doc-1",
    metadata,
  };
  useResearchRouteStore.getState().setCurrentView(activeView, "test-execution:128");
  mockPathname.value = "/search/search-doc-1";
  mockSearchParams.value = new URLSearchParams();
  const container = renderSearchBar("reader@example.com", [
    {
      paperId: "corpus-101",
      title: "Retrieval-Augmented Agents",
      folderName: "Graph Retrieval",
    },
    { paperId: "corpus-202", title: "Long-Term Memory for Agents", folderName: "Agent Memory" },
  ]);
  const input = container.querySelector<HTMLInputElement>(
    '[data-testid="research-route-search-input"]',
  );
  const submit = container.querySelector<HTMLButtonElement>(
    '[data-testid="research-route-search-submit"]',
  );
  act(() => {
    typeInto(input, "scientific discovery");
  });
  act(() => {
    submit?.click();
  });

  // The entry URL carries only the library flag — never the current route view's
  // hydrated library paper ids — and no placeholder request leaves the client.
  expect(fetchMock).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/search?q=scientific+discovery&lib=1&entry=route-bar", {
    scroll: false,
  });
}

function assertImmediateEntryNavigationOnSubmit() {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  const container = renderSearchBar();
  const input = container.querySelector<HTMLInputElement>(
    '[data-testid="research-route-search-input"]',
  );
  const submit = container.querySelector<HTMLButtonElement>(
    '[data-testid="research-route-search-submit"]',
  );
  const logo = container.querySelector<HTMLImageElement>(
    '[data-testid="research-route-brand-logo"]',
  );

  expect(input).not.toBeNull();
  expect(submit).not.toBeNull();
  expect(logo?.getAttribute("alt")).toBe("Moonlight Search");
  expect(decodeURIComponent(logo?.getAttribute("src") ?? "")).toContain("/brand/scholar-logo.png");
  expect(logo?.className).toContain("h-9");
  expect(logo?.className).toContain("max-w-[12.375rem]");

  act(() => {
    typeInto(input, "graph retrieval");
  });
  act(() => {
    submit?.click();
  });

  // Submit navigates IMMEDIATELY to the `/search?q=` entry route: no client-side result placeholder, no local staged view, no analytics fetch. The server entry
  // route owns the execution, the canonical submit event, and the run.
  expect(fetchMock).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/search?q=graph+retrieval&entry=route-bar", {
    scroll: false,
  });
  expect(
    [useResearchRouteStore.getState().currentView].filter(Boolean) as NonNullable<
      ReturnType<typeof useResearchRouteStore.getState>["currentView"]
    >[],
  ).toHaveLength(0);
  // The shell-scoped activation acknowledges the submit while the destination
  // route is still resolving without taking ownership of provider progress.
  expect(submit?.querySelector('[data-testid="search-navigation-button-spinner"]')).not.toBeNull();
  expect(input?.readOnly).toBe(false);
  expect(submit?.disabled).toBe(true);
  expect(submit?.getAttribute("aria-busy")).toBe("true");
}

async function assertReviewedPapersLibraryListEditsWithoutRouteTransport() {
  const reviewedList = [
    {
      id: "reviewed-1",
      userId: "user-1",
      paperId: "12345",
      title: "Retrieval-Augmented Agents",
      url: "https://example.com/12345",
      authors: [{ name: "Ada" }],
      year: 2024,
      citationCount: 12,
      reviewedAt: "2026-06-29T00:00:00.000Z",
    },
  ];
  const fetchMock = vi.fn((...args: Parameters<typeof fetch>) => {
    const [input, init] = args;
    if (input === API_ROUTES.PAPERS_REVIEWED && init?.method === "DELETE") {
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    }
    if (input === API_ROUTES.PAPERS_REVIEWED) {
      return Promise.resolve(
        new Response(JSON.stringify(reviewedList), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }
    return Promise.resolve(new Response(JSON.stringify({}), { status: 404 }));
  });
  vi.stubGlobal("fetch", fetchMock);
  useLibraryAvailabilityStore.setState({ available: true });
  useResearchRouteStore.getState().setCurrentView(
    {
      status: "ready",
      version: 0,
      reactionVersion: 0,
      id: "search-1",
      type: "search",
      title: "검색: agent memory",
      content: "",
      createdBy: "user",
      metadata: { type: "search", query: "agent memory", papers: [], total: 0 },
      refs: [],
      ownerPrincipalId: "principal-1",
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
      reaction: null,
    },
    "test-execution:236",
  );
  mockSearchParams.value = new URLSearchParams("q=agent+memory");
  const container = renderSearchBar("reader@example.com", [
    {
      paperId: "12345",
      title: "Seeded title",
      folderName: "Seeded folder",
    },
  ]);

  await act(async () => {
    container
      .querySelector<HTMLButtonElement>('[data-testid="research-route-library-menu-button"]')
      ?.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(container.querySelector('[data-testid="research-route-library-menu"]')).not.toBeNull();
  expect(container.textContent).toContain("Retrieval-Augmented Agents");
  expect(container.textContent).toContain("내 라이브러리");

  await act(async () => {
    container
      .querySelector<HTMLButtonElement>('[data-testid="research-route-library-remove"]')
      ?.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  const deleteInit = fetchMock.mock.calls.find(
    ([input, init]) => input === API_ROUTES.PAPERS_REVIEWED && init?.method === "DELETE",
  )?.[1];
  expect(deleteInit?.body).toBe(JSON.stringify({ paperId: "12345" }));
  expect(useLibraryPapersStore.getState().papers).toEqual([]);
  expect(useLibraryAvailabilityStore.getState().available).toBe(false);
  // The global library list has no paper-card rank/search context, so it does
  // not impersonate the search-journey paper_unsaved event.
  expect(track).not.toHaveBeenCalled();

  act(() => {
    container
      .querySelector<HTMLButtonElement>('[data-testid="research-route-search-submit"]')
      ?.click();
  });

  // The route search submit rides no transport at all: it pushes the entry URL
  // immediately, and after removing the last paper the library flag drops out.
  expect(
    fetchMock.mock.calls.every(([requestInput]) => requestInput === API_ROUTES.PAPERS_REVIEWED),
  ).toBe(true);
  expect(mockPush).toHaveBeenCalledWith("/search?q=agent+memory&entry=route-bar", {
    scroll: false,
  });
}

async function assertAuthenticatedLibraryListEntryVisibleWhenEmpty() {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const container = renderSearchBar("reader@example.com");

  await act(async () => {
    container
      .querySelector<HTMLButtonElement>('[data-testid="research-route-library-menu-button"]')
      ?.click();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(fetchMock).toHaveBeenCalledWith(API_ROUTES.PAPERS_REVIEWED);
  expect(container.querySelector('[data-testid="research-route-library-empty"]')?.textContent).toBe(
    "설정된 논문이 없다.",
  );
}

describe("ResearchRouteSearchBar", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
    useLibraryAvailabilityStore.setState({ available: false });
    useLibraryPapersStore.setState(useLibraryPapersStore.getInitialState());
    mockPathname.value = "/search";
    mockSearchParams.value = new URLSearchParams();
    window.history.pushState({}, "", "/search");
    mockPush.mockReset();
    mockSignOut.mockResolvedValue({ error: null });
    mockSignOut.mockClear();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    vi.unstubAllGlobals();
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
    useLibraryAvailabilityStore.setState({ available: false });
    useLibraryPapersStore.setState(useLibraryPapersStore.getInitialState());
    window.history.pushState({}, "", "/search");
  });

  it(
    "navigates immediately to the search entry route on submit",
    assertImmediateEntryNavigationOnSubmit,
  );

  it("does not activate when submitting the exact current entry URL", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockSearchParams.value = new URLSearchParams("q=graph+retrieval&entry=route-bar");
    window.history.pushState({}, "", "/search?q=graph+retrieval&entry=route-bar");
    const container = renderSearchBar();
    const submit = container.querySelector<HTMLButtonElement>(
      '[data-testid="research-route-search-submit"]',
    );

    submit?.click();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/search?q=graph+retrieval&entry=route-bar", {
      scroll: false,
    });
    expect(submit?.disabled).toBe(false);
    expect(submit?.getAttribute("aria-busy")).toBe("false");
    expect(submit?.querySelector('[data-testid="search-navigation-button-spinner"]')).toBeNull();
  });

  it("pushes a new query route while keeping provider processing destination-owned", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockSearchParams.value = new URLSearchParams("q=agent+memory");
    window.history.pushState({}, "", "/search?q=agent%20memory");
    const container = renderSearchBar();
    const input = container.querySelector<HTMLInputElement>(
      '[data-testid="research-route-search-input"]',
    );
    const submit = container.querySelector<HTMLButtonElement>(
      '[data-testid="research-route-search-submit"]',
    );

    act(() => {
      typeInto(input, "scientific discovery");
    });
    act(() => {
      submit?.click();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/search?q=scientific+discovery&entry=route-bar", {
      scroll: false,
    });
    expect(submit?.disabled).toBe(true);
    expect(submit?.getAttribute("aria-busy")).toBe("true");
    expect(
      submit?.querySelector('[data-testid="search-navigation-button-spinner"]'),
    ).not.toBeNull();
  });

  it("rejects raw route-bar overflow before trimming whitespace", () => {
    const container = renderSearchBar();
    const input = container.querySelector<HTMLInputElement>(
      '[data-testid="research-route-search-input"]',
    );
    const submit = container.querySelector<HTMLButtonElement>(
      '[data-testid="research-route-search-submit"]',
    );

    act(() => {
      typeInto(input, `${" ".repeat(9_000)}query`);
    });
    act(() => {
      submit?.click();
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="condition-url-rejected"]')?.textContent).toBe(
      "true",
    );
  });

  it("clears the route-bar button activation when navigation throws synchronously", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const container = renderSearchBar();
    const input = container.querySelector<HTMLInputElement>(
      '[data-testid="research-route-search-input"]',
    );
    const submit = container.querySelector<HTMLButtonElement>(
      '[data-testid="research-route-search-submit"]',
    );
    act(() => {
      typeInto(input, "scientific discovery");
    });
    mockPush.mockImplementationOnce(() => {
      throw new Error("navigation failed");
    });

    act(() => {
      submit?.click();
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[research-route-search] navigation failed:",
      expect.objectContaining({ message: "navigation failed" }),
    );
    expect(submit?.disabled).toBe(false);
    expect(submit?.getAttribute("aria-busy")).toBe("false");
    expect(submit?.querySelector('[data-testid="search-navigation-button-spinner"]')).toBeNull();
    consoleError.mockRestore();
  });

  it("links the top-bar brand mark to the search home", () => {
    const container = renderSearchBar();
    const logo = container.querySelector('[data-testid="research-route-brand-logo"]');
    const homeLink = container.querySelector<HTMLAnchorElement>(
      '[data-testid="research-route-brand-home-link"]',
    );

    expect(homeLink).not.toBeNull();
    expect(homeLink?.getAttribute("href")).toBe("/");
    expect(homeLink?.contains(logo ?? null)).toBe(true);
  });

  it.each(["/search", "/"])(
    "uses URL query as the input source of truth on the search route",
    (pathname) => {
      mockPathname.value = pathname;
      mockSearchParams.value = new URLSearchParams("q=retrieval+agents");
      const search = createSearchView("principal-1");
      useResearchRouteStore.getState().setCurrentView(search, "test-execution:431");
      const container = renderSearchBar();
      const input = container.querySelector<HTMLInputElement>(
        '[data-testid="research-route-search-input"]',
      );

      expect(input?.value).toBe("retrieval agents");
    },
  );

  it("centers the route command rail and keeps the input on the content rail", () => {
    const container = renderSearchBar("reader@example.com");
    const rail = container.querySelector<HTMLElement>('[data-testid="research-route-search-rail"]');
    const inputColumn = container.querySelector<HTMLElement>(
      '[data-testid="research-route-search-input-column"]',
    );
    const account = container.querySelector<HTMLElement>(
      '[data-testid="research-route-current-account"]',
    );
    const logo = container.querySelector<HTMLImageElement>(
      '[data-testid="research-route-brand-logo"]',
    );

    expect(rail).not.toBeNull();
    expect(rail?.className).toContain(RESEARCH_ROUTE_ROUTE_PANEL_MAX_WIDTH_CLASS);
    expect(rail?.className).toContain("sm:items-center");
    expect(rail?.className).toContain("mx-auto");
    expect(rail?.className).toContain("sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]");
    expect(inputColumn?.className).toContain(DOCUMENT_CONTENT_RAIL_MAX_WIDTH_CLASS);
    expect(inputColumn?.className).toContain("justify-self-center");
    expect(inputColumn?.className).toContain("w-full");
    expect(logo?.parentElement?.className).not.toContain("pt-");
    expect(account?.textContent).toContain("reader@example.com");
    expect(account?.textContent).toContain("로그아웃");
    expect(account?.textContent).not.toContain("온보딩");
    expect(account?.querySelector('[data-testid="research-route-onboarding-open"]')).toBeNull();
    expect(account?.textContent).not.toContain("현재 계정");
    expect(account?.className).toContain("justify-self-end");
    expect(account?.className).not.toContain("bg-surface-panel");
    expect(account?.className).not.toContain("border");
  });

  it("keeps the route command row as a search-and-account layout", () => {
    const container = renderSearchBar("reader@example.com", [
      {
        paperId: "corpus-101",
        title: "Retrieval-Augmented Agents",
        folderName: "Graph Retrieval",
      },
      { paperId: "corpus-202", title: "Long-Term Memory for Agents", folderName: "Agent Memory" },
    ]);

    const inputFrame = container.querySelector('[data-testid="research-route-search-input-frame"]');
    const account = container.querySelector<HTMLElement>(
      '[data-testid="research-route-current-account"]',
    );
    expect(inputFrame).not.toBeNull();
    expect(account).not.toBeNull();
    expect(
      (inputFrame?.compareDocumentPosition(account ?? inputFrame) ?? 0) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it(
    "shows and edits the reviewed papers library list without route search transport",
    assertReviewedPapersLibraryListEditsWithoutRouteTransport,
  );

  it(
    "keeps the authenticated library list entry visible when no papers are saved",
    assertAuthenticatedLibraryListEntryVisibleWhenEmpty,
  );

  it("builds the next route search from current library availability", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockSearchParams.value = new URLSearchParams("q=agent+memory");
    const container = renderSearchBar("reader@example.com", [
      {
        paperId: "corpus-101",
        title: "Retrieval-Augmented Agents",
        folderName: "Graph Retrieval",
      },
      { paperId: "corpus-202", title: "Long-Term Memory for Agents", folderName: "Agent Memory" },
    ]);
    const submit = container.querySelector<HTMLButtonElement>(
      '[data-testid="research-route-search-submit"]',
    );

    act(() => {
      submit?.click();
    });

    // The exact entry URL proves no library paper ids, no personalize param,
    // and no lib flag ride the next route search; no client-side placeholder POST fires.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/search?q=agent+memory&entry=route-bar", {
      scroll: false,
    });
  });

  it("submits the route search without a result-basis parameter", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockSearchParams.value = new URLSearchParams("q=agent+memory");
    const container = renderSearchBar("reader@example.com", [
      {
        paperId: "corpus-101",
        title: "Retrieval-Augmented Agents",
        folderName: "Graph Retrieval",
      },
      { paperId: "corpus-202", title: "Long-Term Memory for Agents", folderName: "Agent Memory" },
    ]);
    const input = container.querySelector<HTMLInputElement>(
      '[data-testid="research-route-search-input"]',
    );
    const submit = container.querySelector<HTMLButtonElement>(
      '[data-testid="research-route-search-submit"]',
    );
    act(() => {
      typeInto(input, "scientific discovery");
    });
    act(() => {
      submit?.click();
    });

    // The entry URL is built from the current route query and personalize state, and the
    // submit stays a pure navigation without any reserve transport.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/search?q=scientific+discovery&entry=route-bar", {
      scroll: false,
    });
  });

  it("drops retired basis state before library availability is known", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockSearchParams.value = new URLSearchParams("q=agent+memory&personalize=false");
    const container = renderSearchBar("reader@example.com", []);
    const submit = container.querySelector<HTMLButtonElement>(
      '[data-testid="research-route-search-submit"]',
    );

    act(() => {
      submit?.click();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/search?q=agent+memory&entry=route-bar", {
      scroll: false,
    });
  });

  it(
    "does not use active search ResearchRoutePayload library papers on canonical document routes",
    assertActiveSearchViewLibraryPapersOnCanonicalRoute,
  );

  it("signs out from the route command account controls", async () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    const container = renderSearchBar("reader@example.com");
    const account = container.querySelector<HTMLElement>(
      '[data-testid="research-route-current-account"]',
    );
    const signOut = container.querySelector<HTMLButtonElement>(
      '[data-testid="research-route-sign-out"]',
    );

    expect(account?.textContent).toContain("reader@example.com");
    expect(account?.textContent).not.toContain("현재 계정");
    expect(signOut).not.toBeNull();

    await act(async () => {
      signOut?.click();
      await Promise.resolve();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/moonlight-scholar/session", {
      method: "DELETE",
    });
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("keeps the route command input focused on search conditions", () => {
    seedActiveSearch({ papers: 3, libraryContextAvailable: true });
    useLibraryAvailabilityStore.setState({ available: true });
    mockSearchParams.value = new URLSearchParams("q=agentic+science");
    const container = renderSearchBar();

    expect(container.querySelector('[data-testid="research-route-personalize-row"]')).toBeNull();
    expect(container.querySelector('[data-testid="search-personalize-toggle"]')).toBeNull();
    const inputFrame = container.querySelector('[data-testid="research-route-search-input-frame"]');
    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-input-personalize-toggle"]',
    );
    expect(inputFrame).not.toBeNull();
    expect(toggle).toBeNull();
  });
});
