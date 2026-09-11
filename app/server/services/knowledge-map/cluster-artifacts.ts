import type { GraphPaperSnapshot } from "@/app/domain/research-route-payload";

interface ClusterSeedInput {
  label: string;
  paperIds: string[];
}

interface OrderedClusterEntry {
  id: string;
  label: string;
  paperIds: string[];
}

export function buildOrderedClusterEntries(params: {
  papers: GraphPaperSnapshot[];
  clusterLabels: Record<string, string>;
  clusters?: ClusterSeedInput[];
}): OrderedClusterEntry[] {
  const orderedLabels = new Map<string, string[]>();

  for (const cluster of params.clusters ?? []) {
    orderedLabels.set(cluster.label, [...cluster.paperIds]);
  }

  for (const paper of params.papers) {
    const label = params.clusterLabels[paper.paperId] ?? "Cluster 1";
    const bucket = orderedLabels.get(label) ?? [];
    if (!bucket.includes(paper.paperId)) {
      bucket.push(paper.paperId);
    }
    orderedLabels.set(label, bucket);
  }

  return [...orderedLabels.entries()]
    .map(([label, paperIds], index) => ({
      id: `cluster-${String(index)}`,
      label,
      paperIds: [...new Set(paperIds)],
    }))
    .filter((cluster) => cluster.paperIds.length > 0);
}

export function buildPaperClusterIdMap(
  clusters: Array<{ id: string; paperIds: string[] }>,
): Map<string, string> {
  const clusterIdByPaperId = new Map<string, string>();
  for (const cluster of clusters) {
    for (const paperId of cluster.paperIds) {
      clusterIdByPaperId.set(paperId, cluster.id);
    }
  }
  return clusterIdByPaperId;
}

export function buildUndirectedEdgeKey(source: string, target: string): string {
  return [source, target].sort().join("::");
}

interface UndirectedEdgeLike {
  source: string;
  target: string;
}

export function buildUniqueUndirectedEdges(params: {
  validNodeIds: ReadonlySet<string>;
  citationEdges: ReadonlyArray<UndirectedEdgeLike>;
  semanticEdges?: ReadonlyArray<UndirectedEdgeLike>;
  graphSupportEdges?: ReadonlyArray<UndirectedEdgeLike>;
}): UndirectedEdgeLike[] {
  const edgeMap = new Map<string, UndirectedEdgeLike>();

  const registerEdge = (source: string, target: string) => {
    if (source === target || !params.validNodeIds.has(source) || !params.validNodeIds.has(target)) {
      return;
    }

    const [left, right] = [source, target].sort();
    const key = buildUndirectedEdgeKey(left, right);
    if (!edgeMap.has(key)) {
      edgeMap.set(key, { source: left, target: right });
    }
  };

  for (const edge of params.citationEdges) {
    registerEdge(edge.source, edge.target);
  }

  for (const edge of params.semanticEdges ?? []) {
    registerEdge(edge.source, edge.target);
  }

  for (const edge of params.graphSupportEdges ?? []) {
    registerEdge(edge.source, edge.target);
  }

  return [...edgeMap.values()];
}
