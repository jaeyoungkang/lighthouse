import type {
  EnglishTermCandidate,
  EnglishTermCandidateType,
  SearchMetadata,
  SearchTermDiscoveryState,
} from "@/app/domain/research-route-payload";
import {
  projectSearchTermSemanticProfile,
  SEARCH_BACKGROUND_TERM_CANDIDATE_LIMIT,
  SEARCH_BACKGROUND_TERM_MAX_CHARS,
  type SearchTermDiscoveryPaperV1,
} from "@/app/domain/search-background-transport";
import type { SearchQueryClause } from "@/app/domain/search-query";
import { hasGeminiApiKey, GEMINI_LITE_MODEL } from "@/app/server/ai-generation/gemini";
import { executeJudgment, type LLMJudgmentUsageLedger } from "@/app/server/ai-generation/judgment";
import {
  compareEnglishTermCandidatesBySupport,
  getEnglishTermCandidateBasisSource,
} from "@/app/lib/search-term-candidates";
import { t } from "@/app/i18n/message-access";
import {
  getCurrentUsableInlineAnalysisRecord,
  hasUsableInlineAnalysisAbstract,
} from "@/app/lib/inline-analysis";
import { z } from "zod";
import { buildQueryHints } from "./knowledge-map/topic-signals";
import {
  buildLLMTermExtractionPrompt,
  TERM_CANDIDATE_PROMPT_ABSTRACT_CHARS,
  TERM_CANDIDATE_LLM_PAPER_LIMIT,
} from "./search-term-discovery-prompt";

const TERM_CANDIDATE_SAMPLE_LIMIT = 3;
// 추출은 background task에서 돈다 — 검색 응답을 막지 않으므로 LLM이 실제로
// 닫힐 수 있는 예산을 준다. 이 값을 줄여 검색 critical path로 되돌리지 않는다.
export const TERM_CANDIDATE_LLM_TIMEOUT_MS = 12_000;
export const TERM_CANDIDATE_LLM_MAX_OUTPUT_TOKENS = 512;
const MIN_TERM_SUPPORT_COUNT = 2;
const MAX_TERM_WORDS = 5;
const VARIANT_TERMS = new Set(["ai", "llm", "llms", "rag"]);
const BROAD_RESEARCH_TERM_BLOCKLIST = new Set([
  "artificial intelligence",
  "science",
  "scientific",
  "research",
  "study",
  "studies",
  "methods",
  "models",
  "systems",
  "learning",
  "discovery",
  "challenges",
  "opportunities",
]);
const TECHNICAL_SINGLE_WORD_TERMS = new Set(["retrieval", "rag", "multimodal", "materials"]);
const BROAD_AI_FOR_SCIENCE_TERMS = new Set([
  "agents",
  "agent",
  "benchmarks",
  "evaluation",
  "large",
  "language",
  "model",
  "models",
  "large language models",
  "materials",
  "multimodal",
  "retrieval",
  "verification",
]);
const GENERIC_TERM_PENALTIES = new Map<string, number>([
  ["artificial intelligence", 7],
  ["research", 8],
  ["study", 8],
  ["studies", 8],
  ["methods", 6],
  ["models", 5],
  ["systems", 6],
  ["evaluation", 4],
]);

type SearchTermDiscoveryQueryClause = Pick<
  SearchQueryClause,
  "normalizedClause" | "derivedExpansions"
>;

function projectMetadataPaperForTermDiscovery(
  paper: SearchMetadata["papers"][number],
): SearchTermDiscoveryPaperV1 {
  const semanticProfile = getCurrentUsableInlineAnalysisRecord(paper)?.analysis.semanticProfile;
  return {
    paperId: paper.paperId,
    title: paper.title,
    abstract: paper.abstract,
    year: paper.year,
    ...(semanticProfile
      ? { semanticProfile: projectSearchTermSemanticProfile(semanticProfile) }
      : {}),
  };
}

export function projectSearchTermDiscoveryPapersFromCachedMetadata(
  metadata: SearchMetadata,
): SearchTermDiscoveryPaperV1[] {
  return metadata.papers
    .slice(0, TERM_CANDIDATE_LLM_PAPER_LIMIT)
    .map(projectMetadataPaperForTermDiscovery);
}

const llmTermCandidateSchema = z.object({
  candidates: z
    .array(
      z.object({
        term: z.string().trim().min(1),
        supportPaperIds: z.array(z.string()).default([]),
        rationale: z.string().trim().optional().nullable(),
      }),
    )
    .default([]),
});

