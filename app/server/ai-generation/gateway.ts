import { createOpenAI } from "@ai-sdk/openai";
import { loadEnvConfig } from "@next/env";
import { generateText, Output } from "ai";
import {
  GEMINI_GENERATE_CONTENT_THINKING_LEVEL,
  GEMINI_MODEL,
  getGeminiClient,
} from "@/app/server/ai-generation/gemini";
import { getOpenAiModelId } from "@/app/lib/ai-model-provider";
import { observe } from "@/app/lib/observe";
import { logWarn } from "@/app/lib/runtime-log";
import { utf8ByteLength } from "@/app/lib/utf8";
import { computeCostUsdMicros } from "./pricing";
import {
  hasMeasuredUsage,
  normalizeGeminiUsage,
  normalizeOpenAiUsage,
  type NormalizedUsage,
} from "./usage";

const DEFAULT_STRUCTURED_GENERATION_TIMEOUT_MS = 20_000;
const INLINE_ANALYSIS_PRIMARY_TIMEOUT_MS = 10_000;
const INLINE_ANALYSIS_PROVIDER_BUDGET_MS = 24_000;
export const INLINE_ANALYSIS_SECONDARY_MODEL = "gpt-5.4-mini-2026-03-17";
type LlmBreakerState = "closed" | "open" | "half_open";
const LLM_BREAKER_FAILURE_THRESHOLD = 5;
const LLM_BREAKER_OPEN_MS = 60_000;

let cachedOpenAiProvider: ReturnType<typeof createOpenAI> | null = null;
let cachedOpenAiProviderApiKey: string | null = null;
let envLoaded = false;

export interface StructuredGenerationOptions {
  prompt: string;
  model?: string;
  jsonMode?: boolean;
  maxInputBytes?: number;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  seed?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  providerPolicy?: "inline_analysis_failover";
}

export interface StructuredGenerationResult {
  text: string;
  model: string;
  provider?: "gemini" | "openai";
  usage: NormalizedUsage;
  costUsdMicros: number | null;
  priced: boolean;
}

export class StructuredGenerationInputTooLargeError extends Error {
  readonly actualBytes: number;
  readonly maxBytes: number;

  constructor(params: { actualBytes: number; maxBytes: number }) {
    super(
      `Structured generation input exceeds byte budget: ${String(params.actualBytes)} > ${String(params.maxBytes)}`,
    );
    this.name = "StructuredGenerationInputTooLargeError";
    this.actualBytes = params.actualBytes;
    this.maxBytes = params.maxBytes;
  }
}

export class LlmFailoverExhaustedError extends Error {
  readonly failureClass = "transient_failover_exhausted";

  constructor(
    readonly primaryFailureClass: string,
    readonly secondaryFailureClass: string,
    readonly retryAfterSeconds: number | null,
    options?: ErrorOptions,
  ) {
    super("Primary and secondary LLM providers failed transiently", options);
    this.name = "LlmFailoverExhaustedError";
  }
}

class LlmPrimaryCircuitOpenError extends Error {
  readonly failureClass = "primary_circuit_open";

  constructor() {
    super("Primary LLM circuit is open");
    this.name = "LlmPrimaryCircuitOpenError";
  }
}

class ProcessLocalLlmCircuitBreaker {
  private consecutiveFailures = 0;
  private openedAt = 0;
  private halfOpenProbeActive = false;
  private epoch = 0;

  state(now = Date.now()): LlmBreakerState {
    if (this.openedAt === 0) return "closed";
    return now - this.openedAt >= LLM_BREAKER_OPEN_MS ? "half_open" : "open";
  }

  enter(now = Date.now()): { epoch: number; release(): void } {
    const state = this.state(now);
    if (state === "open" || (state === "half_open" && this.halfOpenProbeActive)) {
      throw new LlmPrimaryCircuitOpenError();
    }
    if (state === "half_open") this.halfOpenProbeActive = true;
    return {
      epoch: this.epoch,
      release: () => {
        this.halfOpenProbeActive = false;
      },
    };
  }

