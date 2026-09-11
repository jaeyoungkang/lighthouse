import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIAnalysis } from "@/app/domain/analysis";
import { resolveInlineAnalysis } from "@/app/server/domain-access/inline-analysis-access";
import type { RepositoryDbHandle } from "@/app/server/repository/db";
import type { PaperInlineAnalysisIdentity } from "@/app/server/repository/paper-inline-analysis-cache";
import type {
  InlineAnalysisResult,
  PaperInput,
} from "@/app/server/services/inline-analysis-service";

const requireOwnerPrincipalAuth = vi.hoisted(() => vi.fn());

vi.mock("@/app/server/auth/identity", () => ({
  requireOwnerPrincipalAuth,
}));

vi.mock("@/app/server/domain-access/llm-usage-access", () => ({
  createLlmJudgmentUsageLedgerForTrustedAgent: vi.fn(() => ({ record: vi.fn() })),
}));

const analysis: AIAnalysis = {
  summary: "summary",
  objective: "objective",
  methodology: "methodology",
  results: "results",
  keywords: ["topic"],
  semanticProfile: {
    claim: "claim",
    topics: ["topic"],
    method: "method",
    finding: "finding",
    quotedBasis: {
      claim: "claim",
      topics: ["topic"],
      method: "method",
      finding: "finding",
    },
  },
  confidence: "medium",
  evidenceMap: { claim: "claim" },
};

function input(paperId = "paper-1"): PaperInput {
  return {
    paperId,
    title: `Paper ${paperId}`,
    abstract: `Abstract ${paperId}`,
    year: 2024,
    citationCount: 10,
    url: `https://example.com/${paperId}`,
    authors: ["Author 1"],
  };
}

function releaseClaimedIdentities(
  _db: RepositoryDbHandle,
  entries: PaperInlineAnalysisIdentity[],
): Promise<Set<string>> {
  return Promise.resolve(new Set(entries.map((entry) => entry.paperId)));
}

beforeEach(() => {
  requireOwnerPrincipalAuth.mockReset();
  requireOwnerPrincipalAuth.mockResolvedValue({
    db: { source: "owner-db" },
    user: { id: "user-1", email: "user@example.com" },
  });
});

