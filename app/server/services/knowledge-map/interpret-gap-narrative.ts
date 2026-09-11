// Gap overlay body는 1~3개 evidence-based hypothesis proposals + 정성 meta로 구성된다.
// 각 proposal은 {hypothesis, grounding}: hypothesis는 어떤 연구 방향·접근인지,
// grounding은 시스템 자원(군집 라벨/개념·매개 개념·대표 논문) 인용 근거.
// meta는 두 군집의 결과 gap의 character를 함께 묘사하는 정성 한 줄 (수치 없음).
// aspect:visible-explanation-sufficiency (사용자 가시 설명 충분성) sufficiency 축의 pointcut이며 live judge는
// `gap-card-intent-qualitative.live.test.tsx`가 측정.
//
// 오염 차단 (2026-04-30 reality signal): `interpretGapNetworkHypotheses`가 fallback으로
// 빠지면 모든 gap의 `report.insight.hypotheses[].description`이 같은 i18n 템플릿
// ("...관련 키워드는 공유하지만 직접 연결은 아직 약하다 ...")으로 채워진다. 본 서비스는
// (a) LLM 프롬프트 입력에서 hypothesisDescription을 제외해 contamination을 끊고,
// (b) fallback path도 hypothesis.description을 쓰지 않고 gapPair-specific facts(매개
// 개념·left/rightConcepts)에서 per-gap 다양성을 만들도록 합성한다.
import { z } from "zod";
import type {
  GapHypothesisProposal,
  GapNetworkCluster,
  GapPair,
  GraphPaperSnapshot,
} from "@/app/domain/research-route-payload";
import { GAP_NETWORK_GAP_PAIR_LIMIT } from "@/app/lib/constants";
import { executeJudgment, type LLMJudgmentUsageLedger } from "@/app/server/ai-generation/judgment";
import {
  buildGapNetworkJudgmentBudget,
  projectGapNetworkFallbackText,
  projectGapNetworkPromptText,
} from "./gap-network-prompt-budget";

const proposalSchema = z.object({
  hypothesis: z.string().min(30).max(500),
  grounding: z.string().min(30).max(500),
});

const gapNarrativeItemSchema = z.object({
  gapPairId: z.string(),
  metaQualitative: z.string().min(15).max(240),
  proposals: z.array(proposalSchema).min(1).max(3),
});

const gapNarrativeOutputSchema = z.object({
  narratives: z.array(gapNarrativeItemSchema),
});

export interface GapNarrativePayload {
  metaQualitative: string;
  proposals: GapHypothesisProposal[];
}

export type GapNarrativeMap = Map<string, GapNarrativePayload>;

export interface InterpretGapNarrativesParams {
  query: string;
  gapPairs: readonly GapPair[];
  clustersById: Map<string, GapNetworkCluster>;
  papersById?: ReadonlyMap<string, GraphPaperSnapshot>;
  usageLedger?: LLMJudgmentUsageLedger;
}

const DOMAIN_TERM_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/자율\s*LLM\s*에이전트/g, "Autonomous LLM Agents"],
  [/검색\s*증강\s*생성/g, "Retrieval-Augmented Generation"],
  [/장기\s*검색/g, "long-horizon retrieval"],
];

function preserveDomainTerms(text: string): string {
  return DOMAIN_TERM_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text.trim().replace(/\s+/g, " "),
  );
}

function resolveRepresentativeTitles(
  cluster: GapNetworkCluster | undefined,
  papersById: InterpretGapNarrativesParams["papersById"],
): string[] {
  if (!cluster || !papersById) return [];
  const topIds = cluster.topPaperIds ?? [];
  return topIds
    .map((paperId) => papersById.get(paperId)?.title)
    .filter((title): title is string => typeof title === "string" && title.trim().length > 0)
    .slice(0, 3);
}

