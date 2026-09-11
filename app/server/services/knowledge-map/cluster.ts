import { UndirectedGraph } from "graphology";
import louvain from "graphology-communities-louvain";
import type { SearchQueryClause } from "@/app/domain/search-query";
import { GAP_NETWORK_CLUSTER_LIMIT } from "@/app/lib/constants";
import {
  buildPaperTopicProfiles,
  buildTopicLabel,
  type ExternalPaperSignals,
  type KnowledgeMapTopicPaper,
  type PaperTopicProfile,
} from "@/app/server/services/knowledge-map/topic-signals";
import {
  buildResearchTermQualityContext,
  isResearchLandscapeTerm,
} from "@/app/server/services/knowledge-map/research-term-quality";

interface ClusterInputEdge {
  source: string;
  target: string;
  weight: number;
  origin?: "citation" | "semantic" | "method" | "graph_support";
}

export interface DegreeDistributionClusterInput {
  query: string;
  queryClauses?: SearchQueryClause[];
  papers: readonly KnowledgeMapTopicPaper[];
  citationEdges: ReadonlyArray<Omit<ClusterInputEdge, "origin">>;
  semanticEdges?: ReadonlyArray<ClusterInputEdge>;
  graphSupportEdges?: ReadonlyArray<Omit<ClusterInputEdge, "origin">>;
  externalSignals?: readonly ExternalPaperSignals[];
}

export interface DegreeDistributionClusterResult {
  clusterLabels: Record<string, string>;
  clusters: Array<{
    id: number;
    label: string;
    paperIds: string[];
  }>;
}

const CLUSTER_LABEL_SKIP = new Set([
  "a",
  "an",
  "the",
  "for",
  "of",
  "and",
  "to",
  "in",
  "with",
  "on",
  "is",
  "are",
  "by",
  "ai",
  "towards",
  "fully",
  "automated",
]);

const GENERIC_CLUSTER_LABEL_PENALTIES = new Map<string, number>([
  ["artificial intelligence", 12],
  ["agents", 9],
  ["scientists", 9],
  ["generative ai", 7],
  ["research agents", 5],
  ["machine learning research", 5],
  ["research automation", 1.5],
]);

