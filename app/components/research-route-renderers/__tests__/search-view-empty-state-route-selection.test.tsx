import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { SearchViewEmptyState } from "@/app/components/research-route-renderers/search-view-content";
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

vi.mock("@/app/components/research-route-renderers/SearchView", () => ({
  SearchView: () => null,
}));

// Submitting the empty state navigates IMMEDIATELY to the `/search?q=` entry
// URL; the destination route executes from the URL and renders an ephemeral
// search result at the same condition URL.
function submitEmptyStateQuery(container: HTMLElement, query: string) {
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
  useLibraryPapersStore.setState({ papers: [] });
  vi.unstubAllGlobals();
});

it("preserves internal library basis without committing selected paper ids", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  mockPathname.value = "/search/search-doc-1";
  useLibraryPapersStore.setState({
    papers: [
      {
        paperId: "corpus-101",
        title: "Retrieval-Augmented Agents",
        folderName: "Graph Retrieval",
      },
      { paperId: "corpus-202", title: "Long-Term Memory for Agents", folderName: "Memory" },
    ],
  });
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  act(() => {
    root.render(<SearchViewEmptyState isError={false} libraryContextAvailable personalize />);
  });

  submitEmptyStateQuery(container, "agent memory");

  // The exact entry URL preserves known library availability (`lib=1`) without
  // committing any selected paper ids or a retired basis preference,
  // and no client-side placeholder POST fires — navigation is immediate.
  expect(fetchMock).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/search?q=agent+memory&lib=1&entry=empty-entry", {
    scroll: false,
  });

  act(() => {
    root.unmount();
  });
});

it("drops retired basis state without selected paper ids", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  act(() => {
    root.render(
      <SearchViewEmptyState isError={false} libraryContextAvailable={true} personalize={false} />,
    );
  });

  submitEmptyStateQuery(container, "keyword only");

  // The immediate entry URL keeps availability but has no selectable basis.
  expect(fetchMock).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/search?q=keyword+only&lib=1&entry=empty-entry", {
    scroll: false,
  });

  act(() => {
    root.unmount();
  });
});

it("drops retired basis state before library availability is known", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  act(() => {
    root.render(
      <SearchViewEmptyState isError={false} libraryContextAvailable={false} personalize={false} />,
    );
  });

  submitEmptyStateQuery(container, "keyword only");

  expect(fetchMock).not.toHaveBeenCalled();
  expect(mockPush).toHaveBeenCalledWith("/search?q=keyword+only&entry=empty-entry", {
    scroll: false,
  });

  act(() => {
    root.unmount();
  });
});

it("rejects raw query overflow before trimming whitespace", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(
      <SearchViewEmptyState isError={false} libraryContextAvailable={false} personalize />,
    );
  });

  submitEmptyStateQuery(container, `${"a".repeat(1024)} `);

  expect(mockPush).not.toHaveBeenCalled();
  act(() => {
    root.unmount();
  });
});

it("does not submit a blank query", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => {
    root.render(
      <SearchViewEmptyState isError={false} libraryContextAvailable={false} personalize />,
    );
  });

  submitEmptyStateQuery(container, "   ");

  expect(mockPush).not.toHaveBeenCalled();
  expect(
    container.querySelector<HTMLButtonElement>('[data-testid="search-view-empty-submit"]')
      ?.disabled,
  ).toBe(true);
  act(() => {
    root.unmount();
  });
});

it("preserves sort, year, and facet conditions in the immediate route", () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  mockSearchParams.value = new URLSearchParams([
    ["sort", "year"],
    ["year", "2020-2024"],
    ["field", "Computer Science"],
    ["author", "Ada Lovelace"],
    ["venue", "NeurIPS"],
    ["hasPdf", "true"],
  ]);
  act(() => {
    root.render(<SearchViewEmptyState isError={false} libraryContextAvailable personalize />);
  });

  submitEmptyStateQuery(container, "graph agents");

  expect(mockPush).toHaveBeenCalledTimes(1);
  const [route, options] = mockPush.mock.calls[0] as [string, { scroll: boolean }];
  const destination = new URL(route, "https://lighthouse.example.com");
  expect(destination.pathname).toBe("/search");
  expect(Object.fromEntries(destination.searchParams)).toEqual({
    q: "graph agents",
    sort: "year",
    year: "2020-2024",
    field: "Computer Science",
    author: "Ada Lovelace",
    venue: "NeurIPS",
    hasPdf: "true",
    lib: "1",
    entry: "empty-entry",
  });
  expect(options).toEqual({ scroll: false });
  act(() => {
    root.unmount();
  });
});