function buildGapNarrativePrompt(params: InterpretGapNarrativesParams): string {
  const gapInputs = params.gapPairs.slice(0, GAP_NETWORK_GAP_PAIR_LIMIT).map((gapPair) => {
    const leftCluster = params.clustersById.get(gapPair.leftClusterId);
    const rightCluster = params.clustersById.get(gapPair.rightClusterId);
    const leftConceptLabels = leftCluster
      ? leftCluster.concepts.slice(0, 5).map((concept) => concept.label)
      : gapPair.leftConcepts.slice(0, 5);
    const rightConceptLabels = rightCluster
      ? rightCluster.concepts.slice(0, 5).map((concept) => concept.label)
      : gapPair.rightConcepts.slice(0, 5);
    const leftPapers = resolveRepresentativeTitles(leftCluster, params.papersById);
    const rightPapers = resolveRepresentativeTitles(rightCluster, params.papersById);
    return {
      gapPairId: projectGapNetworkPromptText(gapPair.id, "idBytes"),
      leftLabel: projectGapNetworkPromptText(gapPair.leftLabel, "labelBytes"),
      rightLabel: projectGapNetworkPromptText(gapPair.rightLabel, "labelBytes"),
      leftConcepts: leftConceptLabels.map((concept) =>
        projectGapNetworkPromptText(concept, "conceptBytes"),
      ),
      rightConcepts: rightConceptLabels.map((concept) =>
        projectGapNetworkPromptText(concept, "conceptBytes"),
      ),
      bridgeConcepts: gapPair.bridgeConcepts
        .slice(0, 5)
        .map((concept) => projectGapNetworkPromptText(concept, "conceptBytes")),
      leftRepresentativePapers: leftPapers.map((title) =>
        projectGapNetworkPromptText(title, "titleBytes"),
      ),
      rightRepresentativePapers: rightPapers.map((title) =>
        projectGapNetworkPromptText(title, "titleBytes"),
      ),
    };
  });

  return [
    "당신은 검색 결과 기반 연구 공백(gap)을 해설하는 연구 도우미다.",
    `사용자 검색어: ${projectGapNetworkPromptText(params.query, "queryBytes")}`,
    "",
    "각 gap에 대해 두 가지를 만들어 반환한다.",
    "",
    "도메인 용어 보존 규칙(매우 중요):",
    "- 입력으로 주어진 cluster 라벨·concept·bridgeConcept·논문 제목은 영문이면 영문 그대로 보존한다.",
    "- 'Autonomous LLM Agents'를 '자율 LLM 에이전트'로, 'Retrieval-Augmented Generation'을 '검색 증강 생성'으로, 'long-horizon retrieval'을 '장기 검색'으로 번역하지 마라.",
    '- 한국어 자연 문장 안에 영문 도메인 용어를 그대로 끼워 넣는다 — 예: "Memory & Retrieval-Augmented LLMs 결의 long-horizon retrieval 자산을 활용해...".',
    "- 한국어로 자연스럽게 풀 수 있는 일반 어휘(연구·접근·작업·평가 등)는 한국어로 쓴다. 도메인 고유명사·기법명·논문 제목·약어(RAG·LLM 등)만 영문 보존.",
    "",
    "(1) metaQualitative — 두 군집의 결과 gap의 character를 함께 묘사하는 한국어 한 줄(2~3절, 60~150자).",
    "    규칙:",
    "    - 두 cluster 라벨을 영문 그대로 자연스럽게 포함하되 단순 'X ↔ Y' 나열은 금지.",
    "    - 어떤 결의 미탐색 영역인지 character가 드러나야 한다 — 두 군집이 무엇을 다루는지 + 왜 직접 만나지 못했는지.",
    "    - 숫자(gap score / expected / observed)는 절대 포함하지 않는다.",
    "    - 끝맺음은 '~다' 또는 명사구로 닫는다.",
    "",
    "(2) proposals — 1~3개의 evidence-based hypothesis 제안. 각 항목은 두 필드를 가진다.",
    "    - hypothesis: 어떤 연구 작업·접근인지 2~3문장으로 충분히 서술 (80~280자). 작업이 무엇인지(어떤 데이터·모델·방법) + 왜 의미 있는지(어떤 문제를 풀거나 어떤 능력을 만드는지)가 함께 드러나야 한다. '두 분야를 결합하자' 류 일반론, 한 문장 짧은 슬로건은 금지.",
    "    - grounding: 그 가설이 어떤 자원에서 도출됐는지 2~3문장으로 충분히 서술 (80~280자). 입력에 주어진 군집 라벨·concept·bridgeConcept·대표 논문 제목 중 둘 이상을 명시적으로 인용하고, 그 자원들이 가설의 어떤 구성요소를 뒷받침하는지를 함께 보여라. 입력에 없는 개념·논문은 인용하지 마라.",
    "    - 가설 개수는 자원이 풍부할 때만 늘린다 — bridgeConcepts·representativePapers에서 명확한 결이 더 잡히면 2~3개, 아니면 1개로 닫는다.",
    "    - 각 hypothesis는 결이 서로 달라야 한다. 같은 결을 표현만 바꿔 반복하면 안 된다.",
    "",
    "다양성 규칙(중요):",
    "- 여러 gap에 걸쳐 같은 phrasing(예: '관련 키워드는 공유하지만 직접 연결은 아직 약하다' 류)을 반복하지 마라.",
    "- 각 gap은 자기 군집·매개 개념·논문 결에서 도출된 고유한 표현으로 닫혀야 한다.",
    "",
    "출력 표현 규칙:",
    "- 입력 JSON의 필드명(`leftLabel`/`rightLabel`/`leftConcepts`/`rightConcepts`/`bridgeConcepts`/`leftRepresentativePapers`/`rightRepresentativePapers` 등)을 출력 문장에 노출하지 마라.",
    '- bridgeConcepts에 담긴 항목을 인용할 때는 "매개 개념" 또는 자연 한국어 표현으로 부른다 ("bridgeConcept인 X" 같은 직접 노출 금지).',
    '- representativePapers에 담긴 제목을 인용할 때는 "대표 논문 X" 또는 "논문 X"로 부른다.',
    "",
    "입력 JSON:",
    JSON.stringify({ gaps: gapInputs }, null, 2),
    "",
    '출력 JSON: {"narratives": [{"gapPairId": "...", "metaQualitative": "...", "proposals": [{"hypothesis": "...", "grounding": "..."}, ...]}, ...]}',
  ].join("\n");
}

