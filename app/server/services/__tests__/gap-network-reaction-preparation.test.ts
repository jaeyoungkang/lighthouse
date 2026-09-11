import { describe, expect, it } from "vitest";
import { buildGapNetworkReactionPreparation } from "@/app/server/services/gap-network-reaction-preparation";

const papers = [
  {
    paperId: "p1",
    title: "Agents paper about tool use",
    abstract: "",
    year: 2024,
    citationCount: 120,
    url: "https://example.com/p1",
    authors: [{ name: "A" }],
  },
  {
    paperId: "p2",
    title: "Planner memory in LLM agents",
    abstract: "",
    year: 2023,
    citationCount: 80,
    url: "https://example.com/p2",
    authors: [{ name: "B" }],
  },
  {
    paperId: "p3",
    title: "Agent workflow benchmark",
    abstract: "",
    year: 2024,
    citationCount: 40,
    url: "https://example.com/p3",
    authors: [{ name: "C" }],
  },
  {
    paperId: "p4",
    title: "Long context retrieval primer",
    abstract: "",
    year: 2023,
    citationCount: 60,
    url: "https://example.com/p4",
    authors: [{ name: "D" }],
  },
  {
    paperId: "p5",
    title: "Memory scaling in transformers",
    abstract: "",
    year: 2022,
    citationCount: 30,
    url: "https://example.com/p5",
    authors: [{ name: "E" }],
  },
];

const report = {
  clusters: [
    {
      id: "cluster-0",
      label: "Agents",
      color: "oklch(0.641 0.131 251.4)",
      paperCount: 3,
      concepts: [
        { id: "c-0", label: "Tool Use", clusterId: "cluster-0", score: 8.2 },
        { id: "c-1", label: "Planner Memory", clusterId: "cluster-0", score: 6.4 },
      ],
      topPaperIds: ["p1", "p2", "p3"],
    },
    {
      id: "cluster-1",
      label: "Memory",
      color: "#f28b82",
      paperCount: 2,
      concepts: [{ id: "c-2", label: "Long Context", clusterId: "cluster-1", score: 7.5 }],
      topPaperIds: ["p4", "p5"],
    },
  ],
  conceptEdges: [],
  gapPairs: [
    {
      id: "gap-0",
      leftClusterId: "cluster-0",
      rightClusterId: "cluster-1",
      leftLabel: "Agents",
      rightLabel: "Memory",
      displayLabel: "Agents-Memory Gap",
      observed: 0,
      expected: 3,
      gapScore: 1,
      rank: 1,
      bridgeConcepts: ["Retrieval Planning"],
      leftConcepts: ["Tool Use"],
      rightConcepts: ["Long Context"],
    },
  ],
  metrics: {
    clusterCount: 2,
    totalPaperCount: 5,
    totalEdgeCount: 6,
    gapPairCount: 1,
  },
  insight: {
    hypotheses: [
      {
        id: "hyp-1",
        gapPairId: "gap-0",
        title: "Memory-guided agent benchmark",
        description: "Use memory planning to connect the two clusters.",
        sourceConcept: "Tool Use",
        targetConcept: "Long Context",
        confidence: "high" as const,
      },
    ],
  },
};

