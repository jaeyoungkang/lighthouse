import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchRouteSearchBar } from "@/app/components/research/ResearchRouteSearchBar";
import { API_ROUTES } from "@/app/lib/api-routes";
import {
  REVIEWED_PAPER_STATE_CHANGED_EVENT,
  type ReviewedPaperStateChangedDetail,
} from "@/app/lib/reviewed-paper-state-event";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
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

function renderSearchBar(
  userEmail?: string,
  libraryPapers: { paperId: string; title: string; folderName: string }[] = [],
) {
  const container = document.createElement("div");
  root = createRoot(container);
  useLibraryPapersStore.getState().setPapers(libraryPapers);

  act(() => {
    root?.render(<ResearchRouteSearchBar userEmail={userEmail} libraryPapers={libraryPapers} />);
  });

  return container;
}

describe("ResearchRouteSearchBar library refresh", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
    useLibraryAvailabilityStore.setState({ available: false });
    useLibraryPapersStore.setState(useLibraryPapersStore.getInitialState());
    mockPathname.value = "/search";
    mockSearchParams.value = new URLSearchParams();
    mockPush.mockClear();
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
    useLibraryAvailabilityStore.setState({ available: false });
    useLibraryPapersStore.setState(useLibraryPapersStore.getInitialState());
  });

  it("ignores stale reviewed papers list refreshes after newer library mutations", async () => {
    const staleReviewedList = [
      {
        paperId: "12345",
        title: "Stale Reviewed Paper",
        url: "https://example.com/stale",
        authors: [{ name: "Ada" }],
        year: 2024,
        citationCount: 12,
        reviewedAt: "2026-06-29T00:00:00.000Z",
      },
    ];
    let resolveReviewedList: ((value: Response) => void) | null = null;
    const reviewedListResponse = new Promise<Response>((resolve) => {
      resolveReviewedList = resolve;
    });
    const fetchMock = vi.fn((...args: Parameters<typeof fetch>) => {
      const [input] = args;
      if (input === API_ROUTES.PAPERS_REVIEWED) {
        return reviewedListResponse;
      }
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    useLibraryAvailabilityStore.setState({ available: true });
    const container = renderSearchBar("reader@example.com", [
      {
        paperId: "12345",
        title: "Current Reviewed Paper",
        folderName: "내 라이브러리",
      },
    ]);

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="research-route-library-menu-button"]')
        ?.click();
      await Promise.resolve();
    });

    act(() => {
      useLibraryPapersStore.getState().removePaper("12345");
      useLibraryAvailabilityStore.getState().setAvailable(false);
    });

    await act(async () => {
      resolveReviewedList?.(
        new Response(JSON.stringify(staleReviewedList), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useLibraryPapersStore.getState().papers).toEqual([]);
    expect(useLibraryAvailabilityStore.getState().available).toBe(false);
    expect(container.textContent).not.toContain("Stale Reviewed Paper");
  });

  it("syncs fresh reviewed papers list refreshes to visible card state", async () => {
    const reviewedList = [
      {
        paperId: "pap_e3_only",
        title: "Fresh Reviewed Paper",
        url: "https://example.com/fresh",
        authors: [{ name: "Grace" }],
        year: 2025,
        citationCount: 5,
        reviewedAt: "2026-06-29T00:00:00.000Z",
      },
    ];
    const stateChanges: ReviewedPaperStateChangedDetail[] = [];
    const handleReviewedStateChanged = (event: Event) => {
      const detail = (event as CustomEvent<ReviewedPaperStateChangedDetail>).detail;
      stateChanges.push(detail);
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(reviewedList), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const container = renderSearchBar("reader@example.com", [
      {
        paperId: "12345",
        title: "Previous Reviewed Paper",
        folderName: "내 라이브러리",
      },
    ]);
    window.addEventListener(REVIEWED_PAPER_STATE_CHANGED_EVENT, handleReviewedStateChanged);

    try {
      await act(async () => {
        container
          .querySelector<HTMLButtonElement>('[data-testid="research-route-library-menu-button"]')
          ?.click();
        await Promise.resolve();
        await Promise.resolve();
      });
    } finally {
      window.removeEventListener(REVIEWED_PAPER_STATE_CHANGED_EVENT, handleReviewedStateChanged);
    }

    expect(useLibraryPapersStore.getState().papers).toEqual([
      expect.objectContaining({
        paperId: "pap_e3_only",
        title: "Fresh Reviewed Paper",
      }),
    ]);
    expect(stateChanges).toHaveLength(2);
    expect(stateChanges).toEqual(
      expect.arrayContaining([
        { paperId: "pap_e3_only", reviewed: true },
        { paperId: "12345", reviewed: false },
      ]),
    );
    expect(useLibraryAvailabilityStore.getState().available).toBe(true);
  });
});
