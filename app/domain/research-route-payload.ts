// ============================================================
// ResearchRoutePayload — route-owned research surface payload.
//
// Search-first runtime surfaces are no longer product "documents". This shape
// is the internal route view payload shared by renderers, reactions, and the
// still-compatible persistence/wire layer.
// ============================================================

import type { PaperCore } from "./paper";
import type { AIAnalysis } from "./analysis";
import type { SearchQueryClause, SearchQueryClauseRole } from "./search-query";
import type { RouteAiComment } from "./route-ai-comment";
import type { SearchFacetFilters } from "./search-facets";

// ─── ResearchRouteKind ──────────────────────────────────────

export type ResearchRouteKind =
  | "search" // 검색 결과
  | "gap_network" // E2 연구 공백 리포트
  | "citation_lineage" // 인용 계보 파생 뷰
  | "graph_neighbors"; // 그래프 인접(co-cited/coupled) 파생 뷰

// ─── ResearchRoutePayloadStatus ────────────────────────────────────
//
// route view resource의 lifecycle 상태. 제출 시점에 id가 발급되면 결과가 채워지기
// 전까지 `pending`으로 존재하고, 결과가 들어오면 `ready`, 준비가 실패하면
// `failed`로 간다. URL이 source of truth이므로 이 상태는 client 가짜
// 자리표시가 아니라 서버가 소유하는 실제 view 상태다.

export type ResearchRouteStatus = "pending" | "ready" | "failed";

// ─── 타입별 metadata ────────────────────────────────────────

export interface InlineAnalysisCache {
  version: number;
  /** Canonical title/abstract/year identity. Missing only on legacy snapshots. */
  inputFingerprint?: string;
  analysis: AIAnalysis;
  source?: "abstract";
}

export interface PaperWithReviewStatus extends PaperCore {
  reviewed: boolean;
  reviewedAt?: string;
  inlineAnalysis?: InlineAnalysisCache;
}

export type SearchLibraryGroundingOutcome =
  | { requested: false; status: "not_requested" }
  | { requested: true; status: "applied" | "no_signal" | "unavailable" };

export interface SearchMetadata {
  type: "search";
  query: string;
  sortOption?: "relevance" | "citationCount" | "year" | "yearAsc" | "interest";
  /**
   * Moonlight-derived library snapshot for this search result. Moonlight stays
   * the source of truth for the reader's library; this stored metadata only
   * explains and replays the basis used by this completed search. Results stay
   * stored in provider order; active combined snapshots sort the `interest`
   * view with `combinedRankWeights`, while positive `interestWeights` stay the
   * library-proximity marker and legacy-reader evidence. The interest view
   * defaults on when a signal is present.
   * See `aspect:library-grounded-research`.
   */
  libraryContext?: {
    /** Collections whose graph neighborhood anchored the interest ranking. */
    folders: { name: string }[];
    /** True when a precomputed library signal optimized this search. */
    signalPresent: boolean;
    /** paperId → library-relation evidence used by the library-proximity marker and compatibility readers. */
    interestWeights: Record<string, number>;
    /** paperId → active equal-max query/library combined ranking score. */
    combinedRankWeights?: Record<string, number>;
    /** Active combined-pool ordering; absent snapshots use the legacy reader. */
    rankingMode?: "combined_score";
    /** Query-absent library-neighbor ids in the shared result pool. */
    libraryOnlyPaperIds?: string[];
    /** ISO date/time of the Moonlight-source read that produced this snapshot. */
    computedAt?: string;
    /** Number of unique basis papers in the reflected Moonlight-source basis. */
    anchorPaperCount?: number;
  };
  /** True when the reader has a precomputed library context. */
  libraryContextAvailable?: boolean;
  /**
   * Safe, first-payload account of whether the requested library basis was
   * applied. Provider errors, HTTP status, and circuit details stay in server
   * telemetry. Missing on historical snapshots, which remain read-compatible
   * and do not infer a failure notice.
   */
  libraryGrounding?: SearchLibraryGroundingOutcome;
  searchIntentMode?: "balanced" | "foundational" | "latest" | "applied";
  yearFilter?: string;
  facetFilters?: SearchFacetFilters;
  spellingCorrection?: {
    originalQuery: string;
    correctedQuery: string;
  };
  exactLookup?: {
    kind: "doi";
    value: string;
  };
  /** 유사 논문 검색의 출발 논문 (선택적) */
  seedPaper?: PaperCore;
  /** 연구 용어에서 출발한 반복 검색의 trace metadata. */
  termSeed?: SearchTermSeed;
  englishTermCandidates?: EnglishTermCandidate[];
  englishTermDiscovery?: SearchTermDiscoveryState;
  /**
   * Progressive hydration state. The search route commits the keyword window
   * from Episteme 3 search immediately (lightweight: no abstract/authors/PDF)
   * with `"pending"`, so the result cards paint without waiting for the
   * E3 batch hydration round-trip. A background hydrate task then fills
   * abstracts/authors/PDF and flips this to `"ready"` without changing the
   * keyword-provider result membership. Term discovery and inline analysis wait for `"ready"`. Route
   * AI comment generation may fire at commit once the result basis is locked.
   * Optional on stored snapshots that predate the discovery-state field and on
   * fully-hydrated commits (DOI exact-lookup, query-transition snapshots).
   */
  abstractHydration?: SearchAbstractHydrationStatus;
  graphSupport?: SearchGraphSupportMetadata;
  queryClauses?: SearchQueryClause[];
  papers: (PaperCore | PaperWithReviewStatus)[];
  total: number;
  totalMode?:
    | "exact"
    | "merged"
    | "candidate_window"
    | "estimated"
    | "lower_bound"
    | "not_computed";
  paging?: SearchPagingMetadata;
  source?: SearchSourceMetadata | null;
  clauseStats?: SearchQueryClauseStat[];
}