  recordSuccess(epoch: number): void {
    if (epoch !== this.epoch) return;
    this.consecutiveFailures = 0;
    this.openedAt = 0;
    this.halfOpenProbeActive = false;
    this.epoch += 1;
  }

  recordTransientFailure(epoch: number, now = Date.now()): void {
    if (epoch !== this.epoch) return;
    this.consecutiveFailures += 1;
    if (
      this.state(now) === "half_open" ||
      this.consecutiveFailures >= LLM_BREAKER_FAILURE_THRESHOLD
    ) {
      this.openedAt = now;
      this.halfOpenProbeActive = false;
      this.epoch += 1;
    }
  }
}

/** Module-local by design; it is not a fleet/provider-account authority. */
const processLocalGeminiBreaker = new ProcessLocalLlmCircuitBreaker();

const missingPricingWarnings = new Set<string>();

function ensureServerEnvLoaded() {
  if (envLoaded || typeof window !== "undefined") return;
  loadEnvConfig(process.cwd());
  envLoaded = true;
}

function resolveOpenAiApiKey(): string | null {
  ensureServerEnvLoaded();
  return process.env.OPENAI_API_KEY ?? null;
}

function getOpenAiProvider(): ReturnType<typeof createOpenAI> {
  const apiKey = resolveOpenAiApiKey();
  if (!apiKey) {
    throw new Error("[openai] Missing OPENAI_API_KEY");
  }

  if (!cachedOpenAiProvider || cachedOpenAiProviderApiKey !== apiKey) {
    cachedOpenAiProvider = createOpenAI({ apiKey });
    cachedOpenAiProviderApiKey = apiKey;
  }

  return cachedOpenAiProvider;
}

function buildStructuredGenerationResult(params: {
  text: string;
  model: string;
  provider: "gemini" | "openai";
  usage: NormalizedUsage;
}): StructuredGenerationResult {
  const costUsdMicros = computeCostUsdMicros(params.model, params.usage);

  if (
    costUsdMicros == null &&
    hasMeasuredUsage(params.usage) &&
    !missingPricingWarnings.has(params.model)
  ) {
    missingPricingWarnings.add(params.model);
    logWarn("ai-generation-pricing", "missing model pricing", {
      model: params.model,
      ...params.usage,
    });
  }

  return {
    text: params.text,
    model: params.model,
    provider: params.provider,
    usage: params.usage,
    costUsdMicros,
    priced: costUsdMicros != null,
  };
}

function createLinkedAbortSignal(params: { signal?: AbortSignal; timeoutMs: number }): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    controller.abort(
      new DOMException(
        `Structured generation timed out after ${String(params.timeoutMs)}ms`,
        "TimeoutError",
      ),
    );
  }, params.timeoutMs);

  const abortFromUpstream = () => {
    controller.abort(params.signal?.reason ?? new DOMException("Request aborted", "AbortError"));
  };

  if (params.signal?.aborted) {
    abortFromUpstream();
  } else {
    params.signal?.addEventListener("abort", abortFromUpstream, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timeout != null) {
        clearTimeout(timeout);
        timeout = null;
      }
      params.signal?.removeEventListener("abort", abortFromUpstream);
    },
  };
}

export async function executeStructuredGeneration(
  params: StructuredGenerationOptions,
): Promise<string> {
  return (await executeStructuredGenerationWithUsage(params)).text;
}

