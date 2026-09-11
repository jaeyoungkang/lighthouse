import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { INLINE_ANALYSIS_VERSION, type AIAnalysis } from "@/app/domain/analysis";
import { resolveInlineAnalysis } from "@/app/server/domain-access/inline-analysis-access";
import { buildInlineAnalysisRequestKey } from "@/app/server/domain-access/inline-analysis-identity";
import type { RepositoryDbHandle } from "@/app/server/repository/db";
import type { PaperInlineAnalysisIdentity } from "@/app/server/repository/paper-inline-analysis-cache";
import type { PaperInput } from "@/app/server/services/inline-analysis-service";

const requireOwnerPrincipalAuth = vi.hoisted(() => vi.fn());
const createUsageLedger = vi.hoisted(() => vi.fn(() => ({ record: vi.fn() })));

vi.mock("@/app/server/auth/identity", () => ({
  requireOwnerPrincipalAuth,
}));

vi.mock("@/app/server/domain-access/llm-usage-access", () => ({
  createLlmJudgmentUsageLedgerForTrustedAgent: createUsageLedger,
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
  evidenceMap: {
    claim: "claim",
  },
};

function input(paperId: string): PaperInput {
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

function cacheRecord(paperId: string) {
  return {
    paperId,
    version: INLINE_ANALYSIS_VERSION,
    inputFingerprint: "a".repeat(64),
    analysis,
    source: "abstract" as const,
    createdAt: "2026-07-13T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z",
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
  createUsageLedger.mockClear();
  requireOwnerPrincipalAuth.mockResolvedValue({
    db: { source: "owner-db" },
    user: { id: "user-1", email: "user@example.com" },
  });
});

describe("shared inline analysis request identity", () => {
  it("uses locale-independent lexical ordering for the request key", () => {
    const fingerprint = "a".repeat(64);
    const identities = [
      { paperId: "ä", version: INLINE_ANALYSIS_VERSION, inputFingerprint: fingerprint },
      { paperId: "z", version: INLINE_ANALYSIS_VERSION, inputFingerprint: fingerprint },
    ];

    expect(buildInlineAnalysisRequestKey(identities)).toBe(
      JSON.stringify([
        ["z", INLINE_ANALYSIS_VERSION, fingerprint],
        ["ä", INLINE_ANALYSIS_VERSION, fingerprint],
      ]),
    );
    expect(buildInlineAnalysisRequestKey([...identities].reverse())).toBe(
      buildInlineAnalysisRequestKey(identities),
    );
  });

  it("uses the complete identity tuple as an order-independent tie-breaker", () => {
    const identities = [
      {
        paperId: "paper-1",
        version: INLINE_ANALYSIS_VERSION + 1,
        inputFingerprint: "b".repeat(64),
      },
      { paperId: "paper-1", version: INLINE_ANALYSIS_VERSION, inputFingerprint: "c".repeat(64) },
      { paperId: "paper-1", version: INLINE_ANALYSIS_VERSION, inputFingerprint: "a".repeat(64) },
    ];

    expect(buildInlineAnalysisRequestKey([...identities].reverse())).toBe(
      buildInlineAnalysisRequestKey(identities),
    );
    expect(buildInlineAnalysisRequestKey(identities)).toBe(
      JSON.stringify([
        ["paper-1", INLINE_ANALYSIS_VERSION, "a".repeat(64)],
        ["paper-1", INLINE_ANALYSIS_VERSION, "c".repeat(64)],
        ["paper-1", INLINE_ANALYSIS_VERSION + 1, "b".repeat(64)],
      ]),
    );
  });

  it("does not coalesce structurally different identities containing delimiters", async () => {
    const fingerprintA = createHash("sha256")
      .update(JSON.stringify({ title: "Paper a", abstract: "Abstract a", year: 2024 }))
      .digest("hex");
    const collidingPaperId = `a:${String(INLINE_ANALYSIS_VERSION)}:${fingerprintA}|b`;
    const listCachedInlineAnalyses = vi.fn().mockResolvedValue(new Map());
    const claimInlineAnalysisGeneration = vi
      .fn<
        (
          db: RepositoryDbHandle,
          entries: PaperInlineAnalysisIdentity[],
          leaseToken: string,
        ) => Promise<Set<string>>
      >()
      .mockImplementation((_db, entries) =>
        Promise.resolve(new Set(entries.map((entry) => entry.paperId))),
      );
    const resolvers: Array<() => void> = [];
    const analyzePapersInline = vi.fn(
      (papers: PaperInput[]) =>
        new Promise<Array<{ paperId: string; analysis: AIAnalysis; source: "abstract" }>>(
          (resolve) => {
            resolvers.push(() => {
              resolve([{ paperId: papers[0].paperId, analysis, source: "abstract" }]);
            });
          },
        ),
    );
    const completeInlineAnalysisGeneration = vi
      .fn<
        (
          db: RepositoryDbHandle,
          entries: PaperInlineAnalysisIdentity[],
          leaseToken: string,
        ) => Promise<Set<string>>
      >()
      .mockImplementation((_db, entries) =>
        Promise.resolve(new Set(entries.map((entry) => entry.paperId))),
      );
    const releaseInlineAnalysisGeneration = vi.fn(releaseClaimedIdentities);
    const deps = {
      listCachedInlineAnalyses,
      claimInlineAnalysisGeneration,
      analyzePapersInline,
      completeInlineAnalysisGeneration,
      releaseInlineAnalysisGeneration,
    };

    const first = resolveInlineAnalysis({ papers: [input("a"), input("b")] }, deps);
    await vi.waitFor(() => {
      expect(analyzePapersInline).toHaveBeenCalledTimes(2);
    });
    const second = resolveInlineAnalysis(
      { papers: [{ ...input("b"), paperId: collidingPaperId }] },
      deps,
    );
    await vi.waitFor(() => {
      expect(analyzePapersInline).toHaveBeenCalledTimes(3);
    });
    resolvers.forEach((resolve) => {
      resolve();
    });

    await Promise.all([first, second]);
    expect(claimInlineAnalysisGeneration).toHaveBeenCalledTimes(2);
  });
});

describe("shared inline analysis waiter failure isolation", () => {
  it("rejects after the peer observation budget when the waiter fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T00:00:00.000Z"));
    const listCachedInlineAnalyses = vi.fn().mockResolvedValue(new Map());
    const claimInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(["paper-1"]));
    const analyzePapersInline = vi
      .fn()
      .mockResolvedValue([{ paperId: "paper-1", analysis, source: "abstract" as const }]);
    const completeInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(["paper-1"]));
    const releaseInlineAnalysisGeneration = vi.fn(releaseClaimedIdentities);
    const waitForCachedInlineAnalyses = vi.fn().mockRejectedValue(new Error("peer read failed"));

    try {
      const resultPromise = resolveInlineAnalysis(
        { papers: [input("paper-1"), input("paper-2")] },
        {
          listCachedInlineAnalyses,
          claimInlineAnalysisGeneration,
          analyzePapersInline,
          completeInlineAnalysisGeneration,
          releaseInlineAnalysisGeneration,
          waitForCachedInlineAnalyses,
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
    } finally {
      vi.useRealTimers();
    }
  });

  it("aborts and settles the peer waiter when owned completion fails", async () => {
    const listCachedInlineAnalyses = vi.fn().mockResolvedValue(new Map());
    const claimInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(["paper-1"]));
    const analyzePapersInline = vi
      .fn()
      .mockResolvedValue([{ paperId: "paper-1", analysis, source: "abstract" as const }]);
    const completeInlineAnalysisGeneration = vi
      .fn()
      .mockRejectedValue(new Error("completion failed"));
    const releaseInlineAnalysisGeneration = vi.fn(releaseClaimedIdentities);
    let waiterSignal: AbortSignal | undefined;
    const waitForCachedInlineAnalyses = vi.fn(
      (_db: RepositoryDbHandle, _entries: PaperInlineAnalysisIdentity[], signal?: AbortSignal) =>
        new Promise<Map<string, ReturnType<typeof cacheRecord>>>((resolve) => {
          waiterSignal = signal;
          signal?.addEventListener(
            "abort",
            () => {
              resolve(new Map());
            },
            { once: true },
          );
        }),
    );

    await expect(
      resolveInlineAnalysis(
        { papers: [input("paper-1"), input("paper-2")] },
        {
          listCachedInlineAnalyses,
          claimInlineAnalysisGeneration,
          analyzePapersInline,
          completeInlineAnalysisGeneration,
          releaseInlineAnalysisGeneration,
          waitForCachedInlineAnalyses,
        },
      ),
    ).rejects.toThrow("completion failed");

    expect(waiterSignal?.aborted).toBe(true);
    expect(waitForCachedInlineAnalyses).toHaveBeenCalledTimes(1);
  });
});