function projectGapNarrativeFacts(params: {
  gapPair: GapPair;
  leftCluster: GapNetworkCluster | undefined;
  rightCluster: GapNetworkCluster | undefined;
}) {
  const { gapPair, leftCluster, rightCluster } = params;
  return {
    leftLabel: projectGapNetworkPromptText(gapPair.leftLabel, "labelBytes"),
    rightLabel: projectGapNetworkPromptText(gapPair.rightLabel, "labelBytes"),
    leftConcept: projectGapNetworkPromptText(
      leftCluster?.concepts[0]?.label ?? gapPair.leftConcepts.at(0) ?? gapPair.leftLabel,
      "conceptBytes",
    ),
    rightConcept: projectGapNetworkPromptText(
      rightCluster?.concepts[0]?.label ?? gapPair.rightConcepts.at(0) ?? gapPair.rightLabel,
      "conceptBytes",
    ),
    bridges: gapPair.bridgeConcepts
      .filter((concept) => concept.trim().length > 0)
      .map((concept) => projectGapNetworkPromptText(concept, "conceptBytes")),
  };
}

function buildDeterministicGapMeta(params: {
  gapPair: GapPair;
  leftCluster: GapNetworkCluster | undefined;
  rightCluster: GapNetworkCluster | undefined;
}): string {
  const { leftLabel, rightLabel, leftConcept, rightConcept, bridges } =
    projectGapNarrativeFacts(params);
  const bridge = bridges[0];

  const bridgeClause = bridge ? `매개 개념 ${bridge}로 직접 이어지지 못한` : "직접 이어지지 못한";

  return projectGapNetworkFallbackText(
    preserveDomainTerms(
      `${leftLabel}의 ${leftConcept} 흐름과 ${rightLabel}의 ${rightConcept} 흐름이 ${bridgeClause} 미탐색 연구 공백이다.`,
    ),
    240,
  );
}

