import type {
  EnglishTermCandidate,
  ResearchRoutePayload,
  SearchResearchRoutePayload,
  SearchMetadata,
  SearchTermDiscoveryState,
} from "@/app/domain/research-route-payload";
import {
  buildSearchBackgroundSnapshotTarget,
  buildSearchEnrichmentCommandV1,
  hasSameSearchBackgroundTarget,
  searchEnrichmentDeltaResponseV1Schema,
  type SearchEnrichmentDelta,
  type SearchEnrichmentDeltaResponseV1,
  type SearchTermDiscoveryDelta,
} from "@/app/domain/search-background-transport";
import { t } from "@/app/i18n/message-access";
import { API_ROUTES } from "@/app/lib/api-routes";
import { fetchBackgroundRequest, waitForBackgroundRetry } from "@/app/lib/background-request";
import {
  compareEnglishTermCandidatesBySupport,
  getEnglishTermCandidateBasisSource,
} from "@/app/lib/search-term-candidates";
import {
  hasEpisteme3SearchPaper,
  shouldRepairSearchHydrationMetadata,
} from "@/app/lib/search-hydration-state";
import { useResearchRouteStore } from "@/app/stores/research-route-store";
import {
  hasSameInlineAnalysisInput,
  hasUsableInlineAnalysisAbstract,
} from "@/app/lib/inline-analysis";
import { advanceUpdatedAtAfterCurrent } from "@/app/stores/research-route-store-internals";
import {
  getApiErrorRetryDelayMs,
  isApiErrorRetryable,
  readApiResponseError,
} from "@/app/lib/api-error-response";

export interface SearchEnrichmentTask {
  executionId: string;
  documentId: string;
  ownerPrincipalId: string;
  query: string;
  metadata: SearchMetadata;
}

type SearchEnrichmentResponse = SearchEnrichmentDeltaResponseV1;

const SEARCH_ENRICHMENT_MAX_ATTEMPTS = 3;
const SEARCH_ENRICHMENT_RETRY_DELAY_MS = 500;
const TERM_CANDIDATE_SAMPLE_LIMIT = 3;

export function isSearchHydrationPending(metadata: SearchMetadata): boolean {
  return metadata.abstractHydration?.status === "pending";
}

function isSearchViewReady(document: ResearchRoutePayload): document is SearchResearchRoutePayload {
  if (document.status !== "ready" || document.type !== "search") {
    return false;
  }
  return true;
}

function hasSameSearchSnapshotTarget(current: SearchMetadata, original: SearchMetadata): boolean {
  return hasSameSearchBackgroundTarget(
    buildSearchBackgroundSnapshotTarget(current),
    buildSearchBackgroundSnapshotTarget(original),
  );
}

function hasSameSearchEnrichmentInput(current: SearchMetadata, original: SearchMetadata): boolean {
  return (
    JSON.stringify(buildSearchEnrichmentCommandV1(current)) ===
    JSON.stringify(buildSearchEnrichmentCommandV1(original))
  );
}

function hasAllowedSearchEnrichmentResultTarget(
  incoming: SearchMetadata,
  original: SearchMetadata,
): boolean {
  return hasSameSearchSnapshotTarget(incoming, original);
}

function hasSameMetadataValue<T>(left: T, right: T): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function rankTermDiscoveryState(state: SearchTermDiscoveryState | undefined): number {
  if (!state) return 0;
  return state.status === "pending" ? 1 : 2;
}

function selectTermDiscoverySource(
  incoming: SearchMetadata,
  existing: SearchMetadata,
): SearchMetadata {
  const incomingRank = rankTermDiscoveryState(incoming.englishTermDiscovery);
  const existingRank = rankTermDiscoveryState(existing.englishTermDiscovery);
  if (existingRank > incomingRank) return existing;
  if (incomingRank > existingRank) return incoming;
  return incoming.englishTermCandidates && incoming.englishTermCandidates.length > 0
    ? incoming
    : existing;
}

