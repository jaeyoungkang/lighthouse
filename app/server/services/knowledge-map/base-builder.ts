import type {
  GapNetworkGraphSupportMetadata,
  GraphPaperSnapshot,
  KnowledgeMapBaseArtifact,
  KnowledgeMapGraphSupportEdgeArtifact,
  SearchMetadata,
} from "@/app/domain/research-route-payload";
import { toGraphPaperSnapshots } from "@/app/lib/graph-paper-snapshots";
import { getCurrentUsableInlineAnalysisRecord } from "@/app/lib/inline-analysis";
import { clusterDegreeDistributionNetwork } from "@/app/server/services/knowledge-map/cluster";
import {
  enrichDegreeDistributionNetwork,
  shouldEnrichDegreeDistribution,
  type DegreeDistributionEnrichInput,
  type DegreeDistributionSemanticEdgeInput,
} from "@/app/server/services/knowledge-map/enrich";
import type { ExternalPaperSignals } from "@/app/server/services/knowledge-map/topic-signals";

export interface KnowledgeMapBaseBuildInput {
  ownerPrincipalId: string;
  sourceSnapshotId: string;
  query: string;
  queryClauses?: SearchMetadata["queryClauses"];
  papers: SearchMetadata["papers"];
  graphSupport?: GapNetworkGraphSupportMetadata;
  createdBy: "user" | "agent";
}

interface KnowledgeMapBaseBuilderDeps {
  enrichNetwork?: (
    input: DegreeDistributionEnrichInput,
  ) => Promise<DegreeDistributionSemanticEdgeInput[]>;
  clusterNetwork?: typeof clusterDegreeDistributionNetwork;
}

interface CitationEdgeInput {
  source: string;
  target: string;
  weight: number;
}

export function buildExternalSignalsFromInlineAnalysis(
  papers: SearchMetadata["papers"],
): ExternalPaperSignals[] {
  return papers.flatMap((paper) => {
    const inlineAnalysis = getCurrentUsableInlineAnalysisRecord(paper);
    if (!inlineAnalysis) {
      return [];
    }

    const semanticProfile = inlineAnalysis.analysis.semanticProfile;

    return [
      {
        paperId: paper.paperId,
        claim: semanticProfile.claim ?? undefined,
        topics: semanticProfile.topics,
        methods: semanticProfile.method ? [semanticProfile.method] : [],
        finding: semanticProfile.finding ?? undefined,
      } satisfies ExternalPaperSignals,
    ];
  });
}

export function buildCitationEdges(papers: GraphPaperSnapshot[]): CitationEdgeInput[] {
  const availablePaperIds = new Set(papers.map((paper) => paper.paperId));
  const pairMap = new Map<string, { source: string; target: string; directions: Set<string> }>();

  const registerDirection = (fromPaperId: string, toPaperId: string) => {
    if (
      !availablePaperIds.has(fromPaperId) ||
      !availablePaperIds.has(toPaperId) ||
      fromPaperId === toPaperId
    ) {
      return;
    }

    const [source, target] = [fromPaperId, toPaperId].sort();
    const key = `${source}::${target}`;
    const entry = pairMap.get(key) ?? {
      source,
      target,
      directions: new Set<string>(),
    };
    entry.directions.add(`${fromPaperId}->${toPaperId}`);
    pairMap.set(key, entry);
  };

  for (const paper of papers) {
    for (const referenceId of new Set(paper.referenceIds ?? [])) {
      registerDirection(paper.paperId, referenceId);
    }

    for (const citationId of new Set(paper.citationIds ?? [])) {
      registerDirection(citationId, paper.paperId);
    }
  }

  return [...pairMap.values()]
    .map((entry) => ({
      source: entry.source,
      target: entry.target,
      weight: Number((entry.directions.size / 2).toFixed(3)),
    }))
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 300);
}

export function buildGraphSupportEdges(params: {
  papers: GraphPaperSnapshot[];
  graphSupport?: GapNetworkGraphSupportMetadata;
}): KnowledgeMapGraphSupportEdgeArtifact[] {
  if (!params.graphSupport || params.graphSupport.status !== "ready") {
    return [];
  }

  const availablePaperIds = new Set(params.papers.map((paper) => paper.paperId));
  const supported = Object.entries(params.graphSupport.paperScores)
    .flatMap(([paperId, score]) =>
      availablePaperIds.has(paperId) && score && score.defaultScore > 0
        ? [[paperId, score] as const]
        : [],
    )
    .sort((left, right) => {
      if (right[1].defaultScore !== left[1].defaultScore) {
        return right[1].defaultScore - left[1].defaultScore;
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, 24);

  const edges: KnowledgeMapGraphSupportEdgeArtifact[] = [];
  for (let leftIndex = 0; leftIndex < supported.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < supported.length; rightIndex += 1) {
      const [leftPaperId, leftScore] = supported[leftIndex];
      const [rightPaperId, rightScore] = supported[rightIndex];
      const sharedSourceCount = leftScore.sources.filter((source) =>
        rightScore.sources.includes(source),
      ).length;
      const weight =
        Math.min(leftScore.defaultScore, rightScore.defaultScore) * (1 + sharedSourceCount);
      edges.push({
        source: leftPaperId,
        target: rightPaperId,
        weight: Number(weight.toFixed(3)),
      });
    }
  }

  return edges
    .sort((left, right) => {
      if (right.weight !== left.weight) return right.weight - left.weight;
      if (left.source !== right.source) return left.source.localeCompare(right.source);
      return left.target.localeCompare(right.target);
    })
    .slice(0, 300);
}

export async function buildKnowledgeMapBaseData(
  input: Omit<KnowledgeMapBaseBuildInput, "ownerPrincipalId" | "sourceSnapshotId" | "createdBy">,
  deps: KnowledgeMapBaseBuilderDeps = {},
): Promise<{
  papers: GraphPaperSnapshot[];
  base: KnowledgeMapBaseArtifact;
  clusters: ReturnType<typeof clusterDegreeDistributionNetwork>["clusters"];
}> {
  const externalSignals = buildExternalSignalsFromInlineAnalysis(input.papers);
  const papers = toGraphPaperSnapshots(input.query, input.queryClauses, input.papers);
  const citationEdges = buildCitationEdges(papers);
  const graphSupportEdges = buildGraphSupportEdges({
    papers,
    graphSupport: input.graphSupport,
  });
  const semanticEdges = shouldEnrichDegreeDistribution({
    paperCount: papers.length,
    edgeCount: citationEdges.length,
  })
    ? await (deps.enrichNetwork ?? enrichDegreeDistributionNetwork)({
        query: input.query,
        queryClauses: input.queryClauses,
        papers,
        citationEdges,
        externalSignals,
      })
    : [];
  const clusteredGraph = (deps.clusterNetwork ?? clusterDegreeDistributionNetwork)({
    query: input.query,
    queryClauses: input.queryClauses,
    papers,
    citationEdges,
    semanticEdges,
    graphSupportEdges,
    externalSignals,
  });

  return {
    papers,
    base: {
      version: 1,
      citationEdges,
      semanticEdges,
      graphSupportEdges,
      clusterLabels: clusteredGraph.clusterLabels,
    },
    clusters: clusteredGraph.clusters,
  };
}