export interface SearchGraphSupportPaperScore {
  defaultScore: number;
  graphScore: number | null;
  semanticScore: number | null;
  sharedCiters: number | null;
  sharedRefs: number | null;
  seedCount: number | null;
  sources: string[];
}

/** Historical search snapshot. Read-compatible only; new searches never write this basis. */
export interface SearchGraphSupportMetadataV1 {
  version: 1;
  source: "episteme-paper-neighborhood";
  basis: "loaded_result_sample";
  status: "ready" | "empty";
  samplePaperIds: string[];
  paperScores: Partial<Record<string, SearchGraphSupportPaperScore>>;
  generatedAt: string;
}

/** Historical v2 library-anchor diagnostics. Read-compatible only. */
export interface SearchLibraryGraphCandidateCounts {
  /** Unique candidates returned across library folders after strongest-score merge. */
  providerReturned: number;
  /** Top-band candidates for which E3 rich batch hydration returned usable paper metadata. */
  hydrated: number;
  /** Returned graph candidates already present in the keyword result window. */
  keywordOverlap: number;
  /** Query-absent graph candidates that survived year/title admission into the result pool. */
  admittedSupplement: number;
  /** Admitted supplements kept below the query-relevant spine by the deterministic fit gate. */
  deferredByQueryRelevance: number;
  filteredOut: {
    /** Merged candidates below the bounded supplement hydration band. */
    candidateCap: number;
    /** Top-band ids omitted by best-effort paper hydration. */
    hydrationUnavailable: number;
    /** Hydrated graph candidates outside the keyword result window rejected by the year range. */
    publicationYear: number;
    /** Hydrated candidates dropped because the neighborhood carried no positive score. */
    nonPositiveScore: number;
    /** Admitted candidates removed by the final title-family deduplication. */
    titleFamilyDuplicate: number;
  };
}

/** Historical v2 search snapshot. Read-compatible only; new searches never write this basis. */
export interface SearchLibraryGraphSupportMetadata {
  version: 2;
  source: "episteme-paper-neighborhood";
  basis: "library_anchor_neighborhood";
  status: "ready" | "empty";
  /** Count of private library paper references supplied to E3 discovery server-side. */
  anchorPaperCount: number;
  /** Result-pool papers for which the library neighborhood supplied a score. */
  samplePaperIds: string[];
  paperScores: Partial<Record<string, SearchGraphSupportPaperScore>>;
  candidateCounts: SearchLibraryGraphCandidateCounts;
  generatedAt: string;
}

/** Graph-neighbor route snapshot evidence; independent from ordinary search retrieval. */
export interface GraphNeighborSnapshotSupportMetadata {
  version: 2;
  source: "episteme-paper-neighborhood";
  basis: "graph_neighbor_snapshot";
  status: "ready" | "empty";
  samplePaperIds: string[];
  paperScores: Partial<Record<string, SearchGraphSupportPaperScore>>;
  generatedAt: string;
}