export async function executeStructuredGenerationWithUsage(
  params: StructuredGenerationOptions,
): Promise<StructuredGenerationResult> {
  if (params.maxInputBytes != null) {
    const actualBytes = utf8ByteLength(params.prompt);
    if (actualBytes > params.maxInputBytes) {
      throw new StructuredGenerationInputTooLargeError({
        actualBytes,
        maxBytes: params.maxInputBytes,
      });
    }
  }

  const model = params.model ?? GEMINI_MODEL;
  const failoverEnabled =
    params.providerPolicy === "inline_analysis_failover" && getOpenAiModelId(model) == null;
  const ownerTimeoutMs = failoverEnabled
    ? INLINE_ANALYSIS_PROVIDER_BUDGET_MS
    : (params.timeoutMs ?? DEFAULT_STRUCTURED_GENERATION_TIMEOUT_MS);
  const generationConfig = {
    responseMimeType: params.jsonMode !== false ? ("application/json" as const) : undefined,
    temperature: params.temperature,
    topP: params.topP,
    seed: params.seed,
    thinkingConfig: { thinkingLevel: GEMINI_GENERATE_CONTENT_THINKING_LEVEL } as const,
  };
  const linkedSignal = createLinkedAbortSignal({
    signal: params.signal,
    timeoutMs: ownerTimeoutMs,
  });
  try {
    if (!failoverEnabled) {
      return await executeProviderAttempt({
        params,
        model,
        signal: linkedSignal.signal,
        timeoutMs: ownerTimeoutMs,
        role: "selected",
        generationConfig,
      });
    }

    const startedAt = Date.now();
    const breakerState = processLocalGeminiBreaker.state();
    let breakerAttempt: ReturnType<typeof processLocalGeminiBreaker.enter> | null = null;
    let primaryFailure: unknown;
    try {
      breakerAttempt = processLocalGeminiBreaker.enter();
      const result = await executeProviderAttempt({
        params,
        model,
        signal: linkedSignal.signal,
        timeoutMs: INLINE_ANALYSIS_PRIMARY_TIMEOUT_MS,
        role: "primary",
        breakerState,
        generationConfig,
      });
      processLocalGeminiBreaker.recordSuccess(breakerAttempt.epoch);
      return result;
    } catch (error) {
      primaryFailure = error;
      if (!isTransientProviderFailure(error)) throw error;
      if (!(error instanceof LlmPrimaryCircuitOpenError) && breakerAttempt) {
        processLocalGeminiBreaker.recordTransientFailure(breakerAttempt.epoch);
      }
    } finally {
      breakerAttempt?.release();
    }

    try {
      return await executeProviderAttempt({
        params,
        model: INLINE_ANALYSIS_SECONDARY_MODEL,
        signal: linkedSignal.signal,
        timeoutMs: Math.max(1, INLINE_ANALYSIS_PROVIDER_BUDGET_MS - (Date.now() - startedAt)),
        role: "secondary",
        breakerState: processLocalGeminiBreaker.state(),
        generationConfig,
      });
    } catch (secondaryFailure) {
      if (!isTransientProviderFailure(secondaryFailure)) throw secondaryFailure;
      throw new LlmFailoverExhaustedError(
        classifyProviderFailure(primaryFailure),
        classifyProviderFailure(secondaryFailure),
        Math.max(
          readRetryAfterSeconds(primaryFailure) ?? 0,
          readRetryAfterSeconds(secondaryFailure) ?? 0,
        ) || null,
        { cause: secondaryFailure },
      );
    }
  } finally {
    linkedSignal.cleanup();
  }
}

function getErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  for (const key of ["status", "statusCode", "httpStatusCode"] as const) {
    const value = (error as Record<string, unknown>)[key];
    if (typeof value === "number") return value;
  }
  return null;
}

function readRetryAfterSeconds(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const direct = (error as Record<string, unknown>).retryAfter;
  if (typeof direct === "number" && Number.isFinite(direct)) return Math.max(0, direct);
  const headers = (error as Record<string, unknown>).responseHeaders;
  if (headers && typeof headers === "object") {
    const value = (headers as Record<string, unknown>)["retry-after"];
    const seconds = typeof value === "string" ? Number(value) : value;
    if (typeof seconds === "number" && Number.isFinite(seconds)) return Math.max(0, seconds);
  }
  return null;
}

export function classifyProviderFailure(error: unknown): string {
  if (error instanceof LlmPrimaryCircuitOpenError) return error.failureClass;
  if (
    typeof error === "object" &&
    error !== null &&
    "failureClass" in error &&
    typeof error.failureClass === "string"
  ) {
    return error.failureClass;
  }
  const status = getErrorStatus(error);
  if (status === 429) return "provider_429";
  if (status != null && status >= 500) return "provider_5xx";
  if (error instanceof TypeError) return "network";
  const name = error instanceof Error ? error.name.toLowerCase() : "";
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (name.includes("timeout") || message.includes("timed out") || message.includes("timeout")) {
    return "timeout";
  }
  if (message.includes("fetch") || message.includes("network")) return "network";
  return "terminal";
}