describe("gap-network-reaction-preparation", () => {
  it("prepares overview, cluster, and gap reactions from one report", () => {
    const preparation = buildGapNetworkReactionPreparation({
      query: "agents memory",
      report,
      papers,
      preparedAt: "2026-04-10T00:00:00.000Z",
    });

    expect(preparation.overviewReaction).toMatchObject({
      id: "gap-network-overview",
      title: "연구 공백 리포트 요약",
    });
    expect(preparation.clusterReactions).toHaveLength(2);
    expect(preparation.clusterReactions[0]).toMatchObject({
      clusterId: "cluster-0",
      reaction: {
        id: "gap-network-cluster-cluster-0",
        title: "Agents 클러스터",
      },
    });
    expect(preparation.gapReactions).toHaveLength(1);
    expect(preparation.gapReactions[0]).toMatchObject({
      gapPairId: "gap-0",
      reaction: {
        id: "gap-network-gap-gap-0",
        title: "Agents-Memory 가설",
      },
    });
    expect(preparation.gapReactions[0]?.reaction.body.length).toBeLessThanOrEqual(200);
  });

  it("cluster reaction body carries composition, adjacency, and representative paper titles", () => {
    const preparation = buildGapNetworkReactionPreparation({
      query: "agents memory",
      report,
      papers,
      preparedAt: "2026-04-10T00:00:00.000Z",
    });

    const agentsCluster = preparation.clusterReactions.find(
      (entry) => entry.clusterId === "cluster-0",
    );
    expect(agentsCluster).toBeDefined();
    const body = agentsCluster?.reaction.body ?? "";

    expect(body).toContain("Agents");
    expect(body).toContain("3편");
    expect(body).toContain("Tool Use");
    expect(body).not.toContain("Agents-Memory Gap");
    expect(agentsCluster?.nearestGapLabel).toBe("Agents-Memory Gap");
    expect(agentsCluster?.representativePaperTitles).toEqual([
      "Agents paper about tool use",
      "Planner memory in LLM agents",
      "Agent workflow benchmark",
    ]);
    expect(body).not.toContain("Agents paper about tool use");

    const memoryCluster = preparation.clusterReactions.find(
      (entry) => entry.clusterId === "cluster-1",
    );
    expect(memoryCluster).toBeDefined();
    const memoryBody = memoryCluster?.reaction.body ?? "";
    expect(memoryBody).toContain("Memory");
    expect(memoryBody).toContain("2편");
    expect(memoryBody).toContain("Long Context");
    expect(memoryBody).not.toContain("Agents-Memory Gap");
    expect(memoryCluster?.nearestGapLabel).toBe("Agents-Memory Gap");
  });

  it("uses LLM cluster narrative as the prepared cluster reaction body when available", () => {
    const narrative =
      "Agents 클러스터는 도구 사용과 planner memory를 함께 다루며, Memory 클러스터보다 실행 절차 쪽에 무게를 둔다.";
    const preparation = buildGapNetworkReactionPreparation({
      query: "agents memory",
      report: {
        ...report,
        clusters: report.clusters.map((cluster) =>
          cluster.id === "cluster-0" ? { ...cluster, narrative } : cluster,
        ),
      },
      papers,
      preparedAt: "2026-04-10T00:00:00.000Z",
    });

    const agentsCluster = preparation.clusterReactions.find(
      (entry) => entry.clusterId === "cluster-0",
    );

    expect(agentsCluster?.reaction.body).toBe(narrative);
    expect(agentsCluster?.narrative).toBe(narrative);
    expect(agentsCluster?.reaction.body).not.toContain("논문 3편");
  });

  it("gap reaction body falls back to hypothesis description when no LLM payload is provided", () => {
    const preparation = buildGapNetworkReactionPreparation({
      query: "agents memory",
      report,
      papers,
      preparedAt: "2026-04-10T00:00:00.000Z",
    });

    const gap = preparation.gapReactions[0];

    expect(gap.metaQualitative).toBeUndefined();
    expect(gap.proposals).toBeUndefined();
    expect(gap.reaction.body).toContain("Use memory planning to connect the two clusters.");
    expect(gap.reaction.title).toContain("Agents");
    expect(gap.reaction.title).toContain("Memory");
  });

  it("gap reaction carries metaQualitative and evidence-based proposals when available", () => {
    const metaQualitative =
      "도구 사용 결의 Agents 군집과 장기 문맥 결의 Memory 군집 사이의 미탐색 교차";
    const proposals = [
      {
        hypothesis:
          "장기 문맥 기억과 도구 사용 에이전트를 결합해 다단계 과제 동안 외부 지식을 갱신·재호출하는 접근을 시도한다.",
        grounding: "매개 개념 'Retrieval Planning'이 Agents·Memory 두 군집을 잇는 단서로 식별된다.",
      },
      {
        hypothesis:
          "Agents 결의 Tool Use를 Memory 결의 Long Context와 paired benchmark로 묶어 평가 파이프라인을 만든다.",
        grounding:
          "대표 논문 'Agents paper about tool use'와 'Long context retrieval primer'가 두 군집의 결을 보여준다.",
      },
    ];
    const preparation = buildGapNetworkReactionPreparation({
      query: "agents memory",
      report,
      papers,
      gapNarratives: new Map([["gap-0", { metaQualitative, proposals }]]),
      preparedAt: "2026-04-30T00:00:00.000Z",
    });

    const gap = preparation.gapReactions[0];

    expect(gap.metaQualitative).toBe(metaQualitative);
    expect(gap.proposals).toHaveLength(2);
    expect(gap.proposals?.[0]?.hypothesis).toBe(proposals[0].hypothesis);
    expect(gap.proposals?.[0]?.grounding).toBe(proposals[0].grounding);
    expect(gap.reaction.body).toContain("장기 문맥 기억과 도구 사용 에이전트");
    expect(gap.reaction.body).not.toContain("Use memory planning to connect the two clusters.");
  });
});