/** Share-safe, build-effective graph evidence stored with a gap source snapshot. */
export interface GapSourceSnapshotSupportMetadata {
  version: 2;
  source: "episteme-paper-neighborhood";
  basis: "gap_source_snapshot";
  status: "ready" | "empty";
  samplePaperIds: string[];
  paperScores: Partial<Record<string, SearchGraphSupportPaperScore>>;
  generatedAt: string;
}

export type SearchGraphSupportMetadata =
  | SearchGraphSupportMetadataV1
  | SearchLibraryGraphSupportMetadata
  | GraphNeighborSnapshotSupportMetadata;

/** Gap artifact read shape: v1 remains readable; all active writes use the share-safe v2 basis. */
export type GapNetworkGraphSupportMetadata =
  | SearchGraphSupportMetadataV1
  | GapSourceSnapshotSupportMetadata;

/**
 * e2 그래프 이웃 한 편. 직접 인용이 아니라 그래프 관계로 묶인 논문이며,
 * `shared`가 왜 곁에 놓였는지 설명하는 근거 수치다 (co-cited는 공동 인용 횟수,
 * coupled는 공유 참고문헌 수). 전용 graph-neighbor surface에 노출된다.
 */
export interface GraphNeighborPaperEntry {
  shared: number;
  paper: PaperCore | PaperWithReviewStatus;
}

export interface CitationLineageMetadata {
  type: "citation_lineage";
  /** 출발 논문 (필수) */
  seedPaper: PaperCore;
  /** 라우트가 요청받은 원본 referenceIds — 선행 연구 분류 기준. seedPaper.referenceIds와는 별개. */
  referenceIds: string[];
  /** 라우트가 요청받은 원본 citationIds — 후속 연구 분류 기준. */
  citationIds: string[];
  /** 수집된 모든 논문 (references + citations 합쳐진 배열) */
  papers: (PaperCore | PaperWithReviewStatus)[];
  /** 수집된 논문 총 개수 */
  total: number;
  referenceAvailability?: CitationListAvailability | null;
  citationAvailability?: CitationListAvailability | null;
}

/**
 * 검색 결과 카드에서 직접 연 그래프 인접 문서. 인용 계보(직접 인용: 선행·후속)와
 * 달리 그래프 관계(함께 인용 / 같은 토대)만 두 축으로 보여 준다. 두 축은
 * `GraphNeighborPaperEntry` 형식을 공유한다.
 */
export interface GraphNeighborsMetadata {
  type: "graph_neighbors";
  /** 출발 논문 (필수) */
  seedPaper: PaperCore;
  /** 두 축에 등장한 모든 논문 (co-cited + coupled 합쳐진 배열) */
  papers: (PaperCore | PaperWithReviewStatus)[];
  /** 수집된 논문 총 개수 */
  total: number;
  /** 함께 자주 인용되는 논문 (co-citation, shared_citers desc). */
  coCited: GraphNeighborPaperEntry[];
  /** 같은 참고문헌 토대를 공유하는 논문 (bibliographic coupling, shared_refs desc). */
  coupled: GraphNeighborPaperEntry[];
  /**
   * provider 그래프 호출이 실패해 축을 만들지 못한 채 문서가 열렸음을 나타낸다.
   * 정직한 빈 결과(두 축 모두 0편)와 구분되며, degraded 안내 + 재시도를 보여주는
   * 근거다 (aspect:provider-failure-degraded-mode).
   */
  graphLoadFailed?: boolean;
  /**
   * Graph-neighbor documents can open from lightweight co-cited/coupled pages
   * first, then fill abstract/authors/PDF metadata in the background. While
   * pending, repeated paper cards reuse the shared paper-card detail loading
   * frame instead of inventing graph-neighbor-only skeleton UI.
   */
  cardDataHydration?: { status: "pending" | "ready" };
  coCitedAvailability?: CitationListAvailability | null;
  coupledAvailability?: CitationListAvailability | null;
}

export interface SearchPagingMetadata {
  limit: number;
  offset: number;
  returned: number;
  total?: number | null;
  totalMode: "candidate_window" | "estimated" | "exact" | "lower_bound" | "not_computed";
  hasMore: boolean;
  nextOffset?: number | null;
  /** Opaque Episteme 3 continuation token. Never derive or inspect this value. */
  nextCursor?: string | null;
}

export interface SearchCoverageMetadata {
  full: boolean;
  indexed?: number | null;
  eligible?: number | null;
  generation: string;
}

