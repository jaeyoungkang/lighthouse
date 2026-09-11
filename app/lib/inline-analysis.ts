import { INLINE_ANALYSIS_VERSION, type AIAnalysis } from "@/app/domain/analysis";
import type { PaperCore } from "@/app/domain/paper";
import type {
  CitationLineageMetadata,
  GraphNeighborsMetadata,
  InlineAnalysisCache,
  SearchMetadata,
} from "@/app/domain/research-route-payload";

type InlineAnalysisInput = Pick<PaperCore, "title" | "abstract" | "year">;

export interface AnalysisResult {
  inputFingerprint?: string;
  analysis: AIAnalysis;
  source?: "abstract";
}

export interface InlineAnalysisFailureResult {
  paperId: string;
  status: "error";
  failureKind: "cooldown" | "terminal";
  cooldownUntil?: string;
  retryRequiresExplicit: true;
}

export type InlineAnalysisResponseResult =
  | ({ paperId: string } & AnalysisResult)
  | InlineAnalysisFailureResult;

export type AnalysisProgressState = "queued" | "running" | "done" | "error";

export interface InlineAnalysisRequestPaper {
  paperId: string;
  title: string;
  abstract: string | null;
  year?: number | null;
}

export function normalizeInlineAnalysisInputText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function hasUsableInlineAnalysisAbstract(value: string | null | undefined): value is string {
  return normalizeInlineAnalysisInputText(value).length > 0;
}

export function hasSameInlineAnalysisInput(
  left: InlineAnalysisInput,
  right: InlineAnalysisInput,
): boolean {
  return (
    normalizeInlineAnalysisInputText(left.title) ===
      normalizeInlineAnalysisInputText(right.title) &&
    normalizeInlineAnalysisInputText(left.abstract) ===
      normalizeInlineAnalysisInputText(right.abstract) &&
    (left.year ?? null) === (right.year ?? null)
  );
}

function hasNonEmptyText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasSemanticProfileSignals(analysis: AIAnalysis): boolean {
  return (
    hasNonEmptyText(analysis.semanticProfile.claim) ||
    analysis.semanticProfile.topics.length > 0 ||
    hasNonEmptyText(analysis.semanticProfile.method)
  );
}

export function isInlineAnalysisFailurePlaceholder(analysis: AIAnalysis): boolean {
  return analysis.confidence === "low" && !hasSemanticProfileSignals(analysis);
}

export function isKnowledgeMapUsableInlineAnalysis(analysis: AIAnalysis): boolean {
  return hasSemanticProfileSignals(analysis);
}

/**
 * Returns the embedded analysis only when it is safe for current downstream use.
 *
 * Exact title/abstract/year fingerprint verification remains owned by the server
 * hydration boundary. Shared client/server consumers still reject legacy
 * versions, fingerprint-less snapshots, failure placeholders, and papers whose
 * abstract is absent or whitespace-only.
 */
export function getCurrentUsableInlineAnalysisRecord(
  paper: PaperCore,
): InlineAnalysisCache | undefined {
  if (!hasUsableInlineAnalysisAbstract(paper.abstract)) return undefined;

  const inlineAnalysis = (paper as PaperCore & { inlineAnalysis?: InlineAnalysisCache })
    .inlineAnalysis;
  if (inlineAnalysis?.version !== INLINE_ANALYSIS_VERSION || !inlineAnalysis.inputFingerprint) {
    return undefined;
  }

  return isInlineAnalysisFailurePlaceholder(inlineAnalysis.analysis) ? undefined : inlineAnalysis;
}

export function hasCurrentInlineAnalysisRecord(paper: SearchMetadata["papers"][number]): boolean {
  if (!hasUsableInlineAnalysisAbstract(paper.abstract)) {
    return true;
  }

  return getCurrentUsableInlineAnalysisRecord(paper) !== undefined;
}