describe("shared inline analysis cancellation cleanup", () => {
  it("releases an owned lease with an independent signal after the last subscriber aborts", async () => {
    const controller = new AbortController();
    const analyzePapersInline = vi.fn(
      (_papers: PaperInput[], options?: { signal?: AbortSignal }) =>
        new Promise<InlineAnalysisResult[]>((resolve) => {
          options?.signal?.addEventListener(
            "abort",
            () => {
              resolve([]);
            },
            { once: true },
          );
        }),
    );
    let cleanupSignal: AbortSignal | undefined;
    const releaseInlineAnalysisGeneration = vi.fn(
      (
        _db: RepositoryDbHandle,
        _entries: PaperInlineAnalysisIdentity[],
        _leaseToken: string,
        signal?: AbortSignal,
      ) => {
        cleanupSignal = signal;
        return Promise.resolve(new Set(_entries.map((entry) => entry.paperId)));
      },
    );
    const resultPromise = resolveInlineAnalysis(
      { papers: [input()], signal: controller.signal },
      {
        listCachedInlineAnalyses: vi.fn().mockResolvedValue(new Map()),
        claimInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set(["paper-1"])),
        analyzePapersInline,
        completeInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set()),
        releaseInlineAnalysisGeneration,
      },
    );
    const rejection = resultPromise.catch((error: unknown) => error);
    await vi.waitFor(() => {
      expect(analyzePapersInline).toHaveBeenCalledTimes(1);
    });
    controller.abort(new DOMException("caller navigated away", "AbortError"));

    await expect(rejection).resolves.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => {
      expect(releaseInlineAnalysisGeneration).toHaveBeenCalledTimes(1);
    });
    expect(cleanupSignal?.aborted).toBe(false);
  });

  it("aborts a hanging independent cleanup after 1.5 seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T00:00:00.000Z"));
    const controller = new AbortController();
    let cleanupSignal: AbortSignal | undefined;
    let observeCleanupAbort: Promise<void> | undefined;
    const analyzePapersInline = vi.fn(
      (_papers: PaperInput[], options?: { signal?: AbortSignal }) =>
        new Promise<InlineAnalysisResult[]>((resolve) => {
          options?.signal?.addEventListener(
            "abort",
            () => {
              resolve([]);
            },
            { once: true },
          );
        }),
    );
    const releaseInlineAnalysisGeneration = vi.fn(
      (
        _db: RepositoryDbHandle,
        _entries: PaperInlineAnalysisIdentity[],
        _leaseToken: string,
        signal?: AbortSignal,
      ) => {
        cleanupSignal = signal;
        observeCleanupAbort = new Promise<void>((resolve) => {
          signal?.addEventListener(
            "abort",
            () => {
              resolve();
            },
            { once: true },
          );
        });
        return observeCleanupAbort.then(() => {
          throw new Error("cleanup signal aborted");
        });
      },
    );

    try {
      const resultPromise = resolveInlineAnalysis(
        { papers: [input()], signal: controller.signal },
        {
          listCachedInlineAnalyses: vi.fn().mockResolvedValue(new Map()),
          claimInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set(["paper-1"])),
          analyzePapersInline,
          completeInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set()),
          releaseInlineAnalysisGeneration,
        },
      );
      const rejection = resultPromise.catch((error: unknown) => error);
      await vi.waitFor(() => {
        expect(analyzePapersInline).toHaveBeenCalledTimes(1);
      });
      controller.abort(new DOMException("caller navigated away", "AbortError"));
      await expect(rejection).resolves.toMatchObject({ name: "AbortError" });
      await vi.advanceTimersByTimeAsync(0);
      expect(releaseInlineAnalysisGeneration).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1_499);
      expect(cleanupSignal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(observeCleanupAbort).resolves.toBeUndefined();
      expect(cleanupSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("terminal-fences an omitted claimed identity instead of releasing it", async () => {
    const releaseInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set<string>());
    const terminalFailInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(["paper-1"]));

    await expect(
      resolveInlineAnalysis(
        { papers: [input()] },
        {
          listCachedInlineAnalyses: vi.fn().mockResolvedValue(new Map()),
          claimInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set(["paper-1"])),
          analyzePapersInline: vi.fn().mockResolvedValue([]),
          completeInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set()),
          releaseInlineAnalysisGeneration,
          terminalFailInlineAnalysisGeneration,
        },
      ),
    ).resolves.toEqual([expect.objectContaining({ paperId: "paper-1", failureKind: "terminal" })]);

    expect(terminalFailInlineAnalysisGeneration).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({ paperId: "paper-1" })],
      expect.any(String),
      "terminal_generation_failure",
      expect.any(AbortSignal),
    );
    expect(releaseInlineAnalysisGeneration).not.toHaveBeenCalled();
  });

  it("terminal-fences every omitted identity without partial release", async () => {
    const releaseInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(["paper-1"]));
    const terminalFailInlineAnalysisGeneration = vi
      .fn()
      .mockResolvedValue(new Set(["paper-1", "paper-2"]));

    await expect(
      resolveInlineAnalysis(
        { papers: [input("paper-1"), input("paper-2")] },
        {
          listCachedInlineAnalyses: vi.fn().mockResolvedValue(new Map()),
          claimInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set(["paper-1", "paper-2"])),
          analyzePapersInline: vi.fn().mockResolvedValue([]),
          completeInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set()),
          releaseInlineAnalysisGeneration,
          terminalFailInlineAnalysisGeneration,
        },
      ),
    ).resolves.toEqual([
      expect.objectContaining({ paperId: "paper-1", failureKind: "terminal" }),
      expect.objectContaining({ paperId: "paper-2", failureKind: "terminal" }),
    ]);

    expect(terminalFailInlineAnalysisGeneration).toHaveBeenCalledTimes(2);
    expect(releaseInlineAnalysisGeneration).not.toHaveBeenCalled();
  });

  it("keeps the pending fence when terminal persistence is not confirmed", async () => {
    const releaseInlineAnalysisGeneration = vi.fn();

    await expect(
      resolveInlineAnalysis(
        { papers: [input()] },
        {
          listCachedInlineAnalyses: vi.fn().mockResolvedValue(new Map()),
          claimInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set(["paper-1"])),
          analyzePapersInline: vi.fn().mockResolvedValue([]),
          completeInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set()),
          releaseInlineAnalysisGeneration,
          terminalFailInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set()),
        },
      ),
    ).rejects.toThrow("Failed to persist terminal inline analysis failure");

    expect(releaseInlineAnalysisGeneration).not.toHaveBeenCalled();
  });

  it("requires explicit retry before reclaiming an expired pending lease", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "supabase/migrations/00024_inline_analysis_failure_fence.sql"),
      "utf8",
    );

    expect(sql).toMatch(
      /status = 'pending'[\s\S]*?lease_expires_at <= now\(\)[\s\S]*?p_retry_command = 'explicit_retry'/,
    );
  });
});

describe("shared inline analysis peer rejection handling", () => {
  it("handles an earlier peer rejection while owner generation is still settling", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T00:00:00.000Z"));
    const claimInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(["paper-1"]));
    const analyzePapersInline = vi.fn(
      () =>
        new Promise<InlineAnalysisResult[]>((resolve) => {
          setTimeout(() => {
            resolve([{ paperId: "paper-1", analysis, source: "abstract" }]);
          }, 52_000);
        }),
    );

    try {
      const resultPromise = resolveInlineAnalysis(
        { papers: [input("paper-1"), input("paper-2")] },
        {
          listCachedInlineAnalyses: vi.fn().mockResolvedValue(new Map()),
          claimInlineAnalysisGeneration,
          analyzePapersInline,
          completeInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set(["paper-1"])),
          releaseInlineAnalysisGeneration: vi.fn(releaseClaimedIdentities),
          waitForCachedInlineAnalyses: vi.fn().mockRejectedValue(new Error("peer read failed")),
        },
      );
      const rejection = resultPromise.catch((error: unknown) => error);
      let settled = false;
      void rejection.then(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(29_999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(rejection).resolves.toMatchObject({ name: "TimeoutError" });
      expect(claimInlineAnalysisGeneration).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