export interface SearchSourceMetadata {
  provider?: string;
  baseCorpus?: string;
  sourceFlags?: number | string | string[] | null;
  canonicalPaperId?: string;
  dumpDate?: string | null;
  indexedAt?: string | null;
  freshnessMode?: "unknown" | "configured" | "exact";
  searchBasis?: string[];
  limits?: string[];
  generation?: string;
  completenessStatus?: "complete" | "bounded" | "estimated" | "unavailable";
  coverage?: SearchCoverageMetadata;
  /** Coverage provenance attached specifically to the provider's total measurement. */
  totalCoverage?: SearchCoverageMetadata;
  currencyState?: "current" | "mixed" | "missing";
  retrievalGeneration?: string;
  projectionGenerations?: number[];
  elapsedMs?: number;
}

export type EnglishTermCandidateType = "direct" | "broader" | "narrower" | "variant";

export interface EnglishTermCandidate {
  term: string;
  type: EnglishTermCandidateType;
  confidence: "high" | "medium" | "low";
  supportCount: number;
  methodSupportCount?: number;
  graphSupportCount?: number;
  supportPaperIds?: string[];
  samplePaperIds: string[];
  basis: string;
}

/**
 * Progressive hydration 상태. 검색 route가 `/search` 경량 결과로 `pending` 커밋하고,
 * background hydrate task가 E3 rich batch projection(abstract·authors·PDF)을 채워 `ready`로
 * PATCH한다.
 */
export interface SearchAbstractHydrationStatus {
  status: "pending" | "ready";
  /** Historical snapshot compatibility only; current searches do not write this field. */
  personalize?: boolean;
  /** Historical snapshot compatibility only; current searches do not write this field. */
  libraryBlendPolicy?: "first_reveal_only";
  /** Explicit library paper ids captured when the search was submitted. */
  libraryPaperIds?: string[];
  /** Set after a ready-but-lightweight repair attempt so degraded providers do not loop forever. */
  repairAttempted?: boolean;
  /**
   * The sort explicitly requested at search time (`undefined` = default). The
   * deferred hydrate resolves the view sort as `requestedSort ?? (interest when
   * a library signal scores, else relevance)`. `interest` and `relevance` are
   * internal ordering states, not user-selectable result bases.
   */
  requestedSort?: "relevance" | "citationCount" | "year" | "yearAsc" | "interest";
}

/**
 * 연구 용어 추출 상태. 검색 커밋 시 `pending`으로 시작하고, background
 * 추출이 `ready`로 닫는다. 필드가 없으면 background 추출 대상이 아니다.
 */
export interface SearchTermDiscoveryState {
  status: "pending" | "ready";
  source?: "llm";
  generatedAt?: string;
}

export interface SearchTermSeed {
  sourceQuery: string;
  term: string;
  candidateType: EnglishTermCandidateType;
  supportCount: number;
}

export interface CitationListAvailability {
  available: boolean;
  truncated: boolean;
  total?: number | null;
  returned?: number | null;
  reason?: string | null;
}

export interface SearchQueryClauseStat {
  clause: string;
  role: SearchQueryClauseRole;
  total: number;
  fetched: number;
  /** Bounded E3 provider provenance for this merged clause window. */
  providerWindow?: {
    totalMode?: SearchMetadata["totalMode"];
    hasMore: boolean;
    nextCursor?: string | null;
    generation?: string;
    completenessStatus?: SearchSourceMetadata["completenessStatus"];
    currencyState?: SearchSourceMetadata["currencyState"];
    totalCoverage?: SearchCoverageMetadata;
  };
}

export type GraphPaperSnapshot = PaperCore;

export interface KnowledgeMapCitationEdgeArtifact {
  source: string;
  target: string;
  weight: number;
}

export interface KnowledgeMapSemanticEdgeArtifact {
  source: string;
  target: string;
  weight: number;
  origin: "semantic" | "method";
}

export interface KnowledgeMapGraphSupportEdgeArtifact {
  source: string;
  target: string;
  weight: number;
}

export interface KnowledgeMapBaseArtifact {
  version: 1;
  citationEdges: KnowledgeMapCitationEdgeArtifact[];
  semanticEdges: KnowledgeMapSemanticEdgeArtifact[];
  graphSupportEdges?: KnowledgeMapGraphSupportEdgeArtifact[];
  clusterLabels: Record<string, string>;
}