export function hasKnowledgeMapUsableInlineAnalysisRecord(
  paper: SearchMetadata["papers"][number],
): boolean {
  if (!hasUsableInlineAnalysisAbstract(paper.abstract)) {
    return true;
  }

  const inlineAnalysis = getCurrentUsableInlineAnalysisRecord(paper);
  if (!inlineAnalysis) return false;

  return isKnowledgeMapUsableInlineAnalysis(inlineAnalysis.analysis);
}

export function hasKnowledgeMapUsableInlineAnalysisForPapers(
  papers: SearchMetadata["papers"],
): boolean {
  return papers.every((paper) => hasKnowledgeMapUsableInlineAnalysisRecord(paper));
}

function getCachedInlineAnalysis(paper: SearchMetadata["papers"][number]): AnalysisResult | null {
  const cached = getCurrentUsableInlineAnalysisRecord(paper);
  if (!cached) return null;

  return {
    inputFingerprint: cached.inputFingerprint,
    analysis: cached.analysis,
    source: cached.source,
  };
}

export function buildInlineAnalysisMap(
  papers: SearchMetadata["papers"],
): Map<string, AnalysisResult> {
  const map = new Map<string, AnalysisResult>();

  for (const paper of papers) {
    const cached = getCachedInlineAnalysis(paper);
    if (cached) {
      map.set(paper.paperId, cached);
    }
  }

  return map;
}

export function buildInlineAnalysisProgressMap(
  papers: SearchMetadata["papers"],
): Map<string, AnalysisProgressState> {
  const map = new Map<string, AnalysisProgressState>();

  for (const paper of papers) {
    if (getCachedInlineAnalysis(paper)) {
      map.set(paper.paperId, "done");
    }
  }

  return map;
}

export function buildInlineAnalysisPayload(
  papers: SearchMetadata["papers"],
): InlineAnalysisRequestPaper[] {
  return papers
    .filter((paper): paper is SearchMetadata["papers"][number] & { abstract: string } =>
      hasUsableInlineAnalysisAbstract(paper.abstract),
    )
    .map((paper) => ({
      paperId: paper.paperId,
      title: paper.title,
      abstract: paper.abstract,
      year: paper.year,
    }));
}

export function buildInlineAnalysisCycleKey(
  documentId: string,
  metadata: SearchMetadata | CitationLineageMetadata | GraphNeighborsMetadata,
): string {
  const discriminant = metadata.type === "search" ? metadata.query : metadata.seedPaper.paperId;
  return JSON.stringify([documentId, discriminant, metadata.papers.map((paper) => paper.paperId)]);
}

export function hasPendingInlineAnalysis(
  papers: SearchMetadata["papers"],
  analysisMap: ReadonlyMap<string, AnalysisResult>,
  analysisProgressMap: ReadonlyMap<string, AnalysisProgressState>,
  visibleCount: number,
  visiblePaperIds?: ReadonlySet<string>,
): boolean {
  const candidatePapers =
    visiblePaperIds == null
      ? papers.slice(0, visibleCount)
      : papers.filter((paper) => visiblePaperIds.has(paper.paperId)).slice(0, visibleCount);
  return candidatePapers.some(
    (paper) =>
      hasUsableInlineAnalysisAbstract(paper.abstract) &&
      !analysisMap.has(paper.paperId) &&
      analysisProgressMap.get(paper.paperId) !== "error",
  );
}

export function mergeInlineAnalysisIntoPapers(
  papers: SearchMetadata["papers"],
  resultMap: Map<string, AnalysisResult>,
): SearchMetadata["papers"] {
  return papers.map((paper) => {
    const result = resultMap.get(paper.paperId);
    if (!result) return paper;

    return {
      ...paper,
      inlineAnalysis: {
        version: INLINE_ANALYSIS_VERSION,
        inputFingerprint: result.inputFingerprint,
        analysis: result.analysis,
        source: result.source,
      },
    };
  });
}

