import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GapNetworkFocusedSelectionSummary } from "@/app/components/research-route-renderers/knowledge-map/GapNetworkFocusedSelectionSummary";
import { useSearchTermHandler } from "@/app/components/research-route-renderers/search-view-followup-handlers";
import {
  readAiContentFeedbackBodies,
  stubAiContentFeedbackTransport,
} from "../../__tests__/ai-content-feedback-test-support";
import {
  SearchFollowupActivationProvider,
  useSearchFollowupActivation,
} from "@/app/components/research/search-followup-activation";

let root: Root | null = null;

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

function GapSeedSearchFeedbackHarness() {
  const launchSearchTerm = useSearchTermHandler();
  const { startActivation } = useSearchFollowupActivation();
  return (
    <>
      <button
        type="button"
        data-testid="same-query-route-bar-activation"
        onClick={() => {
          startActivation({
            route: "/search?q=Memory+Systems&entry=route-bar",
            query: "Memory Systems",
            originLocation: "/gap/gap-1",
          });
        }}
      >
        다른 검색 진입
      </button>
      <button
        type="button"
        data-testid="same-query-different-context-activation"
        onClick={() => {
          startActivation({
            route: "/search?q=Memory+Systems&personalize=false&entry=term",
            query: "Memory Systems",
            originLocation: "/gap/gap-1",
          });
        }}
      >
        다른 검색 조건
      </button>
      <GapNetworkFocusedSelectionSummary
        summary={{
          kind: "cluster",
          meta: "논문 3편",
          body: "Memory Systems는 장기 문맥 기억과 외부 지식 갱신에 집중한다.",
          seedTerm: "Memory Systems",
        }}
        onUseSeedAsSearch={(seed, _seedKind, event) => {
          launchSearchTerm(seed, undefined, event);
        }}
      />
    </>
  );
}

