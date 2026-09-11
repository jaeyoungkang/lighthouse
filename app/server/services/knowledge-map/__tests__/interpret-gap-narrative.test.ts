import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeJudgment } from "@/app/server/ai-generation/judgment";
import type {
  GapNetworkCluster,
  GapPair,
  GraphPaperSnapshot,
} from "@/app/domain/research-route-payload";
import { interpretGapNarratives } from "@/app/server/services/knowledge-map/interpret-gap-narrative";

vi.mock("@/app/server/ai-generation/judgment", () => ({
  executeJudgment: vi.fn(),
}));

const clusters: GapNetworkCluster[] = [
  {
    id: "cluster-agents",
    label: "Autonomous LLM Agents",
    color: "oklch(0.641 0.131 251.4)",
    paperCount: 3,
    concepts: [
      { id: "c-0", label: "Tool Use", clusterId: "cluster-agents", score: 8 },
      { id: "c-1", label: "Reasoning Traces", clusterId: "cluster-agents", score: 7 },
    ],
    topPaperIds: ["p1"],
  },
  {
    id: "cluster-retrieval",
    label: "Memory & Retrieval-Augmented LLMs",
    color: "oklch(0.685 0.16 44.7)",
    paperCount: 2,
    concepts: [
      { id: "c-2", label: "Long Context", clusterId: "cluster-retrieval", score: 8 },
      { id: "c-3", label: "RAG Survey", clusterId: "cluster-retrieval", score: 7 },
    ],
    topPaperIds: ["p2"],
  },
];

const gapPair: GapPair = {
  id: "gap-agents-retrieval",
  leftClusterId: "cluster-agents",
  rightClusterId: "cluster-retrieval",
  leftLabel: "Autonomous LLM Agents",
  rightLabel: "Memory & Retrieval-Augmented LLMs",
  displayLabel: "Autonomous LLM Agents-Memory & Retrieval-Augmented LLMs Gap",
  observed: 0,
  expected: 3,
  gapScore: 1,
  rank: 1,
  bridgeConcepts: ["memory-grounded planning", "long-horizon retrieval"],
  leftConcepts: ["Tool Use", "Reasoning Traces"],
  rightConcepts: ["Long Context", "RAG Survey"],
};

const papersById = new Map<string, GraphPaperSnapshot>([
  [
    "p1",
    {
      paperId: "p1",
      title: "Toolformer: language models can teach themselves to use tools",
      abstract: "Tool use for language models.",
      year: 2023,
      citationCount: 820,
      url: "https://example.com/p1",
      authors: [{ name: "Schick" }],
    },
  ],
  [
    "p2",
    {
      paperId: "p2",
      title: "Retrieval-augmented generation for large language models: a survey",
      abstract: "Retrieval-augmented generation survey.",
      year: 2024,
      citationCount: 210,
      url: "https://example.com/p2",
      authors: [{ name: "Gao" }],
    },
  ],
]);

function clustersById() {
  return new Map(clusters.map((cluster) => [cluster.id, cluster] as const));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("interpretGapNarratives", () => {
  it("returns an empty map without invoking the judge when there are no gaps", async () => {
    await expect(
      interpretGapNarratives({
        query: "autonomous LLM agents memory retrieval",
        gapPairs: [],
        clustersById: clustersById(),
        papersById,
      }),
    ).resolves.toEqual(new Map());
    expect(executeJudgment).not.toHaveBeenCalled();
  });

  it("builds a gap-specific fallback when the judge omits the gap", async () => {
    vi.mocked(executeJudgment).mockResolvedValueOnce({ narratives: [] });

    const narratives = await interpretGapNarratives({
      query: "autonomous LLM agents memory retrieval",
      gapPairs: [gapPair],
      clustersById: clustersById(),
      papersById,
    });

    expect(executeJudgment).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "interpret-gap-narrative",
        onError: "fallback",
        fallbackValue: { narratives: [] },
      }),
    );
    const payload = narratives.get(gapPair.id);
    expect(narratives.size).toBe(1);
    expect(payload?.metaQualitative).toBe(
      "Autonomous LLM Agents의 Tool Use 흐름과 Memory & Retrieval-Augmented LLMs의 Long Context 흐름이 매개 개념 memory-grounded planning로 직접 이어지지 못한 미탐색 연구 공백이다.",
    );
    expect(payload?.proposals).toHaveLength(1);
    expect(payload?.proposals[0]?.hypothesis).toContain("memory-grounded planning");
    expect(payload?.proposals[0]?.grounding).toContain("Tool Use");
  });

  it("ignores an unknown judge id and still fills the requested gap", async () => {
    vi.mocked(executeJudgment).mockResolvedValueOnce({
      narratives: [
        {
          gapPairId: "unknown-gap",
          metaQualitative:
            "Autonomous LLM Agents와 Memory & Retrieval-Augmented LLMs가 직접 만나지 않은 미탐색 연구 공백이다.",
          proposals: [
            {
              hypothesis:
                "Autonomous LLM Agents와 Memory & Retrieval-Augmented LLMs를 연결하는 검증 작업을 구성한다.",
              grounding:
                "Tool Use와 Long Context가 두 군집의 연결 가능성을 보여 주는 출발 근거를 제공한다.",
            },
          ],
        },
      ],
    });

    const narratives = await interpretGapNarratives({
      query: "autonomous LLM agents memory retrieval",
      gapPairs: [gapPair],
      clustersById: clustersById(),
      papersById,
    });

    expect(narratives.has("unknown-gap")).toBe(false);
    expect(narratives.has(gapPair.id)).toBe(true);
  });
});

