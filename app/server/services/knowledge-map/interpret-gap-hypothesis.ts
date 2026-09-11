import { z } from "zod";
import type {
  GapNetworkInsight,
  GapNetworkReport,
  GraphPaperSnapshot,
} from "@/app/domain/research-route-payload";
import { executeJudgment, type LLMJudgmentUsageLedger } from "@/app/server/ai-generation/judgment";
import { t } from "@/app/i18n/message-access";
import { buildOrderedClusterEntries } from "./cluster-artifacts";
import {
  buildGapNetworkJudgmentBudget,
  projectGapNetworkPromptText,
} from "./gap-network-prompt-budget";

interface GapNetworkClusterSeed {
  id: number | string;
  label: string;
  paperIds: string[];
}

type GapNetworkInterpretReport = Omit<GapNetworkReport, "insight">;

const gapHypothesisSchema = z.object({
  id: z.string(),
  gapPairId: z.string(),
  title: z.string(),
  description: z.string(),
  sourceConcept: z.string(),
  targetConcept: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

const gapNetworkInsightSchema = z.object({
  hypotheses: z.array(gapHypothesisSchema).default([]),
});

function buildFallbackInsight(report: GapNetworkInterpretReport): GapNetworkInsight {
  return {
    hypotheses: report.gapPairs.slice(0, 5).map((gapPair, index) => {
      const sourceConcept = projectGapNetworkPromptText(
        gapPair.leftConcepts[0] ?? gapPair.leftLabel,
        "conceptBytes",
      );
      const targetConcept = projectGapNetworkPromptText(
        gapPair.rightConcepts[0] ?? gapPair.rightLabel,
        "conceptBytes",
      );
      const leftLabel = projectGapNetworkPromptText(gapPair.leftLabel, "labelBytes");
      const rightLabel = projectGapNetworkPromptText(gapPair.rightLabel, "labelBytes");
      const bridgeConcept = projectGapNetworkPromptText(
        gapPair.bridgeConcepts[0] ?? "",
        "conceptBytes",
      );
      const confidence = gapPair.bridgeConcepts.length > 0 ? "medium" : "low";

      return {
        id: `hyp-${String(index + 1)}`,
        gapPairId: gapPair.id,
        title: `${sourceConcept} ↔ ${targetConcept}: Cross-Domain Bridge`,
        description:
          gapPair.bridgeConcepts.length > 0
            ? t("knowledgeMap.label.interpret-gap-hypothesis", {
                leftLabel,
                rightLabel,
                bridgeConcept,
              })
            : t("knowledgeMap.label.interpret-gap-hypothesis.2", {
                leftLabel,
                rightLabel,
              }),
        sourceConcept,
        targetConcept,
        confidence,
      };
    }),
  };
}

function normalizePaperText(paper: GraphPaperSnapshot): string {
  return `${paper.title} ${paper.abstract ?? ""}`.toLowerCase();
}

function countConceptMatches(text: string, concepts: readonly string[]): number {
  return concepts.reduce((total, concept) => {
    if (!concept.trim()) {
      return total;
    }
    return total + (text.includes(concept.toLowerCase()) ? 1 : 0);
  }, 0);
}

function buildRepresentativePaperTitles(params: {
  report: GapNetworkInterpretReport;
  papers: GraphPaperSnapshot[];
  clusterLabels: Record<string, string>;
  clusters?: GapNetworkClusterSeed[];
}): Map<string, string[]> {
  const papersById = new Map(params.papers.map((paper) => [paper.paperId, paper] as const));
  const clusterEntries = buildOrderedClusterEntries({
    papers: params.papers,
    clusterLabels: params.clusterLabels,
    clusters: params.clusters,
  });
  const conceptPoolByClusterId = new Map(
    params.report.gapPairs.flatMap((gapPair) => [
      [gapPair.leftClusterId, [...gapPair.leftConcepts, ...gapPair.bridgeConcepts]] as const,
      [gapPair.rightClusterId, [...gapPair.rightConcepts, ...gapPair.bridgeConcepts]] as const,
    ]),
  );

  return new Map(
    clusterEntries.map((cluster) => {
      const rankedTitles = cluster.paperIds
        .map((paperId) => papersById.get(paperId))
        .filter((paper): paper is GraphPaperSnapshot => paper !== undefined)
        .sort((left, right) => {
          const concepts = conceptPoolByClusterId.get(cluster.id) ?? [];
          const leftMatches = countConceptMatches(normalizePaperText(left), concepts);
          const rightMatches = countConceptMatches(normalizePaperText(right), concepts);
          if (rightMatches !== leftMatches) {
            return rightMatches - leftMatches;
          }
          if (right.citationCount !== left.citationCount) {
            return right.citationCount - left.citationCount;
          }
          return left.title.localeCompare(right.title);
        })
        .slice(0, 2)
        .map((paper) => projectGapNetworkPromptText(paper.title, "titleBytes"));

      return [cluster.id, rankedTitles] as const;
    }),
  );
}

function buildGapHypothesisPrompt(params: {
  query: string;
  report: GapNetworkInterpretReport;
  papers: GraphPaperSnapshot[];
  clusterLabels: Record<string, string>;
  clusters?: GapNetworkClusterSeed[];
}): string {
  const representativePaperTitles = buildRepresentativePaperTitles(params);
  const gapLines = params.report.gapPairs.slice(0, 5).map((gapPair) => {
    // i18n-ignore — LLM prompt internals
    const bridgeConcepts = gapPair.bridgeConcepts
      .slice(0, 5)
      .map((concept) => projectGapNetworkPromptText(concept, "conceptBytes"));
    const leftPapers = representativePaperTitles.get(gapPair.leftClusterId)?.join(" | ") ?? "없음"; // i18n-ignore
    const rightPapers =
      representativePaperTitles.get(gapPair.rightClusterId)?.join(" | ") ?? "없음"; // i18n-ignore
    const leftConcepts = gapPair.leftConcepts
      .slice(0, 5)
      .map((concept) => projectGapNetworkPromptText(concept, "conceptBytes"));
    const rightConcepts = gapPair.rightConcepts
      .slice(0, 5)
      .map((concept) => projectGapNetworkPromptText(concept, "conceptBytes"));
    return [
      `- gapPairId: ${projectGapNetworkPromptText(gapPair.id, "idBytes")}`,
      `  label: ${projectGapNetworkPromptText(gapPair.displayLabel, "labelBytes")}`,
      `  leftConcepts: ${leftConcepts.join(", ") || "없음"}`, // i18n-ignore
      `  rightConcepts: ${rightConcepts.join(", ") || "없음"}`, // i18n-ignore
      `  bridgeConcepts: ${bridgeConcepts.join(", ") || "없음"}`, // i18n-ignore
      `  representativePapers: ${projectGapNetworkPromptText(gapPair.leftLabel, "labelBytes")} — ${leftPapers} / ${projectGapNetworkPromptText(gapPair.rightLabel, "labelBytes")} — ${rightPapers}`,
    ].join("\n");
  });

  const promptBody = gapLines.length > 0 ? gapLines.join("\n") : "- 없음"; // i18n-ignore
  return buildGapHypothesisPromptText(
    projectGapNetworkPromptText(params.query, "queryBytes"),
    promptBody,
  );
}

// LLM prompt template — each line is an LLM instruction, not user-facing UI
const GAP_HYPOTHESIS_PROMPT_LINES = [
  '분석 대상: "{query}" 관련 논문 네트워크에서 발견한 연구 공백', // i18n-ignore
  "",
  "다음 클러스터 쌍들은 크기에 비해 연결이 부족하다. 아직 탐색되지 않은 교차 영역일 가능성이 있다.", // i18n-ignore
  "",
  "{body}",
  "",
  "각 Gap에 대해 1개의 연구 가설을 생성하라.", // i18n-ignore
  "",
  "규칙:", // i18n-ignore
  '1. title: "X ↔ Y: Cross-Domain Bridge" 형태', // i18n-ignore
  "2. description: 왜 연결이 가치 있는지 2~3문장", // i18n-ignore
  "3. sourceConcept: 왼쪽 클러스터 개념", // i18n-ignore
  "4. targetConcept: 오른쪽 클러스터 개념", // i18n-ignore
  '5. confidence: bridgeConcepts가 있으면 "medium" 이상, 없으면 "low"', // i18n-ignore
  "6. 데이터에 없는 과장된 추론은 하지 않는다", // i18n-ignore
  "7. gapPairId는 입력 gap의 id를 그대로 사용한다", // i18n-ignore
  "8. 최대 10개까지만 반환한다", // i18n-ignore
  "",
  "한국어로 작성한다. JSON만 반환한다.", // i18n-ignore
] as const;

function buildGapHypothesisPromptText(query: string, body: string): string {
  return GAP_HYPOTHESIS_PROMPT_LINES.join("\n").replace("{query}", query).replace("{body}", body);
}

export async function interpretGapNetworkHypotheses(params: {
  query: string;
  report: GapNetworkInterpretReport;
  papers: GraphPaperSnapshot[];
  clusterLabels: Record<string, string>;
  clusters?: GapNetworkClusterSeed[];
  usageLedger?: LLMJudgmentUsageLedger;
}): Promise<GapNetworkInsight> {
  if (params.report.gapPairs.length === 0) {
    return { hypotheses: [] };
  }

  const fallbackValue = buildFallbackInsight(params.report);
  const prompt = buildGapHypothesisPrompt(params);
  const insight = await executeJudgment({
    prompt,
    outputSchema: gapNetworkInsightSchema,
    label: "interpret-gap-network",
    ...buildGapNetworkJudgmentBudget("hypothesis", prompt),
    onError: "fallback",
    fallbackValue,
    usageLedger: params.usageLedger,
  });

  return {
    hypotheses: insight.hypotheses
      .filter((hypothesis) =>
        params.report.gapPairs.some((gapPair) => gapPair.id === hypothesis.gapPairId),
      )
      .slice(0, 10),
  };
}
