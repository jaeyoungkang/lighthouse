import { z } from "zod";
import { SemanticProfileSchema, StanceProfileSchema } from "@/app/lib/schemas";
import {
  executeJudgment,
  isTransientLlmFailoverError,
  type LLMJudgmentUsageLedger,
} from "@/app/server/ai-generation/judgment";
import { GEMINI_MODEL } from "@/app/server/ai-generation/gemini";
import { t } from "@/app/i18n/message-access";
import {
  INLINE_ANALYSIS_REQUEST_PAPER_LIMIT,
  normalizeProviderReadyDifferentPositionQuery,
  type AIAnalysis,
} from "@/app/domain/analysis";

const ABSTRACT_PROMPT = `당신은 연구 지식맵을 위한 논문 semantic profile 추출기다.
초록을 읽고 다음 형식으로 추출하라.
- localizedTitle: 원문 제목의 한국어화. 새 주장이나 요약을 추가하지 말고 제목 의미만 자연스럽게 옮긴다.
- claim: 핵심 주장 1-2문장 (확정 불가하면 null)
- topics: 3-5개 lowercase short phrases
- method: 핵심 방법론 1문장 (확정 불가하면 null)
- finding: 주요 결과 1문장 (확정 불가하면 null)
- stanceProfile: 이 논문의 입장, 이 논문의 한계·반박 가능 지점, 그리고 그 지점을 확인하기 위한 검색 후보
- quotedBasis: 각 필드를 뒷받침하는 abstract의 직접 구절. 없으면 null/[]

[Abstract]
{text}

주의:
- claim/method/finding은 한국어로 작성하되, 모르면 null로 둔다.
- localizedTitle은 제목의 한국어화이며 논문 요약이 아니다. abstract에만 있는 내용을 덧붙이지 않는다.
- topics는 3-5개 lowercase short phrases로 유지하되, 안정적 토픽이 없으면 빈 배열 허용
- topics는 generic word보다 구체적 연구 표현을 우선한다.
- topics는 해당 논문의 연구 대상·방법·문제 축을 나타내야 한다. abstract의 "novel", "first", "new", "state-of-the-art" 같은 저자 홍보 표현이나 일회성 수식어를 분야의 핵심 토픽으로 만들지 않는다.
- claim은 저자가 초록에서 주장하는 바를 abstract 기반 주장으로만 정리한다. 제목/초록만으로 분야 전체의 중요도나 반복성을 단정하지 않는다.
- quotedBasis는 abstract에서 직접 근거가 되는 짧은 구절만 넣는다.
- stanceProfile.mainPosition은 이 논문이 취하는 입장/해석을 한국어로 1문장 정리한다. 근거가 약하면 null.
- stanceProfile.debateAxis는 반대 해석이 갈릴 수 있는 쟁점 축을 한국어로 1문장 정리한다. 근거가 약하면 null.
- stanceProfile.limitations는 이 논문의 한계나 반박할 수 있는 지점을 제목·초록 근거로 한국어 1-2문장으로 정리한다. 근거가 약하면 null.
- stanceProfile.counterSearchQueries는 반박 논문이 실제로 존재한다고 단정하지 말고, 위 한계·반박 지점을 확인하기 위한 영어 검색어 1-3개를 제안한다.
- counterSearchQueries[].query에는 검색 provider에 바로 전달할 영어 검색식만 넣고 한국어 설명문을 넣지 않는다. 한국어 설명은 rationale에만 넣는다. rationale은 그 검색어가 어떤 한계·반박 지점을 확인하려는지 한국어 1문장으로 설명한다.
- 검색어는 논문 제목 그대로 + critique 형식에 기대지 말고, abstract의 핵심 쟁점·법/분야 용어·대립 축을 조합한다.
- 검색어 후보에는 4-8개 핵심 용어로 된 compact keyword query를 최소 1개 포함한다.
- "necessity of", "role of", "limitations of"처럼 자연어 filler로 시작하는 문장형 query만 만들지 말고, precise query와 broader fallback query를 섞는다.
- 추정하지 말고, 근거가 약하면 빈 배열 또는 null을 사용한다.
- JSON만 반환한다.

형식:
{
  "localizedTitle": "string | null",
  "claim": "string | null",
  "topics": ["string"],
  "method": "string | null",
  "finding": "string | null",
  "stanceProfile": {
    "mainPosition": "string | null",
    "debateAxis": "string | null",
    "limitations": "string | null",
    "counterSearchQueries": [
      { "query": "string", "rationale": "string", "basis": "string | null" }
    ]
  },
  "quotedBasis": {
    "claim": "string | null",
    "topics": ["string"],
    "method": "string | null",
    "finding": "string | null"
  }
}`;

