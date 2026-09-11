import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_ROUTES } from "@/app/lib/api-routes";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import { useLibraryAvailabilityStore } from "@/app/stores/library-availability-store";
import { useLibraryPapersStore } from "@/app/stores/library-papers-store";
import { trackCanonicalEvent } from "@/app/lib/analytics/client";
import {
  createPaper,
  createSearchMetadata,
  createSearchView,
  createSearchViewRenderHarness,
} from "./search-view-test-support";

vi.mock("@/app/lib/analytics/client", () => ({ trackCanonicalEvent: vi.fn() }));

const trackCanonicalEventMock = vi.mocked(trackCanonicalEvent);

const { mockPathname, mockPush, mockSearchParams } = vi.hoisted(() => ({
  mockPathname: { value: "/search/search-1" },
  mockPush: vi.fn(),
  mockSearchParams: { value: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname.value,
  useSearchParams: () => mockSearchParams.value,
}));

const searchViewHarness = createSearchViewRenderHarness();

function createLibrarySearchView(paper = createPaper()) {
  return createSearchView({
    metadata: createSearchMetadata({
      papers: [paper],
      spellingCorrection: undefined,
    }),
  });
}

function libraryRequest(method: string): RequestInit | undefined {
  return vi
    .mocked(fetch)
    .mock.calls.find(
      ([input, init]) => input === API_ROUTES.PAPERS_REVIEWED && init?.method === method,
    )?.[1];
}

function libraryRequestCount(method: string): number {
  return vi
    .mocked(fetch)
    .mock.calls.filter(
      ([input, init]) => input === API_ROUTES.PAPERS_REVIEWED && init?.method === method,
    ).length;
}

async function flushToggle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("SearchView library action", () => {
  beforeEach(() => {
    searchViewHarness.setup();
    mockPathname.value = "/search/search-1";
    mockSearchParams.value = new URLSearchParams();
    mockPush.mockClear();
    trackCanonicalEventMock.mockClear();
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    useLibraryAvailabilityStore.setState({ available: false });
    useLibraryPapersStore.setState(useLibraryPapersStore.getInitialState());
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  afterEach(() => {
    searchViewHarness.cleanup();
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    useLibraryAvailabilityStore.setState({ available: false });
    useLibraryPapersStore.setState(useLibraryPapersStore.getInitialState());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("adds an unsaved paper through reviewed POST and updates the card action", async () => {
    const container = searchViewHarness.render(
      createLibrarySearchView(createPaper({ reviewed: false })),
    );
    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-result-library-action"]',
    );

    expect(button?.getAttribute("data-library-state")).toBe("unsaved");

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushToggle();
    });

    const postRequest = libraryRequest("POST");
    expect(postRequest?.body).toBe(
      JSON.stringify({
        paperId: "paper-1",
        title: "Attention Is All You Need",
        url: "https://example.com/paper-1",
        authors: [{ name: "Vaswani" }],
        year: 2017,
        citationCount: 1000,
      }),
    );
    expect(
      container
        .querySelector<HTMLButtonElement>('[data-testid="search-result-library-action"]')
        ?.getAttribute("data-library-state"),
    ).toBe("saved");
    expect(
      container
        .querySelector<HTMLButtonElement>('[data-testid="search-result-library-action"]')
        ?.getAttribute("aria-label"),
    ).toContain("라이브러리에서 해제");
    expect(
      container
        .querySelector<HTMLButtonElement>('[data-testid="search-result-library-action"]')
        ?.getAttribute("title"),
    ).toContain("라이브러리에서 해제");
    expect(container.querySelector('[data-testid="search-result-library-status"]')).toBeNull();
    expect(useLibraryPapersStore.getState().papers).toEqual([
      expect.objectContaining({
        paperId: "paper-1",
        title: "Attention Is All You Need",
        folderName: "내 라이브러리",
      }),
    ]);
    const savedPayload = trackCanonicalEventMock.mock.calls.find(
      ([name]) => name === "paper_saved",
    )?.[1];
    expect(savedPayload?.properties).toMatchObject({
      journey_context_id: "search-1",
      search_context_id: "search-1",
      paper_id: "paper-1",
      result_rank: 1,
    });
  });

  it("keeps the saved card state when stale search metadata rerenders after add", async () => {
    const container = searchViewHarness.render(
      createLibrarySearchView(createPaper({ reviewed: false })),
    );
    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-result-library-action"]',
    );

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushToggle();
    });

    searchViewHarness.rerender(createLibrarySearchView(createPaper({ reviewed: false })));

    expect(
      container
        .querySelector<HTMLButtonElement>('[data-testid="search-result-library-action"]')
        ?.getAttribute("data-library-state"),
    ).toBe("saved");
    expect(container.querySelector('[data-testid="search-result-library-status"]')).toBeNull();
    expect(useLibraryPapersStore.getState().papers).toEqual([
      expect.objectContaining({ paperId: "paper-1" }),
    ]);
  });

  it("deletes a saved paper through reviewed DELETE and updates the card action", async () => {
    useLibraryPapersStore.getState().setPapers([
      {
        paperId: "paper-1",
        title: "Attention Is All You Need",
        folderName: "내 라이브러리",
      },
    ]);
    const container = searchViewHarness.render(
      createLibrarySearchView(createPaper({ reviewed: true })),
    );
    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-result-library-action"]',
    );

    expect(button?.getAttribute("data-library-state")).toBe("saved");
    expect(button?.getAttribute("aria-label")).toContain("라이브러리에서 해제");
    expect(button?.getAttribute("title")).toContain("라이브러리에서 해제");

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushToggle();
    });

    const deleteRequest = libraryRequest("DELETE");
    expect(deleteRequest?.body).toBe(JSON.stringify({ paperId: "paper-1" }));
    expect(
      container
        .querySelector<HTMLButtonElement>('[data-testid="search-result-library-action"]')
        ?.getAttribute("data-library-state"),
    ).toBe("unsaved");
    expect(container.querySelector('[data-testid="search-result-library-status"]')).toBeNull();
    expect(useLibraryPapersStore.getState().papers).toEqual([]);
    const unsavedPayload = trackCanonicalEventMock.mock.calls.find(
      ([name]) => name === "paper_unsaved",
    )?.[1];
    expect(unsavedPayload?.properties).toMatchObject({
      search_context_id: "search-1",
      paper_id: "paper-1",
    });
  });

  it("keeps the updated card state when stale search metadata rerenders after remove", async () => {
    useLibraryPapersStore.getState().setPapers([
      {
        paperId: "paper-1",
        title: "Attention Is All You Need",
        folderName: "내 라이브러리",
      },
    ]);
    const container = searchViewHarness.render(
      createLibrarySearchView(createPaper({ reviewed: true })),
    );
    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-result-library-action"]',
    );

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushToggle();
    });

    searchViewHarness.rerender(createLibrarySearchView(createPaper({ reviewed: true })));

    expect(container.querySelector('[data-testid="search-result-library-status"]')).toBeNull();
    expect(
      container
        .querySelector<HTMLButtonElement>('[data-testid="search-result-library-action"]')
        ?.getAttribute("data-library-state"),
    ).toBe("unsaved");
    expect(useLibraryPapersStore.getState().papers).toEqual([]);
  });

  it("rolls back the card state when reviewed DELETE fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "failed" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    useLibraryPapersStore.getState().setPapers([
      {
        paperId: "paper-1",
        title: "Attention Is All You Need",
        folderName: "내 라이브러리",
      },
    ]);
    const container = searchViewHarness.render(
      createLibrarySearchView(createPaper({ reviewed: true })),
    );
    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-result-library-action"]',
    );

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushToggle();
    });

    expect(libraryRequest("DELETE")).toBeTruthy();
    expect(
      container
        .querySelector<HTMLButtonElement>('[data-testid="search-result-library-action"]')
        ?.getAttribute("data-library-state"),
    ).toBe("saved");
    expect(
      container
        .querySelector<HTMLButtonElement>('[data-testid="search-result-library-action"]')
        ?.getAttribute("aria-label"),
    ).toContain("라이브러리에서 해제");
    expect(container.querySelector('[data-testid="search-result-library-status"]')).toBeNull();
    expect(useLibraryPapersStore.getState().papers).toEqual([
      expect.objectContaining({ paperId: "paper-1" }),
    ]);
    expect(trackCanonicalEventMock.mock.calls.some(([name]) => name === "paper_unsaved")).toBe(
      false,
    );
  });

  it("rolls back the card state when reviewed POST fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "failed" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const container = searchViewHarness.render(
      createLibrarySearchView(createPaper({ reviewed: false })),
    );
    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-result-library-action"]',
    );

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushToggle();
    });

    expect(libraryRequest("POST")).toBeTruthy();
    expect(
      container
        .querySelector<HTMLButtonElement>('[data-testid="search-result-library-action"]')
        ?.getAttribute("data-library-state"),
    ).toBe("unsaved");
    expect(container.querySelector('[data-testid="search-result-library-status"]')).toBeNull();
    expect(useLibraryPapersStore.getState().papers).toEqual([]);
    expect(trackCanonicalEventMock.mock.calls.some(([name]) => name === "paper_saved")).toBe(false);
  });

  it("ignores repeated clicks while the reviewed mutation is pending", async () => {
    let resolveFetch: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    const container = searchViewHarness.render(
      createLibrarySearchView(createPaper({ reviewed: false })),
    );
    const button = container.querySelector<HTMLButtonElement>(
      '[data-testid="search-result-library-action"]',
    );

    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(libraryRequestCount("POST")).toBe(1);
    expect(
      container.querySelector<HTMLButtonElement>('[data-testid="search-result-library-action"]')
        ?.disabled,
    ).toBe(true);

    await act(async () => {
      resolveFetch(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      await flushToggle();
    });

    expect(
      container.querySelector<HTMLButtonElement>('[data-testid="search-result-library-action"]')
        ?.disabled,
    ).toBe(false);
  });
});
