import { describe, expect, it, vi } from "vitest";
import { createRepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";
import { insertLlmUsageEventUnchecked } from "../llm-usage-events";

function createDbForInsert(error: Error | null = null) {
  const insert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn(() => ({ insert }));
  const schema = vi.fn(() => ({ from }));
  return {
    db: createRepositoryDbHandle({ schema } as never),
    spies: { schema, from, insert },
  };
}

describe("llm usage events repository", () => {
  it("inserts billing metadata without prompt or output content", async () => {
    const { db, spies } = createDbForInsert();

    await insertLlmUsageEventUnchecked(db, {
      ownerPrincipalId: "principal-1",
      action: "route-ai-comment-generation",
      status: "success",
      model: "gemini-3.1-flash-lite",
      inputTokens: 100.9,
      outputTokens: 20,
      totalTokens: 120,
      reasoningTokens: 0,
      cachedInputTokens: 0,
      costUsdMicros: 55,
      priced: true,
      usageMeasured: true,
      durationMs: 250,
      metadata: { snapshotId: "search-1" },
    });

    expect(spies.schema).toHaveBeenCalledWith("lighthouse");
    expect(spies.from).toHaveBeenCalledWith("llm_usage_events");
    expect(spies.insert).toHaveBeenCalledWith({
      owner_principal_id: "principal-1",
      action: "route-ai-comment-generation",
      status: "success",
      model: "gemini-3.1-flash-lite",
      input_tokens: 100,
      output_tokens: 20,
      total_tokens: 120,
      reasoning_tokens: 0,
      cached_input_tokens: 0,
      cost_usd_micros: 55,
      priced: true,
      usage_measured: true,
      duration_ms: 250,
      metadata: { snapshotId: "search-1" },
    });
  });

  it("throws when insert fails", async () => {
    const failure = new Error("insert failed");
    const { db } = createDbForInsert(failure);

    await expect(
      insertLlmUsageEventUnchecked(db, {
        action: "route-ai-comment-generation",
        status: "aborted",
        model: "gemini-3.1-flash-lite",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        reasoningTokens: 0,
        cachedInputTokens: 0,
        costUsdMicros: null,
        priced: false,
        usageMeasured: false,
      }),
    ).rejects.toThrow("insert failed");
  });
});
