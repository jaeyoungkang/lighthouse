import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchViewEmptyState } from "@/app/components/research-route-renderers/search-view-states";
import { useLibraryPapersStore } from "@/app/stores/library-papers-store";

const { mockSearchParams } = vi.hoisted(() => ({
  mockSearchParams: { value: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => mockSearchParams.value,
}));

afterEach(() => {
  mockSearchParams.value = new URLSearchParams();
  useLibraryPapersStore.setState({ papers: [] });
});

describe("SearchViewEmptyState route-owned search input", () => {
  it("keeps selected-paper basis controls out of the empty search input", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
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
      root.render(<SearchViewEmptyState isError={false} libraryContextAvailable personalize />);
    });

    expect(container.querySelector('[data-testid="search-view-empty-query-input"]')).not.toBe(null);
    expect(container.querySelector('[data-testid="search-view-empty-personalize-row"]')).toBe(null);
    expect(container.querySelector('[data-testid="search-input-personalize-toggle"]')).toBeNull();

    act(() => {
      root.unmount();
    });
  });

  it("uses condition URL execution for the empty search input", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    mockSearchParams.value = new URLSearchParams();
    useLibraryPapersStore.setState({
      papers: [
        {
          paperId: "corpus-101",
          title: "Retrieval-Augmented Agents",
          folderName: "Graph Retrieval",
        },
      ],
    });

    act(() => {
      root.render(<SearchViewEmptyState isError={false} libraryContextAvailable personalize />);
    });

    expect(container.querySelector('[data-testid="search-view-empty-query-input"]')).not.toBe(null);
    expect(container.querySelector('[data-testid="search-view-empty-personalize-row"]')).toBe(null);
    expect(container.querySelector('[data-testid="search-input-personalize-toggle"]')).toBeNull();

    act(() => {
      root.unmount();
    });
  });
});
