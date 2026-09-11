import type {
  GapNetworkReport,
  GraphPaperSnapshot,
  KnowledgeMapCitationEdgeArtifact,
  KnowledgeMapGraphSupportEdgeArtifact,
  KnowledgeMapSemanticEdgeArtifact,
} from "@/app/domain/research-route-payload";
import type { SearchQueryClause } from "@/app/domain/search-query";
import { GAP_NETWORK_GAP_PAIR_LIMIT } from "@/app/lib/constants";
import { COMMUNITY_CLUSTER_COLORS } from "./cluster-colors";
import {
  buildOrderedClusterEntries,
  buildPaperClusterIdMap,
  buildUndirectedEdgeKey,
  buildUniqueUndirectedEdges,
} from "./cluster-artifacts";
import {
  buildPaperTopicProfiles,
  type ExternalPaperSignals,
  type KnowledgeMapTopicPaper,
  type PaperTopicProfile,
} from "./topic-signals";
import {
  buildResearchTermQualityContext,
  isResearchLandscapeTerm,
  type ResearchTermQualityContext,
} from "./research-term-quality";

interface GapNetworkClusterSeed {
  id: number | string;
  label: string;
  paperIds: string[];
}

export interface GapNetworkAnalysisInput {
  query: string;
  queryClauses?: SearchQueryClause[];
  papers: GraphPaperSnapshot[];
  citationEdges: KnowledgeMapCitationEdgeArtifact[];
  semanticEdges?: KnowledgeMapSemanticEdgeArtifact[];
  graphSupportEdges?: KnowledgeMapGraphSupportEdgeArtifact[];
  clusterLabels: Record<string, string>;
  clusters?: GapNetworkClusterSeed[];
  externalSignals?: readonly ExternalPaperSignals[];
}

export type GapNetworkAnalysisOutput = Omit<GapNetworkReport, "insight">;

interface ClusterConceptScore {
  keyword: string;
  score: number;
}

interface GapNetworkConceptEdgeRecord {
  source: string;
  target: string;
  clusterId: string;
  weight: number;
}

