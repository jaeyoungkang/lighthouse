/**
 * 도구 수준 LLM 판단 공통 실행기.
 * 프롬프트 → Gemini 호출 → 파싱 → Zod 검증 → 관측 기록을 단일 경로로 추상화한다.
 */
// @promise promise:llm-usage-observability
// @check acceptance-check:llm-usage-observability-execute-judgment-ledger

import { GEMINI_MODEL } from "@/app/server/ai-generation/gemini";
import { observe } from "@/app/lib/observe";
import { utf8ByteLength } from "@/app/lib/utf8";
import { executeStructuredGenerationWithUsage } from "@/app/server/ai-generation/gateway";
import type { NormalizedUsage } from "@/app/server/ai-generation/usage";
import type { LlmUsageEventStatus } from "@/app/server/repository/llm-usage-events";
import { after } from "next/server";
import type { z } from "zod";

// ---------------------------------------------------------------------------
// 판단 스펙
// ---------------------------------------------------------------------------

export interface LLMJudgmentSpec<TOutput> {
  /** 조립된 프롬프트 문자열 */
  prompt: string;

  /** 출력 검증 스키마. null이면 텍스트 그대로 반환 */
  outputSchema: z.ZodType<TOutput> | null;

  /** JSON 응답 강제 여부 (기본: true). false면 텍스트 응답 */
  jsonMode?: boolean;

  /** 에러 전략. "throw"(기본)이면 throw, "fallback"이면 fallbackValue 반환 */
  onError?: "throw" | "fallback";

  /** onError가 "fallback"일 때 반환할 기본값 */
  fallbackValue?: TOutput;

  /** 관측용 라벨 (예: "analyze-paper", "evaluate-importance") */
  label: string;

  /** 사용할 모델 (기본: GEMINI_MODEL). 대량 입력 시 GEMINI_LITE_MODEL 권장 */
  model?: string;

  /**
   * Optional sampling controls for tool-level judgments.
   *
   * Prefer one non-neutral sampling constraint per caller. Judge-style calls
   * may pair `temperature: 0` with `topP: 1` because `topP: 1` is the neutral
   * provider default pinned explicitly for reproducibility.
   */
  temperature?: number;
  topP?: number;
  seed?: number;

  /** Provider call deadline in milliseconds. */
  timeoutMs?: number;

  /** Provider output token cap, when the caller owns a bounded response shape. */
  maxOutputTokens?: number;

  /** Provider input byte cap, measured on the exact UTF-8 prompt before dispatch. */
  maxInputBytes?: number;

  /** Allowlisted, non-prompt usage dimensions recorded with trusted-server calls. */
  usageMetadata?: {
    phase?: string;
    paperCount?: number;
    promptChars?: number;
    promptPaperLimit?: number;
    promptAbstractChars?: number;
    mode?: string;
  };

  /** Optional durable usage ledger hook for trusted server-owned execution paths. */
  usageLedger?: LLMJudgmentUsageLedger;

  /** 외부 취소 signal */
  signal?: AbortSignal;

  /** Inline-analysis-only primary→secondary policy. */
  providerPolicy?: "inline_analysis_failover";
}

export interface LLMJudgmentUsageRecord {
  action: string;
  status: LlmUsageEventStatus;
  model: string;
  usage: NormalizedUsage;
  costUsdMicros: number | null;
  priced: boolean;
  durationMs: number;
  metadata?: {
    responseLength?: number;
    timeoutMs?: number;
    promptBytes?: number;
    maxInputBytes?: number;
    maxOutputTokens?: number;
    phase?: string;
    paperCount?: number;
    promptChars?: number;
    promptPaperLimit?: number;
    promptAbstractChars?: number;
    mode?: string;
  };
}

export interface LLMJudgmentUsageLedger {
  record: (event: LLMJudgmentUsageRecord) => Promise<void>;
}

export function isTransientLlmFailoverError(error: unknown): error is Error & {
  failureClass: "transient_failover_exhausted";
  retryAfterSeconds?: number | null;
} {
  return (
    error instanceof Error &&
    "failureClass" in error &&
    error.failureClass === "transient_failover_exhausted"
  );
}

function scheduleJudgmentUsageRecord(
  usageLedger: LLMJudgmentUsageLedger | undefined,
  event: LLMJudgmentUsageRecord,
): void {
  if (!usageLedger) return;

  const record = () => usageLedger.record(event);

  try {
    after(record);
  } catch {
    try {
      void record().catch(() => {
        // Usage recording is an observability side effect and must not alter judgment behavior.
      });
    } catch {
      // Usage recording is an observability side effect and must not alter judgment behavior.
    }
  }
}

