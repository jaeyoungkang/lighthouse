import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResearchRoutePayload, SearchMetadata } from "@/app/domain/research-route-payload";
import { useSearchViewController } from "@/app/components/research-route-renderers/use-search-view-controller";
import { useLibraryAvailabilityStore } from "@/app/stores/library-availability-store";
import { useBackgroundTaskStore } from "@/app/stores/background-task-store";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

const NOW = 1_700_000_000_000;

// The legacy selected-anchor seams are retired, but the route shell can still
// seed internal reviewed_papers availability before the first search.
function createSearchView(
  libraryContextAvailable?: boolean,
): Extract<ResearchRoutePayload, { type: "search" }> {
  const metadata: SearchMetadata = {
    type: "search",
    query: "",
    total: 0,
    papers: [],
    ...(libraryContextAvailable === undefined ? {} : { libraryContextAvailable }),
  };
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id: "search-1",
    type: "search",
    title: "검색",
    content: "",
    createdBy: "user",
    metadata,
    refs: [],
    ownerPrincipalId: "principal-1",
    createdAt: "2026-05-04T00:00:00.000Z",
    updatedAt: "2026-05-04T00:00:00.000Z",
    reaction: null,
  };
}

function createSearchViewWithPapers(): Extract<ResearchRoutePayload, { type: "search" }> {
  const view = createSearchView(true);
  return {
    ...view,
    metadata: {
      ...view.metadata,
      query: "agent memory",
      total: 1,
      papers: [
        {
          paperId: "paper-1",
          title: "Paper 1",
          abstract: "abstract",
          year: 2026,
          citationCount: 5,
          url: "https://example.com/paper-1",
          authors: [{ name: "Author 1" }],
        },
      ],
    },
  };
}

function ControllerHarness(props: {
  document: Extract<ResearchRoutePayload, { type: "search" }>;
  onResult: (result: {
    available: boolean;
    sortOption: string;
    isCreatingGapNetwork: boolean;
    handleOpenGapNetwork: () => void;
  }) => void;
}) {
  const result = useSearchViewController({ document: props.document });
  props.onResult({
    available: result.libraryContextAvailable,
    sortOption: result.sortOption,
    isCreatingGapNetwork: result.isCreatingGapNetwork,
    handleOpenGapNetwork: result.handleOpenGapNetwork,
  });
  return null;
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  useLibraryAvailabilityStore.setState({ available: false });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  useBackgroundTaskStore.setState(useBackgroundTaskStore.getInitialState());
  useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  useLibraryAvailabilityStore.setState({ available: false });
});

function renderController(doc: Extract<ResearchRoutePayload, { type: "search" }>): boolean {
  let available = false;
  useResearchRouteStore.getState().setCurrentView(doc, "test-execution:112");
  act(() => {
    root.render(
      <ControllerHarness
        document={doc}
        onResult={(next) => {
          available = next.available;
        }}
      />,
    );
  });
  return available;
}

function renderControllerState(doc: Extract<ResearchRoutePayload, { type: "search" }>): {
  available: boolean;
  sortOption: string;
  isCreatingGapNetwork: boolean;
  handleOpenGapNetwork: () => void;
} {
  let result: {
    available: boolean;
    sortOption: string;
    isCreatingGapNetwork: boolean;
    handleOpenGapNetwork: () => void;
  } = {
    available: false,
    sortOption: "",
    isCreatingGapNetwork: false,
    handleOpenGapNetwork: () => {},
  };
  useResearchRouteStore.getState().setCurrentView(doc, "test-execution:143");
  act(() => {
    root.render(
      <ControllerHarness
        document={doc}
        onResult={(next) => {
          result = next;
        }}
      />,
    );
  });
  return result;
}

function createDetachedWindowMock() {
  return {
    close: vi.fn(),
    location: {
      assign: vi.fn(),
    },
    opener: window,
  } as unknown as Window;
}

describe("useSearchViewController library availability", () => {
  it("uses the seeded internal availability value before the first search", () => {
    useLibraryAvailabilityStore.setState({ available: true });

    expect(renderController(createSearchView(undefined))).toBe(true);
  });

  it("treats the missing flag as unavailable when the store was never seeded", () => {
    expect(renderController(createSearchView(undefined))).toBe(false);
  });

  it("keeps explicit unavailable metadata unavailable even when the store was seeded", () => {
    useLibraryAvailabilityStore.setState({ available: true });

    expect(renderController(createSearchView(false))).toBe(false);
  });

  it("uses committed availability metadata", () => {
    useLibraryAvailabilityStore.setState({ available: false });

    expect(renderController(createSearchView(true))).toBe(true);
  });

  it("starts empty searches with relevance sort even when the internal store was seeded", () => {
    useLibraryAvailabilityStore.setState({ available: true });

    expect(renderControllerState(createSearchView(undefined))).toMatchObject({
      available: true,
      sortOption: "relevance",
    });
  });

  it("marks gap report creation as pending while the detached report id is being created", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(
        () =>
          new Promise<Response>(() => {
            // Keep the request in flight so the controller should stay pending.
          }),
      ),
    );
    vi.spyOn(window, "open").mockReturnValue(createDetachedWindowMock());
    const initial = renderControllerState(createSearchViewWithPapers());

    expect(initial.isCreatingGapNetwork).toBe(false);

    act(() => {
      initial.handleOpenGapNetwork();
    });

    expect(renderControllerState(createSearchViewWithPapers()).isCreatingGapNetwork).toBe(true);
  });
});
