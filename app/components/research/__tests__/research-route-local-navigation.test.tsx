import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CitationLink } from "@/app/components/CitationLink";
import {
  SearchFollowupActivationProvider,
  useSearchFollowupActivation,
} from "@/app/components/research/search-followup-activation";
import type { ResearchRoutePayload } from "@/app/domain/research-route-payload";
import { useResearchRouteStore } from "@/app/stores/research-route-store";

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn<(href: string) => void>(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

let root: Root | null = null;

function RejectionProbe() {
  const { conditionUrlRejected } = useSearchFollowupActivation();
  return <span data-testid="condition-url-rejected">{String(conditionUrlRejected)}</span>;
}

function createCitationView(id: string): ResearchRoutePayload {
  return {
    status: "ready",
    version: 0,
    reactionVersion: 0,
    id,
    type: "citation_lineage",
    title: "인용 계보: Attention Is All You Need",
    content: "",
    createdBy: "user",
    reaction: null,
    refs: [],
    ownerPrincipalId: "research-route-collection-1",
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z",
    metadata: {
      type: "citation_lineage",
      seedPaper: {
        paperId: "seed-1",
        title: "Attention Is All You Need",
        abstract: null,
        year: 2017,
        citationCount: 1000,
        url: "https://example.com/seed",
        authors: [{ name: "Vaswani" }],
      },
      referenceIds: [],
      citationIds: [],
      papers: [],
      total: 0,
    },
  };
}

function expectSeedPaperRoute(actual: string, pathname: "/citation" | "/similar") {
  const url = new URL(actual, "http://localhost");
  expect(url.pathname).toBe(pathname);
  expect(url.searchParams.get("seedPaperId")).toBe("seed-1");
  expect(url.searchParams.get("seedPaperTitle")).toBe("Attention Is All You Need");
  expect(url.searchParams.get("seedPaperYear")).toBe("2017");
  expect(url.searchParams.get("seedPaperUrl")).toBe("https://example.com/seed");
  expect(url.searchParams.get("seedPaperCitations")).toBe("1000");
}

function expectFirstPushedSeedRoute(pathname: "/citation" | "/similar") {
  const firstCall = mockPush.mock.calls[0];
  expect(firstCall).toBeDefined();
  const href = firstCall[0];
  expectSeedPaperRoute(href, pathname);
}

describe("local research route payload navigation", () => {
  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mockPush.mockClear();
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    useResearchRouteStore.setState(useResearchRouteStore.getInitialState());
  });

  it("pushes a citation seed route before focusing an inline citation target", () => {
    const targetView = createCitationView("citation-1");
    const container = window.document.createElement("div");
    const revealPaper = vi.fn();
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(targetView, "test-execution:152");
    window.addEventListener("lighthouse:reveal-paper", revealPaper);

    act(() => {
      root?.render(<CitationLink docId={targetView.id} paperId="paper-1" />);
    });

    act(() => {
      container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expectFirstPushedSeedRoute("/citation");
    expect(revealPaper).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { documentId: targetView.id, paperId: "paper-1" },
      }),
    );
    expect(useResearchRouteStore.getState().currentView?.id ?? null).toBe(targetView.id);
    window.removeEventListener("lighthouse:reveal-paper", revealPaper);
  });

  it("reports fixed feedback instead of throwing when an inline citation route is oversized", () => {
    const targetView = createCitationView("citation-inline-oversized");
    if (targetView.metadata.type !== "citation_lineage") {
      throw new Error("expected citation metadata");
    }
    targetView.metadata.seedPaper.title = "a".repeat(769);
    const container = window.document.createElement("div");
    root = createRoot(container);
    useResearchRouteStore.getState().setCurrentView(targetView, "test-execution:oversized");

    act(() => {
      root?.render(
        <SearchFollowupActivationProvider>
          <CitationLink docId={targetView.id} />
          <RejectionProbe />
        </SearchFollowupActivationProvider>,
      );
    });
    act(() => {
      container.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(mockPush).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="condition-url-rejected"]')?.textContent).toBe(
      "true",
    );
  });
});