describe("gap-network-reaction-preparation — capacity adequacy", () => {
  it("cluster reaction body stays within 200 chars and retains all composition constituents under worst-case long labels", () => {
    const worstCasePapers = [
      {
        paperId: "lp1",
        title: "Memory-augmented reasoning for long-horizon agents",
        abstract: "",
        year: 2024,
        citationCount: 200,
        url: "https://example.com/lp1",
        authors: [{ name: "X" }],
      },
      {
        paperId: "lp2",
        title: "Retrieval-augmented long-context scientific QA benchmark",
        abstract: "",
        year: 2024,
        citationCount: 150,
        url: "https://example.com/lp2",
        authors: [{ name: "Y" }],
      },
    ];
    const worstCaseReport = {
      clusters: [
        {
          id: "cluster-long-0",
          label: "Agents & Large Language Models",
          color: "oklch(0.641 0.131 251.4)",
          paperCount: 12,
          concepts: [
            {
              id: "long-0",
              label: "Memory-augmented reasoning",
              clusterId: "cluster-long-0",
              score: 9.1,
            },
            {
              id: "long-1",
              label: "Tool-use orchestration",
              clusterId: "cluster-long-0",
              score: 8.4,
            },
            {
              id: "long-2",
              label: "Long-horizon planning",
              clusterId: "cluster-long-0",
              score: 7.8,
            },
          ],
          topPaperIds: ["lp1"],
        },
        {
          id: "cluster-long-1",
          label: "Retrieval-Augmented Scientific Question Answering",
          color: "oklch(0.685 0.16 44.7)",
          paperCount: 9,
          concepts: [
            {
              id: "long-3",
              label: "Long-context retrieval augmentation",
              clusterId: "cluster-long-1",
              score: 8.7,
            },
          ],
          topPaperIds: ["lp2"],
        },
      ],
      conceptEdges: [],
      gapPairs: [
        {
          id: "gap-long-0-1",
          leftClusterId: "cluster-long-0",
          rightClusterId: "cluster-long-1",
          leftLabel: "Agents & Large Language Models",
          rightLabel: "Retrieval-Augmented Scientific Question Answering",
          displayLabel:
            "Agents & Large Language Models ↔ Retrieval-Augmented Scientific Question Answering Gap",
          observed: 0,
          expected: 2.4,
          gapScore: 1,
          rank: 1,
          bridgeConcepts: ["retrieval planning", "episodic memory grounding"],
          leftConcepts: ["Memory-augmented reasoning"],
          rightConcepts: ["Long-context retrieval augmentation"],
        },
      ],
      metrics: {
        clusterCount: 2,
        totalPaperCount: 21,
        totalEdgeCount: 3,
        gapPairCount: 1,
      },
      insight: { hypotheses: [] },
    };

    const preparation = buildGapNetworkReactionPreparation({
      query: "agents retrieval scientific question answering",
      report: worstCaseReport,
      papers: worstCasePapers,
      preparedAt: "2026-04-20T00:00:00.000Z",
    });

    for (const entry of preparation.clusterReactions) {
      const cluster = worstCaseReport.clusters.find((c) => c.id === entry.clusterId);
      const relatedGap = worstCaseReport.gapPairs.find(
        (gapPair) =>
          gapPair.leftClusterId === entry.clusterId || gapPair.rightClusterId === entry.clusterId,
      );
      expect(cluster).toBeDefined();
      expect(entry.reaction.body.length).toBeLessThanOrEqual(200);
      expect(entry.reaction.body).toContain(cluster?.label ?? "");
      expect(entry.reaction.body).toContain(`${String(cluster?.paperCount ?? 0)}편`);
      expect(entry.reaction.body).toContain(cluster?.concepts[0]?.label ?? "");
      expect(entry.nearestGapLabel).toBe(relatedGap?.displayLabel);
      expect(entry.representativePaperTitles).toBeDefined();
      expect((entry.representativePaperTitles ?? []).length).toBeGreaterThan(0);
    }

    // Gap reaction body는 prepared reaction state (synced surface)로만 사용된다.
    // overlay UI는 metaQualitative/proposals를 읽고, body는 직접 표시되지 않는다.
    // gapNarratives 없는 fallback 경로에서 body는 templated cluster-pair 또는
    // hypothesis description을 200자 한도 안에서 닫는다.
    for (const entry of preparation.gapReactions) {
      const gapPair = worstCaseReport.gapPairs.find((gp) => gp.id === entry.gapPairId);
      expect(gapPair).toBeDefined();
      expect(entry.reaction.body.length).toBeLessThanOrEqual(200);
      expect(entry.reaction.body).toContain(gapPair?.leftLabel ?? "");
      expect(entry.reaction.body).toContain(gapPair?.rightLabel ?? "");
    }
  });
});