export function queueVisibleInlineAnalysis(params: {
  papers: SearchMetadata["papers"];
  visibleCount: number;
  visiblePaperIds?: ReadonlySet<string>;
  analysisMap: ReadonlyMap<string, AnalysisResult>;
  analysisProgressMap: ReadonlyMap<string, AnalysisProgressState>;
}): Map<string, AnalysisProgressState> {
  const visiblePaperIds =
    params.visiblePaperIds ??
    new Set(params.papers.slice(0, params.visibleCount).map((paper) => paper.paperId));
  const visiblePapers = params.papers
    .filter((paper) => visiblePaperIds.has(paper.paperId))
    .slice(0, params.visibleCount);
  const next = new Map(
    [...params.analysisProgressMap].filter(
      ([paperId, status]) =>
        visiblePaperIds.has(paperId) || status === "done" || status === "error",
    ),
  );

  for (const paper of visiblePapers) {
    if (!hasUsableInlineAnalysisAbstract(paper.abstract) || params.analysisMap.has(paper.paperId)) {
      continue;
    }
    if (!next.has(paper.paperId)) {
      next.set(paper.paperId, "queued");
    }
  }

  return next;
}

export function hasRunningInlineAnalysis(
  analysisProgressMap: ReadonlyMap<string, AnalysisProgressState>,
): boolean {
  for (const state of analysisProgressMap.values()) {
    if (state === "running") return true;
  }

  return false;
}

export function selectInlineAnalysisBatch(params: {
  papers: SearchMetadata["papers"];
  visibleCount: number;
  visiblePaperIds?: ReadonlySet<string>;
  analysisProgressMap: ReadonlyMap<string, AnalysisProgressState>;
  batchSize: number;
}): SearchMetadata["papers"] {
  const visiblePaperIds =
    params.visiblePaperIds ??
    new Set(params.papers.slice(0, params.visibleCount).map((paper) => paper.paperId));
  return params.papers
    .filter((paper) => visiblePaperIds.has(paper.paperId))
    .slice(0, params.visibleCount)
    .filter(
      (paper): paper is SearchMetadata["papers"][number] & { abstract: string } =>
        hasUsableInlineAnalysisAbstract(paper.abstract) &&
        params.analysisProgressMap.get(paper.paperId) === "queued",
    )
    .slice(0, params.batchSize);
}

export function updateInlineAnalysisProgress(
  analysisProgressMap: ReadonlyMap<string, AnalysisProgressState>,
  paperIds: Iterable<string>,
  nextState: AnalysisProgressState,
): Map<string, AnalysisProgressState> {
  const next = new Map(analysisProgressMap);

  for (const paperId of paperIds) {
    next.set(paperId, nextState);
  }

  return next;
}

export function buildInlineAnalysisResponseMap(
  response: Array<{ paperId: string } & AnalysisResult>,
): Map<string, AnalysisResult> {
  return new Map(response.map(({ paperId, analysis, source }) => [paperId, { analysis, source }]));
}

export function mergeInlineAnalysisResults(
  analysisMap: ReadonlyMap<string, AnalysisResult>,
  resultMap: ReadonlyMap<string, AnalysisResult>,
): Map<string, AnalysisResult> {
  const next = new Map(analysisMap);

  for (const [paperId, result] of resultMap) {
    next.set(paperId, result);
  }

  return next;
}

export function resolveInlineAnalysisBatchProgress(params: {
  analysisProgressMap: ReadonlyMap<string, AnalysisProgressState>;
  batchPaperIds: Iterable<string>;
  resultMap: ReadonlyMap<string, AnalysisResult>;
}): Map<string, AnalysisProgressState> {
  const next = new Map(params.analysisProgressMap);

  for (const paperId of params.batchPaperIds) {
    next.set(paperId, params.resultMap.has(paperId) ? "done" : "queued");
  }

  return next;
}
