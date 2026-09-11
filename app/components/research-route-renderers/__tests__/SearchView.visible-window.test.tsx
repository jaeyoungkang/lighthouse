import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import {
  SearchView,
  buildSearchViewViewKey,
} from "@/app/components/research-route-renderers/SearchView";
import { buildInlineAnalysisCycleKey } from "@/app/lib/inline-analysis";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

let root: Root | null = null;

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
const previousIntersectionObserver = globalThis.IntersectionObserver;
let intersectionCallbacks: IntersectionObserverCallback[] = [];

function createMetadata(paperCount: number, query = "agent memory"): SearchMetadata {
  return {
    type: "search",
    query,
    total: paperCount,
    papers: Array.from({ length: paperCount }, (_, index) => ({
      paperId: `${query.replace(/\s+/g, "-")}-paper-${String(index + 1)}`,
      title: `${query} paper ${String(index + 1)}`,
      abstract: `abstract ${String(index + 1)}`,
      year: 2024,
      citationCount: 100 - index,
      url: `https://example.com/${String(index + 1)}`,
      authors: [{ name: "Alice" }],
      openAccessPdf: { url: `https://example.com/${String(index + 1)}.pdf` },
      doi: null,
      referenceIds: null,
      citationIds: null,
    })),
  };
}

function createSearchView(
  metadata: SearchMetadata,
  updatedAt = "2026-05-07T00:00:00.000Z",
): ResearchRoutePayload {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-1",
    type: "search",
    title: `검색: ${metadata.query}`,
    content: "# 검색 결과",
    createdBy: "user",
    metadata,
    reaction: null,
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-05-07T00:00:00.000Z",
    updatedAt,
  };
}

function createStablePaperMetadata(paperIds: readonly string[]): SearchMetadata {
  return {
    type: "search",
    query: "agent memory",
    total: paperIds.length,
    papers: paperIds.map((paperId, index) => ({
      paperId,
      title: `Stable paper ${String(index + 1)}`,
      abstract: `stable abstract ${String(index + 1)}`,
      year: 2024,
      citationCount: 100 - index,
      url: `https://example.com/${paperId}`,
      authors: [{ name: "Alice" }],
      openAccessPdf: { url: `https://example.com/${paperId}.pdf` },
      doi: null,
      referenceIds: null,
      citationIds: null,
    })),
  };
}

function mountSearchView(document: ResearchRoutePayload) {
  if (!useResearchRouteStore.getState().activeExecutionId) {
    useResearchRouteStore.getState().setCurrentView(document, `test:${document.id}`);
  }
  const container = globalThis.document.createElement("div");
  root = createRoot(container);
  act(() => {
    root?.render(<SearchView document={document} />);
  });
  return container;
}

function unmountSearchView() {
  act(() => {
    root?.unmount();
  });
  root = null;
}