function mergeAbstractHydrationState(
  incoming: SearchMetadata["abstractHydration"],
  existing: SearchMetadata["abstractHydration"],
): SearchMetadata["abstractHydration"] {
  if (!incoming) return existing;
  if (!existing) return incoming;
  return {
    ...incoming,
    ...existing,
    status: incoming.status === "ready" || existing.status === "ready" ? "ready" : "pending",
    ...(incoming.repairAttempted || existing.repairAttempted ? { repairAttempted: true } : {}),
  };
}

function getPaperInlineAnalysis(paper: SearchMetadata["papers"][number]) {
  return "inlineAnalysis" in paper ? paper.inlineAnalysis : undefined;
}

function getPaperReviewState(paper: SearchMetadata["papers"][number]) {
  if (!("reviewed" in paper)) return undefined;
  return {
    reviewed: paper.reviewed,
    reviewedAt: paper.reviewed ? paper.reviewedAt : undefined,
  };
}

function keepPresent<T>(incoming: T | null | undefined, existing: T | null | undefined) {
  return incoming ?? existing;
}

function keepNonEmptyArray<T>(incoming: T[] | null | undefined, existing: T[] | null | undefined) {
  if (incoming && incoming.length > 0) return incoming;
  return existing ?? incoming;
}

export function mergeBackgroundPaperDetails(
  incomingPapers: SearchMetadata["papers"],
  existingPapers: SearchMetadata["papers"],
  basePapers?: SearchMetadata["papers"],
): SearchMetadata["papers"] {
  const incomingByPaperId = new Map(incomingPapers.map((paper) => [paper.paperId, paper] as const));
  const baseByPaperId = basePapers
    ? new Map(basePapers.map((paper) => [paper.paperId, paper] as const))
    : null;
  return existingPapers.map((existingPaper) => {
    const incomingPaper = incomingByPaperId.get(existingPaper.paperId);
    if (!incomingPaper) return existingPaper;
    const basePaper = baseByPaperId?.get(incomingPaper.paperId);
    const existingInlineAnalysis = getPaperInlineAnalysis(existingPaper);
    const incomingInlineAnalysis = getPaperInlineAnalysis(incomingPaper);
    const baseInlineAnalysis = basePaper ? getPaperInlineAnalysis(basePaper) : undefined;
    const mergedAbstract = keepPresent(incomingPaper.abstract, existingPaper.abstract) ?? null;
    const hasSameInput = hasSameInlineAnalysisInput(
      { ...incomingPaper, abstract: mergedAbstract },
      existingPaper,
    );
    const hasDifferentFingerprint =
      incomingInlineAnalysis != null &&
      incomingInlineAnalysis.inputFingerprint != null &&
      incomingInlineAnalysis.inputFingerprint !== existingInlineAnalysis?.inputFingerprint;
    const hasConcurrentInlineAnalysisChange =
      basePaper != null && !hasSameMetadataValue(existingInlineAnalysis, baseInlineAnalysis);
    const inlineAnalysis = !hasSameInput
      ? incomingInlineAnalysis
      : hasDifferentFingerprint
        ? incomingInlineAnalysis
        : hasConcurrentInlineAnalysisChange
          ? existingInlineAnalysis
          : basePaper
            ? incomingInlineAnalysis
            : (existingInlineAnalysis ?? incomingInlineAnalysis);
    const existingReviewState = getPaperReviewState(existingPaper);
    const mergedPaper = {
      ...incomingPaper,
      abstract: mergedAbstract,
      venue: keepPresent(incomingPaper.venue, existingPaper.venue),
      fieldsOfStudy: keepNonEmptyArray(incomingPaper.fieldsOfStudy, existingPaper.fieldsOfStudy),
      authors: keepNonEmptyArray(incomingPaper.authors, existingPaper.authors) ?? [],
      openAccessPdf: keepPresent(incomingPaper.openAccessPdf, existingPaper.openAccessPdf),
      openAccess: keepPresent(incomingPaper.openAccess, existingPaper.openAccess),
      source: keepPresent(incomingPaper.source, existingPaper.source),
      doi: keepPresent(incomingPaper.doi, existingPaper.doi),
      externalIds: keepPresent(incomingPaper.externalIds, existingPaper.externalIds),
      referenceIds: keepNonEmptyArray(incomingPaper.referenceIds, existingPaper.referenceIds),
      referenceCount: keepPresent(incomingPaper.referenceCount, existingPaper.referenceCount),
      citationIds: keepNonEmptyArray(incomingPaper.citationIds, existingPaper.citationIds),
      referenceAvailability: keepPresent(
        incomingPaper.referenceAvailability,
        existingPaper.referenceAvailability,
      ),
      citationAvailability: keepPresent(
        incomingPaper.citationAvailability,
        existingPaper.citationAvailability,
      ),
      ...(inlineAnalysis ? { inlineAnalysis } : {}),
      ...(existingReviewState ?? {}),
    };
    return mergedPaper as SearchMetadata["papers"][number];
  });
}