function buildJudgmentUsageMetadata<TOutput>(
  ledger: LLMJudgmentSpec<TOutput>,
  responseLength: number,
  promptBytes: number,
): Record<string, unknown> {
  return {
    ...ledger.usageMetadata,
    responseLength,
    promptBytes,
    ...(ledger.timeoutMs !== undefined ? { timeoutMs: ledger.timeoutMs } : {}),
    ...(ledger.maxInputBytes !== undefined ? { maxInputBytes: ledger.maxInputBytes } : {}),
    ...(ledger.maxOutputTokens !== undefined ? { maxOutputTokens: ledger.maxOutputTokens } : {}),
  };
}

// ---------------------------------------------------------------------------
// 판단 실행
// ---------------------------------------------------------------------------

export async function executeJudgment<TOutput>(ledger: LLMJudgmentSpec<TOutput>): Promise<TOutput> {
  const start = Date.now();
  const jsonMode = ledger.jsonMode !== false;
  const model = ledger.model ?? GEMINI_MODEL;
  const promptBytes = utf8ByteLength(ledger.prompt);
  let generationMetadata: Record<string, unknown> = { model };
  let generationForUsage:
    | Awaited<ReturnType<typeof executeStructuredGenerationWithUsage>>
    | undefined;

  observe({
    timestamp: new Date().toISOString(),
    category: "ai-call",
    action: ledger.label,
    status: "start",
    metadata: { promptLength: ledger.prompt.length, promptBytes, jsonMode, model },
  });

  try {
    // abort 체크
    if (ledger.signal?.aborted) {
      throw new DOMException("Judgment cancelled", "AbortError");
    }

    // 1. LLM gateway 호출
    const generation = await executeStructuredGenerationWithUsage({
      model,
      prompt: ledger.prompt,
      jsonMode,
      temperature: ledger.temperature,
      topP: ledger.topP,
      seed: ledger.seed,
      timeoutMs: ledger.timeoutMs,
      maxInputBytes: ledger.maxInputBytes,
      maxOutputTokens: ledger.maxOutputTokens,
      providerPolicy: ledger.providerPolicy,
      signal: ledger.signal,
    });
    const text = generation.text;
    generationForUsage = generation;
    const duration = Date.now() - start;
    generationMetadata = {
      responseLength: text.length,
      model: generation.model,
      ...generation.usage,
      costUsdMicros: generation.costUsdMicros,
      priced: generation.priced,
    };

    if (ledger.signal?.aborted) {
      throw new DOMException("Judgment cancelled", "AbortError");
    }

    // 2. 파싱
    let result: TOutput;

    if (!ledger.outputSchema) {
      // 스키마 없음 → 텍스트 그대로 반환
      result = text as TOutput;
    } else {
      // JSON 파싱 → Zod 검증
      const json: unknown = JSON.parse(text);
      const parsed = ledger.outputSchema.safeParse(json);

      if (!parsed.success) {
        throw new Error(
          `[${ledger.label}] Zod validation failed: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        );
      }
      result = parsed.data;
    }

    if (ledger.signal?.aborted) {
      throw new DOMException("Judgment cancelled", "AbortError");
    }

    scheduleJudgmentUsageRecord(ledger.usageLedger, {
      action: ledger.label,
      status: "success",
      model: generation.model,
      usage: generation.usage,
      costUsdMicros: generation.costUsdMicros,
      priced: generation.priced,
      durationMs: duration,
      metadata: buildJudgmentUsageMetadata(ledger, text.length, promptBytes),
    });

    // 3. 관측 성공 기록
    observe({
      timestamp: new Date().toISOString(),
      category: "ai-call",
      action: ledger.label,
      status: "success",
      duration,
      metadata: {
        promptLength: ledger.prompt.length,
        promptBytes,
        jsonMode,
        ...generationMetadata,
      },
    });

    return result;
  } catch (error) {
    const duration = Date.now() - start;

    if (generationForUsage) {
      scheduleJudgmentUsageRecord(ledger.usageLedger, {
        action: ledger.label,
        status: ledger.signal?.aborted ? "aborted" : "empty",
        model: generationForUsage.model,
        usage: generationForUsage.usage,
        costUsdMicros: generationForUsage.costUsdMicros,
        priced: generationForUsage.priced,
        durationMs: duration,
        metadata: buildJudgmentUsageMetadata(ledger, generationForUsage.text.length, promptBytes),
      });
    }

    observe({
      timestamp: new Date().toISOString(),
      category: "ai-call",
      action: ledger.label,
      status: "fail",
      duration,
      metadata: {
        promptLength: ledger.prompt.length,
        promptBytes,
        jsonMode,
        ...generationMetadata,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    if (ledger.onError === "fallback" && "fallbackValue" in ledger) {
      return ledger.fallbackValue as TOutput;
    }

    throw error;
  }
}
