// LLM 산출 narrative는 cluster overlay body로 사용자에게 노출되므로 aspect:visible-explanation-sufficiency
// (사용자 가시 설명 충분성) sufficiency 축의 pointcut이다. 라벨/키워드 단순 반복으로
// 닫지 않고 접근·목적·방법을 구체적으로 서술하도록 강제한다 — live judge는
// `cluster-card-intent-qualitative.live.test.tsx`가 측정.
import { z } from "zod";
import type { GapNetworkCluster, GraphPaperSnapshot } from "@/app/domain/research-route-payload";
import { GAP_NETWORK_CLUSTER_LIMIT } from "@/app/lib/constants";
import { executeJudgment, type LLMJudgmentUsageLedger } from "@/app/server/ai-generation/judgment";
import {
  buildGapNetworkJudgmentBudget,
  projectGapNetworkPromptText,
} from "./gap-network-prompt-budget";

const clusterNarrativeItemSchema = z.object({
  clusterId: z.string(),
  narrative: z.string().min(1).max(120),
});

const clusterNarrativeOutputSchema = z.object({
  narratives: z.array(clusterNarrativeItemSchema),
});

export type ClusterNarrativeMap = Map<string, string>;

export interface InterpretClusterNarrativesParams {
  query: string;
  clusters: readonly GapNetworkCluster[];
  papersById: Map<string, GraphPaperSnapshot>;
  usageLedger?: LLMJudgmentUsageLedger;
}

function buildClusterNarrativePrompt(params: InterpretClusterNarrativesParams): string {
  const clusterInputs = params.clusters.slice(0, GAP_NETWORK_CLUSTER_LIMIT).map((cluster) => {
    const topPapers = (cluster.topPaperIds ?? []).slice(0, 3).flatMap((paperId) => {
      const paper = params.papersById.get(paperId);
      if (!paper) return [];
      return [
        {
          title: projectGapNetworkPromptText(paper.title, "titleBytes"),
          abstract: paper.abstract
            ? projectGapNetworkPromptText(paper.abstract, "abstractBytes")
            : "",
        },
      ];
    });
    return {
      clusterId: projectGapNetworkPromptText(cluster.id, "idBytes"),
      label: projectGapNetworkPromptText(cluster.label, "labelBytes"),
      concepts: cluster.concepts
        .slice(0, 6)
        .map((concept) => projectGapNetworkPromptText(concept.label, "conceptBytes")),
      topPapers,
    };
  });

  return [
    "당신은 검색 결과 기반 연구 군집(cluster)을 요약하는 연구 도우미다.",
    `사용자 검색어: ${projectGapNetworkPromptText(params.query, "queryBytes")}`,
    "",
    "각 클러스터에 대해, **그 군집이 실제로 어떤 연구 작업을 수행하는지**를 드러내는 한국어 한 문장(100자 이내)을 생성한다.",
    "규칙:",
    "- 라벨이나 키워드를 단순 나열·반복하지 말 것.",
    "- 대표 논문 제목/요약을 참고해 연구의 접근·목적·방법을 구체적으로 서술할 것.",
    "- 모호한 일반론('AI를 연구하는 군집이다') 금지. 실제 작업 결이 드러나야 한다.",
    "- 각 문장은 100자 이내, 끝맺음은 '~다'로.",
    "- 입력 클러스터 순서대로 narratives 배열에 담아 반환한다.",
    "",
    "입력 JSON:",
    JSON.stringify({ clusters: clusterInputs }, null, 2),
    "",
    '출력 JSON: {"narratives": [{"clusterId": "...", "narrative": "..."}, ...]}',
  ].join("\n");
}

export async function interpretClusterNarratives(
  params: InterpretClusterNarrativesParams,
): Promise<ClusterNarrativeMap> {
  if (params.clusters.length === 0) {
    return new Map();
  }

  const prompt = buildClusterNarrativePrompt(params);
  const result = await executeJudgment({
    prompt,
    outputSchema: clusterNarrativeOutputSchema,
    label: "interpret-cluster-narrative",
    ...buildGapNetworkJudgmentBudget("clusterNarrative", prompt),
    onError: "fallback",
    fallbackValue: { narratives: [] },
    usageLedger: params.usageLedger,
  });

  const map: ClusterNarrativeMap = new Map();
  for (const item of result.narratives) {
    map.set(item.clusterId, item.narrative.trim());
  }
  return map;
}