type LLMTermCandidateResponse = z.infer<typeof llmTermCandidateSchema>;

function round(value: number, digits = 3): number {
  return Number(value.toFixed(digits));
}

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

function isEnglishSearchTerm(term: string): boolean {
  if (!/^[a-z0-9][a-z0-9 /+.-]*[a-z0-9]$/i.test(term)) return false;
  if (term.length > SEARCH_BACKGROUND_TERM_MAX_CHARS) return false;
  const wordCount = term.split(/\s+/g).filter(Boolean).length;
  return wordCount > 0 && wordCount <= MAX_TERM_WORDS;
}

function tokenizeTerm(term: string): string[] {
  return normalizeTerm(term)
    .split(/[^a-z0-9+.-]+/g)
    .filter((token) => token.length > 0);
}

function buildQueryHintTokenSet(queryHints: Set<string>): Set<string> {
  const tokens = new Set<string>();
  for (const hint of queryHints) {
    for (const token of tokenizeTerm(hint)) {
      tokens.add(token);
    }
  }
  return tokens;
}

function isSearchUsefulTerm(params: {
  term: string;
  queryHints: Set<string>;
  queryTokens: Set<string>;
  methodSupportCount: number;
  source?: "deterministic" | "llm";
}): boolean {
  const term = params.term;
  if (BROAD_RESEARCH_TERM_BLOCKLIST.has(term)) return false;
  if (params.queryHints.has(term)) return false;
  const isAiForScienceQuery =
    params.queryHints.has("artificial intelligence") && params.queryHints.has("science");

  const termTokens = tokenizeTerm(term);
  if (termTokens.length === 0) return false;
  const source = params.source ?? "deterministic";
  if (
    isAiForScienceQuery &&
    source === "deterministic" &&
    termTokens.some((token) => BROAD_AI_FOR_SCIENCE_TERMS.has(token))
  ) {
    return false;
  }
  if (
    isAiForScienceQuery &&
    source === "llm" &&
    termTokens.every((token) => BROAD_AI_FOR_SCIENCE_TERMS.has(token))
  ) {
    return false;
  }
  const hasDifferentiatingToken = termTokens.some((token) => !params.queryTokens.has(token));
  if (!hasDifferentiatingToken) return false;

  if (termTokens.length === 1) {
    if (isAiForScienceQuery) {
      return false;
    }
    return (
      TECHNICAL_SINGLE_WORD_TERMS.has(term) || params.methodSupportCount >= MIN_TERM_SUPPORT_COUNT
    );
  }

  return true;
}

function classifyTerm(term: string, query: string): EnglishTermCandidateType {
  const normalizedQuery = normalizeTerm(query);
  const wordCount = term.split(/\s+/g).length;
  if (wordCount === 1 && VARIANT_TERMS.has(term)) {
    return "variant";
  }
  if (normalizedQuery.includes(term) || term.includes(normalizedQuery)) {
    return "direct";
  }
  if (wordCount >= 4) return "narrower";
  if (wordCount <= 2) return "broader";
  return "direct";
}

function getConfidence(supportCount: number, hasAbstractBasis: boolean): "high" | "medium" | "low" {
  if (supportCount >= 3 && hasAbstractBasis) return "high";
  if (supportCount >= 2) return "medium";
  return "low";
}

function buildBasis(params: {
  supportCount: number;
  hasAbstractBasis: boolean;
  graphSupportCount: number;
  sampleTitles: string[];
}): string {
  const source = getEnglishTermCandidateBasisSource(params);
  const title = params.sampleTitles[0] ?? "";
  return title
    ? t("search.label.search-term-discovery.basisWithExample", {
        source,
        count: params.supportCount,
        title,
      })
    : t("search.label.search-term-discovery.basis", {
        source,
        count: params.supportCount,
      });
}

function getGraphSupportCount(
  samplePaperIds: Iterable<string>,
  graphSupportedPaperIds: ReadonlySet<string>,
): number {
  let count = 0;
  for (const paperId of samplePaperIds) {
    if (graphSupportedPaperIds.has(paperId)) {
      count += 1;
    }
  }
  return count;
}

