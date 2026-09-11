import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PaperCore } from "@/app/domain/paper";
import { SearchResultItem } from "@/app/components/research-route-renderers/search-result-item";

const paper: PaperCore = {
  paperId: "271854887",
  title: "The AI Scientist",
  abstract: "abstract",
  year: 2024,
  citationCount: 10,
  url: "https://example.com/paper-1",
  authors: [{ name: "Author 1" }],
  openAccessPdf: null,
  doi: null,
  referenceIds: null,
  citationIds: null,
};

function findGraphNeighborsButton(container: HTMLElement): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll("button")).find(
    (button) => button.textContent === "비슷한 논문",
  );
}

describe("SearchResultItem graph neighbors action", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(["271854887", "pap_01900000-0000-7000-8000-000000000001"])(
    "uses the 비슷한 논문 button for an Episteme 3 paper ref (%s)",
    (paperId) => {
      const container = document.createElement("div");
      const root = createRoot(container);
      const onOpenGraphNeighbors = vi.fn();

      act(() => {
        root.render(
          <SearchResultItem
            paper={{ ...paper, paperId }}
            isLast
            analysisState={undefined}
            analysisResult={undefined}
            isAnyPaperOpening={false}
            isOpening={false}
            onOpenPdf={vi.fn()}
            onOpenGraphNeighbors={onOpenGraphNeighbors}
          />,
        );
      });

      const graphNeighborsButton = findGraphNeighborsButton(container);
      expect(graphNeighborsButton).toBeTruthy();
      if (!graphNeighborsButton) {
        throw new Error("비슷한 논문 버튼이 렌더되지 않았다.");
      }

      act(() => {
        graphNeighborsButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(onOpenGraphNeighbors).toHaveBeenCalledTimes(1);
      const firstCallPaper = onOpenGraphNeighbors.mock.calls[0]?.[0] as
        | { paperId?: string }
        | undefined;
      expect(firstCallPaper?.paperId).toBe(paperId);

      act(() => {
        root.unmount();
      });
    },
  );

  it("does not render the graph-backed 비슷한 논문 button when onOpenGraphNeighbors is absent", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <SearchResultItem
          paper={paper}
          isLast
          analysisState={undefined}
          analysisResult={undefined}
          isAnyPaperOpening={false}
          isOpening={false}
          onOpenPdf={vi.fn()}
        />,
      );
    });

    expect(findGraphNeighborsButton(container)).toBeUndefined();

    act(() => {
      root.unmount();
    });
  });

  it("falls back to the seeded search similar action for non-corpus paper ids", () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onOpenGraphNeighbors = vi.fn();
    const onFindSimilar = vi.fn();

    act(() => {
      root.render(
        <SearchResultItem
          paper={{ ...paper, paperId: "paper-non-corpus" }}
          isLast
          analysisState={undefined}
          analysisResult={undefined}
          isAnyPaperOpening={false}
          isOpening={false}
          onOpenPdf={vi.fn()}
          onOpenGraphNeighbors={onOpenGraphNeighbors}
          onFindSimilar={onFindSimilar}
        />,
      );
    });

    const similarButton = findGraphNeighborsButton(container);
    expect(similarButton).toBeTruthy();
    if (!similarButton) {
      throw new Error("비슷한 논문 fallback 버튼이 렌더되지 않았다.");
    }

    act(() => {
      similarButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onOpenGraphNeighbors).not.toHaveBeenCalled();
    expect(onFindSimilar).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
  });

  it("shows the shared loading affordance while opening graph-backed similar papers", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <SearchResultItem
          paper={paper}
          isLast
          analysisState={undefined}
          analysisResult={undefined}
          isAnyPaperOpening={false}
          isOpening={false}
          isGraphNeighborsLoading
          onOpenPdf={vi.fn()}
          onOpenGraphNeighbors={vi.fn()}
        />,
      );
    });

    const graphNeighborsButton = findGraphNeighborsButton(container);
    expect(graphNeighborsButton).toBeTruthy();
    expect(graphNeighborsButton?.disabled).toBe(true);
    expect(graphNeighborsButton?.querySelector(".animate-spin")).toBeTruthy();

    act(() => {
      root.unmount();
    });
  });
});
