import type {
  GapNetworkGraphSupportMetadata,
  GapNetworkMetadata,
  GapSourceSnapshotSupportMetadata,
  ResearchRoutePayload,
  SearchMetadata,
} from "@/app/domain/research-route-payload";
import { toGraphPaperSnapshots } from "@/app/lib/graph-paper-snapshots";
import { normalizeGraphSourcePaperIds } from "@/app/lib/graph-source-paper-ids";
import { knowledgeMapInputMatchesPaperIds } from "@/app/server/domain-access/search-backed-view-access.helpers";

export interface GapNetworkSourceSnapshotInput {
  sourceSnapshotId: string;
  sourceQuery: string;
  sourcePaperIds?: readonly string[];
  papers: SearchMetadata["papers"];
  graphSupport?: SearchMetadata["graphSupport"];
  queryClauses?: SearchMetadata["queryClauses"];
  createdBy?: "user" | "agent";
}

export interface CanonicalGapNetworkSourceSnapshotInput {
  sourceSnapshotId: string;
  sourceQuery: string;
  sourcePaperIds: string[];
  papers: ReturnType<typeof toGraphPaperSnapshots>;
  graphSupport?: GapSourceSnapshotSupportMetadata;
  createdBy: "user" | "agent";
}

export interface GapNetworkBuildSourceMetadata {
  query: string;
  queryClauses?: SearchMetadata["queryClauses"];
  papers: SearchMetadata["papers"];
  graphSupport?: GapNetworkGraphSupportMetadata;
}

function projectGraphSupportToPapers(
  graphSupport: SearchMetadata["graphSupport"],
  paperIds: readonly string[],
): GapSourceSnapshotSupportMetadata | undefined {
  if (!graphSupport) return undefined;
  const allowedPaperIds = new Set(paperIds);
  const samplePaperIds = graphSupport.samplePaperIds.filter((paperId) =>
    allowedPaperIds.has(paperId),
  );
  const paperScores = Object.fromEntries(
    samplePaperIds.flatMap((paperId) => {
      const score = graphSupport.paperScores[paperId];
      return score ? [[paperId, score] as const] : [];
    }),
  );
  return {
    version: 2,
    source: graphSupport.source,
    basis: "gap_source_snapshot",
    status: graphSupport.status,
    samplePaperIds,
    paperScores,
    generatedAt: graphSupport.generatedAt,
  };
}

/**
 * The stored snapshot is also the build input and content-address identity
 * boundary. Viewer-private paper fields and output-inert query clauses never
 * cross it.
 */
export function buildCanonicalGapNetworkSourceSnapshot(
  input: GapNetworkSourceSnapshotInput,
): CanonicalGapNetworkSourceSnapshotInput {
  const sourcePaperIds = normalizeGraphSourcePaperIds(input.sourcePaperIds);
  const selectedPapers =
    sourcePaperIds && sourcePaperIds.length > 0
      ? sourcePaperIds
          .map((paperId) => input.papers.find((paper) => paper.paperId === paperId))
          .filter((paper): paper is SearchMetadata["papers"][number] => Boolean(paper))
      : input.papers;
  const papers = toGraphPaperSnapshots(input.sourceQuery, undefined, selectedPapers);
  const canonicalPaperIds = papers.map((paper) => paper.paperId);
  return {
    sourceSnapshotId: input.sourceSnapshotId,
    sourceQuery: input.sourceQuery.trim(),
    sourcePaperIds: canonicalPaperIds,
    papers,
    graphSupport: projectGraphSupportToPapers(input.graphSupport, canonicalPaperIds),
    createdBy: input.createdBy ?? "user",
  };
}

export function gapNetworkDocumentMatchesSourcePaperIds(
  document: ResearchRoutePayload | null,
  sourcePaperIds?: readonly string[],
): boolean {
  if (!sourcePaperIds || sourcePaperIds.length === 0) {
    return true;
  }
  return knowledgeMapInputMatchesPaperIds(document, sourcePaperIds);
}

export function buildGapNetworkBuildSourceFromSnapshot(
  input: CanonicalGapNetworkSourceSnapshotInput,
): GapNetworkBuildSourceMetadata {
  return {
    query: input.sourceQuery,
    papers: input.papers,
    graphSupport: input.graphSupport,
  };
}

export function buildGapNetworkBuildSourceFromStoredSnapshot(
  document: ResearchRoutePayload & { metadata: GapNetworkMetadata },
): GapNetworkBuildSourceMetadata {
  return {
    query: document.metadata.query,
    papers: document.metadata.papers,
    graphSupport: document.metadata.sourceGraphSupport,
  };
}
