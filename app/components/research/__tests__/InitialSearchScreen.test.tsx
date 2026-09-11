import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InitialSearchScreen } from "@/app/components/research/InitialSearchScreen";
import { useLibraryAvailabilityStore } from "@/app/stores/library-availability-store";
import { useLibraryPapersStore } from "@/app/stores/library-papers-store";

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

// Submitting the initial search input navigates IMMEDIATELY to the `/search?q=`
// entry URL; the destination route executes from the URL and renders an
// ephemeral route-owned search result.
function submitInitialQuery(container: HTMLElement, query: string) {
  const queryInput = container.querySelector<HTMLInputElement>(
    '[data-testid="search-view-empty-query-input"]',
  );
  act(() => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    descriptor?.set?.call(queryInput, query);
    queryInput?.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => {
    container.querySelector<HTMLButtonElement>('[data-testid="search-view-empty-submit"]')?.click();
  });
}

afterEach(() => {
  mockPathname.value = "/search";
  mockPush.mockClear();
  mockSearchParams.value = new URLSearchParams();
  useLibraryAvailabilityStore.setState({ available: false });
  useLibraryPapersStore.setState({ papers: [] });
  vi.unstubAllGlobals();
});

describe("InitialSearchScreen", () => {
  // The empty `/search` start screen is route-owned — it renders the centered
  // initial search entry with no store document and reserves no inline reaction
  // surface. @check acceptance-check:route-view-ai-comment-inline-surface-exempt-initial-search-and-gap-network
  it("renders the route-owned centered initial search screen without an inline reaction surface", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(<InitialSearchScreen libraryContextAvailable personalize />);
    });

    const screen = container.querySelector('[data-testid="initial-search-screen"]');
    expect(screen).not.toBeNull();
    expect(container.querySelector('[data-testid="search-view-empty-state"]')).not.toBeNull();
    // No expected AI comment exists on the start screen, so no reaction surface
    // is reserved.
    expect(container.querySelector('[data-testid="research-route-inline-reaction"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="research-route-inline-reaction-content"]'),
    ).toBeNull();
    // Centered bounded initial rail at the initial-search width.
    expect(screen?.className).toContain("mx-auto");
    expect(screen?.className).toContain("lg:grid-cols-[minmax(0,1fr)]");
    expect(screen?.className).toContain("lg:max-w-[1180px]");
    expect(screen?.className).not.toContain("lg:max-w-[1740px]");

    act(() => {
      root.unmount();
    });
  });

  // @check acceptance-check:search-results-fast-window-result-basis-visible
  it("renders the initial search as a condition URL input", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    useLibraryAvailabilityStore.setState({ available: true });
    useLibraryPapersStore.setState({
      papers: [
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
      ],
    });

    act(() => {
      root.render(<InitialSearchScreen />);
    });

    expect(container.querySelector('[data-testid="search-view-empty-query-input"]')).not.toBe(null);
    expect(container.querySelector('[data-testid="search-view-empty-personalize-row"]')).toBe(null);
    expect(container.querySelector('[data-testid="search-input-personalize-toggle"]')).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  // @check acceptance-check:research-route-cap-feedback-route-search-visible
  it("navigates immediately to the search entry route on submit", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    useLibraryAvailabilityStore.setState({ available: true });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    act(() => {
      root.render(<InitialSearchScreen libraryContextAvailable personalize />);
    });

    submitInitialQuery(container, "agent memory");

    // No client-side result placeholder is created. The destination `/search?q=` route owns
    // execution, and the entry URL carries the library flag but never the
    // reviewed_papers list.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/search?q=agent+memory&lib=1&entry=empty-entry", {
      scroll: false,
    });

    act(() => {
      root.unmount();
    });
  });

  it("builds the first search without a result-basis parameter", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    useLibraryAvailabilityStore.setState({ available: true });
    useLibraryPapersStore.setState({
      papers: [
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
      ],
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    act(() => {
      root.render(<InitialSearchScreen libraryContextAvailable personalize />);
    });

    submitInitialQuery(container, "agent memory");

    // The exact entry URL proves the first search carries the query, the
    // library flag, without a retired result-basis parameter
    // without any seeded library paper ids; no client-side result placeholder is created.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/search?q=agent+memory&lib=1&entry=empty-entry", {
      scroll: false,
    });

    act(() => {
      root.unmount();
    });
  });
});