function buildCandidateBasis(params: {
  candidate: Pick<EnglishTermCandidate, "supportCount" | "samplePaperIds">;
  graphSupportCount: number;
  byPaperId: Map<string, SearchMetadata["papers"][number]>;
}): string {
  const samplePapers = params.candidate.samplePaperIds
    .map((paperId) => params.byPaperId.get(paperId))
    .filter((paper): paper is SearchMetadata["papers"][number] => paper !== undefined)
    .slice(0, TERM_CANDIDATE_SAMPLE_LIMIT);
  const source = getEnglishTermCandidateBasisSource({
    hasAbstractBasis: samplePapers.some((paper) => hasUsableInlineAnalysisAbstract(paper.abstract)),
    graphSupportCount: params.graphSupportCount,
  });
  const title = samplePapers[0]?.title ?? "";
  return title
    ? t("search.label.search-term-discovery.basisWithExample", {
        source,
        count: params.candidate.supportCount,
        title,
      })
    : t("search.label.search-term-discovery.basis", {
        source,
        count: params.candidate.supportCount,
      });
}

function applyGraphCountsToSearchTermCandidates(params: {
  candidates: EnglishTermCandidate[];
  papers: SearchMetadata["papers"];
  graphSupport: SearchMetadata["graphSupport"];
}): EnglishTermCandidate[] {
  if (params.graphSupport?.status !== "ready") return params.candidates;

  const byPaperId = new Map(params.papers.map((paper) => [paper.paperId, paper] as const));
  return params.candidates
    .map((candidate) => {
      const supportPaperIds = candidate.supportPaperIds ?? candidate.samplePaperIds;
      const graphSupportCount = supportPaperIds.filter(
        (paperId) => params.graphSupport?.paperScores[paperId],
      ).length;
      return {
        ...candidate,
        ...(supportPaperIds.length > 0 ? { supportPaperIds } : {}),
        ...(graphSupportCount > 0 ? { graphSupportCount } : {}),
        basis: buildCandidateBasis({
          candidate,
          graphSupportCount,
          byPaperId,
        }),
      };
    })
    .sort(compareEnglishTermCandidatesBySupport);
}

export function mergeSearchBackgroundMetadata(
  incoming: SearchMetadata,
  existing: SearchMetadata,
  base: SearchMetadata = existing,
): SearchMetadata {
  // @check acceptance-check:search-url-restores-search-current-conditions-preserved
  if (
    existing.query !== base.query ||
    !hasSameSearchSnapshotTarget(existing, base) ||
    !hasAllowedSearchEnrichmentResultTarget(incoming, base)
  ) {
    return existing;
  }

  const termSource = selectTermDiscoverySource(incoming, existing);
  const papers = mergeBackgroundPaperDetails(incoming.papers, existing.papers, base.papers);
  const graphSupport = existing.graphSupport;
  const termCandidates = termSource.englishTermCandidates
    ? applyGraphCountsToSearchTermCandidates({
        candidates: termSource.englishTermCandidates,
        papers,
        graphSupport,
      })
    : undefined;

  const abstractHydration = mergeAbstractHydrationState(
    incoming.abstractHydration,
    existing.abstractHydration,
  );
  return {
    ...existing,
    papers,
    total: existing.total,
    ...(abstractHydration ? { abstractHydration } : {}),
    ...(graphSupport ? { graphSupport } : {}),
    ...(termSource.englishTermDiscovery
      ? { englishTermDiscovery: termSource.englishTermDiscovery }
      : {}),
    ...(termCandidates ? { englishTermCandidates: termCandidates } : {}),
    ...(existing.spellingCorrection
      ? { spellingCorrection: existing.spellingCorrection }
      : incoming.spellingCorrection
        ? { spellingCorrection: incoming.spellingCorrection }
        : {}),
  };
}