export function isTransientProviderFailure(error: unknown): boolean {
  return ["timeout", "network", "provider_429", "provider_5xx", "primary_circuit_open"].includes(
    classifyProviderFailure(error),
  );
}

async function executeProviderAttempt(params: {
  params: StructuredGenerationOptions;
  model: string;
  signal: AbortSignal;
  timeoutMs: number;
  role: "selected" | "primary" | "secondary";
  breakerState?: LlmBreakerState;
  generationConfig: {
    responseMimeType: "application/json" | undefined;
    temperature: number | undefined;
    topP: number | undefined;
    seed: number | undefined;
    thinkingConfig: { thinkingLevel: typeof GEMINI_GENERATE_CONTENT_THINKING_LEVEL };
  };
}): Promise<StructuredGenerationResult> {
  const startedAt = Date.now();
  const openAiModelId = getOpenAiModelId(params.model);
  const provider = openAiModelId == null ? "gemini" : "openai";
  observe({
    timestamp: new Date().toISOString(),
    category: "ai-call",
    action: "structured-generation-provider-attempt",
    status: "start",
    metadata: {
      role: params.role,
      provider,
      model: params.model,
      timeoutMs: params.timeoutMs,
      breakerScope: "process_local",
      breakerState: params.breakerState ?? null,
    },
  });
  const attemptSignal = createLinkedAbortSignal({
    signal: params.signal,
    timeoutMs: params.timeoutMs,
  });
  const { responseMimeType, thinkingConfig, ...samplingConfig } = params.generationConfig;
  try {
    let result: StructuredGenerationResult;
    if (openAiModelId != null) {
      const response = await generateText({
        model: getOpenAiProvider()(openAiModelId),
        prompt: params.params.prompt,
        ...(params.params.jsonMode !== false ? { output: Output.json() } : undefined),
        ...(params.params.maxOutputTokens != null
          ? { maxOutputTokens: params.params.maxOutputTokens }
          : undefined),
        ...samplingConfig,
        maxRetries: 0,
        timeout: params.timeoutMs,
        abortSignal: attemptSignal.signal,
      });
      result = buildStructuredGenerationResult({
        text: response.text,
        model: params.model,
        provider,
        usage: normalizeOpenAiUsage(response.usage),
      });
    } else {
      const response = await getGeminiClient().models.generateContent({
        model: params.model,
        contents: params.params.prompt,
        config: {
          ...(responseMimeType != null ? { responseMimeType } : undefined),
          ...(params.params.maxOutputTokens != null
            ? { maxOutputTokens: params.params.maxOutputTokens }
            : undefined),
          ...samplingConfig,
          abortSignal: attemptSignal.signal,
          httpOptions: { timeout: params.timeoutMs, retryOptions: { attempts: 1 } },
          thinkingConfig,
        },
      });
      result = buildStructuredGenerationResult({
        text: response.text ?? "",
        model: params.model,
        provider,
        usage: normalizeGeminiUsage(response.usageMetadata),
      });
    }
    observe({
      timestamp: new Date().toISOString(),
      category: "ai-call",
      action: "structured-generation-provider-attempt",
      status: "success",
      duration: Date.now() - startedAt,
      metadata: {
        role: params.role,
        provider,
        model: params.model,
        breakerScope: "process_local",
        ...result.usage,
        costUsdMicros: result.costUsdMicros,
      },
    });
    return result;
  } catch (error) {
    observe({
      timestamp: new Date().toISOString(),
      category: "ai-call",
      action: "structured-generation-provider-attempt",
      status: "fail",
      duration: Date.now() - startedAt,
      metadata: {
        role: params.role,
        provider,
        model: params.model,
        failureClass: classifyProviderFailure(error),
        retryAfterSeconds: readRetryAfterSeconds(error),
        breakerScope: "process_local",
      },
    });
    throw error;
  } finally {
    attemptSignal.cleanup();
  }
}
