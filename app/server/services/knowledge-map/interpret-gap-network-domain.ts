// 분석된 학문 분야 도출 — gap report 타이틀과 본문 도입부에 들어가는 분야명을
// query + cluster labels에서 1-shot LLM 분류로 도출한다. intent-check:gap-domain-framing (Domain
// Framing) sufficiency 축의 입력. live judge는 `gap-network-content-intent-qualitative.live.test.tsx`.
import { z } from "zod";
import type { GapNetworkCluster } from "@/app/domain/research-route-payload";
import { GAP_NETWORK_CLUSTER_LIMIT } from "@/app/lib/constants";
import { executeJudgment, type LLMJudgmentUsageLedger } from "@/app/server/ai-generation/judgment";
import {
  buildGapNetworkJudgmentBudget,
  projectGapNetworkPromptText,
} from "./gap-network-prompt-budget";

const domainOutputSchema = z.object({
  domainLabel: z.string().min(1).max(60),
});

export interface InterpretGapNetworkDomainParams {
  query: string;
  clusters: readonly GapNetworkCluster[];
  usageLedger?: LLMJudgmentUsageLedger;
}

function buildDomainPrompt(params: InterpretGapNetworkDomainParams): string {
  const clusterInputs = params.clusters.slice(0, GAP_NETWORK_CLUSTER_LIMIT).map((cluster) => ({
    label: projectGapNetworkPromptText(cluster.label, "labelBytes"),
    concepts: cluster.concepts
      .slice(0, 6)
      .map((concept) => projectGapNetworkPromptText(concept.label, "conceptBytes")),
    narrative: cluster.narrative
      ? projectGapNetworkPromptText(cluster.narrative, "narrativeBytes")
      : null,
  }));

  return [
    "당신은 학술 검색 결과의 클러스터들을 묶는 학문 분야명을 한국어로 도출하는 연구 도우미다.",
    `사용자 검색어: ${projectGapNetworkPromptText(params.query, "queryBytes")}`,
    "",
    "주어진 클러스터들이 공통으로 속한 학문 분야 또는 연구 영역을 한국어 명사구 한 줄(60자 이내)로 도출한다.",
    "규칙:",
    "- 검색어를 그대로 echo하지 말고, 클러스터들이 공유하는 상위 영역을 추론해 학문/기술 영역명으로 답할 것.",
    "- 너무 일반적인 분류('인공지능', '컴퓨터 과학') 금지. 사용자가 실제로 어느 영역의 연구 지형을 보고 있는지 식별 가능한 수준 (예: '강화학습 기반 자율 에이전트', '대규모 언어 모델의 추론 강화').",
    "- 영문 도메인 용어/기법명/모델명은 영문 원형으로 보존해도 좋다 (예: 'Transformer 기반 언어 모델 사전학습').",
    "- 끝맺음 조사/어미 없이 명사구로.",
    "",
    "입력 JSON:",
    JSON.stringify({ clusters: clusterInputs }, null, 2),
    "",
    '출력 JSON: {"domainLabel": "..."}',
  ].join("\n");
}

export async function interpretGapNetworkDomain(
  params: InterpretGapNetworkDomainParams,
): Promise<string | null> {
  if (params.clusters.length === 0) {
    return null;
  }

  const prompt = buildDomainPrompt(params);
  const result = await executeJudgment({
    prompt,
    outputSchema: domainOutputSchema,
    label: "interpret-gap-network-domain",
    ...buildGapNetworkJudgmentBudget("domain", prompt),
    onError: "fallback",
    fallbackValue: { domainLabel: "" },
    usageLedger: params.usageLedger,
  });

  const trimmed = result.domainLabel.trim();
  return trimmed.length === 0 ? null : trimmed;
}