describe("SearchView visible result window", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    intersectionCallbacks = [];
    globalThis.IntersectionObserver = class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallbacks.push(callback);
      }

      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = "";
      thresholds = [];
    };
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
    mockPush.mockReset();
  });

  afterEach(() => {
    unmountSearchView();
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    globalThis.IntersectionObserver = previousIntersectionObserver;
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
  });

  it("advances the load-more window by ten and stops at the total result count", () => {
    const container = mountSearchView(createSearchView(createMetadata(25)));

    expect(container.textContent).toContain("agent memory paper 10");
    expect(container.textContent).not.toContain("agent memory paper 11");
    expect(container.textContent).toContain("더보기 (10/25)");

    const firstLoadMore = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("더보기 (10/25)"),
    );
    if (!firstLoadMore) throw new Error("expected first load-more button");
    act(() => {
      firstLoadMore.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("agent memory paper 20");
    expect(container.textContent).not.toContain("agent memory paper 21");
    expect(container.textContent).toContain("더보기 (20/25)");

    const secondLoadMore = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("더보기 (20/25)"),
    );
    if (!secondLoadMore) throw new Error("expected second load-more button");
    act(() => {
      secondLoadMore.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("agent memory paper 25");
    expect(container.textContent).not.toContain("더보기 (");
  });

  it("keeps the expanded result window after the search ResearchRoutePayload remounts", () => {
    const searchDocument = createSearchView(createMetadata(12));
    let container = mountSearchView(searchDocument);
    const loadMore = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("더보기 (10/12)"),
    );

    if (!loadMore) {
      throw new Error("expected load-more button");
    }

    act(() => {
      loadMore.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("agent memory paper 12");
    expect(container.textContent).not.toContain("더보기 (10/12)");

    unmountSearchView();
    container = mountSearchView(searchDocument);

    expect(container.textContent).toContain("agent memory paper 12");
    expect(container.textContent).not.toContain("더보기 (10/12)");
  });

  it("keeps the view key stable for background enrichment of the same result set", () => {
    const metadata = createStablePaperMetadata(["paper-1", "paper-2", "paper-3"]);
    const enrichedMetadata: SearchMetadata = {
      ...metadata,
      abstractHydration: {
        status: "ready" as const,
        libraryPaperIds: ["paper-1"],
      },
    };
    const initialDocument = createSearchView(metadata);
    const enrichedDocument = {
      ...createSearchView(enrichedMetadata, "2026-05-07T00:02:00.000Z"),
      version: initialDocument.version + 1,
    };

    expect(buildSearchViewViewKey(enrichedDocument, enrichedMetadata)).toBe(
      buildSearchViewViewKey(initialDocument, metadata),
    );
  });

  it("changes the view key when a new result set replaces the search ResearchRoutePayload", () => {
    const initialMetadata = createStablePaperMetadata(["paper-1", "paper-2", "paper-3"]);
    const nextMetadata = createStablePaperMetadata(["paper-3", "paper-4", "paper-5"]);
    const initialDocument = createSearchView(initialMetadata);
    const nextDocument = createSearchView(nextMetadata, "2026-05-07T00:03:00.000Z");

    expect(buildSearchViewViewKey(nextDocument, nextMetadata)).not.toBe(
      buildSearchViewViewKey(initialDocument, initialMetadata),
    );
  });

  it("rejects raw result requery overflow before trimming whitespace", () => {
    const rawQuery = `${" ".repeat(9_000)}agent memory`;
    const container = mountSearchView(createSearchView(createMetadata(1, rawQuery)));
    const sort = container.querySelector<HTMLSelectElement>("select");
    if (!sort) throw new Error("expected result sort control");

    act(() => {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
      descriptor?.set?.call(sort, "citationCount");
      sort.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("resets the visible window when a new result batch replaces the search ResearchRoutePayload", () => {
    const initialDocument = createSearchView(createMetadata(12, "agent memory"));
    const nextDocument = createSearchView(
      createMetadata(12, "retrieval memory"),
      "2026-05-07T00:01:00.000Z",
    );
    const container = mountSearchView(initialDocument);
    const loadMore = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("더보기 (10/12)"),
    );

    if (!loadMore) {
      throw new Error("expected load-more button");
    }

    act(() => {
      loadMore.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      root?.render(<SearchView document={nextDocument} />);
    });

    expect(container.textContent).toContain("더보기 (10/12)");
    expect(container.textContent).toContain("retrieval memory paper 10");
    expect(container.textContent).not.toContain("retrieval memory paper 11");
  });

  it("does not carry exposed paper ids into a new inline-analysis cycle", async () => {
    const initialMetadata = createStablePaperMetadata(["paper-1", "paper-2", "paper-3"]);
    const nextMetadata = createStablePaperMetadata(["paper-3", "paper-4", "paper-5"]);
    const initialDocument = createSearchView(initialMetadata);
    const nextDocument = createSearchView(nextMetadata);

    mountSearchView(initialDocument);

    await act(async () => {
      for (const callback of intersectionCallbacks) {
        callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      }
      await Promise.resolve();
    });

    expect(
      useBackgroundTaskStore.getState().inlineAnalysisTasks[initialDocument.id]?.cycleKey,
    ).toBe(buildInlineAnalysisCycleKey(initialDocument.id, initialMetadata));

    intersectionCallbacks = [];
    await act(async () => {
      root?.render(<SearchView document={nextDocument} />);
      await Promise.resolve();
    });
    await act(async () => {
      for (const callback of intersectionCallbacks) {
        callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      }
      await Promise.resolve();
    });

    expect(
      useBackgroundTaskStore.getState().inlineAnalysisTasks[initialDocument.id]?.cycleKey,
    ).toBe(buildInlineAnalysisCycleKey(nextDocument.id, nextMetadata));
    expect(
      useBackgroundTaskStore.getState().inlineAnalysisTasks[initialDocument.id]?.visiblePaperIds,
    ).toEqual(["paper-3", "paper-4", "paper-5"]);
  });

  it("queues search inline analysis only after rendered cards enter the viewport", async () => {
    const searchDocument = createSearchView(createStablePaperMetadata(["paper-1", "paper-2"]));

    mountSearchView(searchDocument);

    expect(
      useBackgroundTaskStore.getState().inlineAnalysisTasks[searchDocument.id],
    ).toBeUndefined();

    await act(async () => {
      for (const callback of intersectionCallbacks) {
        callback(
          [{ isIntersecting: false } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      }
      await Promise.resolve();
    });

    expect(
      useBackgroundTaskStore.getState().inlineAnalysisTasks[searchDocument.id],
    ).toBeUndefined();

    await act(async () => {
      for (const callback of intersectionCallbacks) {
        callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      }
      await Promise.resolve();
    });

    expect(
      useBackgroundTaskStore.getState().inlineAnalysisTasks[searchDocument.id]?.visiblePaperIds,
    ).toEqual(["paper-1", "paper-2"]);
  });

  it("keeps card exposure when hydration adds analysis input to the same paper id", async () => {
    const hydratedMetadata = createStablePaperMetadata(["paper-1"]);
    const lightweightMetadata: SearchMetadata = {
      ...hydratedMetadata,
      papers: hydratedMetadata.papers.map((paper) => ({ ...paper, abstract: null })),
    };
    const lightweightDocument = createSearchView(lightweightMetadata);
    const hydratedDocument = createSearchView(hydratedMetadata, "2026-05-07T00:02:00.000Z");
    mountSearchView(lightweightDocument);

    await act(async () => {
      for (const callback of intersectionCallbacks) {
        callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      }
      await Promise.resolve();
    });
    expect(
      useBackgroundTaskStore.getState().inlineAnalysisTasks[lightweightDocument.id],
    ).toBeUndefined();

    await act(async () => {
      useResearchRouteStore
        .getState()
        .patchCurrentView(hydratedDocument, `test:${hydratedDocument.id}`);
      root?.render(<SearchView document={hydratedDocument} />);
      await Promise.resolve();
    });

    const task = useBackgroundTaskStore.getState().inlineAnalysisTasks[hydratedDocument.id];
    expect(task?.visiblePaperIds).toEqual(["paper-1"]);
    expect(task?.progressMap.get("paper-1")).toBe("queued");
    expect(task?.cycleKey).toBe(buildInlineAnalysisCycleKey(hydratedDocument.id, hydratedMetadata));
  });
});