function getCandidateMethodSupportCount(params: {
  term: string;
  samplePaperIds: string[];
  byPaperId: Map<string, SearchTermDiscoveryPaperV1>;
}): number {
  const termTokens = tokenizeTerm(params.term);
  if (termTokens.length === 0) return 0;

  let count = 0;
  for (const paperId of params.samplePaperIds) {
    const paper = params.byPaperId.get(paperId);
    const method = paper?.semanticProfile?.method;
    if (!method) continue;
    const methodTokens = new Set(tokenizeTerm(method));
    if (termTokens.some((token) => methodTokens.has(token))) {
      count += 1;
    }
  }
  return count;
}

function buildCandidateBasis(params: {
  candidate: Pick<EnglishTermCandidate, "supportCount" | "samplePaperIds" | "supportPaperIds">;
  graphSupportCount: number;
  byPaperId: Map<string, SearchTermDiscoveryPaperV1>;
}): string {
  const samplePapers = params.candidate.samplePaperIds
    .map((paperId) => params.byPaperId.get(paperId))
    .filter((paper): paper is SearchTermDiscoveryPaperV1 => paper !== undefined)
    .slice(0, TERM_CANDIDATE_SAMPLE_LIMIT);
  return buildBasis({
    supportCount: params.candidate.supportCount,
    hasAbstractBasis: samplePapers.some((paper) => hasUsableInlineAnalysisAbstract(paper.abstract)),
    graphSupportCount: params.graphSupportCount,
    sampleTitles: samplePapers.map((paper) => paper.title),
  });
}

function getCandidateSupportPaperIds(candidate: EnglishTermCandidate): string[] {
  return candidate.supportPaperIds && candidate.supportPaperIds.length > 0
    ? candidate.supportPaperIds
    : candidate.samplePaperIds;
}

export function applyGraphSupportToEnglishTermCandidates(params: {
  candidates: EnglishTermCandidate[];
  papers: SearchMetadata["papers"];
  graphSupport?: SearchMetadata["graphSupport"];
}): EnglishTermCandidate[] {
  const byPaperId = new Map(
    params.papers.map((paper) => {
      const projected = projectMetadataPaperForTermDiscovery(paper);
      return [projected.paperId, projected] as const;
    }),
  );
  const graphSupportedPaperIds = new Set(
    params.graphSupport?.status === "ready" ? Object.keys(params.graphSupport.paperScores) : [],
  );
  return params.candidates
    .map((candidate) => {
      const supportPaperIds = getCandidateSupportPaperIds(candidate);
      const graphSupportCount = getGraphSupportCount(supportPaperIds, graphSupportedPaperIds);
      const methodSupportCount =
        candidate.methodSupportCount ??
        getCandidateMethodSupportCount({
          term: candidate.term,
          samplePaperIds: supportPaperIds,
          byPaperId,
        });
      return {
        ...candidate,
        supportPaperIds,
        ...(methodSupportCount > 0 ? { methodSupportCount } : {}),
        ...(graphSupportCount > 0 ? { graphSupportCount } : {}),
        basis: buildCandidateBasis({
          candidate: { ...candidate, supportPaperIds },
          graphSupportCount,
          byPaperId,
        }),
      };
    })
    .sort(compareEnglishTermCandidatesBySupport);
}

function rankLLMTermCandidate(params: {
  term: string;
  supportCount: number;
  methodSupportCount: number;
  graphSupportCount: number;
}): number {
  const wordCount = params.term.split(/\s+/g).length;
  const phraseBonus = Math.max(0, wordCount - 1) * 2.4;
  const supportBonus = Math.min(params.supportCount, 5) * 4;
  const methodBonus = params.methodSupportCount * 3;
  const graphBonus = params.graphSupportCount * 5;
  const penalty = GENERIC_TERM_PENALTIES.get(params.term) ?? 0;
  return round(phraseBonus + supportBonus + methodBonus + graphBonus - penalty);
}

export interface EnglishTermDiscoveryResult {
  candidates: EnglishTermCandidate[];
  /** 서빙 목록의 출처 — 연구 용어는 LLM 방법·기여 명사구 추출만 사용한다. */
  source: "llm";
}

