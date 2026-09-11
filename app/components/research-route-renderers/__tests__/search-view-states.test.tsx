import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchView } from "@/app/components/research-route-renderers/SearchView";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { createMetadata } from "./search-view-content.fixtures";

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  useSearchParams: () => new URLSearchParams("q=graph+retrieval"),
}));

function failedSearchView(): ResearchRoutePayload {
  return {
    id: "search-ephemeral-failed",
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
    status: "failed",
    version: 0,
    reactionVersion: 0,
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z",
  };
}

function readySearchView(): ResearchRoutePayload {
  const metadata = createMetadata(3);
  return {
    id: "search-ephemeral-ready",
    type: "search",
    title: "검색: graph retrieval",
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
  };
}

function emptyResultSearchView(): ResearchRoutePayload {
  const view = readySearchView();
  if (view.type !== "search") {
    throw new Error("expected a search fixture");
  }
  return {
    ...view,
    id: "search-ephemeral-empty-results",
    metadata: {
      ...view.metadata,
      papers: [],
      total: 0,
      totalMode: "exact",
    },
  };
}

function pendingSearchView(): ResearchRoutePayload {
  return {
    id: "search-ephemeral-pending",
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
    ownerPrincipalId: "anonymous",
    status: "pending",
    version: 0,
    reactionVersion: 0,
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z",
  };
}

function createFetchMockWithGapReport(gapReportId: string) {
  return vi.fn<typeof fetch>((input) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url === "/api/gap-reports") {
      return Promise.resolve(
        new Response(JSON.stringify({ gapReportId, status: "pending" }), {
          status: 202,
        }),
      );
    }
    return Promise.resolve(new Response(null, { status: 204 }));
  });
}

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

function renderFailedSearch() {
  const container = document.createElement("div");
  root = createRoot(container);
  act(() => {
    root?.render(<SearchView document={failedSearchView()} />);
  });
  return container;
}

describe("search ResearchRoutePayload degraded states", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    pushMock.mockClear();
    refreshMock.mockClear();
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the degraded search failure state with a retry at the same URL", () => {
    const container = renderFailedSearch();

    expect(container.querySelector('[data-testid="search-view-degraded-failure"]')).not.toBe(null);
    expect(container.textContent).toContain("graph retrieval");
    expect(container.querySelector('[data-testid="search-view-degraded-retry"]')).not.toBe(null);
    expect(container.querySelector('[data-testid="search-view-no-results"]')).toBeNull();
  });

  it("renders a query pending route as processing instead of zero-result search output", () => {
    const container = document.createElement("div");
    root = createRoot(container);
    act(() => {
      root?.render(<SearchView document={pendingSearchView()} />);
    });

    const processingState = container.querySelector('[data-testid="search-view-processing-state"]');
    expect(processingState).not.toBeNull();
    expect(processingState?.getAttribute("role")).toBe("status");
    expect(processingState?.className).toContain("min-h-[54vh]");
    expect(container.querySelector('[data-testid="search-results-header"]')).toBeNull();
    expect(container.querySelector('[data-testid="search-results-list-column"]')).toBeNull();
    expect(container.querySelector('[data-testid="search-results-footer-about"]')).toBeNull();
    expect(container.querySelector('[data-testid="search-view-empty-state"]')).toBeNull();
    expect(container.textContent).not.toContain("0");
  });

  it("distinguishes a successful zero-result search from provider failure", () => {
    const container = document.createElement("div");
    root = createRoot(container);
    act(() => {
      root?.render(<SearchView document={emptyResultSearchView()} />);
    });

    expect(container.querySelector('[data-testid="search-view-no-results"]')).not.toBeNull();
    expect(container.textContent).toContain("검색 결과가 없습니다");
    expect(container.textContent).toContain("검색어나 필터를 바꾸고");
    expect(container.querySelector('[data-testid="search-view-degraded-failure"]')).toBeNull();
    expect(container.querySelector('[data-testid="search-view-degraded-retry"]')).toBeNull();
  });

  it("re-runs the same query when the failure retry is clicked", () => {
    const container = renderFailedSearch();

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="search-view-degraded-retry"]')
        ?.click();
    });

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("pushes the requery route without staging an origin transition", () => {
    window.history.pushState({}, "", "/search?q=agent+memory");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    const container = document.createElement("div");
    root = createRoot(container);
    act(() => {
      root?.render(<SearchView document={readySearchView()} />);
    });

    const dateRange = container.querySelector<HTMLElement>(
      '[data-testid="search-facet-dateRange"]',
    );
    const summary = dateRange?.querySelector("summary");
    if (!summary) {
      throw new Error("expected date range control");
    }
    act(() => {
      summary.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="search-submit-button"]')
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(pushMock).toHaveBeenCalledWith("/search?q=agent+memory&entry=requery", {
      scroll: false,
    });
  });

  it("opens gap analysis in a detached window without replacing the current search route", async () => {
    const fetchMock = createFetchMockWithGapReport("gap-report-1");
    vi.stubGlobal("fetch", fetchMock);
    const detachedWindow = {
      close: vi.fn(),
      location: { assign: vi.fn() },
      opener: window,
    } as unknown as Window & {
      location: { assign: ReturnType<typeof vi.fn> };
    };
    const openSpy = vi.spyOn(window, "open").mockReturnValue(detachedWindow);

    const container = document.createElement("div");
    root = createRoot(container);
    act(() => {
      root?.render(<SearchView document={readySearchView()} />);
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="search-results-gap-network-action"]')
        ?.click();
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });

    expect(openSpy).toHaveBeenCalledWith("/gap?opening=1", "_blank");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/gap-reports",
      expect.objectContaining({ method: "POST" }),
    );
    expect(detachedWindow.location.assign).toHaveBeenCalledWith("/gap/gap-report-1");
    expect(pushMock).not.toHaveBeenCalledWith("/gap/gap-report-1");
  });

  it("continues the detached gap handoff after the source search view unmounts", async () => {
    let resolveGapRequest: ((response: Response) => void) | undefined;
    const gapRequest = new Promise<Response>((resolve) => {
      resolveGapRequest = resolve;
    });
    const fetchMock = vi.fn<typeof fetch>(() => gapRequest);
    vi.stubGlobal("fetch", fetchMock);
    const closeMock = vi.fn();
    const detachedWindow = {
      close: closeMock,
      location: { assign: vi.fn() },
      opener: window,
    } as unknown as Window & {
      location: { assign: ReturnType<typeof vi.fn> };
    };
    vi.spyOn(window, "open").mockReturnValue(detachedWindow);

    const container = document.createElement("div");
    root = createRoot(container);
    act(() => {
      root?.render(<SearchView document={readySearchView()} />);
    });

    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="search-results-gap-network-action"]')
        ?.click();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/gap-reports",
      expect.objectContaining({ method: "POST" }),
    );

    act(() => {
      root?.unmount();
    });
    root = null;

    resolveGapRequest?.(
      new Response(JSON.stringify({ gapReportId: "gap-report-after-unmount" }), {
        status: 202,
      }),
    );

    await vi.waitFor(() => {
      expect(detachedWindow.location.assign).toHaveBeenCalledWith("/gap/gap-report-after-unmount");
    });
    expect(closeMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalledWith("/gap/gap-report-after-unmount");
  });
});