export interface GapNetworkConceptNode {
  id: string;
  label: string;
  clusterId: string;
  score: number;
  /** Papers within the cluster whose topic profile contains this concept keyword,
   * sorted by citationCount desc and capped. Lets the UI trace a concept seed
   * back to the papers that support it. */
  supportingPaperIds?: string[];
}

export interface GapNetworkCluster {
  id: string;
  label: string;
  color: string;
  paperCount: number;
  concepts: GapNetworkConceptNode[];
  topPaperIds?: string[];
  narrative?: string;
}

export interface GapNetworkConceptEdge {
  source: string;
  target: string;
  clusterId: string;
  weight: number;
}

export interface GapPair {
  id: string;
  leftClusterId: string;
  rightClusterId: string;
  leftLabel: string;
  rightLabel: string;
  displayLabel: string;
  observed: number;
  expected: number;
  gapScore: number;
  rank: number;
  bridgeConcepts: string[];
  leftConcepts: string[];
  rightConcepts: string[];
}

export interface GapHypothesis {
  id: string;
  gapPairId: string;
  title: string;
  description: string;
  sourceConcept: string;
  targetConcept: string;
  confidence: "high" | "medium" | "low";
}

export interface GapNetworkInsight {
  hypotheses: GapHypothesis[];
}

export interface GapNetworkMetrics {
  clusterCount: number;
  totalPaperCount: number;
  totalEdgeCount: number;
  gapPairCount: number;
}

export interface GapNetworkClusterReaction {
  clusterId: string;
  reaction: RouteAiComment;
  nearestGapLabel?: string;
  representativePaperTitles?: string[];
  narrative?: string;
}

export interface GapHypothesisProposal {
  hypothesis: string;
  grounding: string;
}

export interface GapNetworkGapReaction {
  gapPairId: string;
  reaction: RouteAiComment;
  metaQualitative?: string;
  proposals?: GapHypothesisProposal[];
}

export interface GapNetworkReactionPreparation {
  overviewReaction: RouteAiComment;
  clusterReactions: GapNetworkClusterReaction[];
  gapReactions: GapNetworkGapReaction[];
  preparedAt: string;
}

export interface GapNetworkClusterParagraph {
  clusterId: string;
  paragraph: string;
}

export interface GapNetworkContentNarrative {
  overview: string;
  clusterParagraphs: GapNetworkClusterParagraph[];
  gapInferenceParagraph: string;
}

export interface GapNetworkBuildState {
  core: "pending" | "ready" | "failed";
  enrichment: "pending" | "ready" | "failed";
  updatedAt: string;
  coreEvidence?: "citation-semantic-graph-v1" | "citation-semantic-graph-v2";
  phase?:
    | "queued"
    | "graph-support"
    | "core-build"
    | "persist"
    | "enrichment"
    | "complete"
    | "failed";
  attempt?: number;
  /** Accepted explicit narrative-enrichment commands for this persisted report. */
  enrichmentRetryCount?: number;
  leaseExpiresAt?: string;
  phaseDurationsMs?: {
    "graph-support"?: number;
    "core-build"?: number;
    persist?: number;
    enrichment?: number;
  };
}

export interface GapNetworkReport {
  clusters: GapNetworkCluster[];
  conceptEdges: GapNetworkConceptEdge[];
  gapPairs: GapPair[];
  metrics: GapNetworkMetrics;
  insight: GapNetworkInsight;
  domainLabel?: string;
  contentNarrative?: GapNetworkContentNarrative;
}

export interface GapNetworkMetadata {
  type: "gap_network";
  version: 1;
  sourceSnapshotId: string;
  query: string;
  papers: GraphPaperSnapshot[];
  sourceGraphSupport?: GapNetworkGraphSupportMetadata;
  gapNetworkReport: GapNetworkReport;
  reactionPreparation?: GapNetworkReactionPreparation;
  gapNetworkBuild?: GapNetworkBuildState;
  /**
   * citation_lineage source일 때만 채워지는 입력 분해. 사용자가 보는 빈 상태
   * 메시지가 "선행 N편 + 후속 M편"으로 입력 출처를 명시할 수 있도록
   * gap-network 빌더가 계산해 저장한다. 일반 검색 source에서는 미존재.
   */
  sourceCitationLineageBreakdown?: {
    references: number;
    citations: number;
  };
}

// 판별 유니온
export type ResearchRouteMetadata =
  | SearchMetadata
  | GapNetworkMetadata
  | CitationLineageMetadata
  | GraphNeighborsMetadata;