describe("GapNetworkFocusedSelectionSummary feedback", () => {
  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    window.localStorage.clear();
    mockPush.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("records feedback for focused gap overlay proposals with gap report provenance", () => {
    const fetchMock = stubAiContentFeedbackTransport();
    const container = document.createElement("div");
    root = createRoot(container);

    act(() => {
      root?.render(
        <GapNetworkFocusedSelectionSummary
          documentId="gap-1"
          summary={{
            kind: "gap",
            meta: "Memory Systems와 Tool Use 사이의 정성 공백",
            proposals: [
              {
                hypothesis: "장기 기억을 도구 호출 계획에 연결하는 평가를 설계한다.",
                grounding: "Memory Systems와 Tool Use 라벨에서 도출됐다.",
              },
            ],
            seedTerm: "Memory Systems-Tool Use Gap",
          }}
        />,
      );
    });

    const notHelpful = container.querySelector<HTMLButtonElement>(
      '[data-testid="ai-content-feedback-not-helpful"]',
    );
    expect(notHelpful).not.toBeNull();

    act(() => {
      notHelpful?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const feedback = readAiContentFeedbackBodies(fetchMock);
    expect(feedback).toHaveLength(1);
    expect(feedback[0]).toMatchObject({
      name: "product.ai_content_feedback.submitted",
      payload: {
        subject: {
          documentId: "gap-1",
          promiseRef: "promise:gap-overlay-decision-evidence",
        },
        properties: {
          documentId: "gap-1",
          documentType: "gap_network",
          surfaceKind: "gap_gap_focused_summary",
          promiseRef: "promise:gap-overlay-decision-evidence",
          value: "not_helpful",
          metadataSelectionKind: "gap",
        },
      },
    });
    const properties = (feedback[0] as { payload: { properties: Record<string, unknown> } }).payload
      .properties;
    expect(properties.outputBodyHash).toEqual(expect.stringMatching(/^fnv1a32:/));
    expect(properties.outputBodyLength).toEqual(expect.any(Number));
  });

  it("keeps focused gap meta separated from proposal text in DOM extraction", () => {
    const container = document.createElement("div");
    root = createRoot(container);

    act(() => {
      root?.render(
        <GapNetworkFocusedSelectionSummary
          summary={{
            kind: "gap",
            meta: "Autonomous LLM Agents와 Memory & Retrieval-Augmented LLMs 사이의 미탐색 공백이다.",
            proposals: [
              {
                hypothesis: "장기 기억을 도구 호출 계획에 연결하는 평가를 설계한다.",
                grounding: "Memory & Retrieval-Augmented LLMs와 Tool Use 라벨에서 도출됐다.",
              },
            ],
            seedTerm: "Autonomous LLM Agents-Memory & Retrieval-Augmented LLMs Gap",
          }}
        />,
      );
    });

    expect(container.querySelector('[data-overlay-slot="meta"]')?.textContent).toContain(
      "Autonomous LLM Agents",
    );
    expect(container.textContent).toContain("미탐색 공백이다.\n장기 기억을");
  });

  it("does not render feedback for focused cluster overlays", () => {
    const container = document.createElement("div");
    root = createRoot(container);

    act(() => {
      root?.render(
        <GapNetworkFocusedSelectionSummary
          documentId="gap-1"
          summary={{
            kind: "cluster",
            kicker: "선택한 클러스터",
            meta: "논문 3편",
            body: "Memory Systems는 장기 문맥 기억과 외부 지식 갱신에 집중한다.",
            representativeTitles: ["Workflow memory for agents"],
            representativeTitlesHeading: "대표 논문",
            seedTerm: "Memory Systems",
          }}
        />,
      );
    });

    expect(container.querySelector('[data-testid="focused-selection-summary"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ai-content-feedback"]')).toBeNull();
  });

  it("shows immediate progress on the clicked paper-search button", () => {
    const container = document.createElement("div");
    root = createRoot(container);

    act(() => {
      root?.render(
        <SearchFollowupActivationProvider>
          <GapSeedSearchFeedbackHarness />
        </SearchFollowupActivationProvider>,
      );
    });

    const searchButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="gap-network-seed-as-search"]',
    );
    act(() => {
      searchButton?.click();
    });

    expect(searchButton?.disabled).toBe(true);
    expect(searchButton?.getAttribute("aria-busy")).toBe("true");
    expect(
      searchButton?.querySelector('[data-testid="search-navigation-button-spinner"]'),
    ).not.toBeNull();
    expect(searchButton?.textContent).toContain("[Memory Systems] 으로 논문 검색");
    expect(mockPush).toHaveBeenCalledWith("/search?q=Memory+Systems&entry=term");
  });

  it("does not confuse a same-query route-bar activation with the gap seed button", () => {
    const container = document.createElement("div");
    root = createRoot(container);

    act(() => {
      root?.render(
        <SearchFollowupActivationProvider>
          <GapSeedSearchFeedbackHarness />
        </SearchFollowupActivationProvider>,
      );
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="same-query-route-bar-activation"]')
        ?.click();
    });

    const searchButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="gap-network-seed-as-search"]',
    );
    expect(searchButton?.disabled).toBe(false);
    expect(searchButton?.getAttribute("aria-busy")).toBe("false");
    expect(
      searchButton?.querySelector('[data-testid="search-navigation-button-spinner"]'),
    ).toBeNull();
  });

  it("does not confuse a same-query term activation with different search context", () => {
    const container = document.createElement("div");
    root = createRoot(container);

    act(() => {
      root?.render(
        <SearchFollowupActivationProvider>
          <GapSeedSearchFeedbackHarness />
        </SearchFollowupActivationProvider>,
      );
    });
    act(() => {
      container
        .querySelector<HTMLButtonElement>('[data-testid="same-query-different-context-activation"]')
        ?.click();
    });

    const searchButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="gap-network-seed-as-search"]',
    );
    expect(searchButton?.disabled).toBe(false);
    expect(searchButton?.getAttribute("aria-busy")).toBe("false");
    expect(
      searchButton?.querySelector('[data-testid="search-navigation-button-spinner"]'),
    ).toBeNull();
  });

  it("keeps detached gap seed search from activating the current button", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const container = document.createElement("div");
    root = createRoot(container);

    act(() => {
      root?.render(
        <SearchFollowupActivationProvider>
          <GapSeedSearchFeedbackHarness />
        </SearchFollowupActivationProvider>,
      );
    });
    const searchButton = container.querySelector<HTMLButtonElement>(
      '[data-testid="gap-network-seed-as-search"]',
    );
    act(() => {
      searchButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true }),
      );
    });

    expect(openSpy).toHaveBeenCalledWith(
      "/search?q=Memory+Systems&entry=term",
      "_blank",
      "noopener,noreferrer",
    );
    expect(mockPush).not.toHaveBeenCalled();
    expect(searchButton?.disabled).toBe(false);
    expect(searchButton?.getAttribute("aria-busy")).toBe("false");
  });
});