export const PaperInputSchema = z.object({
  paperId: z.string(),
  title: z.string(),
  abstract: z.string().nullable(),
  year: z.number().nullable().optional(),
  citationCount: z.number().optional(),
  url: z.string().optional(),
  authors: z.array(z.string()).optional(),
});

export type PaperInput = z.infer<typeof PaperInputSchema>;

export interface InlineAnalysisResult {
  paperId: string;
  analysis: AIAnalysis;
  source: "abstract";
}

export class InlineAnalysisTerminalGenerationError extends Error {
  readonly failureClass = "terminal_generation_failure";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InlineAnalysisTerminalGenerationError";
  }
}

const semanticProfileSchema = SemanticProfileSchema.extend({
  localizedTitle: z.string().nullable().optional(),
  stanceProfile: StanceProfileSchema.optional(),
});

const InlineAnalysisBatchItemSchema = semanticProfileSchema.extend({
  paperId: z.string(),
  localizedTitle: z.string().nullable().optional(),
});

const InlineAnalysisBatchSchema = z.object({
  papers: z.array(InlineAnalysisBatchItemSchema).default([]),
});

const InlineAnalysisBatchResponseSchema = z.union([
  InlineAnalysisBatchSchema,
  z.array(InlineAnalysisBatchItemSchema).transform((papers) => ({ papers })),
]);

export const INLINE_ANALYSIS_PROMPT_BATCH_SIZE = 5;
export const INLINE_ANALYSIS_CONCURRENCY = INLINE_ANALYSIS_REQUEST_PAPER_LIMIT;

export function chunkInlineAnalysisBatches<T>(
  values: T[],
  batchSize = INLINE_ANALYSIS_PROMPT_BATCH_SIZE,
): T[][] {
  const batches: T[][] = [];

  for (let index = 0; index < values.length; index += batchSize) {
    batches.push(values.slice(index, index + batchSize));
  }

  return batches;
}