const GAP_NETWORK_CONCEPT_LIMIT = 16;
const GAP_NETWORK_MIN_CONCEPT_LIMIT = 1;
const GAP_NETWORK_MAX_CONCEPT_WORDS = 4;
const GAP_NETWORK_MAX_CONCEPT_CHARS = 36;
const GAP_NETWORK_GENERIC_CONCEPT_PENALTIES = new Map<string, number>([
  ["agents", 8],
  ["artificial intelligence", 12],
  ["automation", 7],
  ["memory", 6],
  ["planning", 7],
  ["planner", 4],
  ["research", 8],
  ["scientists", 8],
  ["scientific", 6],
  ["scientific discovery", 7],
  ["discovery", 5],
  ["large language models", 7],
  ["models", 4],
  ["evaluation", 7],
]);

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function toConceptLabel(keyword: string): string {
  return keyword
    .split(" ")
    .map((part) => {
      if (part === "ai") return "AI";
      if (part === "llm" || part === "llms") return "LLMs";
      if (part === "rag") return "RAG";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function buildGapNetworkConceptId(clusterId: string, keyword: string): string {
  return `${clusterId}::${keyword}`;
}

function getGapNetworkConceptLimitForPaperCount(paperCount: number): number {
  return Math.max(
    GAP_NETWORK_MIN_CONCEPT_LIMIT,
    Math.min(GAP_NETWORK_CONCEPT_LIMIT, Math.floor(paperCount)),
  );
}

function isRenderableGapNetworkKeyword(keyword: string): boolean {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (normalized.length > GAP_NETWORK_MAX_CONCEPT_CHARS) {
    return false;
  }

  if (normalized.split(/\s+/g).length > GAP_NETWORK_MAX_CONCEPT_WORDS) {
    return false;
  }

  return !/[:;!?]/.test(normalized);
}

function getGapNetworkRenderableConceptPriority(params: {
  keyword: string;
  rawScore: number;
  supportCount: number;
  conceptScores: ClusterConceptScore[];
}) {
  const normalizedKeyword = params.keyword.trim().toLowerCase();
  const wordCount = normalizedKeyword.split(/\s+/g).length;
  const phraseBonus = (wordCount - 1) * 3.2;
  const singleWordPenalty = wordCount === 1 ? 2.5 : 0;
  const supportPenaltyDivisor = Math.max(1, params.supportCount) ** 2;
  const genericPenalty = GAP_NETWORK_GENERIC_CONCEPT_PENALTIES.get(normalizedKeyword) ?? 0;
  const hasSpecificSibling =
    wordCount === 1 &&
    params.conceptScores.some((concept) => {
      if (concept.keyword === normalizedKeyword) {
        return false;
      }
      return (
        concept.keyword.includes(`${normalizedKeyword} `) ||
        concept.keyword.includes(` ${normalizedKeyword}`)
      );
    });
  const siblingPenalty = hasSpecificSibling ? 6 : 0;

  return round(
    params.rawScore / supportPenaltyDivisor +
      phraseBonus -
      genericPenalty -
      siblingPenalty -
      singleWordPenalty,
    4,
  );
}

function shouldKeepRenderableGapNetworkConcept(params: {
  concept: ClusterConceptScore;
  keywordClusterSupportCounts: Map<string, number>;
  termQualityContext: ResearchTermQualityContext;
}) {
  if (!isRenderableGapNetworkKeyword(params.concept.keyword)) {
    return false;
  }

  if (!isResearchLandscapeTerm(params.concept.keyword, params.termQualityContext)) {
    return false;
  }

  const normalizedKeyword = params.concept.keyword.trim().toLowerCase();
  const wordCount = normalizedKeyword.split(/\s+/g).length;
  const supportCount = params.keywordClusterSupportCounts.get(params.concept.keyword) ?? 1;
  const genericPenalty = GAP_NETWORK_GENERIC_CONCEPT_PENALTIES.get(normalizedKeyword) ?? 0;

  if (wordCount === 1 && genericPenalty >= 6) {
    return false;
  }

  if (supportCount >= 2 && genericPenalty >= 5) {
    return false;
  }

  return true;
}

function rankRenderableGapNetworkConcepts(params: {
  conceptScores: ClusterConceptScore[];
  keywordClusterSupportCounts: Map<string, number>;
  termQualityContext: ResearchTermQualityContext;
}) {
  return params.conceptScores
    .filter((concept) =>
      shouldKeepRenderableGapNetworkConcept({
        concept,
        keywordClusterSupportCounts: params.keywordClusterSupportCounts,
        termQualityContext: params.termQualityContext,
      }),
    )
    .slice()
    .sort((left, right) => {
      const leftPriority = getGapNetworkRenderableConceptPriority({
        keyword: left.keyword,
        rawScore: left.score,
        supportCount: params.keywordClusterSupportCounts.get(left.keyword) ?? 1,
        conceptScores: params.conceptScores,
      });
      const rightPriority = getGapNetworkRenderableConceptPriority({
        keyword: right.keyword,
        rawScore: right.score,
        supportCount: params.keywordClusterSupportCounts.get(right.keyword) ?? 1,
        conceptScores: params.conceptScores,
      });
      if (rightPriority !== leftPriority) {
        return rightPriority - leftPriority;
      }
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.keyword.localeCompare(right.keyword);
    });
}

function preferMultiwordGapNetworkConcepts(concepts: ClusterConceptScore[]) {
  const multiwordConcepts = concepts.filter((concept) => concept.keyword.includes(" "));
  return multiwordConcepts.length >= 2
    ? [...multiwordConcepts, ...concepts.filter((concept) => !concept.keyword.includes(" "))]
    : concepts;
}

function buildClusterEntries(input: GapNetworkAnalysisInput) {
  return buildOrderedClusterEntries(input).map((cluster, index) => ({
    ...cluster,
    color:
      COMMUNITY_CLUSTER_COLORS[index % COMMUNITY_CLUSTER_COLORS.length] ??
      "oklch(0.641 0.131 251.4)",
  }));
}

function buildUniqueEdges(input: GapNetworkAnalysisInput) {
  return buildUniqueUndirectedEdges({
    validNodeIds: new Set(input.papers.map((paper) => paper.paperId)),
    citationEdges: input.citationEdges,
    semanticEdges: input.semanticEdges,
    graphSupportEdges: input.graphSupportEdges,
  });
}

function buildClusterConceptScores(params: {
  paperIds: string[];
  papersById: Map<string, GraphPaperSnapshot>;
  topicProfiles: Map<string, PaperTopicProfile>;
}) {
  const aggregateScores = new Map<string, number>();

  for (const paperId of params.paperIds) {
    const profile = params.topicProfiles.get(paperId);
    const paper = params.papersById.get(paperId);
    if (!profile || !paper) {
      continue;
    }

    const citationWeight = 1 + Math.log10(paper.citationCount + 10);
    for (const [keyword, score] of profile.keywordScores.entries()) {
      aggregateScores.set(keyword, (aggregateScores.get(keyword) ?? 0) + score * citationWeight);
    }
  }

  return [...aggregateScores.entries()]
    .map(([keyword, score]) => ({
      keyword,
      score: round(score, 3),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      const rightWordCount = right.keyword.split(" ").length;
      const leftWordCount = left.keyword.split(" ").length;
      if (rightWordCount !== leftWordCount) {
        return rightWordCount - leftWordCount;
      }
      return left.keyword.localeCompare(right.keyword);
    });
}

function pickBridgeConcepts(
  leftScores: ClusterConceptScore[],
  rightScores: ClusterConceptScore[],
  params: {
    keywordClusterSupportCounts: Map<string, number>;
    termQualityContext: ResearchTermQualityContext;
    limit?: number;
  },
): string[] {
  const limit = params.limit ?? 3;
  const filteredLeftScores = rankRenderableGapNetworkConcepts({
    conceptScores: leftScores,
    keywordClusterSupportCounts: params.keywordClusterSupportCounts,
    termQualityContext: params.termQualityContext,
  });
  const filteredRightScores = rankRenderableGapNetworkConcepts({
    conceptScores: rightScores,
    keywordClusterSupportCounts: params.keywordClusterSupportCounts,
    termQualityContext: params.termQualityContext,
  });
  const rightScoreByKeyword = new Map(
    filteredRightScores.map((entry) => [entry.keyword, entry.score]),
  );

  return filteredLeftScores
    .filter((entry) => rightScoreByKeyword.has(entry.keyword))
    .sort((left, right) => {
      const leftMin = Math.min(left.score, rightScoreByKeyword.get(left.keyword) ?? 0);
      const rightMin = Math.min(right.score, rightScoreByKeyword.get(right.keyword) ?? 0);
      if (rightMin !== leftMin) {
        return rightMin - leftMin;
      }
      return left.keyword.localeCompare(right.keyword);
    })
    .slice(0, limit)
    .map((entry) => entry.keyword);
}

const GAP_NETWORK_CONCEPT_SUPPORTING_PAPER_LIMIT = 5;

function buildConceptSupportingPaperIds(params: {
  conceptKeyword: string;
  paperIds: string[];
  papersById: Map<string, GraphPaperSnapshot>;
  topicProfiles: Map<string, PaperTopicProfile>;
}): string[] {
  const supporters: Array<{ paperId: string; score: number; citationCount: number }> = [];
  for (const paperId of params.paperIds) {
    const profile = params.topicProfiles.get(paperId);
    if (!profile) continue;
    const score = profile.keywordScores.get(params.conceptKeyword);
    if (typeof score !== "number" || score <= 0) continue;
    const paper = params.papersById.get(paperId);
    supporters.push({
      paperId,
      score,
      citationCount: paper?.citationCount ?? 0,
    });
  }
  supporters.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return right.citationCount - left.citationCount;
  });
  return supporters
    .slice(0, GAP_NETWORK_CONCEPT_SUPPORTING_PAPER_LIMIT)
    .map((entry) => entry.paperId);
}

function buildClusterConceptEdges(params: {
  clusterId: string;
  paperIds: string[];
  selectedConcepts: ClusterConceptScore[];
  papersById: Map<string, GraphPaperSnapshot>;
  topicProfiles: Map<string, PaperTopicProfile>;
}): GapNetworkConceptEdgeRecord[] {
  const conceptSet = new Set(params.selectedConcepts.map((concept) => concept.keyword));
  const edgeScores = new Map<string, number>();

  for (const paperId of params.paperIds) {
    const profile = params.topicProfiles.get(paperId);
    const paper = params.papersById.get(paperId);
    if (!profile || !paper || conceptSet.size < 2) {
      continue;
    }

    const rankedConcepts = [...profile.keywordScores.entries()]
      .filter(([keyword]) => conceptSet.has(keyword))
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
      })
      .slice(0, 6);

    const citationWeight = 1 + Math.log10(paper.citationCount + 10);
    for (let index = 0; index < rankedConcepts.length; index += 1) {
      const source = rankedConcepts[index];

      for (let nextIndex = index + 1; nextIndex < rankedConcepts.length; nextIndex += 1) {
        const target = rankedConcepts[nextIndex];

        const [leftKeyword, rightKeyword] = [source[0], target[0]].sort();
        const key = `${leftKeyword}::${rightKeyword}`;
        const edgeWeight = Math.min(source[1], target[1]) * citationWeight;
        edgeScores.set(key, (edgeScores.get(key) ?? 0) + edgeWeight);
      }
    }
  }

  const rankedEdges = [...edgeScores.entries()]
    .map(([key, rawWeight]) => {
      const [source, target] = key.split("::");
      return {
        source: buildGapNetworkConceptId(params.clusterId, source),
        target: buildGapNetworkConceptId(params.clusterId, target),
        clusterId: params.clusterId,
        weight: round(rawWeight, 3),
      };
    })
    .sort((left, right) => {
      if (right.weight !== left.weight) {
        return right.weight - left.weight;
      }
      if (left.source !== right.source) {
        return left.source.localeCompare(right.source);
      }
      return left.target.localeCompare(right.target);
    })
    .slice(0, Math.max(params.selectedConcepts.length * 2, 8));

  const maxWeight = rankedEdges[0]?.weight ?? 1;
  return rankedEdges.map((edge) => ({
    ...edge,
    weight: round(maxWeight > 0 ? edge.weight / maxWeight : 0, 3),
  }));
}

