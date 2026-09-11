import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchRouteShell } from "@/app/(research)/research-route-shell";
import { ResearchRouteLayout } from "@/app/components/research/ResearchRouteLayout";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { useLibraryAvailabilityStore } from "@/app/stores/library-availability-store";
import { useLibraryPapersStore } from "@/app/stores/library-papers-store";
import { API_ROUTES } from "@/app/lib/api-routes";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";

vi.mock("@/app/components/research/ResearchBackgroundTasks", () => ({
  ResearchBackgroundTasks: () => <div data-testid="research-background-tasks" />,
}));

vi.mock("@/app/components/AuthSessionTouch", () => ({
  AuthSessionTouch: () => <div data-testid="auth-session-touch" />,
}));

const authChallengeEvents = vi.hoisted(() => ({
  viewed: vi.fn(),
}));

vi.mock("@/app/lib/track", () => ({
  trackResearchAuthChallengeViewed: authChallengeEvents.viewed,
}));

vi.mock("@/app/components/MoonlightAuthBootstrap", () => {
  function MockMoonlightAuthBootstrap({
    onSessionNavigation,
  }: {
    onSessionNavigation: () => void;
  }) {
    return (
      <button type="button" data-testid="moonlight-auth-bootstrap" onClick={onSessionNavigation}>
        authenticate
      </button>
    );
  }

  return {
    MoonlightAuthBootstrap: MockMoonlightAuthBootstrap,
    refreshLightHouseMoonlightScholarSession: vi.fn(),
  };
});

vi.mock("@/app/components/research/ResearchRouteSearchBar", () => ({
  ResearchRouteSearchBar: () => <div data-testid="document-route-search-bar" />,
}));