export function mergeSearchEnrichmentDelta(
  delta: SearchEnrichmentDelta,
  existing: SearchMetadata,
  base: SearchMetadata = existing,
): SearchMetadata {
  if (!hasSameSearchEnrichmentInput(existing, base)) {
    return existing;
  }
  const existingByPaperId = new Map(
    existing.papers.map((paper) => [paper.paperId, paper] as const),
  );
  const materializedPapers = delta.papers.flatMap((paperDelta) => {
    const committedPaper = existingByPaperId.get(paperDelta.paperId);
    if (!committedPaper) return [];
    const materializedPaper = {
      ...committedPaper,
      ...paperDelta,
      paperId: committedPaper.paperId,
      title: committedPaper.title,
      year: committedPaper.year,
      citationCount: committedPaper.citationCount,
      url: committedPaper.url,
    };
    if (!hasSameInlineAnalysisInput(materializedPaper, committedPaper)) {
      Reflect.deleteProperty(materializedPaper, "inlineAnalysis");
    }
    return [materializedPaper];
  });
  const papers = mergeBackgroundPaperDetails(materializedPapers, existing.papers, base.papers);
  const englishTermCandidates = existing.englishTermCandidates
    ? applyGraphCountsToSearchTermCandidates({
        candidates: existing.englishTermCandidates,
        papers,
        graphSupport: existing.graphSupport,
      })
    : undefined;
  const abstractHydration = mergeAbstractHydrationState(
    delta.abstractHydration,
    existing.abstractHydration,
  );
  return {
    ...existing,
    papers,
    ...(abstractHydration ? { abstractHydration } : {}),
    ...(englishTermCandidates ? { englishTermCandidates } : {}),
  };
}

export function mergeTermDiscoveryMetadata(
  incoming: SearchMetadata,
  existing: SearchMetadata,
): SearchMetadata {
  if (!hasSameSearchSnapshotTarget(incoming, existing)) return existing;

  const termSource = selectTermDiscoverySource(incoming, existing);
  const graphSupport = existing.graphSupport;
  const termCandidates = termSource.englishTermCandidates
    ? applyGraphCountsToSearchTermCandidates({
        candidates: termSource.englishTermCandidates,
        papers: existing.papers,
        graphSupport,
      })
    : undefined;

  return {
    ...existing,
    ...(termSource.englishTermDiscovery
      ? { englishTermDiscovery: termSource.englishTermDiscovery }
      : {}),
    ...(termCandidates ? { englishTermCandidates: termCandidates } : {}),
  };
}

export function mergeTermDiscoveryDelta(
  delta: SearchTermDiscoveryDelta,
  existing: SearchMetadata,
): SearchMetadata {
  return mergeTermDiscoveryMetadata(
    {
      ...existing,
      englishTermCandidates: delta.englishTermCandidates,
      englishTermDiscovery: delta.englishTermDiscovery,
    },
    existing,
  );
}

export function shouldQueueSearchEnrichment(
  document: ResearchRoutePayload,
): document is SearchResearchRoutePayload {
  if (!isSearchViewReady(document)) {
    return false;
  }
  return (
    hasEpisteme3SearchPaper(document.metadata) &&
    (isSearchHydrationPending(document.metadata) ||
      shouldRepairSearchHydrationMetadata(document.metadata))
  );
}

export function getSearchEnrichmentAttemptKey(document: ResearchRoutePayload): string {
  if (!isSearchViewReady(document)) return `${document.id}:not-ready`;
  return JSON.stringify({
    id: document.id,
    command: buildSearchEnrichmentCommandV1(document.metadata),
  });
}

