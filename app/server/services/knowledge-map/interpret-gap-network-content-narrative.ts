// gap report 본문(content markdown)에 들어갈 종합 narrative 생성.
// intent-check:gap-cluster-differentiation (Cluster Differentiation) + intent-check:gap-inference-transparency (Gap Inference
// Transparency) sufficiency 축의 입력. live judge는 `gap-network-content-intent-qualitative.live.test.tsx`.
import { z } from "zod";
import type {
  GapNetworkCluster,
  GapNetworkContentNarrative,
  GapPair,
} from "@/app/domain/research-route-payload";
import { GAP_NETWORK_CLUSTER_LIMIT } from "@/app/lib/constants";
import { executeJudgment, type LLMJudgmentUsageLedger } from "@/app/server/ai-generation/judgment";
import {
  buildGapNetworkJudgmentBudget,
  projectGapNetworkFallbackText,
  projectGapNetworkPromptText,
} from "./gap-network-prompt-budget";

const clusterParagraphSchema = z.object({
  clusterId: z.string(),
  paragraph: z.string().min(1).max(360),
});

const contentNarrativeOutputSchema = z.object({
  overview: z.string().min(1).max(360),
  clusterParagraphs: z.array(clusterParagraphSchema),
  gapInferenceParagraph: z.string().min(1).max(420),
});

export type { GapNetworkContentNarrative } from "@/app/domain/research-route-payload";

export interface InterpretGapNetworkContentNarrativeParams {
  query: string;
  domainLabel: string | null;
  clusters: readonly GapNetworkCluster[];
  gapPairs: readonly GapPair[];
  usageLedger?: LLMJudgmentUsageLedger;
}

function buildContentNarrativePrompt(params: InterpretGapNetworkContentNarrativeParams): string {
  const clusterInputs = params.clusters.slice(0, GAP_NETWORK_CLUSTER_LIMIT).map((cluster) => ({
    clusterId: projectGapNetworkPromptText(cluster.id, "idBytes"),
    label: projectGapNetworkPromptText(cluster.label, "labelBytes"),
    paperCount: cluster.paperCount,
    narrative: cluster.narrative
      ? projectGapNetworkPromptText(cluster.narrative, "narrativeBytes")
      : null,
    topConcepts: cluster.concepts
      .slice(0, 6)
      .map((concept) => projectGapNetworkPromptText(concept.label, "conceptBytes")),
  }));

  const topGaps = params.gapPairs.slice(0, 3).map((gap) => ({
    displayLabel: projectGapNetworkPromptText(gap.displayLabel, "labelBytes"),
    leftLabel: projectGapNetworkPromptText(gap.leftLabel, "labelBytes"),
    rightLabel: projectGapNetworkPromptText(gap.rightLabel, "labelBytes"),
    bridgeConcepts: gap.bridgeConcepts
      .slice(0, 4)
      .map((concept) => projectGapNetworkPromptText(concept, "conceptBytes")),
    expected: Number(gap.expected.toFixed(2)),
    observed: gap.observed,
    gapScore: Number(gap.gapScore.toFixed(2)),
  }));

  return [
    "당신은 검색 결과로 도출된 연구 공백 리포트를 한국어로 종합 서술하는 연구 도우미다.",
    `사용자 검색어: ${projectGapNetworkPromptText(params.query, "queryBytes")}`,
    `도출된 학문 분야: ${params.domainLabel ? projectGapNetworkPromptText(params.domainLabel, "domainLabelBytes") : "(미도출 — 클러스터 라벨로 직접 묶어 서술)"}`,
    "",
    "다음 3 섹션을 모두 생성한다.",
    "",
    "**1) overview** (2~3문장, 360자 이내)",
    "- 도출된 학문 분야 안에서 클러스터들이 어떤 위상에 놓여 있는지 전체 조망을 한 단락으로 묶어 서술한다.",
    "- 클러스터 라벨/논문 수의 단순 나열 금지. 분야 안에서 묶음들의 관계·비교 시각이 드러나야 한다.",
    "- 메트릭(논문 수, 클러스터 수) 자체는 1~2개 정도만 자연스럽게 녹여도 된다.",
    "",
    "**2) clusterParagraphs** (입력 클러스터 순서대로, 각 80~360자)",
    "- 각 클러스터에 대해 (a) 그 묶음의 생성 배경 — 어떤 연구 결을 한 묶음으로 묶었는지 — 와 (b) 다른 클러스터(들)와의 차이를 비교 형태로 함께 서술한다.",
    "- 'A는 …에 집중하지만 B는 …에 집중한다' 같은 명시적 대조문을 최소 1회 포함할 것.",
    "- 라벨/논문 수 단순 paraphrase 금지. narrative와 topConcepts를 활용해 묶음 동기를 드러낼 것.",
    "- 영문으로 들어온 기법명/모델명은 영문 원형 보존.",
    "",
    "**3) gapInferenceParagraph** (3~5문장, 420자 이내)",
    "- 공백을 어떤 방법으로 추론했는지 사용자가 추적 가능한 형태로 서술한다.",
    "- 다음 신호를 모두 언급할 것: (i) 클러스터 크기 기반 기대 교차 연결 수(expected) 대비 실제 연결 수(observed) 비교, (ii) 두 클러스터를 잇는 매개 개념(bridgeConcepts) 활용, (iii) 인접성/네트워크 위치 신호.",
    "- 입력 topGaps 중 1~2개를 그 방법의 예시로 짚어 라벨과 함께 한 문장으로 보여줄 것 (수치 dump 금지 — 추론 경로의 예시로만 활용).",
    "",
    "출력 JSON 스키마:",
    '{"overview": "...", "clusterParagraphs": [{"clusterId": "...", "paragraph": "..."}, ...], "gapInferenceParagraph": "..."}',
    "",
    "입력 JSON:",
    JSON.stringify({ clusters: clusterInputs, topGaps }, null, 2),
  ].join("\n");
}