const { mockHistoryGo, mockPathname, mockPush, mockSearchParams } = vi.hoisted(() => ({
  mockHistoryGo: vi.fn(),
  mockPathname: { value: "/search" },
  mockPush: vi.fn(),
  mockSearchParams: { value: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname.value,
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
  useSearchParams: () => mockSearchParams.value,
}));

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

function renderInitialSearchShell({
  libraryContextAvailable = true,
  libraryPapers = [
    {
      paperId: "corpus-101",
      title: "Retrieval-Augmented Agents",
      folderName: "Graph Retrieval",
    },
  ],
  userEmail = "test@example.com",
}: {
  libraryContextAvailable?: boolean;
  libraryPapers?: Array<{ paperId: string; title: string; folderName: string }>;
  userEmail?: string;
} = {}) {
  const container = document.createElement("div");
  root = createRoot(container);
  act(() => {
    root?.render(
      <ResearchRouteShell
        userEmail={userEmail}
        libraryContextAvailable={libraryContextAvailable}
        libraryPapers={libraryPapers}
      >
        <ResearchRouteLayout currentView={null} initialSearchEntry renderViewBody={() => null} />
      </ResearchRouteShell>,
    );
  });
  return container;
}

describe("ResearchRouteShell library route context", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    sessionStorage.clear();
    mockPathname.value = "/search";
    mockPush.mockClear();
    authChallengeEvents.viewed.mockClear();
    mockHistoryGo.mockClear();
    vi.spyOn(window.history, "go").mockImplementation(mockHistoryGo);
    mockSearchParams.value = new URLSearchParams();
    useResearchRouteStore.getState().setCurrentView(null, "test-execution:86");
    useLibraryAvailabilityStore.setState({ available: false });
    useLibraryPapersStore.setState({ papers: [] });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => {
      root?.unmount();
    });
    root = null;
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    sessionStorage.clear();
    useResearchRouteStore.getState().setCurrentView(null, "test-execution:102");
    useLibraryAvailabilityStore.setState({ available: false });
    useLibraryPapersStore.setState({ papers: [] });
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("updates empty search submits after the client library availability changes", () => {
    const container = renderInitialSearchShell();
    expect(useLibraryAvailabilityStore.getState().available).toBe(true);

    act(() => {
      useLibraryPapersStore.getState().setPapers([]);
      useLibraryAvailabilityStore.getState().setAvailable(false);
    });

    const queryInput = container.querySelector<HTMLInputElement>(
      '[data-testid="search-view-empty-query-input"]',
    );
    act(() => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      descriptor?.set?.call(queryInput, "agent memory");
      queryInput?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="search-view-empty-submit"]')
        ?.click();
    });

    // After the client library availability dropped, the immediate entry URL
    // carries neither the `lib` flag nor a `personalize` param. The bootstrap
    // fetch may be accompanied by the authenticated session-touch beacon.
    expect(
      vi.mocked(fetch).mock.calls.some(([input]) => input === API_ROUTES.LIBRARY_CONTEXT_BOOTSTRAP),
    ).toBe(true);
    expect(mockPush).toHaveBeenCalledWith("/search?q=agent+memory&entry=empty-entry", {
      scroll: false,
    });
  });

  it("drops retired basis state while library availability is still bootstrapping", () => {
    mockSearchParams.value = new URLSearchParams("personalize=false");
    const container = renderInitialSearchShell({
      libraryContextAvailable: false,
      libraryPapers: [],
    });

    const queryInput = container.querySelector<HTMLInputElement>(
      '[data-testid="search-view-empty-query-input"]',
    );
    act(() => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      descriptor?.set?.call(queryInput, "agent memory");
      queryInput?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="search-view-empty-submit"]')
        ?.click();
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith("/search?q=agent+memory&entry=empty-entry", {
      scroll: false,
    });
  });

  it("seeds library availability and papers from the background bootstrap endpoint", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          userEmail: "confirmed@example.com",
          libraryContextAvailable: true,
          libraryAccessStatus: "available",
          libraryPapers: [
            {
              paperId: "corpus-202",
              title: "Memory Systems for Agents",
              folderName: "Agent Memory",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const container = renderInitialSearchShell({
      libraryContextAvailable: false,
      libraryPapers: [],
    });
    await flushEffects();

    const [requestUrl, requestInit] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(requestUrl).toBe(API_ROUTES.LIBRARY_CONTEXT_BOOTSTRAP);
    expect(requestInit?.signal).toBeInstanceOf(AbortSignal);
    expect(useLibraryAvailabilityStore.getState().available).toBe(true);
    expect(useLibraryPapersStore.getState().papers).toMatchObject([
      {
        paperId: "corpus-202",
        title: "Memory Systems for Agents",
        folderName: "Agent Memory",
      },
    ]);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="research-feature-onboarding-modal-mount"]'),
    ).toBeNull();
  });

  it("replaces stale research state with the auth surface on bootstrap 401", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    let resolveBootstrap: (response: Response) => void = () => undefined;
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveBootstrap = resolve;
        }),
    );

    const container = renderInitialSearchShell({
      libraryContextAvailable: false,
      libraryPapers: [],
      userEmail: "stale@example.com",
    });
    act(() => {
      useResearchRouteStore
        .getState()
        .setCurrentView(createSearchView("stale-auth-view"), "stale-auth-execution");
    });
    await act(async () => {
      resolveBootstrap(new Response(null, { status: 401 }));
      await Promise.resolve();
    });
    await flushEffects();

    expect(useLibraryAvailabilityStore.getState().available).toBe(false);
    expect(useLibraryPapersStore.getState().papers).toEqual([]);
    expect(useResearchRouteStore.getState().currentView).toBeNull();
    expect(container.querySelector('[data-testid="moonlight-auth-bootstrap"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="auth-session-touch"]')).toBeNull();
    expect(container.querySelector('[data-testid="research-background-tasks"]')).toBeNull();
    expect(authChallengeEvents.viewed).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("keeps the research shell on non-auth bootstrap failures", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 503 }));

    const container = renderInitialSearchShell({
      libraryContextAvailable: true,
      libraryPapers: [
        {
          paperId: "stale-paper",
          title: "Stale Library Paper",
          folderName: "Stale Library",
        },
      ],
    });
    await flushEffects();

    expect(container.querySelector('[data-testid="moonlight-auth-bootstrap"]')).toBeNull();
    expect(container.querySelector('[data-testid="research-background-tasks"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="auth-session-touch"]')).toBeNull();
    expect(useLibraryAvailabilityStore.getState().available).toBe(false);
    expect(useLibraryPapersStore.getState().papers).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("reloads the document after the auth surface establishes a session", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 401 }));

    const container = renderInitialSearchShell({
      libraryContextAvailable: false,
      libraryPapers: [],
      userEmail: "stale@example.com",
    });
    await flushEffects();

    const authBootstrap = container.querySelector<HTMLButtonElement>(
      '[data-testid="moonlight-auth-bootstrap"]',
    );
    expect(authBootstrap).not.toBeNull();

    await act(async () => {
      authBootstrap?.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="moonlight-auth-bootstrap"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="auth-session-touch"]')).toBeNull();
    expect(useLibraryAvailabilityStore.getState().available).toBe(false);
    expect(useLibraryPapersStore.getState().papers).toEqual([]);
    expect(mockHistoryGo).toHaveBeenCalledWith(0);
  });
});

function createSearchView(id: string): ResearchRoutePayload {
  return {
    id,
    type: "search",
    title: "Stale authenticated search",
    content: "",
    createdBy: "user",
    metadata: {
      type: "search",
      query: "stale authenticated search",
      papers: [],
      total: 0,
    },
    reaction: null,
    refs: [],
    ownerPrincipalId: "stale-principal",
    status: "ready",
    version: 0,
    reactionVersion: 0,
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
  };
}

async function flushEffects(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}