describe("shared inline analysis timing", () => {
  it("waits for a peer cache result within the thirty-second lease", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T00:00:00.000Z"));
    const startedAt = Date.now();
    const listCachedInlineAnalyses = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          Date.now() - startedAt >= 25_000
            ? new Map([["paper-1", cacheRecord("paper-1")]])
            : new Map(),
        ),
      );
    const analyzePapersInline = vi.fn();

    try {
      const resultPromise = resolveInlineAnalysis(
        { papers: [input("paper-1")] },
        {
          listCachedInlineAnalyses,
          claimInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set()),
          analyzePapersInline,
          completeInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set()),
          releaseInlineAnalysisGeneration: vi.fn(releaseClaimedIdentities),
        },
      );
      await vi.advanceTimersByTimeAsync(29_750);

      await expect(resultPromise).resolves.toEqual([
        expect.objectContaining({ paperId: "paper-1", analysis }),
      ]);
      expect(analyzePapersInline).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses elapsed wall time instead of sleep totals to bound slow cache polling", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T00:00:00.000Z"));
    const listCachedInlineAnalyses = vi.fn(
      () =>
        new Promise<Map<string, ReturnType<typeof cacheRecord>>>((resolve) => {
          setTimeout(() => {
            resolve(new Map());
          }, 4_000);
        }),
    );

    try {
      const resultPromise = resolveInlineAnalysis(
        { papers: [input("paper-1")] },
        {
          listCachedInlineAnalyses,
          claimInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set()),
          analyzePapersInline: vi.fn(),
          completeInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set()),
          releaseInlineAnalysisGeneration: vi.fn(releaseClaimedIdentities),
        },
      );
      const rejection = resultPromise.catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(30_000);

      await expect(rejection).resolves.toMatchObject({ name: "TimeoutError" });
      expect(listCachedInlineAnalyses.mock.calls.length).toBeGreaterThan(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fences the owner deadline instead of releasing it for automatic retry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T00:00:00.000Z"));
    const listCachedInlineAnalyses = vi.fn(
      () =>
        new Promise<Map<string, ReturnType<typeof cacheRecord>>>((resolve) => {
          setTimeout(() => {
            resolve(new Map());
          }, 8_000);
        }),
    );
    const claimInlineAnalysisGeneration = vi
      .fn<
        (
          db: RepositoryDbHandle,
          entries: PaperInlineAnalysisIdentity[],
          leaseToken: string,
          leaseSeconds?: number,
        ) => Promise<Set<string>>
      >()
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve(new Set(["paper-1"]));
            }, 8_000);
          }),
      );
    const analyzePapersInline = vi.fn(
      (_papers: PaperInput[], options?: { signal?: AbortSignal }) =>
        new Promise<Array<{ paperId: string; analysis: AIAnalysis; source: "abstract" }>>(
          (resolve) => {
            options?.signal?.addEventListener(
              "abort",
              () => {
                resolve([]);
              },
              { once: true },
            );
          },
        ),
    );
    const completeInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(["paper-1"]));
    const releaseInlineAnalysisGeneration = vi.fn(releaseClaimedIdentities);
    const failInlineAnalysisGeneration = vi
      .fn()
      .mockImplementation((_db: RepositoryDbHandle, entries: PaperInlineAnalysisIdentity[]) =>
        Promise.resolve(
          new Map(
            entries.map((entry) => [
              entry.paperId,
              {
                ...entry,
                failureCount: 1,
                cooldownUntil: new Date(Date.now() + 300_000).toISOString(),
                retryRequiresExplicit: true,
              },
            ]),
          ),
        ),
      );

    try {
      const resultPromise = resolveInlineAnalysis(
        { papers: [input("paper-1")] },
        {
          listCachedInlineAnalyses,
          claimInlineAnalysisGeneration,
          analyzePapersInline,
          completeInlineAnalysisGeneration,
          releaseInlineAnalysisGeneration,
          failInlineAnalysisGeneration,
        },
      );
      let settled = false;
      void resultPromise.then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(23_999);

      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await expect(resultPromise).resolves.toEqual([
        expect.objectContaining({ paperId: "paper-1", failureKind: "cooldown" }),
      ]);
      expect(claimInlineAnalysisGeneration).toHaveBeenCalledTimes(1);
      expect(claimInlineAnalysisGeneration.mock.calls[0]?.[3]).toBe(30);
      expect(completeInlineAnalysisGeneration).not.toHaveBeenCalled();
      expect(failInlineAnalysisGeneration).toHaveBeenCalledTimes(1);
      expect(releaseInlineAnalysisGeneration).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("shared inline analysis peer lease", () => {
  it("waits through the peer lease instead of returning a partial successful response", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T00:00:00.000Z"));
    const startedAt = Date.now();
    const listCachedInlineAnalyses = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          Date.now() - startedAt >= 25_000
            ? new Map([["paper-2", cacheRecord("paper-2")]])
            : new Map(),
        ),
      );

    try {
      const resultPromise = resolveInlineAnalysis(
        { papers: [input("paper-1"), input("paper-2")] },
        {
          listCachedInlineAnalyses,
          claimInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set(["paper-1"])),
          analyzePapersInline: vi
            .fn()
            .mockResolvedValue([{ paperId: "paper-1", analysis, source: "abstract" }]),
          completeInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set(["paper-1"])),
          releaseInlineAnalysisGeneration: vi.fn(releaseClaimedIdentities),
        },
      );
      let settled = false;
      void resultPromise.then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(29_499);

      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(251);
      await expect(resultPromise).resolves.toEqual([
        expect.objectContaining({ paperId: "paper-1", analysis }),
        expect.objectContaining({ paperId: "paper-2", analysis }),
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails instead of returning partial when a delayed claim pushes peer observation past the route deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T00:00:00.000Z"));
    const delayedInitialRead = vi.fn(
      () =>
        new Promise<Map<string, ReturnType<typeof cacheRecord>>>((resolve) => {
          setTimeout(() => {
            resolve(new Map());
          }, 10_000);
        }),
    );

    try {
      const resultPromise = resolveInlineAnalysis(
        { papers: [input("paper-1"), input("paper-2")] },
        {
          listCachedInlineAnalyses: delayedInitialRead,
          claimInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set(["paper-1"])),
          analyzePapersInline: vi
            .fn()
            .mockResolvedValue([{ paperId: "paper-1", analysis, source: "abstract" }]),
          completeInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set(["paper-1"])),
          releaseInlineAnalysisGeneration: vi.fn(releaseClaimedIdentities),
          waitForCachedInlineAnalyses: vi.fn().mockRejectedValue(new Error("peer read failed")),
        },
      );
      const rejection = resultPromise.catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(30_000);

      await expect(rejection).resolves.toMatchObject({ name: "TimeoutError" });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("shared inline analysis route-entry deadline", () => {
  it("aborts a stalled cache RPC at the caller's absolute deadline", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T00:00:00.000Z"));
    let observedSignal: AbortSignal | undefined;
    const listCachedInlineAnalyses = vi.fn(
      (_db: RepositoryDbHandle, _entries: PaperInlineAnalysisIdentity[], signal?: AbortSignal) =>
        new Promise<Map<string, ReturnType<typeof cacheRecord>>>((_resolve, reject) => {
          observedSignal = signal;
          signal?.addEventListener(
            "abort",
            () => {
              const reason: unknown = signal.reason;
              const error = new Error("route deadline aborted cache RPC", {
                cause: reason,
              });
              error.name =
                typeof reason === "object" &&
                reason !== null &&
                "name" in reason &&
                typeof reason.name === "string"
                  ? reason.name
                  : "AbortError";
              reject(error);
            },
            { once: true },
          );
        }),
    );

    try {
      const resultPromise = resolveInlineAnalysis(
        { papers: [input("paper-1")], deadlineAt: Date.now() + 1_000 },
        { listCachedInlineAnalyses },
      );
      const rejection = resultPromise.catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(1_000);

      await expect(rejection).resolves.toMatchObject({ name: "TimeoutError" });
      expect(observedSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
