import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GapNetworkContentReport } from "@/app/components/research-route-renderers/knowledge-map/GapNetworkContentReport";
import {
  readFirstAiContentFeedbackBody,
  stubAiContentFeedbackTransport,
} from "../../__tests__/ai-content-feedback-test-support";
import type { GapNetworkReport } from "@/app/domain/research-route-payload";

let root: Root | null = null;
const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};
const previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;

function makeReport(): GapNetworkReport {
  return {
    clusters: [
      {
        id: "c0",
        label: "Memory Systems",
        color: "oklch(0.6 0.1 200)",
        paperCount: 2,
        concepts: [{ id: "k0", label: "Long Context", clusterId: "c0", score: 8 }],
        topPaperIds: ["p1"],
      },
      {
        id: "c1",
        label: "Tool Use",
        color: "oklch(0.6 0.1 60)",
        paperCount: 1,
        concepts: [{ id: "k1", label: "Function Calling", clusterId: "c1", score: 7 }],
        topPaperIds: ["p2"],
      },
    ],
    conceptEdges: [],
    gapPairs: [],
    metrics: {
      clusterCount: 2,
      totalPaperCount: 3,
      totalEdgeCount: 0,
      gapPairCount: 0,
    },
    insight: { hypotheses: [] },
    domainLabel: "자율 LLM 에이전트와 메모리/검색 보강",
    contentNarrative: {
      overview:
        "Memory Systems와 Tool Use 묶음이 분야 안에서 보완 관계를 이루며 서로 다른 결을 본다.",
      clusterParagraphs: [
        {
          clusterId: "c0",
          paragraph:
            "Memory Systems는 장기 문맥 기억과 외부 지식 갱신에 집중하며, Tool Use 묶음과 달리 작업 수행보다 정보 보존 결을 본다.",
        },
        {
          clusterId: "c1",
          paragraph:
            "Tool Use는 도구 호출과 함수 실행 자체에 집중하며, Memory Systems와 달리 장기 문맥보다 단일 행동 결정 결을 본다.",
        },
      ],
      gapInferenceParagraph:
        "클러스터 크기로 기대 교차 연결 수를 추정하고 실제 연결 수와 비교해 공백을 계산했다.",
    },
  };
}

describe("GapNetworkContentReport", () => {
  beforeEach(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    window.localStorage.clear();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  it("renders domain label, overview, cluster paragraphs in cluster order, and gap inference paragraph", () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const report = makeReport();

    act(() => {
      root?.render(<GapNetworkContentReport report={report} />);
    });

    const domainLabel = container.querySelector(
      '[data-testid="gap-network-content-report-domain-label"]',
    );
    expect(domainLabel?.textContent).toBe("자율 LLM 에이전트와 메모리/검색 보강");

    const domainSection = container.querySelector(
      '[data-testid="gap-network-content-report-domain"]',
    );
    expect(domainSection?.textContent).toContain(
      "Memory Systems와 Tool Use 묶음이 분야 안에서 보완 관계",
    );

    const clusterEntries = container.querySelectorAll(
      '[data-testid="gap-network-content-report-cluster"]',
    );
    expect(clusterEntries).toHaveLength(2);
    expect(clusterEntries[0].getAttribute("data-cluster-id")).toBe("c0");
    expect(clusterEntries[0].textContent).toContain("Memory Systems");
    expect(clusterEntries[0].textContent).toContain("(2편)");
    expect(clusterEntries[0].textContent).toContain("작업 수행보다 정보 보존 결을 본다");
    expect(clusterEntries[1].getAttribute("data-cluster-id")).toBe("c1");
    expect(clusterEntries[1].textContent).toContain("Tool Use");
    expect(clusterEntries[1].textContent).toContain("(1편)");
    expect(clusterEntries[1].textContent).toContain("단일 행동 결정 결을 본다");

    const gapInference = container.querySelector(
      '[data-testid="gap-network-content-report-gap-inference"]',
    );
    expect(gapInference?.textContent).toContain("기대 교차 연결 수를 추정");
  });

  it("falls back gracefully when contentNarrative and domainLabel are missing", () => {
    const container = document.createElement("div");
    root = createRoot(container);
    const report = makeReport();
    delete report.domainLabel;
    delete report.contentNarrative;

    act(() => {
      root?.render(<GapNetworkContentReport report={report} />);
    });

    expect(
      container.querySelector('[data-testid="gap-network-content-report-domain-label"]'),
    ).toBeNull();

    const clusterEntries = container.querySelectorAll(
      '[data-testid="gap-network-content-report-cluster"]',
    );
    expect(clusterEntries).toHaveLength(2);
    expect(clusterEntries[0].textContent).toContain("Memory Systems");

    const gapInference = container.querySelector(
      '[data-testid="gap-network-content-report-gap-inference"]',
    );
    expect(gapInference?.textContent).toContain("기대 교차 연결 수");
  });

  it("records feedback once at report level for gap content prose with gap report provenance", () => {
    const fetchMock = stubAiContentFeedbackTransport();
    const container = document.createElement("div");
    root = createRoot(container);
    const report = makeReport();

    act(() => {
      root?.render(<GapNetworkContentReport documentId="gap-1" report={report} />);
    });

    expect(container.querySelectorAll('[data-testid="ai-content-feedback"]')).toHaveLength(1);

    const helpful = container.querySelector<HTMLButtonElement>(
      '[data-testid="ai-content-feedback-helpful"]',
    );
    expect(helpful).not.toBeNull();

    act(() => {
      helpful?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = readFirstAiContentFeedbackBody(fetchMock);
    expect(payload).toMatchObject({
      name: "product.ai_content_feedback.submitted",
      payload: {
        properties: {
          documentId: "gap-1",
          documentType: "gap_network",
          surfaceId: "gap-content:report",
          surfaceKind: "gap_content_report",
          promiseRef: "promise:gap-report-prepared-reaction",
          value: "helpful",
        },
      },
    });
    const properties = (payload as { payload: { properties: Record<string, unknown> } }).payload
      .properties;
    expect(properties.outputTitleHash).toEqual(expect.stringMatching(/^fnv1a32:/));
    expect(properties.outputTitleLength).toEqual(expect.any(Number));
    expect(properties.outputBodyHash).toEqual(expect.stringMatching(/^fnv1a32:/));
    expect(properties.outputBodyLength).toEqual(expect.any(Number));
    expect(JSON.stringify(payload)).not.toContain("Memory Systems와 Tool Use 묶음");
    expect(JSON.stringify(payload)).not.toContain("Memory Systems는 장기 문맥 기억");
    expect(JSON.stringify(payload)).not.toContain("기대 교차 연결 수");
  });
});
