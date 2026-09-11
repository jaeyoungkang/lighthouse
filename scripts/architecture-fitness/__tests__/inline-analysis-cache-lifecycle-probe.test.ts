import { beforeEach, describe, expect, it, vi } from "vitest";

const requireOwnerPrincipalAuth = vi.hoisted(() => vi.fn());
const createUsageLedger = vi.hoisted(() => vi.fn(() => ({ record: vi.fn() })));

vi.mock("@/app/server/auth/identity", () => ({ requireOwnerPrincipalAuth }));
vi.mock("@/app/server/domain-access/llm-usage-access", () => ({
  createLlmJudgmentUsageLedgerForTrustedAgent: createUsageLedger,
}));

import { INLINE_ANALYSIS_VERSION, type AIAnalysis } from "@/app/domain/analysis";
import {
  buildInlineAnalysisCacheIdentities,
  buildInlineAnalysisInputFingerprint,
} from "@/app/server/domain-access/inline-analysis-identity";
import { resolveInlineAnalysis } from "@/app/server/domain-access/inline-analysis-access";
import type { RepositoryDbHandle } from "@/app/server/repository/db";
import type {
  PaperInlineAnalysisCacheRecord,
  PaperInlineAnalysisGenerationState,
  PaperInlineAnalysisIdentity,
} from "@/app/server/repository/paper-inline-analysis-cache";
import type { PaperInput } from "@/app/server/services/inline-analysis-service";

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

function input(overrides: Partial<PaperInput> = {}): PaperInput {
  return {
    paperId: "paper-1",
    title: "Paper One",
    abstract: "Abstract One",
    year: 2024,
    citationCount: 10,
    url: "https://example.com/paper-1",
    authors: ["Author One"],
    ...overrides,
  };
}

function cacheRecord(paper: PaperInput): PaperInlineAnalysisCacheRecord {
  const [identity] = buildInlineAnalysisCacheIdentities([paper]);
  return {
    ...identity,
    analysis,
    source: "abstract",
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
  };
}

function releaseAll(
  _db: RepositoryDbHandle,
  entries: PaperInlineAnalysisIdentity[],
): Promise<Set<string>> {
  return Promise.resolve(new Set(entries.map((entry) => entry.paperId)));
}

function successfulDeps(overrides: Record<string, unknown> = {}) {
  return {
    listCachedInlineAnalyses: vi.fn().mockResolvedValue(new Map()),
    listInlineAnalysisGenerationStates: vi.fn().mockResolvedValue(new Map()),
    claimInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set(["paper-1"])),
    analyzePapersInline: vi
      .fn()
      .mockResolvedValue([{ paperId: "paper-1", analysis, source: "abstract" as const }]),
    completeInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set(["paper-1"])),
    releaseInlineAnalysisGeneration: vi.fn(releaseAll),
    ...overrides,
  };
}

beforeEach(() => {
  requireOwnerPrincipalAuth.mockReset();
  createUsageLedger.mockClear();
  requireOwnerPrincipalAuth.mockResolvedValue({
    db: { source: "inline-analysis-probe" },
    user: { id: "probe-user", email: "probe@example.com" },
  });
});