export async function buildEnglishTermCandidatesWithLLM(params: {
  query: string;
  papers: Array<SearchTermDiscoveryPaperV1 | SearchMetadata["papers"][number]>;
  queryClauses?: SearchTermDiscoveryQueryClause[];
  graphSupportedPaperIds?: string[];
  graphSupport?: SearchMetadata["graphSupport"];
  signal?: AbortSignal;
  usageLedger?: LLMJudgmentUsageLedger;
  usageMetadata?: {
    phase?: string;
  };
}): Promise<EnglishTermDiscoveryResult> {
  const papers = params.papers.map((paper) =>
    "citationCount" in paper ? projectMetadataPaperForTermDiscovery(paper) : paper,
  );
  if (papers.length === 0) {
    return { candidates: [], source: "llm" };
  }
  if (!hasGeminiApiKey()) {
    return { candidates: [], source: "llm" };
  }

  const timeoutController = params.signal ? null : new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const signal = params.signal ?? timeoutController?.signal;
  if (timeoutController) {
    timeout = setTimeout(() => {
      timeoutController.abort();
    }, TERM_CANDIDATE_LLM_TIMEOUT_MS);
  }

  const queryHints = buildQueryHints(params.query, params.queryClauses);
  const queryTokens = buildQueryHintTokenSet(queryHints);
  const graphSupportedPaperIds = new Set(
    params.graphSupportedPaperIds ??
      (params.graphSupport?.status === "ready" ? Object.keys(params.graphSupport.paperScores) : []),
  );
  const promptWindow = papers.slice(0, TERM_CANDIDATE_LLM_PAPER_LIMIT);
  const byPaperId = new Map(promptWindow.map((paper) => [paper.paperId, paper] as const));
  const prompt = buildLLMTermExtractionPrompt({
    query: params.query,
    papers,
  });
  let result: LLMTermCandidateResponse;
  try {
    result = await executeJudgment<LLMTermCandidateResponse>({
      label: "search-term-discovery",
      model: GEMINI_LITE_MODEL,
      outputSchema: llmTermCandidateSchema,
      onError: "throw",
      signal,
      usageLedger: params.usageLedger,
      timeoutMs: TERM_CANDIDATE_LLM_TIMEOUT_MS,
      maxOutputTokens: TERM_CANDIDATE_LLM_MAX_OUTPUT_TOKENS,
      usageMetadata: {
        ...params.usageMetadata,
        mode: "llm_compact",
        paperCount: Math.min(papers.length, TERM_CANDIDATE_LLM_PAPER_LIMIT),
        promptChars: prompt.length,
        promptPaperLimit: TERM_CANDIDATE_LLM_PAPER_LIMIT,
        promptAbstractChars: TERM_CANDIDATE_PROMPT_ABSTRACT_CHARS,
      },
      prompt,
    });
  } catch {
    // LLM 추출이 닫히지 않음(키 없음·timeout·파싱 실패) — 억지 후보를 만들지 않는다.
    return { candidates: [], source: "llm" };
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }

  // The model sometimes echoes the prompt's bracket sample number instead of
  // the printed paperId — repair those references deterministically so one
  // formatting slip does not collapse a healthy extraction into no-answer.
  const resolveSupportPaperId = (value: string): string | null => {
    if (byPaperId.has(value)) return value;
    const trimmed = value.trim();
    if (!/^\d{1,3}$/.test(trimmed)) return null;
    const index = Number.parseInt(trimmed, 10);
    return index >= 1 && index <= promptWindow.length
      ? (promptWindow[index - 1]?.paperId ?? null)
      : null;
  };
  const candidates = result.candidates
    .map((candidate) => {
      const term = normalizeTerm(candidate.term);
      const samplePaperIds = [
        ...new Set(
          candidate.supportPaperIds
            .map(resolveSupportPaperId)
            .filter((paperId): paperId is string => paperId !== null),
        ),
      ];
      if (!isEnglishSearchTerm(term) || samplePaperIds.length === 0) {
        return null;
      }
      const methodSupportCount = getCandidateMethodSupportCount({
        term,
        samplePaperIds,
        byPaperId,
      });
      if (
        !isSearchUsefulTerm({
          term,
          queryHints,
          queryTokens,
          methodSupportCount,
          source: "llm",
        })
      ) {
        return null;
      }
      const graphSupportCount = getGraphSupportCount(samplePaperIds, graphSupportedPaperIds);
      const supportCount = samplePaperIds.length;
      return {
        term,
        priority: rankLLMTermCandidate({
          term,
          supportCount,
          methodSupportCount,
          graphSupportCount,
        }),
        supportCount,
        methodSupportCount,
        graphSupportCount,
        supportPaperIds: samplePaperIds,
        samplePaperIds: samplePaperIds.slice(0, TERM_CANDIDATE_SAMPLE_LIMIT),
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((left, right) => {
      if (right.priority !== left.priority) return right.priority - left.priority;
      if (right.graphSupportCount !== left.graphSupportCount) {
        return right.graphSupportCount - left.graphSupportCount;
      }
      if (right.supportCount !== left.supportCount) return right.supportCount - left.supportCount;
      return left.term.localeCompare(right.term);
    })
    .slice(0, SEARCH_BACKGROUND_TERM_CANDIDATE_LIMIT)
    .map(
      (candidate): EnglishTermCandidate => ({
        term: candidate.term,
        type: classifyTerm(candidate.term, params.query),
        confidence: getConfidence(candidate.supportCount, true),
        supportCount: candidate.supportCount,
        ...(candidate.methodSupportCount > 0
          ? { methodSupportCount: candidate.methodSupportCount }
          : {}),
        ...(candidate.graphSupportCount > 0
          ? { graphSupportCount: candidate.graphSupportCount }
          : {}),
        supportPaperIds: candidate.supportPaperIds,
        samplePaperIds: candidate.samplePaperIds,
        basis: buildCandidateBasis({
          candidate,
          graphSupportCount: candidate.graphSupportCount,
          byPaperId,
        }),
      }),
    );

  // LLM이 정상 응답했지만 search-usefulness filter를 통과한 후보가 없는 경우는
  // 강등이 아니라 정직한 no-answer다. 억지 후보로 채우지 않는다.
  return { candidates, source: "llm" };
}

export type SearchTermDiscoveryPhase = "initial";

export async function runSearchTermDiscoveryOnProjection(params: {
  query: string;
  papers: SearchTermDiscoveryPaperV1[];
  queryClauses?: SearchTermDiscoveryQueryClause[];
  graphSupportedPaperIds?: string[];
  signal?: AbortSignal;
  usageLedger?: LLMJudgmentUsageLedger;
}): Promise<{
  englishTermCandidates: EnglishTermCandidate[];
  englishTermDiscovery: SearchTermDiscoveryState & { status: "ready"; source: "llm" };
}> {
  const extraction = await buildEnglishTermCandidatesWithLLM({
    query: params.query,
    papers: params.papers,
    queryClauses: params.queryClauses,
    graphSupportedPaperIds: params.graphSupportedPaperIds,
    signal: params.signal,
    usageLedger: params.usageLedger,
    usageMetadata: { phase: "initial" },
  });
  return {
    englishTermCandidates: extraction.candidates,
    englishTermDiscovery: {
      status: "ready",
      source: extraction.source,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * background 추출이 이 문서에 지금 필요한지 판단한다. `englishTermDiscovery`가
 * 없는 snapshot은 background 추출 대상이 아니다.
 */
export function shouldRunSearchTermDiscovery(
  metadata: SearchMetadata,
  phase: SearchTermDiscoveryPhase,
): boolean {
  void phase;
  const discovery = metadata.englishTermDiscovery;
  if (!discovery) return false;
  return discovery.status === "pending";
}

/**
 * 주어진(이미 hydrate된) metadata에서 연구 용어를 추출해 discovery 상태와
 * 함께 돌려준다. LLM이 닫히지 않으면 empty ready 상태로 닫아 억지 후보를 만들지 않는다.
 */
export async function runSearchTermDiscoveryOnMetadata(params: {
  metadata: SearchMetadata;
  phase: SearchTermDiscoveryPhase;
  signal?: AbortSignal;
  usageLedger?: LLMJudgmentUsageLedger;
}): Promise<SearchMetadata> {
  const { metadata, phase } = params;
  const extraction = await buildEnglishTermCandidatesWithLLM({
    query: metadata.query,
    papers: metadata.papers.map(projectMetadataPaperForTermDiscovery),
    queryClauses: metadata.queryClauses,
    graphSupportedPaperIds:
      metadata.graphSupport?.status === "ready"
        ? Object.keys(metadata.graphSupport.paperScores)
        : [],
    signal: params.signal,
    usageLedger: params.usageLedger,
    usageMetadata: { phase },
  });

  return {
    ...metadata,
    englishTermCandidates: extraction.candidates,
    englishTermDiscovery: {
      status: "ready",
      source: extraction.source,
      generatedAt: new Date().toISOString(),
    },
  };
}