describe("interpretGapNarratives normalization", () => {
  it("replaces translated or malformed meta with a deterministic domain-term-preserving meta line", async () => {
    vi.mocked(executeJudgment).mockResolvedValueOnce({
      narratives: [
        {
          gapPairId: gapPair.id,
          metaQualitative:
            "자율 LLM 에이전트와 검색 증강 생성 사이 expected 3개의 연결이 부족하다.",
          proposals: [
            {
              hypothesis:
                "검색 증강 생성과 자율 LLM 에이전트를 결합해 장기 검색 능력을 평가하는 작업이다.",
              grounding:
                "검색 증강 생성 survey와 자율 LLM 에이전트 논문이 장기 검색의 근거를 제공한다.",
            },
          ],
        },
      ],
    });

    const narratives = await interpretGapNarratives({
      query: "autonomous LLM agents memory retrieval",
      gapPairs: [gapPair],
      clustersById: clustersById(),
      papersById,
    });

    const payload = narratives.get(gapPair.id);

    expect(payload?.metaQualitative).toBe(
      "Autonomous LLM Agents의 Tool Use 흐름과 Memory & Retrieval-Augmented LLMs의 Long Context 흐름이 매개 개념 memory-grounded planning로 직접 이어지지 못한 미탐색 연구 공백이다.",
    );
    expect(payload?.metaQualitative).toContain("Autonomous LLM Agents");
    expect(payload?.metaQualitative).toContain("Memory & Retrieval-Augmented LLMs");
    expect(payload?.metaQualitative).not.toMatch(/\d|자율\s*LLM\s*에이전트|검색\s*증강\s*생성/);
    expect(payload?.proposals[0]?.hypothesis).toContain("Retrieval-Augmented Generation");
    expect(payload?.proposals[0]?.hypothesis).toContain("long-horizon retrieval");
  });

  it("keeps valid LLM meta while normalizing known translated domain terms in proposals", async () => {
    const metaQualitative =
      "Autonomous LLM Agents의 능동적 실행 체계와 Memory & Retrieval-Augmented LLMs의 장기 정보 관리가 직접 만나는 미탐색 연구 공백이다.";
    vi.mocked(executeJudgment).mockResolvedValueOnce({
      narratives: [
        {
          gapPairId: gapPair.id,
          metaQualitative,
          proposals: [
            {
              hypothesis:
                "Memory & Retrieval-Augmented LLMs의 Long Context 자산을 Autonomous LLM Agents의 Tool Use 루프에 연결해 환경 피드백을 재호출하는 연구 작업이다.",
              grounding:
                "검색 증강 생성 survey와 Tool Use 개념이 이 가설의 방법적 출발점을 제공한다.",
            },
          ],
        },
      ],
    });

    const narratives = await interpretGapNarratives({
      query: "autonomous LLM agents memory retrieval",
      gapPairs: [gapPair],
      clustersById: clustersById(),
      papersById,
    });

    const payload = narratives.get(gapPair.id);

    expect(payload?.metaQualitative).toBe(metaQualitative);
    expect(payload?.proposals[0]?.grounding).toContain("Retrieval-Augmented Generation");
    expect(payload?.proposals[0]?.grounding).not.toContain("검색 증강 생성");
  });

  it.each([
    "자율 LLM 에이전트의 Tool Use와 Memory & Retrieval-Augmented LLMs의 Long Context가 직접 만나지 않은 미탐색 연구 공백이다.",
    "Autonomous LLM Agents와 Memory & Retrieval-Augmented LLMs 사이 expected 3 관계가 비어 있는 미탐색 연구 공백이다.",
    "Autonomous LLM Agents와 Memory & Retrieval-Augmented LLMs 사이 연결 3개가 비어 있는 미탐색 연구 공백이다.",
    "Autonomous LLM Agents와 Memory & Retrieval-Augmented LLMs 사이 미탐색 영역이 3개다.",
  ])("replaces one translated term or metric-bearing meta: %s", async (metaQualitative) => {
    vi.mocked(executeJudgment).mockResolvedValueOnce({
      narratives: [
        {
          gapPairId: gapPair.id,
          metaQualitative,
          proposals: [
            {
              hypothesis:
                "Autonomous LLM Agents의 Tool Use를 Long Context와 연결하는 구체적인 검증 작업이다.",
              grounding: "Tool Use와 Long Context가 두 군집의 핵심 개념으로 이 결합을 뒷받침한다.",
            },
          ],
        },
      ],
    });

    const narratives = await interpretGapNarratives({
      query: "autonomous LLM agents memory retrieval",
      gapPairs: [gapPair],
      clustersById: clustersById(),
      papersById,
    });

    expect(narratives.get(gapPair.id)?.metaQualitative).toBe(
      "Autonomous LLM Agents의 Tool Use 흐름과 Memory & Retrieval-Augmented LLMs의 Long Context 흐름이 매개 개념 memory-grounded planning로 직접 이어지지 못한 미탐색 연구 공백이다.",
    );
  });

  it("trims and collapses whitespace in accepted proposal prose", async () => {
    const metaQualitative =
      "Autonomous LLM Agents의 능동적 실행 체계와 Memory & Retrieval-Augmented LLMs의 장기 정보 관리가 직접 만나는 미탐색 연구 공백이다.";
    vi.mocked(executeJudgment).mockResolvedValueOnce({
      narratives: [
        {
          gapPairId: gapPair.id,
          metaQualitative,
          proposals: [
            {
              hypothesis:
                "  Autonomous LLM Agents의 Tool Use를   Long Context 회수 구조와 연결하는 검증 작업이다.  ",
              grounding:
                "  Tool Use와 Long Context가   두 군집의 핵심 개념으로 이 결합을 뒷받침한다.  ",
            },
          ],
        },
      ],
    });

    const narratives = await interpretGapNarratives({
      query: "autonomous LLM agents memory retrieval",
      gapPairs: [gapPair],
      clustersById: clustersById(),
      papersById,
    });

    expect(narratives.get(gapPair.id)?.proposals[0]).toEqual({
      hypothesis:
        "Autonomous LLM Agents의 Tool Use를 Long Context 회수 구조와 연결하는 검증 작업이다.",
      grounding: "Tool Use와 Long Context가 두 군집의 핵심 개념으로 이 결합을 뒷받침한다.",
    });
  });

  it("keeps domain terms with embedded digits while still replacing raw multiline meta", async () => {
    const metaQualitative =
      "Autonomous LLM Agents의 Agent Benchmark 2.0 traces와 Memory & Retrieval-Augmented LLMs의 Long Context 회수가 직접 만나는 미탐색 연구 공백이다.";
    vi.mocked(executeJudgment).mockResolvedValueOnce({
      narratives: [
        {
          gapPairId: gapPair.id,
          metaQualitative,
          proposals: [
            {
              hypothesis:
                "Autonomous LLM Agents의 Agent Benchmark 2.0 traces를 Long Context 회수 구조와 결합하는 연구 작업이다.",
              grounding: "Tool Use와 Long Context가 두 군집의 핵심 개념으로 이 결합을 뒷받침한다.",
            },
          ],
        },
      ],
    });

    const narratives = await interpretGapNarratives({
      query: "autonomous LLM agents memory retrieval",
      gapPairs: [gapPair],
      clustersById: clustersById(),
      papersById,
    });

    expect(narratives.get(gapPair.id)?.metaQualitative).toBe(metaQualitative);

    vi.mocked(executeJudgment).mockResolvedValueOnce({
      narratives: [
        {
          gapPairId: gapPair.id,
          metaQualitative:
            "Autonomous LLM Agents의 Tool Use 흐름과\nMemory & Retrieval-Augmented LLMs의 Long Context 흐름이 직접 만나는 미탐색 연구 공백이다.",
          proposals: [
            {
              hypothesis:
                "Autonomous LLM Agents의 Tool Use를 Long Context와 연결하는 연구 작업이다.",
              grounding: "Tool Use와 Long Context가 두 군집의 핵심 개념이다.",
            },
          ],
        },
      ],
    });

    const multilineNarratives = await interpretGapNarratives({
      query: "autonomous LLM agents memory retrieval",
      gapPairs: [gapPair],
      clustersById: clustersById(),
      papersById,
    });

    expect(multilineNarratives.get(gapPair.id)?.metaQualitative).toBe(
      "Autonomous LLM Agents의 Tool Use 흐름과 Memory & Retrieval-Augmented LLMs의 Long Context 흐름이 매개 개념 memory-grounded planning로 직접 이어지지 못한 미탐색 연구 공백이다.",
    );
  });
});