async function requestSearchEnrichment(params: {
  metadata: SearchMetadata;
  signal: AbortSignal;
}): Promise<SearchEnrichmentResponse> {
  const command = buildSearchEnrichmentCommandV1(params.metadata);
  const response = await fetchBackgroundRequest(
    API_ROUTES.SEARCH_ENRICHMENT,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
      signal: params.signal,
    },
    "search enrichment request",
    { preserveErrorBody: true },
  );
  if (!response.ok) {
    throw await readApiResponseError(response, "search enrichment request failed");
  }
  const raw: unknown = await response.json().catch((): unknown => null);
  const parsed = searchEnrichmentDeltaResponseV1Schema.safeParse(raw);
  if (!parsed.success || !hasSameSearchBackgroundTarget(parsed.data.target, command.target)) {
    throw new Error("search enrichment response is invalid");
  }
  return parsed.data;
}

function settleSearchEnrichmentFailure(task: SearchEnrichmentTask): ResearchRoutePayload | null {
  const documentStore = useResearchRouteStore.getState();
  const currentView = documentStore.currentView;
  if (
    currentView?.id !== task.documentId ||
    documentStore.activeExecutionId !== task.executionId ||
    currentView.type !== "search" ||
    currentView.ownerPrincipalId !== task.ownerPrincipalId ||
    !hasSameSearchEnrichmentInput(currentView.metadata, task.metadata)
  ) {
    return null;
  }
  const hydration = currentView.metadata.abstractHydration;
  if (
    hydration?.status !== "pending" &&
    !shouldRepairSearchHydrationMetadata(currentView.metadata)
  ) {
    return null;
  }
  const resultDocument: ResearchRoutePayload = {
    ...currentView,
    metadata: {
      ...currentView.metadata,
      abstractHydration: {
        ...hydration,
        status: "ready",
        repairAttempted: true,
      },
      ...(currentView.metadata.graphSupport
        ? { graphSupport: currentView.metadata.graphSupport }
        : {}),
    },
    updatedAt: advanceUpdatedAtAfterCurrent(currentView.updatedAt, currentView.updatedAt),
  };
  return documentStore.patchCurrentView(resultDocument, task.executionId) ? resultDocument : null;
}

export async function runSearchEnrichmentTask(params: {
  task: SearchEnrichmentTask;
  controller: AbortController;
}): Promise<ResearchRoutePayload | null> {
  const { controller, task } = params;
  for (let attempt = 1; attempt <= SEARCH_ENRICHMENT_MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await requestSearchEnrichment({
        metadata: task.metadata,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return null;
      if (
        !hasSameSearchBackgroundTarget(
          result.target,
          buildSearchBackgroundSnapshotTarget(task.metadata),
        )
      ) {
        throw new Error("search enrichment response changed the result snapshot target");
      }

      const documentStore = useResearchRouteStore.getState();
      const currentView = documentStore.currentView;
      if (
        currentView?.id === task.documentId &&
        documentStore.activeExecutionId === task.executionId &&
        currentView.type === "search" &&
        currentView.ownerPrincipalId === task.ownerPrincipalId &&
        hasSameSearchEnrichmentInput(currentView.metadata, task.metadata)
      ) {
        const metadata = mergeSearchEnrichmentDelta(
          result.delta,
          currentView.metadata,
          task.metadata,
        );
        const resultDocument: ResearchRoutePayload = {
          ...currentView,
          metadata,
          updatedAt: advanceUpdatedAtAfterCurrent(currentView.updatedAt, result.updatedAt),
        };
        return documentStore.patchCurrentView(resultDocument, task.executionId)
          ? resultDocument
          : null;
      }
      return null;
    } catch (error) {
      if (controller.signal.aborted) return null;
      if (!isApiErrorRetryable(error) || attempt >= SEARCH_ENRICHMENT_MAX_ATTEMPTS) {
        console.warn("[search-enrichment-background] enrichment skipped:", error);
        return settleSearchEnrichmentFailure(task);
      }
      console.warn("[search-enrichment-background] enrichment retrying:", error);
      await waitForBackgroundRetry(
        controller.signal,
        getApiErrorRetryDelayMs(error, SEARCH_ENRICHMENT_RETRY_DELAY_MS),
      );
    }
  }
  return null;
}
