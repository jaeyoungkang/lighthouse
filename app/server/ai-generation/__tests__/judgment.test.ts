import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { StructuredGenerationResult } from "@/app/server/ai-generation/gateway";
import type { LLMJudgmentUsageRecord } from "@/app/server/ai-generation/judgment";

const executeStructuredGenerationWithUsage = vi.hoisted(() => vi.fn());
const observe = vi.hoisted(() => vi.fn());
const after = vi.hoisted(() => vi.fn((callback: () => void | Promise<void>) => callback()));

vi.mock("@/app/server/ai-generation/gateway", () => ({
  executeStructuredGenerationWithUsage,
}));

vi.mock("@/app/lib/observe", () => ({
  observe,
}));

vi.mock("next/server", () => ({
  after,
}));

function generationResult(text: string): StructuredGenerationResult {
  return {
    text,
    model: "gemini-test-model",
    usage: {
      inputTokens: 100,
      outputTokens: 20,
      totalTokens: 120,
      reasoningTokens: 0,
      cachedInputTokens: 0,
    },
    costUsdMicros: 55,
    priced: true,
  };
}

describe("executeJudgment usage ledger", () => {
  beforeEach(() => {
    executeStructuredGenerationWithUsage.mockReset();
    observe.mockReset();
    after.mockClear();
  });

  it("records successful provider usage under the judgment label action", async () => {
    const record = vi.fn<(event: LLMJudgmentUsageRecord) => Promise<void>>().mockResolvedValue();
    executeStructuredGenerationWithUsage.mockResolvedValueOnce(
      generationResult(JSON.stringify({ value: "ok" })),
    );
    const { executeJudgment } = await import("@/app/server/ai-generation/judgment");

    await expect(
      executeJudgment({
        prompt: "return a value",
        outputSchema: z.object({ value: z.string() }),
        label: "test-judgment",
        timeoutMs: 1234,
        maxInputBytes: 4096,
        maxOutputTokens: 512,
        usageLedger: { record },
      }),
    ).resolves.toEqual({ value: "ok" });

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "test-judgment",
        status: "success",
        model: "gemini-test-model",
        costUsdMicros: 55,
        priced: true,
        metadata: {
          promptBytes: 14,
          responseLength: JSON.stringify({ value: "ok" }).length,
          timeoutMs: 1234,
          maxInputBytes: 4096,
          maxOutputTokens: 512,
        },
      }),
    );
    expect(executeStructuredGenerationWithUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        maxInputBytes: 4096,
        maxOutputTokens: 512,
      }),
    );
    expect(after).toHaveBeenCalledTimes(1);
  });

  it("uses deterministic fallback when the gateway rejects an oversized prompt", async () => {
    executeStructuredGenerationWithUsage.mockRejectedValueOnce(new Error("input too large"));
    const { executeJudgment } = await import("@/app/server/ai-generation/judgment");

    await expect(
      executeJudgment({
        prompt: "과대 입력",
        outputSchema: z.object({ value: z.string() }),
        label: "test-judgment",
        maxInputBytes: 4,
        onError: "fallback",
        fallbackValue: { value: "fallback" },
      }),
    ).resolves.toEqual({ value: "fallback" });

    const lastObservation: unknown = observe.mock.calls.at(-1)?.at(0);
    expect(lastObservation).toMatchObject({
      action: "test-judgment",
      status: "fail",
      metadata: { promptBytes: 13 },
    });
  });

  it("records empty usage when provider output cannot be consumed but fallback handles it", async () => {
    const record = vi.fn<(event: LLMJudgmentUsageRecord) => Promise<void>>().mockResolvedValue();
    executeStructuredGenerationWithUsage.mockResolvedValueOnce(generationResult("{not-json"));
    const { executeJudgment } = await import("@/app/server/ai-generation/judgment");

    await expect(
      executeJudgment({
        prompt: "return json",
        outputSchema: z.object({ value: z.string() }),
        label: "test-judgment",
        onError: "fallback",
        fallbackValue: { value: "fallback" },
        usageLedger: { record },
      }),
    ).resolves.toEqual({ value: "fallback" });

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "test-judgment",
        status: "empty",
        model: "gemini-test-model",
        costUsdMicros: 55,
      }),
    );
  });

  it("records aborted usage and does not return a result when the signal aborts after provider output", async () => {
    const controller = new AbortController();
    const record = vi.fn<(event: LLMJudgmentUsageRecord) => Promise<void>>().mockResolvedValue();
    executeStructuredGenerationWithUsage.mockImplementationOnce(() => {
      controller.abort();
      return Promise.resolve(generationResult(JSON.stringify({ value: "late" })));
    });
    const { executeJudgment } = await import("@/app/server/ai-generation/judgment");

    await expect(
      executeJudgment({
        prompt: "return a value",
        outputSchema: z.object({ value: z.string() }),
        label: "test-judgment",
        signal: controller.signal,
        usageLedger: { record },
      }),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "test-judgment",
        status: "aborted",
        model: "gemini-test-model",
        costUsdMicros: 55,
      }),
    );
    expect(observe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "test-judgment",
        status: "fail",
      }),
    );
  });
});