function buildSeededRng(seed: number) {
  let value = seed;
  return function nextRandom() {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function normalizeTopicTag(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function titleCaseTopic(value: string): string {
  return value
    .split(" ")
    .map((part) => {
      if (part === "ai") return "AI";
      if (part === "llm") return "LLM";
      if (part === "llms") return "LLMs";
      return part ? part.charAt(0).toUpperCase() + part.slice(1) : part;
    })
    .join(" ");
}

function dedupeTopicLabels(topics: string[]): string[] {
  const selected: string[] = [];

  for (const topic of topics) {
    const topicTokens = new Set(topic.split(/\s+/g));
    const overlapsExisting = selected.some((existing) => {
      const existingTokens = new Set(existing.split(/\s+/g));
      const overlap = [...topicTokens].filter((token) => existingTokens.has(token)).length;
      return overlap > 0 && overlap >= Math.min(topicTokens.size, existingTokens.size);
    });

    if (!overlapsExisting) {
      selected.push(topic);
    }
    if (selected.length >= 2) {
      break;
    }
  }

  return selected;
}

function buildStoredTopicSet(signal: ExternalPaperSignals | undefined): Set<string> {
  return new Set((signal?.topics ?? []).map(normalizeTopicTag).filter((topic) => topic.length > 0));
}

function countSharedStoredTopics(left: Set<string>, right: Set<string>): number {
  return [...left].filter((topic) => right.has(topic)).length;
}

function computeStoredTopicOverlapScore(left: Set<string>, right: Set<string>): number {
  const sharedTopicCount = countSharedStoredTopics(left, right);
  if (sharedTopicCount === 0) {
    return 0;
  }

  return sharedTopicCount / Math.max(1, Math.min(left.size, right.size));
}

function buildEdgeKey(source: string, target: string): string {
  return [source, target].sort().join("::");
}

function appendGraphEdge(params: {
  graph: UndirectedGraph;
  existingEdges: Set<string>;
  validPaperIds: Set<string>;
  edge: ClusterInputEdge;
  weight: number;
  origin: "citation" | "semantic" | "method" | "graph_support";
}) {
  if (
    !params.validPaperIds.has(params.edge.source) ||
    !params.validPaperIds.has(params.edge.target) ||
    params.edge.source === params.edge.target
  ) {
    return;
  }

  const key = buildEdgeKey(params.edge.source, params.edge.target);
  if (params.existingEdges.has(key)) {
    return;
  }

  params.existingEdges.add(key);
  params.graph.addUndirectedEdge(params.edge.source, params.edge.target, {
    weight: params.weight,
    origin: params.origin,
  });
}

function buildCombinedGraph(
  input: DegreeDistributionClusterInput,
  papers: KnowledgeMapTopicPaper[],
) {
  const graph = new UndirectedGraph();
  const validPaperIds = new Set(papers.map((paper) => paper.paperId));
  const existingEdges = new Set<string>();

  for (const paper of papers) {
    graph.addNode(paper.paperId, {
      citationCount: paper.citationCount,
    });
  }

  for (const edge of input.citationEdges) {
    appendGraphEdge({
      graph,
      existingEdges,
      validPaperIds,
      edge: { ...edge, origin: "citation" },
      weight: 1,
      origin: "citation",
    });
  }

  for (const edge of input.semanticEdges ?? []) {
    appendGraphEdge({
      graph,
      existingEdges,
      validPaperIds,
      edge,
      weight: edge.origin === "method" ? 0.3 : 0.5,
      origin: edge.origin ?? "semantic",
    });
  }

  for (const edge of input.graphSupportEdges ?? []) {
    appendGraphEdge({
      graph,
      existingEdges,
      validPaperIds,
      edge: { ...edge, origin: "graph_support" },
      weight: Math.max(0.15, Math.min(edge.weight, 1)) * 0.4,
      origin: "graph_support",
    });
  }

  return graph;
}

function buildCommunities(partition: Record<string, number>): string[][] {
  const communities = new Map<number, Set<string>>();

  Object.entries(partition).forEach(([paperId, communityId]) => {
    const bucket = communities.get(communityId) ?? new Set<string>();
    bucket.add(paperId);
    communities.set(communityId, bucket);
  });

  return [...communities.values()].map((community) => [...community]);
}

function sortCommunities(
  communities: string[][],
  citationCountByPaperId: Map<string, number>,
): string[][] {
  return communities
    .map((community) =>
      [...new Set(community)].sort((left, right) => {
        const citationGap =
          (citationCountByPaperId.get(right) ?? 0) - (citationCountByPaperId.get(left) ?? 0);
        if (citationGap !== 0) return citationGap;
        return left.localeCompare(right);
      }),
    )
    .sort((left, right) => {
      if (right.length !== left.length) return right.length - left.length;
      const leftCitation = left.reduce(
        (sum, paperId) => sum + (citationCountByPaperId.get(paperId) ?? 0),
        0,
      );
      const rightCitation = right.reduce(
        (sum, paperId) => sum + (citationCountByPaperId.get(paperId) ?? 0),
        0,
      );
      if (rightCitation !== leftCitation) return rightCitation - leftCitation;
      return (left[0] ?? "").localeCompare(right[0] ?? "");
    });
}

function chooseBestLouvainPartition(params: {
  graph: UndirectedGraph;
  targetClusterCount: number;
}): Record<string, number> {
  const resolutions = [0.8, 1.0, 1.2, 1.5, 2.0, 2.5];
  let bestPartition: Record<string, number> | null = null;
  let bestScore = -1;

  for (const resolution of resolutions) {
    const partition = louvain(params.graph, {
      getEdgeWeight: "weight",
      resolution,
      rng: buildSeededRng(42),
    });
    const communities = buildCommunities(partition);
    const sizes = communities
      .map((community) => community.length)
      .sort((left, right) => right - left);
    const largeSizes = sizes.filter((size) => size >= 5);
    const largeCount = largeSizes.length;

    let score = 0;
    if (largeCount >= Math.min(3, params.targetClusterCount)) {
      const coverage =
        params.graph.order > 0
          ? largeSizes.reduce((sum, size) => sum + size, 0) / params.graph.order
          : 0;
      const topClusters = largeSizes.slice(0, Math.min(params.targetClusterCount, largeCount));
      const balance =
        topClusters.length > 1
          ? Math.min(...topClusters) / Math.max(...topClusters)
          : topClusters.length === 1
            ? 1
            : 0;
      const closeness = 1 / (1 + Math.abs(largeCount - params.targetClusterCount));
      score = balance * 0.3 + closeness * 0.3 + coverage * 0.4;
    }

    if (score > bestScore) {
      bestScore = score;
      bestPartition = partition;
    }
  }

  if (bestPartition) {
    return bestPartition;
  }

  return Object.fromEntries(
    params.graph.nodes().map((paperId, index) => [paperId, index] as const),
  );
}

function mergeSmallCommunities(params: {
  graph: UndirectedGraph;
  communities: string[][];
  targetClusterCount: number;
  citationCountByPaperId: Map<string, number>;
  externalSignals?: readonly ExternalPaperSignals[];
}): string[][] {
  const sortedCommunities = sortCommunities(params.communities, params.citationCountByPaperId);
  let largeCommunities = sortedCommunities.filter((community) => community.length >= 3);
  let smallCommunities = sortedCommunities.filter((community) => community.length < 3);

  while (largeCommunities.length > params.targetClusterCount) {
    const ascending = sortCommunities(largeCommunities, params.citationCountByPaperId).reverse();
    const smallest = ascending.shift();
    const secondSmallest = ascending.shift();
    if (!smallest || !secondSmallest) break;

    largeCommunities = sortCommunities(
      [...ascending, [...smallest, ...secondSmallest]],
      params.citationCountByPaperId,
    );
  }

  if (largeCommunities.length < params.targetClusterCount) {
    const remaining = sortCommunities(
      [...largeCommunities, ...smallCommunities],
      params.citationCountByPaperId,
    );
    largeCommunities = remaining.slice(0, params.targetClusterCount);
    smallCommunities = remaining.slice(params.targetClusterCount);
  }

  const orphanNodes: string[] = [];
  const appendPaperToCluster = (clusterIndex: number, paperId: string) => {
    const cluster = largeCommunities[clusterIndex] ?? [];
    largeCommunities[clusterIndex] = [...cluster, paperId];
  };
  const externalSignalByPaperId = new Map(
    (params.externalSignals ?? []).map((signal) => [signal.paperId, signal] as const),
  );

  const findBestClusterByTopicSimilarity = (paperId: string) => {
    const topicSet = buildStoredTopicSet(externalSignalByPaperId.get(paperId));
    if (topicSet.size === 0) {
      return { clusterIndex: -1, score: 0, sharedTopicCount: 0 };
    }

    let bestClusterIndex = -1;
    let bestTopicOverlapScore = 0;
    let bestSharedTopicCount = 0;

    largeCommunities.forEach((cluster, clusterIndex) => {
      const overlapCandidates = cluster
        .map((memberId) => {
          const memberTopics = buildStoredTopicSet(externalSignalByPaperId.get(memberId));
          if (memberTopics.size === 0) {
            return { score: 0, sharedTopicCount: 0 };
          }

          return {
            score: computeStoredTopicOverlapScore(topicSet, memberTopics),
            sharedTopicCount: countSharedStoredTopics(topicSet, memberTopics),
          };
        })
        .filter((candidate) => candidate.score > 0);

      if (overlapCandidates.length === 0) {
        return;
      }

      overlapCandidates.sort((left, right) => {
        if (right.sharedTopicCount !== left.sharedTopicCount) {
          return right.sharedTopicCount - left.sharedTopicCount;
        }

        return right.score - left.score;
      });
      const selectedCandidates = overlapCandidates.slice(0, 2);
      const similarityScore =
        selectedCandidates.reduce((sum, candidate) => sum + candidate.score, 0) /
        Math.min(2, selectedCandidates.length);
      const sharedTopicCount = selectedCandidates[0]?.sharedTopicCount ?? 0;

      if (
        sharedTopicCount > bestSharedTopicCount ||
        (sharedTopicCount === bestSharedTopicCount && similarityScore > bestTopicOverlapScore)
      ) {
        bestSharedTopicCount = sharedTopicCount;
        bestTopicOverlapScore = similarityScore;
        bestClusterIndex = clusterIndex;
      }
    });

    return {
      clusterIndex: bestClusterIndex,
      score: bestTopicOverlapScore,
      sharedTopicCount: bestSharedTopicCount,
    };
  };

  for (const community of smallCommunities) {
    for (const paperId of community) {
      let bestClusterIndex = -1;
      let bestConnections = -1;

      largeCommunities.forEach((cluster, clusterIndex) => {
        const connectionCount = cluster.reduce(
          (sum, memberId) => sum + (params.graph.hasEdge(paperId, memberId) ? 1 : 0),
          0,
        );
        if (connectionCount > bestConnections) {
          bestConnections = connectionCount;
          bestClusterIndex = clusterIndex;
        }
      });

      if (bestClusterIndex >= 0 && bestConnections > 0) {
        appendPaperToCluster(bestClusterIndex, paperId);
        continue;
      }

      // When graph structure is silent, reassign orphan nodes by stored topic similarity first.
      const topicSimilarityMatch = findBestClusterByTopicSimilarity(paperId);
      // Only merge by strong overlap from stored semanticProfile.topics.
      if (
        topicSimilarityMatch.clusterIndex >= 0 &&
        topicSimilarityMatch.sharedTopicCount >= 2 &&
        topicSimilarityMatch.score >= 0.5
      ) {
        appendPaperToCluster(topicSimilarityMatch.clusterIndex, paperId);
      } else {
        orphanNodes.push(paperId);
      }
    }
  }

  orphanNodes.sort((left, right) => left.localeCompare(right));
  for (const paperId of orphanNodes) {
    const topicSimilarityMatch = findBestClusterByTopicSimilarity(paperId);
    if (
      topicSimilarityMatch.clusterIndex >= 0 &&
      topicSimilarityMatch.sharedTopicCount >= 2 &&
      topicSimilarityMatch.score >= 0.5
    ) {
      appendPaperToCluster(topicSimilarityMatch.clusterIndex, paperId);
      continue;
    }

    const targetIndex = largeCommunities.reduce((bestIndex, cluster, clusterIndex, clusters) => {
      const bestCluster = clusters[bestIndex] ?? [];
      if (cluster.length < bestCluster.length) return clusterIndex;
      if (cluster.length > bestCluster.length) return bestIndex;

      const currentCitation = cluster.reduce(
        (sum, memberId) => sum + (params.citationCountByPaperId.get(memberId) ?? 0),
        0,
      );
      const bestCitation = bestCluster.reduce(
        (sum, memberId) => sum + (params.citationCountByPaperId.get(memberId) ?? 0),
        0,
      );
      return currentCitation < bestCitation ? clusterIndex : bestIndex;
    }, 0);

    appendPaperToCluster(targetIndex, paperId);
  }

  return sortCommunities(largeCommunities, params.citationCountByPaperId);
}

function buildFallbackClusterLabel(params: {
  paperIds: string[];
  papersById: Map<string, KnowledgeMapTopicPaper>;
  fallbackLabel: string;
}): string {
  const representativePaper = params.paperIds
    .map((paperId) => params.papersById.get(paperId))
    .filter((paper): paper is KnowledgeMapTopicPaper => Boolean(paper))
    .sort((left, right) => right.citationCount - left.citationCount)
    .at(0);

  if (!representativePaper) {
    return params.fallbackLabel;
  }

  const words = representativePaper.title
    .replace(/[:\-]/g, " ")
    .split(/\s+/g)
    .map((word) => word.trim())
    .filter((word) => word.length > 0 && !CLUSTER_LABEL_SKIP.has(word.toLowerCase()));

  if (words.length === 0) {
    return params.fallbackLabel;
  }

  return words.slice(0, 3).join(" ");
}

function buildClusterTopicLabel(params: {
  paperIds: string[];
  papersById: Map<string, KnowledgeMapTopicPaper>;
  graph: UndirectedGraph;
  externalSignals?: readonly ExternalPaperSignals[];
  profiles: Map<string, PaperTopicProfile>;
  fallbackLabel: string;
  termQualityContext: ReturnType<typeof buildResearchTermQualityContext>;
}): string {
  const externalSignalByPaperId = new Map(
    (params.externalSignals ?? []).map((signal) => [signal.paperId, signal] as const),
  );
  const connectedPaperIds = params.paperIds.filter((paperId) => params.graph.degree(paperId) > 0);
  const labelPaperIds = connectedPaperIds.length > 0 ? connectedPaperIds : params.paperIds;
  const topicScores = new Map<string, { score: number; support: number; firstSeen: number }>();
  let seenIndex = 0;

  for (const paperId of labelPaperIds) {
    const signal = externalSignalByPaperId.get(paperId);
    const paper = params.papersById.get(paperId);
    if (!signal || !paper) continue;

    if (params.graph.degree(paperId) === 0 && connectedPaperIds.length > 0) {
      continue;
    }

    const degreeWeight = 1 + Math.min(params.graph.degree(paperId), 12) * 0.35;
    const citationWeight = 1 + Math.log10(paper.citationCount + 10);
    const paperWeight = degreeWeight + citationWeight;
    const seenTopics = new Set<string>();

    for (const rawTopic of signal.topics) {
      const topic = normalizeTopicTag(rawTopic);
      if (!topic) continue;
      if (!isResearchLandscapeTerm(topic, params.termQualityContext)) continue;

      const current = topicScores.get(topic);
      if (current) {
        current.score += paperWeight;
        if (!seenTopics.has(topic)) {
          current.support += 1;
        }
      } else {
        topicScores.set(topic, {
          score: paperWeight,
          support: 1,
          firstSeen: seenIndex,
        });
        seenIndex += 1;
      }
      seenTopics.add(topic);
    }
  }

  const rankedTopics = [...topicScores.entries()]
    .sort((left, right) => {
      if (right[1].support !== left[1].support) {
        return right[1].support - left[1].support;
      }

      const leftEffectiveScore =
        left[1].score +
        left[1].support * 2.5 +
        (left[0].split(" ").length - 1) * 1.6 -
        (GENERIC_CLUSTER_LABEL_PENALTIES.get(left[0]) ?? 0);
      const rightEffectiveScore =
        right[1].score +
        right[1].support * 2.5 +
        (right[0].split(" ").length - 1) * 1.6 -
        (GENERIC_CLUSTER_LABEL_PENALTIES.get(right[0]) ?? 0);

      if (rightEffectiveScore !== leftEffectiveScore) {
        return rightEffectiveScore - leftEffectiveScore;
      }
      return left[1].firstSeen - right[1].firstSeen;
    })
    .map(([topic]) => topic);

  const selectedTopics = dedupeTopicLabels(rankedTopics);
  if (selectedTopics.length > 0) {
    return selectedTopics.map((topic) => titleCaseTopic(topic)).join(" & ");
  }

  const weightedLabel = buildTopicLabel({
    paperIds: params.paperIds,
    papersById: params.papersById,
    profiles: params.profiles,
    fallbackLabel: params.fallbackLabel,
    termQualityContext: params.termQualityContext,
  });

  if (weightedLabel !== params.fallbackLabel) {
    return weightedLabel;
  }

  return buildFallbackClusterLabel(params);
}

export function clusterDegreeDistributionNetwork(
  input: DegreeDistributionClusterInput,
): DegreeDistributionClusterResult {
  const papers = input.papers.filter((paper) => paper.paperId.length > 0);
  const paperIds = papers.map((paper) => paper.paperId);
  if (paperIds.length === 0) {
    return { clusterLabels: {}, clusters: [] };
  }

  const targetClusterCount = Math.min(
    GAP_NETWORK_CLUSTER_LIMIT,
    Math.max(2, Math.round(Math.sqrt(papers.length / 2))),
  );
  const papersById = new Map(papers.map((paper) => [paper.paperId, paper] as const));
  const citationCountByPaperId = new Map(
    papers.map((paper) => [paper.paperId, paper.citationCount] as const),
  );
  const profiles = buildPaperTopicProfiles({
    papers,
    query: input.query,
    queryClauses: input.queryClauses,
    externalSignals: input.externalSignals,
  });
  const termQualityContext = buildResearchTermQualityContext(input.query, input.queryClauses);
  const graph = buildCombinedGraph(input, papers);
  const partition = chooseBestLouvainPartition({
    graph,
    targetClusterCount,
  });
  const mergedCommunities = mergeSmallCommunities({
    graph,
    communities: buildCommunities(partition),
    targetClusterCount,
    citationCountByPaperId,
    externalSignals: input.externalSignals,
  });

  const clusters = mergedCommunities.map((paperIdsInCluster, index) => ({
    id: index + 1,
    paperIds: paperIdsInCluster,
    label: buildClusterTopicLabel({
      paperIds: paperIdsInCluster,
      papersById,
      graph,
      externalSignals: input.externalSignals,
      profiles,
      fallbackLabel: `Cluster ${String(index + 1)}`,
      termQualityContext,
    }),
  }));

  const clusterLabels = Object.fromEntries(
    clusters.flatMap((cluster) =>
      cluster.paperIds.map((paperId) => [paperId, cluster.label] as const),
    ),
  );

  return {
    clusterLabels,
    clusters,
  };
}