describe("inline-analysis cache-lifecycle exact-revision probe", () => {
  it("normalizes canonical input and separates content, year, and version identity", () => {
    const canonical = input();
    const whitespace = input({ title: "  Paper   One ", abstract: "Abstract\nOne" });
    const changedContent = input({ abstract: "Changed abstract" });
    const changedYear = input({ year: 2025 });

    expect(buildInlineAnalysisInputFingerprint(whitespace)).toBe(
      buildInlineAnalysisInputFingerprint(canonical),
    );
    expect(buildInlineAnalysisInputFingerprint(changedContent)).not.toBe(
      buildInlineAnalysisInputFingerprint(canonical),
    );
    expect(buildInlineAnalysisInputFingerprint(changedYear)).not.toBe(
      buildInlineAnalysisInputFingerprint(canonical),
    );
    expect(buildInlineAnalysisCacheIdentities([canonical])).toEqual([
      {
        paperId: "paper-1",
        version: INLINE_ANALYSIS_VERSION,
        inputFingerprint: buildInlineAnalysisInputFingerprint(canonical),
      },
    ]);
  });

  it("reuses a ready hit and claims a miss before provider execution", async () => {
    const paper = input();
    const ready = cacheRecord(paper);
    const hitDeps = successfulDeps({
      listCachedInlineAnalyses: vi.fn().mockResolvedValue(new Map([[paper.paperId, ready]])),
      claimInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set()),
    });

    await expect(resolveInlineAnalysis({ papers: [paper] }, hitDeps)).resolves.toEqual([
      expect.objectContaining({ paperId: "paper-1", analysis }),
    ]);
    expect(hitDeps.analyzePapersInline).not.toHaveBeenCalled();
    expect(hitDeps.claimInlineAnalysisGeneration).toHaveBeenCalledWith(
      expect.anything(),
      [],
      expect.any(String),
      30,
      expect.any(AbortSignal),
      "automatic",
    );

    const order: string[] = [];
    const missDeps = successfulDeps({
      claimInlineAnalysisGeneration: vi.fn().mockImplementation(() => {
        order.push("claim");
        return Promise.resolve(new Set(["paper-1"]));
      }),
      analyzePapersInline: vi.fn().mockImplementation(() => {
        order.push("provider");
        return Promise.resolve([{ paperId: "paper-1", analysis, source: "abstract" as const }]);
      }),
    });

    await expect(
      resolveInlineAnalysis({ papers: [input({ abstract: "A changed miss" })] }, missDeps),
    ).resolves.toEqual([expect.objectContaining({ paperId: "paper-1", analysis })]);
    expect(order).toEqual(["claim", "provider"]);
    expect(missDeps.claimInlineAnalysisGeneration).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({ version: INLINE_ANALYSIS_VERSION })],
      expect.any(String),
      30,
      expect.any(AbortSignal),
      "automatic",
    );
  });

  it("keeps an unclaimed worker out of provider execution", async () => {
    const paper = input({ paperId: "paper-loser" });
    const ready = cacheRecord(paper);
    const waitForCachedInlineAnalyses = vi
      .fn()
      .mockResolvedValue(new Map([[paper.paperId, ready]]));
    const deps = successfulDeps({
      claimInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set()),
      waitForCachedInlineAnalyses,
    });

    await expect(resolveInlineAnalysis({ papers: [paper] }, deps)).resolves.toEqual([
      expect.objectContaining({ paperId: "paper-loser", analysis }),
    ]);
    expect(deps.analyzePapersInline).not.toHaveBeenCalled();
    expect(waitForCachedInlineAnalyses).toHaveBeenCalledOnce();
  });

  it("isolates one subscriber abort from shared process work", async () => {
    let completeProvider:
      | ((results: Array<{ paperId: string; analysis: AIAnalysis; source: "abstract" }>) => void)
      | undefined;
    let ownerSignal: AbortSignal | undefined;
    const deps = successfulDeps({
      analyzePapersInline: vi.fn((_papers: PaperInput[], options?: { signal?: AbortSignal }) => {
        ownerSignal = options?.signal;
        return new Promise<Array<{ paperId: string; analysis: AIAnalysis; source: "abstract" }>>(
          (resolve) => {
            completeProvider = resolve;
          },
        );
      }),
    });
    const firstController = new AbortController();
    const first = resolveInlineAnalysis(
      { papers: [input()], signal: firstController.signal },
      deps,
    );
    const firstResult = first.catch((error: unknown) => error);
    await vi.waitFor(() => {
      expect(deps.analyzePapersInline).toHaveBeenCalledOnce();
    });
    const second = resolveInlineAnalysis({ papers: [input()] }, deps);
    await vi.waitFor(() => {
      expect(requireOwnerPrincipalAuth).toHaveBeenCalledTimes(2);
    });

    firstController.abort(new DOMException("probe caller left", "AbortError"));
    await expect(firstResult).resolves.toMatchObject({ name: "AbortError" });
    expect(ownerSignal?.aborted).toBe(false);
    completeProvider?.([{ paperId: "paper-1", analysis, source: "abstract" }]);

    await expect(second).resolves.toEqual([
      expect.objectContaining({ paperId: "paper-1", analysis }),
    ]);
    expect(deps.claimInlineAnalysisGeneration).toHaveBeenCalledOnce();
    expect(deps.analyzePapersInline).toHaveBeenCalledOnce();
  });

  it("blocks automatic failed-state retry and allows explicit retry", async () => {
    const paper = input({ paperId: "paper-fenced" });
    const [identity] = buildInlineAnalysisCacheIdentities([paper]);
    const failedState: PaperInlineAnalysisGenerationState = {
      ...identity,
      status: "cooldown_failed",
      cooldownUntil: "2026-08-04T00:00:00.000Z",
      retryRequiresExplicit: true,
    };
    const listStates = vi.fn().mockResolvedValue(new Map([[paper.paperId, failedState]]));
    const automaticDeps = successfulDeps({
      listInlineAnalysisGenerationStates: listStates,
      claimInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set()),
    });

    await expect(resolveInlineAnalysis({ papers: [paper] }, automaticDeps)).resolves.toEqual([
      expect.objectContaining({
        paperId: "paper-fenced",
        status: "error",
        failureKind: "cooldown",
        retryRequiresExplicit: true,
      }),
    ]);
    expect(automaticDeps.analyzePapersInline).not.toHaveBeenCalled();
    expect(automaticDeps.claimInlineAnalysisGeneration).toHaveBeenCalledWith(
      expect.anything(),
      [],
      expect.any(String),
      30,
      expect.any(AbortSignal),
      "automatic",
    );

    const explicitDeps = successfulDeps({
      listInlineAnalysisGenerationStates: listStates,
      claimInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set(["paper-fenced"])),
      analyzePapersInline: vi
        .fn()
        .mockResolvedValue([{ paperId: "paper-fenced", analysis, source: "abstract" as const }]),
      completeInlineAnalysisGeneration: vi.fn().mockResolvedValue(new Set(["paper-fenced"])),
    });
    await expect(
      resolveInlineAnalysis({ papers: [paper], retryCommand: "explicit_retry" }, explicitDeps),
    ).resolves.toEqual([expect.objectContaining({ paperId: "paper-fenced", analysis })]);
    expect(explicitDeps.claimInlineAnalysisGeneration).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining(identity)],
      expect.any(String),
      30,
      expect.any(AbortSignal),
      "explicit_retry",
    );
    expect(explicitDeps.analyzePapersInline).toHaveBeenCalledOnce();
  });
});
