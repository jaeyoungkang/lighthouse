// @promise promise:gap-network-detection-from-search
// @check acceptance-check:gap-network-detection-from-search-analysis-input-cap
import type { GraphPaperSnapshot, SearchMetadata } from "@/app/domain/research-route-payload";
import { MAX_GRAPH_SOURCE_PAPERS } from "@/app/lib/constants";
import {
  GAP_REPORT_INGRESS_LIMITS,
  GAP_REPORT_SNAPSHOT_LIMITS,
  truncateUtf8,
  utf8ByteLength,
} from "@/app/lib/gap-report-input-budget";

export interface GraphPaperSnapshotProjection {
  papers: GraphPaperSnapshot[];
  paperIdMap: ReadonlyMap<string, string>;
}

function allocateToken(prefix: string, used: Set<string>): string {
  let index = used.size + 1;
  let candidate = `${prefix}${String(index)}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${prefix}${String(index)}`;
  }
  used.add(candidate);
  return candidate;
}

function normalizePaperId(rawPaperId: string, used: Set<string>): string {
  if (
    rawPaperId.length > 0 &&
    rawPaperId.length <= GAP_REPORT_INGRESS_LIMITS.paperIdChars &&
    utf8ByteLength(rawPaperId) <= GAP_REPORT_SNAPSHOT_LIMITS.preservedPaperIdBytes &&
    !used.has(rawPaperId)
  ) {
    used.add(rawPaperId);
    return rawPaperId;
  }
  return allocateToken("__gap_paper_", used);
}

function uniqueTopPapers(papers: SearchMetadata["papers"]): SearchMetadata["papers"] {
  const seen = new Set<string>();
  const result: SearchMetadata["papers"] = [];
  for (const paper of papers) {
    if (seen.has(paper.paperId)) continue;
    seen.add(paper.paperId);
    result.push(paper);
    if (result.length >= MAX_GRAPH_SOURCE_PAPERS) break;
  }
  return result;
}

function normalizeRelationIds(params: {
  values: readonly string[] | null | undefined;
  paperIdMap: ReadonlyMap<string, string>;
  relationIdMap: Map<string, string>;
  usedIds: Set<string>;
}): string[] | null {
  if (params.values == null) return null;

  const direct: string[] = [];
  const external: string[] = [];
  const seen = new Set<string>();
  for (const rawId of params.values.slice(0, GAP_REPORT_INGRESS_LIMITS.paperRelationIds)) {
    if (seen.has(rawId)) continue;
    seen.add(rawId);
    const paperId = params.paperIdMap.get(rawId);
    if (paperId) {
      direct.push(paperId);
      continue;
    }
    let relationId = params.relationIdMap.get(rawId);
    if (!relationId) {
      relationId = allocateToken("__gap_relation_", params.usedIds);
      params.relationIdMap.set(rawId, relationId);
    }
    external.push(relationId);
  }

  return [...direct, ...external].slice(0, GAP_REPORT_SNAPSHOT_LIMITS.paperRelationIds);
}

export function toGraphPaperSnapshotProjection(
  papers: SearchMetadata["papers"],
): GraphPaperSnapshotProjection {
  const selectedPapers = uniqueTopPapers(papers);
  const usedIds = new Set<string>();
  const paperIdMap = new Map<string, string>();
  for (const paper of selectedPapers) {
    paperIdMap.set(paper.paperId, normalizePaperId(paper.paperId, usedIds));
  }

  const relationIdMap = new Map<string, string>();
  const snapshots = selectedPapers.map((paper) => ({
    paperId: paperIdMap.get(paper.paperId) ?? paper.paperId,
    title: truncateUtf8(paper.title, GAP_REPORT_SNAPSHOT_LIMITS.paperTitleBytes),
    abstract:
      paper.abstract == null
        ? null
        : truncateUtf8(paper.abstract, GAP_REPORT_SNAPSHOT_LIMITS.paperAbstractBytes),
    year: paper.year,
    citationCount: paper.citationCount,
    url: truncateUtf8(paper.url, GAP_REPORT_SNAPSHOT_LIMITS.paperUrlBytes),
    // Gap analysis uses title/abstract and relation topology. Author and access
    // metadata are output-inert here, so they do not cross the shared artifact boundary.
    authors: [],
    openAccessPdf: null,
    doi: null,
    referenceIds: normalizeRelationIds({
      values: paper.referenceIds,
      paperIdMap,
      relationIdMap,
      usedIds,
    }),
    citationIds: normalizeRelationIds({
      values: paper.citationIds,
      paperIdMap,
      relationIdMap,
      usedIds,
    }),
  }));

  return { papers: snapshots, paperIdMap };
}

export function projectGraphSupportForGapRequest(
  graphSupport: SearchMetadata["graphSupport"],
  projection: GraphPaperSnapshotProjection,
): SearchMetadata["graphSupport"] | undefined {
  if (!graphSupport) return undefined;

  const allowedPaperIds = new Set(projection.papers.map((paper) => paper.paperId));
  const normalizePaperId = (paperId: string): string | undefined => {
    const normalized = projection.paperIdMap.get(paperId) ?? paperId;
    return allowedPaperIds.has(normalized) ? normalized : undefined;
  };
  const samplePaperIds = graphSupport.samplePaperIds
    .slice(0, MAX_GRAPH_SOURCE_PAPERS)
    .flatMap((paperId) => {
      const normalized = normalizePaperId(paperId);
      return normalized ? [normalized] : [];
    });
  const uniqueSamplePaperIds = [...new Set(samplePaperIds)];
  const sourceIdMap = new Map<string, string>();
  const usedSourceIds = new Set<string>();
  const paperScores = Object.fromEntries(
    [...projection.paperIdMap.entries()].flatMap(([rawPaperId, paperId]) => {
      const score = graphSupport.paperScores[rawPaperId];
      if (!paperId || !score) return [];
      const sources = [
        ...new Set(score.sources.slice(0, GAP_REPORT_INGRESS_LIMITS.graphScoreSources)),
      ].map((source) => {
        let sourceId = sourceIdMap.get(source);
        if (!sourceId) {
          sourceId = allocateToken("__gap_source_", usedSourceIds);
          sourceIdMap.set(source, sourceId);
        }
        return sourceId;
      });
      return [[paperId, { ...score, sources }] as const];
    }),
  );

  return {
    ...graphSupport,
    samplePaperIds: uniqueSamplePaperIds,
    paperScores,
    generatedAt: truncateUtf8(
      graphSupport.generatedAt,
      GAP_REPORT_SNAPSHOT_LIMITS.generatedAtBytes,
    ),
  } as SearchMetadata["graphSupport"];
}

export function toGraphPaperSnapshots(
  _query: string,
  _queryClauses: SearchMetadata["queryClauses"],
  papers: SearchMetadata["papers"],
): GraphPaperSnapshot[] {
  return toGraphPaperSnapshotProjection(papers).papers;
}