function buildFallbackNarrative(
  params: InterpretGapNetworkContentNarrativeParams,
): GapNetworkContentNarrative {
  const domainPart = params.domainLabel
    ? projectGapNetworkPromptText(params.domainLabel, "domainLabelBytes")
    : projectGapNetworkPromptText(params.query, "queryBytes");
  const overview = projectGapNetworkFallbackText(
    `${domainPart} 영역에서 ${String(params.clusters.length)}개 클러스터가 도출되었고, 각 묶음은 인접한 연구 결을 공유하면서 서로 다른 접근을 취한다.`,
    360,
  );

  const clusterParagraphs = params.clusters.map((cluster) => {
    const otherLabels = params.clusters
      .filter((other) => other.id !== cluster.id)
      .map((other) => projectGapNetworkPromptText(other.label, "labelBytes"))
      .slice(0, 2)
      .join(" · ");
    const clusterLabel = projectGapNetworkPromptText(cluster.label, "labelBytes");
    const narrativeBit = cluster.narrative
      ? projectGapNetworkPromptText(cluster.narrative, "narrativeBytes")
      : `${clusterLabel} 결을 공유하는 ${String(cluster.paperCount)}편의 논문 묶음.`;
    const contrast =
      otherLabels.length > 0
        ? ` ${clusterLabel}이(가) ${otherLabels}와 다른 결을 갖는 묶음으로 분리되었다.`
        : "";
    return {
      clusterId: cluster.id,
      paragraph: projectGapNetworkFallbackText(`${narrativeBit}${contrast}`, 360),
    };
  });

  const topGap = params.gapPairs.at(0);
  const displayLabel = topGap ? projectGapNetworkPromptText(topGap.displayLabel, "labelBytes") : "";
  const bridgeConcepts = topGap
    ? topGap.bridgeConcepts
        .slice(0, 2)
        .map((concept) => projectGapNetworkPromptText(concept, "conceptBytes"))
        .join(", ")
    : "";
  const gapInference = projectGapNetworkFallbackText(
    topGap
      ? `클러스터 크기로 기대 교차 연결 수를 추정하고 실제 연결 수와 비교해 공백을 계산했다. 매개 개념과 인접 클러스터 신호를 보조로 활용한다. 예: ${displayLabel}은(는) 두 묶음 사이에서 매개 개념(${bridgeConcepts || "없음"})으로 식별된 공백.`
      : "클러스터 크기로 기대 교차 연결 수를 추정하고 실제 연결 수와 비교해 공백을 계산했다. 매개 개념과 인접 클러스터 신호를 보조로 활용한다.",
    420,
  );

  return {
    overview,
    clusterParagraphs,
    gapInferenceParagraph: gapInference,
  };
}

export async function interpretGapNetworkContentNarrative(
  params: InterpretGapNetworkContentNarrativeParams,
): Promise<GapNetworkContentNarrative> {
  if (params.clusters.length === 0) {
    return {
      overview: "",
      clusterParagraphs: [],
      gapInferenceParagraph: "",
    };
  }

  const prompt = buildContentNarrativePrompt(params);
  const result = await executeJudgment({
    prompt,
    outputSchema: contentNarrativeOutputSchema,
    label: "interpret-gap-network-content-narrative",
    ...buildGapNetworkJudgmentBudget("contentNarrative", prompt),
    onError: "fallback",
    fallbackValue: {
      overview: "",
      clusterParagraphs: [],
      gapInferenceParagraph: "",
    },
    usageLedger: params.usageLedger,
  });

  if (
    result.overview.trim().length === 0 ||
    result.clusterParagraphs.length === 0 ||
    result.gapInferenceParagraph.trim().length === 0
  ) {
    return buildFallbackNarrative(params);
  }

  return {
    overview: result.overview.trim(),
    clusterParagraphs: result.clusterParagraphs.map((item) => ({
      clusterId: item.clusterId,
      paragraph: item.paragraph.trim(),
    })),
    gapInferenceParagraph: result.gapInferenceParagraph.trim(),
  };
}