function hasMetricNumber(text: string): boolean {
  return (
    /\b(?:gap\s*score|expected|observed)\b/i.test(text) ||
    /(?:기대|실제|관찰|연결)\s*\d/.test(text) ||
    /\d\s*(?:개|점|편)/.test(text)
  );
}

function hasKnownTranslatedDomainTerm(text: string): boolean {
  return DOMAIN_TERM_REPLACEMENTS.some(([pattern]) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

function normalizeGapNarrativePayload(params: {
  gapPair: GapPair;
  leftCluster: GapNetworkCluster | undefined;
  rightCluster: GapNetworkCluster | undefined;
  payload: GapNarrativePayload;
}): GapNarrativePayload {
  const rawMeta = params.payload.metaQualitative;
  const meta = preserveDomainTerms(rawMeta);
  const metaIsValid =
    meta.length >= 15 &&
    meta.length <= 240 &&
    !rawMeta.includes("\n") &&
    !hasMetricNumber(meta) &&
    !hasKnownTranslatedDomainTerm(rawMeta) &&
    meta.includes(params.gapPair.leftLabel) &&
    meta.includes(params.gapPair.rightLabel);

  return {
    metaQualitative: metaIsValid
      ? meta
      : buildDeterministicGapMeta({
          gapPair: params.gapPair,
          leftCluster: params.leftCluster,
          rightCluster: params.rightCluster,
        }),
    proposals: params.payload.proposals.map((proposal) => ({
      hypothesis: preserveDomainTerms(proposal.hypothesis),
      grounding: preserveDomainTerms(proposal.grounding),
    })),
  };
}

function buildPerGapFallbackPayload(params: {
  gapPair: GapPair;
  leftCluster: GapNetworkCluster | undefined;
  rightCluster: GapNetworkCluster | undefined;
  papersById: InterpretGapNarrativesParams["papersById"];
}): GapNarrativePayload {
  const { gapPair, leftCluster, rightCluster, papersById } = params;
  const { leftLabel, rightLabel, leftConcept, rightConcept, bridges } =
    projectGapNarrativeFacts(params);
  const leftPaperSource = resolveRepresentativeTitles(leftCluster, papersById)[0];
  const rightPaperSource = resolveRepresentativeTitles(rightCluster, papersById)[0];
  const leftPaper = leftPaperSource
    ? projectGapNetworkPromptText(leftPaperSource, "titleBytes")
    : undefined;
  const rightPaper = rightPaperSource
    ? projectGapNetworkPromptText(rightPaperSource, "titleBytes")
    : undefined;

  // metaQualitative: 두 cluster 라벨(영문이면 영문 그대로)을 자연 한국어 문장에 끼워 넣는다.
  const metaQualitative = buildDeterministicGapMeta({ gapPair, leftCluster, rightCluster });

  // proposals: gapPair-specific facts에서 합성. bridgeConcept이 있으면 그걸 인용,
  // 없으면 leftConcept × rightConcept 직접 결합. 항상 1개 fallback. 두 문장 이상으로 충분한 설명.
  const hypothesis = bridges[0]
    ? `${leftLabel} 결의 ${leftConcept}을 ${rightLabel} 결의 ${rightConcept}에 연결하며 ${bridges[0]}를 매개 축으로 두는 연구 작업이 의미 있을 수 있다. 두 군집이 직접 만나는 논문이 부족한 상태에서 이 매개 축을 통한 검증이 새로운 교차 결을 여는 출발점이 된다.`
    : `${leftLabel} 결의 ${leftConcept}과 ${rightLabel} 결의 ${rightConcept}을 직접 결합한 탐색적 연구가 두 결을 잇는 출발점이 될 수 있다. 두 군집이 같은 흐름으로 다뤄지지 않은 만큼, 직접 결합 자체가 어떤 능력을 만드는지를 측정하는 작업이 우선이다.`;
  const grounding = bridges[0]
    ? `매개 개념 "${bridges[0]}"이 ${leftLabel}·${rightLabel} 두 군집에서 공통 결로 식별되며, 두 군집의 핵심 개념(${leftConcept}, ${rightConcept})이 이 매개를 통해 자연스럽게 이어질 수 있는 단서를 제공한다.`
    : leftPaper && rightPaper
      ? `대표 논문 "${leftPaper}"과 "${rightPaper}"가 각각 ${leftLabel}·${rightLabel} 결을 대표하지만 두 결이 직접 만나는 후속 작업은 비어 있어, 두 논문의 접근을 결합한 후속 연구가 가설의 검증 출발점이 된다.`
      : `${leftConcept}과 ${rightConcept}이 ${leftLabel}·${rightLabel} 두 군집의 핵심 개념이지만 직접 만나는 논문이 부족하며, 이 두 개념의 합성이 가설의 첫 검증 축이 된다.`;

  return {
    metaQualitative,
    proposals: [
      {
        hypothesis: projectGapNetworkFallbackText(preserveDomainTerms(hypothesis), 500),
        grounding: projectGapNetworkFallbackText(preserveDomainTerms(grounding), 500),
      },
    ],
  };
}

export async function interpretGapNarratives(
  params: InterpretGapNarrativesParams,
): Promise<GapNarrativeMap> {
  const map: GapNarrativeMap = new Map();
  if (params.gapPairs.length === 0) {
    return map;
  }

  const prompt = buildGapNarrativePrompt(params);
  const result = await executeJudgment({
    prompt,
    outputSchema: gapNarrativeOutputSchema,
    label: "interpret-gap-narrative",
    ...buildGapNetworkJudgmentBudget("gapNarrative", prompt),
    onError: "fallback",
    fallbackValue: { narratives: [] },
    usageLedger: params.usageLedger,
  });

  for (const item of result.narratives) {
    const gapPair = params.gapPairs.find((candidate) => candidate.id === item.gapPairId);
    if (!gapPair) {
      continue;
    }
    map.set(item.gapPairId, {
      metaQualitative: item.metaQualitative.trim(),
      proposals: item.proposals.map((proposal) => ({
        hypothesis: proposal.hypothesis.trim(),
        grounding: proposal.grounding.trim(),
      })),
    });
  }

  for (const gapPair of params.gapPairs) {
    const payload = map.get(gapPair.id);
    if (!payload) continue;
    map.set(
      gapPair.id,
      normalizeGapNarrativePayload({
        gapPair,
        leftCluster: params.clustersById.get(gapPair.leftClusterId),
        rightCluster: params.clustersById.get(gapPair.rightClusterId),
        payload,
      }),
    );
  }

  // LLM이 일부 gap을 누락하거나 전체 fallback으로 빠진 경우, 누락된 gap을
  // gapPair-specific facts에서 per-gap 다양성을 가진 fallback으로 채운다.
  // hypothesis.description(상위 LLM의 fallback 템플릿)은 사용하지 않는다 —
  // contamination 차단.
  for (const gapPair of params.gapPairs) {
    if (!map.has(gapPair.id)) {
      map.set(
        gapPair.id,
        buildPerGapFallbackPayload({
          gapPair,
          leftCluster: params.clustersById.get(gapPair.leftClusterId),
          rightCluster: params.clustersById.get(gapPair.rightClusterId),
          papersById: params.papersById,
        }),
      );
    }
  }

  return map;
}