function buildInlineAnalysisPrompt(batch: PaperInput[]): string {
  const serializedPapers = batch
    .map(
      (paper, index) => `[${String(index + 1)}]
paperId: ${paper.paperId}
title: ${paper.title}
year: ${paper.year == null ? "?" : String(paper.year)}
abstract: ${paper.abstract ?? "없음"}`, // i18n-ignore — LLM prompt placeholder
    )
    .join("\n\n");

  return `You are a research analyst building semantic profiles for a knowledge map.
각 논문에 대해 다음을 추출하라.
- localizedTitle: 원문 제목의 한국어화. 새 주장이나 요약을 추가하지 말고 제목 의미만 자연스럽게 옮긴다.
- claim: 핵심 주장 1-2문장 (확정 불가하면 null)
- topics: 3-5개 lowercase short phrases
- method: 핵심 방법론 1문장 (확정 불가하면 null)
- finding: 주요 결과 1문장 (확정 불가하면 null)
- stanceProfile: 이 논문의 입장, 이 논문의 한계·반박 가능 지점, 그리고 그 지점을 확인하기 위한 검색 후보
- quotedBasis: abstract에서 직접 근거가 되는 짧은 구절. 없으면 null/[]

Papers:
${serializedPapers}

Rules:
- paperId는 입력과 정확히 일치해야 한다.
- claim/method/finding은 한국어로 작성하되, 모르면 null로 둔다.
- localizedTitle은 제목의 한국어화이며 논문 요약이 아니다. abstract에만 있는 내용을 덧붙이지 않는다.
- topics는 3-5개 lowercase short phrases로 유지하되, 안정적 토픽이 없으면 빈 배열 허용
- topics는 generic word보다 구체적 연구 표현을 우선한다.
- topics는 각 논문의 연구 대상·방법·문제 축을 나타내야 한다. abstract의 "novel", "first", "new", "state-of-the-art" 같은 저자 홍보 표현이나 일회성 수식어를 분야의 핵심 토픽으로 만들지 않는다.
- claim은 저자가 초록에서 주장하는 바를 abstract 기반 주장으로만 정리한다. 제목/초록만으로 분야 전체의 중요도나 반복성을 단정하지 않는다.
- quotedBasis는 직접 근거가 되는 짧은 구절만 넣고, 근거가 약하면 null/[]를 사용한다.
- stanceProfile.mainPosition은 이 논문이 취하는 입장/해석을 한국어로 1문장 정리한다. 근거가 약하면 null.
- stanceProfile.debateAxis는 반대 해석이 갈릴 수 있는 쟁점 축을 한국어로 1문장 정리한다. 근거가 약하면 null.
- stanceProfile.limitations는 이 논문의 한계나 반박할 수 있는 지점을 제목·초록 근거로 한국어 1-2문장으로 정리한다. 근거가 약하면 null.
- stanceProfile.counterSearchQueries는 반박 논문이 실제로 존재한다고 단정하지 말고, 위 한계·반박 지점을 확인하기 위한 영어 검색어 1-3개를 제안한다.
- counterSearchQueries[].query에는 검색 provider에 바로 전달할 영어 검색식만 넣고 한국어 설명문을 넣지 않는다. 한국어 설명은 rationale에만 넣는다. rationale은 그 검색어가 어떤 한계·반박 지점을 확인하려는지 한국어 1문장으로 설명한다.
- 검색어는 논문 제목 그대로 + critique 형식에 기대지 말고, abstract의 핵심 쟁점·법/분야 용어·대립 축을 조합한다.
- 검색어 후보에는 4-8개 핵심 용어로 된 compact keyword query를 최소 1개 포함한다.
- "necessity of", "role of", "limitations of"처럼 자연어 filler로 시작하는 문장형 query만 만들지 말고, precise query와 broader fallback query를 섞는다.
- Return JSON only.
- Include every paper in the response.

Format:
{
  "papers": [
    {
      "paperId": "string",
      "localizedTitle": "string | null",
      "claim": "string | null",
      "topics": ["string"],
      "method": "string | null",
      "finding": "string | null",
      "stanceProfile": {
        "mainPosition": "string | null",
        "debateAxis": "string | null",
        "limitations": "string | null",
        "counterSearchQueries": [
          { "query": "string", "rationale": "string", "basis": "string | null" }
        ]
      },
      "quotedBasis": {
        "claim": "string | null",
        "topics": ["string"],
        "method": "string | null",
        "finding": "string | null"
      }
    }
  ]
}`;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeTopics(topics: string[]): string[] {
  const deduped = new Set<string>();

  for (const topic of topics) {
    const normalized = normalizeText(topic).toLowerCase();
    if (!normalized) continue;
    deduped.add(normalized);
    if (deduped.size >= 6) break;
  }

  return [...deduped];
}

function normalizeStanceProfile(
  stanceProfile:
    | {
        mainPosition?: string | null;
        debateAxis?: string | null;
        limitations?: string | null;
        counterSearchQueries?: Array<{
          query?: string | null;
          rationale?: string | null;
          basis?: string | null;
        }>;
      }
    | null
    | undefined,
) {
  const seenQueries = new Set<string>();
  const counterSearchQueries = [];

  for (const candidate of stanceProfile?.counterSearchQueries ?? []) {
    const query = normalizeProviderReadyDifferentPositionQuery(candidate.query ?? "");
    if (query == null) continue;
    const key = query.toLowerCase();
    if (seenQueries.has(key)) continue;
    seenQueries.add(key);
    counterSearchQueries.push({
      query,
      rationale: normalizeOptionalText(candidate.rationale) ?? "",
      basis: normalizeOptionalText(candidate.basis),
    });
    if (counterSearchQueries.length >= 3) break;
  }

  return {
    mainPosition: normalizeOptionalText(stanceProfile?.mainPosition),
    debateAxis: normalizeOptionalText(stanceProfile?.debateAxis),
    limitations: normalizeOptionalText(stanceProfile?.limitations),
    counterSearchQueries,
  };
}

function buildQuotedBasis(
  quotedBasis:
    | {
        claim?: string | null;
        topics?: string[];
        method?: string | null;
        finding?: string | null;
        conclusion?: string | null;
      }
    | null
    | undefined,
) {
  return {
    claim: normalizeOptionalText(quotedBasis?.claim),
    topics: normalizeTopics(quotedBasis?.topics ?? []),
    method: normalizeOptionalText(quotedBasis?.method),
    finding: normalizeOptionalText(quotedBasis?.finding),
    conclusion: normalizeOptionalText(quotedBasis?.conclusion),
  };
}

function buildEvidenceMap(quotedBasis: {
  claim: string | null;
  topics: string[];
  method: string | null;
  finding: string | null;
  conclusion: string | null;
}) {
  return Object.fromEntries(
    [
      ["claim", quotedBasis.claim],
      ["topics", quotedBasis.topics.join(", ").trim() || null],
      ["method", quotedBasis.method],
      ["finding", quotedBasis.finding],
      ["conclusion", quotedBasis.conclusion],
    ].filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

function buildUnknownInlineAnalysis(paper: PaperInput, source: "abstract"): InlineAnalysisResult {
  const summary = t("document.error.inline-analysis-service");

  return {
    paperId: paper.paperId,
    analysis: {
      summary,
      objective: summary,
      methodology: "",
      results: "",
      keywords: [],
      semanticProfile: {
        claim: null,
        topics: [],
        method: null,
        finding: null,
        conclusion: null,
        quotedBasis: {
          claim: null,
          topics: [],
          method: null,
          finding: null,
          conclusion: null,
        },
      },
      confidence: "low",
      stanceProfile: {
        mainPosition: null,
        debateAxis: null,
        limitations: null,
        counterSearchQueries: [],
      },
      evidenceMap: {},
    },
    source,
  };
}

function buildAnalysisFromSemanticProfile(params: {
  localizedTitle?: string | null;
  claim: string | null;
  topics: string[];
  method: string | null;
  finding: string | null;
  conclusion: string | null;
  quotedBasis?: {
    claim?: string | null;
    topics?: string[];
    method?: string | null;
    finding?: string | null;
    conclusion?: string | null;
  } | null;
  stanceProfile?: {
    mainPosition?: string | null;
    debateAxis?: string | null;
    limitations?: string | null;
    counterSearchQueries?: Array<{
      query?: string | null;
      rationale?: string | null;
      basis?: string | null;
    }>;
  } | null;
  source: "abstract";
}): AIAnalysis {
  const claim = normalizeOptionalText(params.claim);
  const method = normalizeOptionalText(params.method);
  const finding = normalizeOptionalText(params.finding);
  const localizedTitle = normalizeOptionalText(params.localizedTitle);
  const topics = normalizeTopics(params.topics);
  const quotedBasis = buildQuotedBasis(params.quotedBasis);
  const rawConclusion = normalizeOptionalText(params.conclusion);
  const conclusion = quotedBasis.conclusion ? rawConclusion : null;
  const stanceProfile = normalizeStanceProfile(params.stanceProfile);
  const summary =
    claim ||
    method ||
    finding ||
    conclusion ||
    topics.join(", ") ||
    t("document.error.inline-analysis-service");

  return {
    summary,
    localizedTitle,
    objective: claim || summary,
    methodology: method ?? quotedBasis.method ?? "",
    results: finding ?? conclusion ?? summary,
    keywords: topics,
    semanticProfile: {
      claim,
      topics,
      method,
      finding,
      conclusion,
      quotedBasis,
    },
    stanceProfile,
    confidence: "medium" as const,
    evidenceMap: buildEvidenceMap(quotedBasis),
  };
}

export async function analyzePaper(
  paper: PaperInput,
  options?: { signal?: AbortSignal; usageLedger?: LLMJudgmentUsageLedger },
): Promise<InlineAnalysisResult | null> {
  const text = paper.abstract;
  if (!text) return null;
  const prompt = ABSTRACT_PROMPT.replace("{text}", text);

  const semanticProfile = await executeJudgment({
    prompt,
    outputSchema: semanticProfileSchema,
    label: "analyze-paper",
    onError: "fallback",
    fallbackValue: null,
    signal: options?.signal,
    model: GEMINI_MODEL,
    providerPolicy: "inline_analysis_failover",
    maxInputBytes: 500_000,
    maxOutputTokens: 4_096,
    usageLedger: options?.usageLedger,
  });

  if (!semanticProfile) {
    return buildUnknownInlineAnalysis(paper, "abstract");
  }

  return {
    paperId: paper.paperId,
    analysis: buildAnalysisFromSemanticProfile({
      localizedTitle: semanticProfile.localizedTitle,
      claim: semanticProfile.claim,
      topics: semanticProfile.topics,
      method: semanticProfile.method,
      finding: semanticProfile.finding,
      conclusion: semanticProfile.conclusion,
      quotedBasis: semanticProfile.quotedBasis,
      stanceProfile: semanticProfile.stanceProfile,
      source: "abstract",
    }),
    source: "abstract",
  };
}

async function analyzePaperBatch(
  batch: PaperInput[],
  options?: { signal?: AbortSignal; usageLedger?: LLMJudgmentUsageLedger },
): Promise<InlineAnalysisResult[]> {
  if (batch.length === 0) {
    return [];
  }

  let response: z.infer<typeof InlineAnalysisBatchResponseSchema>;
  try {
    response = await executeJudgment({
      prompt: buildInlineAnalysisPrompt(batch),
      outputSchema: InlineAnalysisBatchResponseSchema,
      label: "analyze-paper-batch",
      onError: "throw",
      signal: options?.signal,
      model: GEMINI_MODEL,
      providerPolicy: "inline_analysis_failover",
      maxInputBytes: 500_000,
      maxOutputTokens: 4_096,
      usageLedger: options?.usageLedger,
    });
  } catch (error) {
    if (
      isTransientLlmFailoverError(error) ||
      (error instanceof DOMException &&
        (error.name === "AbortError" || error.name === "TimeoutError"))
    ) {
      throw error;
    }
    throw new InlineAnalysisTerminalGenerationError(
      "Inline analysis generation failed its output contract",
      { cause: error },
    );
  }

  const allowedPaperIds = new Set(batch.map((paper) => paper.paperId));

  const responseMap = new Map(
    response.papers
      .filter((item) => allowedPaperIds.has(item.paperId))
      .map((item) => [item.paperId, item] as const),
  );

  return batch.map((paper) => {
    const item = responseMap.get(paper.paperId);
    if (!item) {
      throw new InlineAnalysisTerminalGenerationError(
        `Inline analysis response omitted paper ${paper.paperId}`,
      );
    }

    return {
      paperId: item.paperId,
      analysis: buildAnalysisFromSemanticProfile({
        localizedTitle: item.localizedTitle,
        claim: item.claim,
        topics: item.topics,
        method: item.method,
        finding: item.finding,
        conclusion: item.conclusion,
        quotedBasis: item.quotedBasis,
        stanceProfile: item.stanceProfile,
        source: "abstract",
      }),
      source: "abstract" as const,
    };
  });
}

export async function analyzePapersInline(
  papers: PaperInput[],
  options?: { signal?: AbortSignal; usageLedger?: LLMJudgmentUsageLedger },
): Promise<InlineAnalysisResult[]> {
  const queue = papers.filter((p) => p.abstract);
  const batches = chunkInlineAnalysisBatches(queue, INLINE_ANALYSIS_PROMPT_BATCH_SIZE);
  const results: InlineAnalysisResult[] = [];

  for (let index = 0; index < batches.length; index += INLINE_ANALYSIS_CONCURRENCY) {
    const concurrentBatches = batches.slice(index, index + INLINE_ANALYSIS_CONCURRENCY);
    const batchResults = await Promise.all(
      concurrentBatches.map((batch) =>
        analyzePaperBatch(batch, {
          signal: options?.signal,
          usageLedger: options?.usageLedger,
        }),
      ),
    );

    for (const result of batchResults) results.push(...result);
  }

  return results;
}