export function analyzeGapNetwork(input: GapNetworkAnalysisInput): GapNetworkAnalysisOutput {
  const clusters = buildClusterEntries(input);
  const clusterIdByPaperId = buildPaperClusterIdMap(clusters);
  const papersById = new Map(input.papers.map((paper) => [paper.paperId, paper] as const));
  const topicProfiles = buildPaperTopicProfiles({
    papers: input.papers as readonly KnowledgeMapTopicPaper[],
    query: input.query,
    queryClauses: input.queryClauses,
    externalSignals: input.externalSignals,
  });
  const termQualityContext = buildResearchTermQualityContext(input.query, input.queryClauses);
  const uniqueEdges = buildUniqueEdges(input);
  const graphSupportScoreByPaperId = new Map<string, number>();
  for (const edge of input.graphSupportEdges ?? []) {
    graphSupportScoreByPaperId.set(
      edge.source,
      (graphSupportScoreByPaperId.get(edge.source) ?? 0) + edge.weight,
    );
    graphSupportScoreByPaperId.set(
      edge.target,
      (graphSupportScoreByPaperId.get(edge.target) ?? 0) + edge.weight,
    );
  }
  const clusterConceptScoresById = new Map<string, ClusterConceptScore[]>();
  const conceptEdges: GapNetworkConceptEdgeRecord[] = [];
  const clusterScoreRecords = clusters.map((cluster) => {
    const conceptScores = buildClusterConceptScores({
      paperIds: cluster.paperIds,
      papersById,
      topicProfiles,
    });

    clusterConceptScoresById.set(cluster.id, conceptScores);
    return { cluster, conceptScores };
  });
  const keywordClusterSupportCounts = new Map<string, number>();
  clusterScoreRecords.forEach(({ conceptScores }) => {
    const seenKeywords = new Set<string>();
    conceptScores.forEach((concept) => {
      if (seenKeywords.has(concept.keyword)) {
        return;
      }
      keywordClusterSupportCounts.set(
        concept.keyword,
        (keywordClusterSupportCounts.get(concept.keyword) ?? 0) + 1,
      );
      seenKeywords.add(concept.keyword);
    });
  });

  const clusterRecords = clusterScoreRecords.map(({ cluster, conceptScores }) => {
    const rankedRenderableConcepts = rankRenderableGapNetworkConcepts({
      conceptScores,
      keywordClusterSupportCounts,
      termQualityContext,
    });
    const preferredRenderableConcepts = preferMultiwordGapNetworkConcepts(rankedRenderableConcepts);

    const conceptLimit = getGapNetworkConceptLimitForPaperCount(cluster.paperIds.length);
    const selectedConcepts = preferredRenderableConcepts.slice(0, conceptLimit);
    conceptEdges.push(
      ...buildClusterConceptEdges({
        clusterId: cluster.id,
        paperIds: cluster.paperIds,
        selectedConcepts,
        papersById,
        topicProfiles,
      }),
    );

    const topPaperIds = cluster.paperIds
      .map((paperId) => papersById.get(paperId))
      .filter((paper): paper is GraphPaperSnapshot => paper !== undefined)
      .sort((left, right) => {
        const leftProfile = topicProfiles.get(left.paperId);
        const rightProfile = topicProfiles.get(right.paperId);
        const leftTopicSupport = conceptScores.reduce(
          (sum, concept) => sum + (leftProfile?.keywordScores.get(concept.keyword) ?? 0),
          0,
        );
        const rightTopicSupport = conceptScores.reduce(
          (sum, concept) => sum + (rightProfile?.keywordScores.get(concept.keyword) ?? 0),
          0,
        );
        if (rightTopicSupport !== leftTopicSupport) {
          return rightTopicSupport - leftTopicSupport;
        }
        const graphDiff =
          (graphSupportScoreByPaperId.get(right.paperId) ?? 0) -
          (graphSupportScoreByPaperId.get(left.paperId) ?? 0);
        if (graphDiff !== 0) return graphDiff;
        return right.citationCount - left.citationCount;
      })
      .slice(0, 3)
      .map((paper) => paper.paperId);

    return {
      id: cluster.id,
      label: cluster.label,
      color: cluster.color,
      paperCount: cluster.paperIds.length,
      concepts: selectedConcepts.map((concept) => ({
        id: buildGapNetworkConceptId(cluster.id, concept.keyword),
        label: toConceptLabel(concept.keyword),
        clusterId: cluster.id,
        score: concept.score,
        supportingPaperIds: buildConceptSupportingPaperIds({
          conceptKeyword: concept.keyword,
          paperIds: cluster.paperIds,
          papersById,
          topicProfiles,
        }),
      })),
      topPaperIds,
    };
  });

  if (clusterRecords.length < 2) {
    return {
      clusters: clusterRecords,
      conceptEdges,
      gapPairs: [],
      metrics: {
        clusterCount: clusterRecords.length,
        totalPaperCount: input.papers.length,
        totalEdgeCount: uniqueEdges.length,
        gapPairCount: 0,
      },
    };
  }

  const observedCounts = new Map<string, number>();
  for (const edge of uniqueEdges) {
    const sourceClusterId = clusterIdByPaperId.get(edge.source);
    const targetClusterId = clusterIdByPaperId.get(edge.target);
    if (!sourceClusterId || !targetClusterId || sourceClusterId === targetClusterId) {
      continue;
    }

    const key = buildUndirectedEdgeKey(sourceClusterId, targetClusterId);
    observedCounts.set(key, (observedCounts.get(key) ?? 0) + 1);
  }

  const totalPaperCount = Math.max(input.papers.length, 1);
  const totalEdgeCount = uniqueEdges.length;
  const hasAuxiliarySparseEvidence =
    (input.semanticEdges?.length ?? 0) > 0 || (input.graphSupportEdges?.length ?? 0) > 0;
  const minimumExpectedGapEvidence = hasAuxiliarySparseEvidence ? 0.25 : 1;
  const gapPairs = clusterRecords
    .flatMap((leftCluster, leftIndex) =>
      clusterRecords.slice(leftIndex + 1).map((rightCluster) => {
        const observed =
          observedCounts.get(buildUndirectedEdgeKey(leftCluster.id, rightCluster.id)) ?? 0;
        const expected =
          totalEdgeCount > 0
            ? 2 *
              totalEdgeCount *
              (leftCluster.paperCount / totalPaperCount) *
              (rightCluster.paperCount / totalPaperCount)
            : 0;
        const gapScore = expected > 0 ? Math.max(0, (expected - observed) / expected) : 0;
        const leftScores = clusterConceptScoresById.get(leftCluster.id) ?? [];
        const rightScores = clusterConceptScoresById.get(rightCluster.id) ?? [];
        const leftPairConcepts = rankRenderableGapNetworkConcepts({
          conceptScores: leftScores,
          keywordClusterSupportCounts,
          termQualityContext,
        });
        const rightPairConcepts = rankRenderableGapNetworkConcepts({
          conceptScores: rightScores,
          keywordClusterSupportCounts,
          termQualityContext,
        });

        return {
          id: `gap-${leftCluster.id.replace("cluster-", "")}-${rightCluster.id.replace("cluster-", "")}`,
          leftClusterId: leftCluster.id,
          rightClusterId: rightCluster.id,
          leftLabel: leftCluster.label,
          rightLabel: rightCluster.label,
          displayLabel: `${leftCluster.label}-${rightCluster.label} Gap`,
          observed,
          expected: round(expected),
          gapScore: round(gapScore),
          rank: 0,
          bridgeConcepts: pickBridgeConcepts(leftScores, rightScores, {
            keywordClusterSupportCounts,
            termQualityContext,
          }),
          leftConcepts: leftPairConcepts.slice(0, 3).map((concept) => concept.keyword),
          rightConcepts: rightPairConcepts.slice(0, 3).map((concept) => concept.keyword),
        };
      }),
    )
    .filter((pair) => pair.expected >= minimumExpectedGapEvidence && pair.gapScore > 0)
    .sort((left, right) => {
      if (right.gapScore !== left.gapScore) {
        return right.gapScore - left.gapScore;
      }

      const leftAbsoluteGap = left.expected * left.gapScore;
      const rightAbsoluteGap = right.expected * right.gapScore;
      if (rightAbsoluteGap !== leftAbsoluteGap) {
        return rightAbsoluteGap - leftAbsoluteGap;
      }

      return left.displayLabel.localeCompare(right.displayLabel);
    })
    .slice(0, GAP_NETWORK_GAP_PAIR_LIMIT)
    .map((pair, index) => ({
      ...pair,
      rank: index + 1,
    }));

  return {
    clusters: clusterRecords,
    conceptEdges,
    gapPairs,
    metrics: {
      clusterCount: clusterRecords.length,
      totalPaperCount: input.papers.length,
      totalEdgeCount,
      gapPairCount: gapPairs.length,
    },
  };
}