// ─── ResearchRoutePayload ──────────────────────────────────────────

interface ResearchRoutePayloadBase {
  id: string;
  title: string;
  content: string; // 마크다운 본문
  createdBy: "user" | "agent";
  reaction?: RouteAiComment | null;
  reactionHistory?: RouteAiComment[];
  refs: string[]; // 참조하는 다른 view ID
  // 서버가 소유하는 route view lifecycle/version 필드. repository `toDocument`가 항상
  // 채우고, wire schema(`researchRoutePayloadSchema`)도 누락 payload를 기본값으로 채우므로
  // 모든 ResearchRoutePayload는 늘 값을 가진다.
  status: ResearchRouteStatus; // 서버 소유 lifecycle 상태
  version: number; // enrichment revalidation용 단조 view version
  reactionVersion: number; // fetch-merge 화해용 단조 reaction version
  createdAt: string;
  updatedAt: string;
}

export type SearchResearchRoutePayload = ResearchRoutePayloadBase & {
  type: "search";
  metadata: SearchMetadata;
  ownerPrincipalId: string;
};

export type CitationLineageResearchRoutePayload = ResearchRoutePayloadBase & {
  type: "citation_lineage";
  metadata: CitationLineageMetadata;
  ownerPrincipalId: string;
};

export type GraphNeighborsResearchRoutePayload = ResearchRoutePayloadBase & {
  type: "graph_neighbors";
  metadata: GraphNeighborsMetadata;
  ownerPrincipalId: string;
};

/**
 * A shared gap artifact projected for the current authenticated viewer.
 * Artifact identity lives in `id` and persisted metadata; viewer identity never
 * aliases artifact ownership.
 */
export type GapNetworkResearchRoutePayload = ResearchRoutePayloadBase & {
  type: "gap_network";
  metadata: GapNetworkMetadata;
  viewerPrincipalId: string;
};

export type OwnedResearchRoutePayload =
  | SearchResearchRoutePayload
  | CitationLineageResearchRoutePayload
  | GraphNeighborsResearchRoutePayload;

export type ResearchRoutePayload = OwnedResearchRoutePayload | GapNetworkResearchRoutePayload;

/**
 * In-place route view update command. The discriminant is required so metadata
 * and principal capability always come from the same payload variant.
 */
export type ResearchRoutePayloadPatch = {
  [Kind in ResearchRouteKind]: Pick<Extract<ResearchRoutePayload, { type: Kind }>, "id" | "type"> &
    Partial<Omit<Extract<ResearchRoutePayload, { type: Kind }>, "id" | "type">>;
}[ResearchRouteKind];

export function getResearchRouteViewerPrincipalId(payload: ResearchRoutePayload): string {
  return payload.type === "gap_network" ? payload.viewerPrincipalId : payload.ownerPrincipalId;
}

// ─── ResearchRoutePayloadStore 인터페이스 (향후 구현 계약) ────────────

export type ResearchRoutePayloadFilter =
  | {
      type?: Exclude<ResearchRouteKind, "gap_network">;
      ownerPrincipalId?: string;
    }
  | {
      type: "gap_network";
      viewerPrincipalId?: string;
    };

interface CreateResearchRoutePayloadParamsBase {
  title: string;
  content: string;
  createdBy: "user" | "agent";
  reaction?: RouteAiComment | null;
  reactionHistory?: RouteAiComment[];
  refs?: string[];
  status?: ResearchRouteStatus; // 미지정 시 ready 상태로 생성 (예약 경로만 pending 지정)
}

export type OwnedCreateResearchRoutePayloadParams = CreateResearchRoutePayloadParamsBase &
  (
    | { type: "search"; metadata: SearchMetadata; ownerPrincipalId: string }
    | {
        type: "citation_lineage";
        metadata: CitationLineageMetadata;
        ownerPrincipalId: string;
      }
    | {
        type: "graph_neighbors";
        metadata: GraphNeighborsMetadata;
        ownerPrincipalId: string;
      }
  );

export type GapNetworkCreateResearchRoutePayloadParams = CreateResearchRoutePayloadParamsBase & {
  type: "gap_network";
  metadata: GapNetworkMetadata;
  viewerPrincipalId: string;
};

export type CreateResearchRoutePayloadParams =
  | OwnedCreateResearchRoutePayloadParams
  | GapNetworkCreateResearchRoutePayloadParams;
