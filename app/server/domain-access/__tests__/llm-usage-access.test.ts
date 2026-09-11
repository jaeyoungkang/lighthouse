import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedUsage } from "@/app/server/ai-generation/usage";
import type { RecordLlmUsageEventForTrustedAgentParams } from "@/app/server/domain-access/llm-usage-access";
import type { RepositoryDbHandle } from "@/app/server/repository/db";
import type { InsertLlmUsageEventUncheckedParams } from "@/app/server/repository/llm-usage-events";

const insertLlmUsageEventUnchecked = vi.hoisted(() =>
  vi.fn<(db: RepositoryDbHandle, params: InsertLlmUsageEventUncheckedParams) => Promise<void>>(),
);
const logWarn = vi.hoisted(() => vi.fn());

vi.mock("@/app/server/repository/llm-usage-events", () => ({
  insertLlmUsageEventUnchecked,
}));

vi.mock("@/app/lib/runtime-log", () => ({
  logWarn,
}));

const usage: NormalizedUsage = {
  inputTokens: 100,
  outputTokens: 20,
  totalTokens: 120,
  reasoningTokens: 0,
  cachedInputTokens: 0,
};

describe("llm usage access", () => {
  beforeEach(() => {
    insertLlmUsageEventUnchecked.mockReset();
    insertLlmUsageEventUnchecked.mockResolvedValue(undefined);
    logWarn.mockReset();
  });

  it("allowlists short metadata and keeps prompt/output content out of usage rows", async () => {
    const { recordLlmUsageEventBestEffortForTrustedAgent } = await import("../llm-usage-access");
    const unsafeMetadata = {
      snapshotId: ` ${"x".repeat(250)} `,
      snapshotKind: " search ",
      trigger: " user_search ",
      responseLength: 400.8,
      promptBytes: 13_702.9,
      maxInputBytes: 65_536,
      maxOutputTokens: 768,
      timeoutMs: 10_000,
      phase: " initial ",
      paperCount: 12.9,
      promptChars: 4567.2,
      promptPaperLimit: 12,
      promptAbstractChars: 300,
      mode: " llm_compact ",
      prompt: "raw prompt",
      output: "generated answer",
    } as unknown as RecordLlmUsageEventForTrustedAgentParams["metadata"];

    await recordLlmUsageEventBestEffortForTrustedAgent({
      db: {} as RepositoryDbHandle,
      ownerPrincipalId: "principal-1",
      action: "route-ai-comment-generation",
      status: "success",
      model: "gemini-3.1-flash-lite",
      usage,
      costUsdMicros: 55,
      priced: true,
      durationMs: 250,
      metadata: unsafeMetadata,
    });

    expect(insertLlmUsageEventUnchecked).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: {
          snapshotId: "x".repeat(200),
          snapshotKind: "search",
          trigger: "user_search",
          responseLength: 400,
          promptBytes: 13_702,
          maxInputBytes: 65_536,
          maxOutputTokens: 768,
          timeoutMs: 10_000,
          phase: "initial",
          paperCount: 12,
          promptChars: 4567,
          promptPaperLimit: 12,
          promptAbstractChars: 300,
          mode: "llm_compact",
        },
      }),
    );
    const metadata = insertLlmUsageEventUnchecked.mock.calls[0]?.[1].metadata;
    expect(metadata).not.toHaveProperty("prompt");
    expect(metadata).not.toHaveProperty("output");
  });

  it("logs and swallows usage insert failures for best-effort recording", async () => {
    const { recordLlmUsageEventBestEffortForTrustedAgent } = await import("../llm-usage-access");
    insertLlmUsageEventUnchecked.mockRejectedValueOnce(new Error("db unavailable"));

    await expect(
      recordLlmUsageEventBestEffortForTrustedAgent({
        db: {} as RepositoryDbHandle,
        ownerPrincipalId: "principal-1",
        action: "route-ai-comment-generation",
        status: "empty",
        model: "gemini-3.1-flash-lite",
        usage,
        costUsdMicros: null,
        priced: false,
      }),
    ).resolves.toBeUndefined();

    expect(logWarn).toHaveBeenCalledWith(
      "llm-usage-events",
      "usage event insert failed",
      expect.objectContaining({
        ownerPrincipalId: "principal-1",
        action: "route-ai-comment-generation",
        model: "gemini-3.1-flash-lite",
        error: "db unavailable",
      }),
    );
  });

  it("creates an executeJudgment usage ledger backed by the trusted usage recorder", async () => {
    const { createLlmJudgmentUsageLedgerForTrustedAgent } = await import("../llm-usage-access");
    const ledger = createLlmJudgmentUsageLedgerForTrustedAgent({
      db: {} as RepositoryDbHandle,
      ownerPrincipalId: "principal-1",
    });

    await ledger.record({
      action: "analyze-paper-batch",
      status: "success",
      model: "gemini-3.1-flash",
      usage,
      costUsdMicros: 55,
      priced: true,
      durationMs: 300,
      metadata: {
        responseLength: 1200,
        timeoutMs: 10_000,
      },
    });

    expect(insertLlmUsageEventUnchecked).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        ownerPrincipalId: "principal-1",
        action: "analyze-paper-batch",
        status: "success",
        model: "gemini-3.1-flash",
        durationMs: 300,
        metadata: {
          responseLength: 1200,
          timeoutMs: 10_000,
        },
      }),
    );
  });
});
