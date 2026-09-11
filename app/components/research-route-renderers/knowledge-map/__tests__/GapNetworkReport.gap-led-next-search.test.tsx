import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GapNetworkReport } from "@/app/components/research-route-renderers/knowledge-map/GapNetworkReport";
import {
  gapNetworkClusterReactionsFixture,
  gapNetworkReportFixture,
  reactActEnvironment,
} from "./gap-network-report.fixtures";

const report = gapNetworkReportFixture;
const clusterReactions = gapNetworkClusterReactionsFixture;

async function settleGapNetworkViewBoxTransition() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(260);
  });
}

const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

describe("GapNetworkReport gap-led-next-search", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
  });

  afterEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    vi.useRealTimers();
  });

  it("traces a selected concept seed to its supporting papers", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const supportingPapers = [
      {
        paperId: "mem-1",
        title: "Workflow memory for agents",
        abstract: "Workflow memory enables long-horizon task execution.",
        year: 2024,
        citationCount: 30,
        url: "https://example.com/mem-1",
        authors: [{ name: "M1" }],
      },
      {
        paperId: "mem-2",
        title: "Persistent context for retrieval",
        abstract: "Persistent context improves retrieval-augmented agents.",
        year: 2025,
        citationCount: 22,
        url: "https://example.com/mem-2",
        authors: [{ name: "M2" }],
      },
    ];

    act(() => {
      root.render(
        <GapNetworkReport
          query="memory planning evaluation"
          report={report}
          papers={supportingPapers}
        />,
      );
    });

    const firstCluster = container.querySelector('[data-cluster-id="cluster-0"]');
    expect(firstCluster).not.toBeNull();
    act(() => {
      firstCluster?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await settleGapNetworkViewBoxTransition();

    const conceptNode = container.querySelector('[data-concept-id="workflow memory"]');
    expect(conceptNode).not.toBeNull();
    act(() => {
      conceptNode?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    const supportingSlot = container.querySelector('[data-overlay-slot="selected-concept-papers"]');
    expect(supportingSlot).not.toBeNull();
    expect(supportingSlot?.getAttribute("data-selected-concept-label")).toBe("Workflow Memory");
    expect(supportingSlot?.textContent).toContain("Workflow memory for agents");
    expect(supportingSlot?.textContent).toContain("Persistent context for retrieval");

    act(() => {
      root.unmount();
    });
  });

  it("offers a seed-as-search action on focused cluster and prefills the cluster label", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onUseSeedAsSearch = vi.fn();

    act(() => {
      root.render(
        <GapNetworkReport
          query="memory planning evaluation"
          report={report}
          clusterReactions={clusterReactions}
          onUseSeedAsSearch={onUseSeedAsSearch}
        />,
      );
    });

    const firstCluster = container.querySelector('[data-cluster-id="cluster-0"]');
    expect(firstCluster).not.toBeNull();
    act(() => {
      firstCluster?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await settleGapNetworkViewBoxTransition();

    const button = container.querySelector('[data-testid="gap-network-seed-as-search"]');
    expect(button).not.toBeNull();
    expect(button?.getAttribute("data-seed-kind")).toBe("cluster");
    expect(button?.getAttribute("data-seed-term")).toBe("Memory");

    act(() => {
      (button as HTMLButtonElement).click();
    });
    expect(onUseSeedAsSearch).toHaveBeenCalledWith(
      "Memory",
      "cluster",
      expect.objectContaining({ button: 0 }),
    );
    expect(onUseSeedAsSearch).toHaveBeenCalledTimes(1);
    expect(button?.textContent).toContain("[Memory]");
    expect(button?.textContent).toContain("으로 논문 검색");

    act(() => {
      root.unmount();
    });
  });

  it("offers a seed-as-search action on focused gap and prefills the gap display label", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onUseSeedAsSearch = vi.fn();

    act(() => {
      root.render(
        <GapNetworkReport
          query="memory planning evaluation"
          report={report}
          onUseSeedAsSearch={onUseSeedAsSearch}
        />,
      );
    });

    const gapLink = container.querySelector('[data-gap-pair-id="gap-0-1"]');
    expect(gapLink).not.toBeNull();
    act(() => {
      gapLink?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await settleGapNetworkViewBoxTransition();

    const button = container.querySelector('[data-testid="gap-network-seed-as-search"]');
    expect(button).not.toBeNull();
    expect(button?.getAttribute("data-seed-kind")).toBe("gap");
    expect(button?.getAttribute("data-seed-term")).toBe("Memory-Planning Gap");

    act(() => {
      (button as HTMLButtonElement).click();
    });
    expect(onUseSeedAsSearch).toHaveBeenCalledWith(
      "Memory-Planning Gap",
      "gap",
      expect.objectContaining({ button: 0 }),
    );
    expect(button?.textContent).toContain("[Memory-Planning Gap]");

    act(() => {
      root.unmount();
    });
  });

  it("offers a seed-as-search action on a focused concept and fires the concept seedKind", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onUseSeedAsSearch = vi.fn();

    act(() => {
      root.render(
        <GapNetworkReport
          query="memory planning evaluation"
          report={report}
          clusterReactions={clusterReactions}
          onUseSeedAsSearch={onUseSeedAsSearch}
        />,
      );
    });

    const firstCluster = container.querySelector('[data-cluster-id="cluster-0"]');
    act(() => {
      firstCluster?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await settleGapNetworkViewBoxTransition();

    const conceptNode = container.querySelector('[data-concept-id="workflow memory"]');
    expect(conceptNode).not.toBeNull();
    act(() => {
      conceptNode?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    const button = container.querySelector('[data-testid="gap-network-seed-as-search"]');
    expect(button).not.toBeNull();
    expect(button?.getAttribute("data-seed-kind")).toBe("concept");
    expect(button?.getAttribute("data-seed-term")).toBe("Workflow Memory");

    act(() => {
      (button as HTMLButtonElement).click();
    });
    expect(onUseSeedAsSearch).toHaveBeenCalledWith(
      "Workflow Memory",
      "concept",
      expect.objectContaining({ button: 0 }),
    );

    act(() => {
      root.unmount();
    });
  });

  it("forwards modifier and middle-click activation from the actual seed button", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const onUseSeedAsSearch = vi.fn();

    act(() => {
      root.render(
        <GapNetworkReport
          query="memory planning evaluation"
          report={report}
          clusterReactions={clusterReactions}
          onUseSeedAsSearch={onUseSeedAsSearch}
        />,
      );
    });

    const firstCluster = container.querySelector('[data-cluster-id="cluster-0"]');
    act(() => {
      firstCluster?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    await settleGapNetworkViewBoxTransition();

    const button = container.querySelector('[data-testid="gap-network-seed-as-search"]');
    act(() => {
      button?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true }),
      );
      button?.dispatchEvent(
        new MouseEvent("auxclick", { bubbles: true, button: 1, cancelable: true }),
      );
    });

    expect(onUseSeedAsSearch).toHaveBeenNthCalledWith(
      1,
      "Memory",
      "cluster",
      expect.objectContaining({ metaKey: true }),
    );
    expect(onUseSeedAsSearch).toHaveBeenNthCalledWith(
      2,
      "Memory",
      "cluster",
      expect.objectContaining({ button: 1 }),
    );

    act(() => {
      root.unmount();
    });
  });

  it("renders the analysis input summary above the canvas", () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(<GapNetworkReport query="memory planning evaluation" report={report} />);
    });

    const summary = container.querySelector('[data-testid="gap-network-analysis-input-summary"]');
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toContain("9편");
    expect(summary?.textContent).toContain("3개 군집");
    expect(summary?.textContent).toContain("나눴습니다");
    expect(summary?.textContent).not.toContain("처음 보이는 10편");

    act(() => {
      root.unmount();
    });
  });
});
