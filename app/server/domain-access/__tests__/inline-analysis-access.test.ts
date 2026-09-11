import { beforeEach, describe, expect, it, vi } from "vitest";
import { INLINE_ANALYSIS_VERSION, type AIAnalysis } from "@/app/domain/analysis";
import type { SearchMetadata } from "@/app/domain/research-route-payload";
import {
  hydrateSearchMetadataWithCachedInlineAnalysis,
  resolveInlineAnalysis,
} from "@/app/server/domain-access/inline-analysis-access";
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

const failureAnalysis: AIAnalysis = {
  ...analysis,
  confidence: "low",
  semanticProfile: {
    ...analysis.semanticProfile,
    claim: null,
    topics: [],
    method: null,
  },
};

function paper(
  overrides: Partial<SearchMetadata["papers"][number]> = {},
): SearchMetadata["papers"][number] {
  return {
    paperId: "paper-1",
    title: "Paper 1",
    abstract: "Paper 1 abstract",
    year: 2024,
    citationCount: 10,
    url: "https://example.com/paper-1",
    authors: [{ name: "Author 1" }],
    reviewed: false,
    ...overrides,
  };
}

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

function cacheRecord(
  paperId: string,
  cachedAnalysis = analysis,
  inputFingerprint = "a".repeat(64),
) {
  return {
    paperId,
    version: INLINE_ANALYSIS_VERSION,
    inputFingerprint,
    analysis: cachedAnalysis,
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

describe("inline analysis access", () => {
  it("hydrates search metadata with current shared cached analyses by paperId", async () => {
    const metadata: SearchMetadata = {
      type: "search",
      query: "agent science",
      papers: [paper(), paper({ paperId: "paper-2", abstract: null })],
      total: 2,
    };
    const listCachedInlineAnalyses = vi
      .fn()
      .mockResolvedValue(new Map([["paper-1", cacheRecord("paper-1")]]));

    const next = await hydrateSearchMetadataWithCachedInlineAnalysis(
      {
        db: { source: "shared-db" } as never,
        metadata,
      },
      { listCachedInlineAnalyses },
    );

    expect(listCachedInlineAnalyses).toHaveBeenCalledWith(
      { source: "shared-db" },
      [
        expect.objectContaining({
          paperId: "paper-1",
          version: INLINE_ANALYSIS_VERSION,
          inputFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/) as string,
        }),
      ],
      undefined,
    );
    const hydratedPaper = next.papers[0];
    if (!("inlineAnalysis" in hydratedPaper)) {
      throw new Error("expected hydrated inlineAnalysis");
    }

    expect(hydratedPaper.inlineAnalysis).toMatchObject({
      version: INLINE_ANALYSIS_VERSION,
      analysis,
      source: "abstract",
    });
    expect("inlineAnalysis" in next.papers[1]).toBe(false);
  });

  it("reuses shared cached results and only claims and analyzes missing papers", async () => {
    const listCachedInlineAnalyses = vi
      .fn()
      .mockResolvedValue(new Map([["paper-1", cacheRecord("paper-1")]]));
    const claimInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(["paper-2"]));
    const analyzePapersInline = vi.fn().mockResolvedValue([
      {
        paperId: "paper-2",
        analysis,
        source: "abstract" as const,
      },
    ]);
    const completeInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(["paper-2"]));
    const releaseInlineAnalysisGeneration = vi.fn(releaseClaimedIdentities);

    const results = await resolveInlineAnalysis(
      { papers: [input("paper-1"), input("paper-2")] },
      {
        listCachedInlineAnalyses,
        claimInlineAnalysisGeneration,
        analyzePapersInline,
        completeInlineAnalysisGeneration,
        releaseInlineAnalysisGeneration,
      },
    );

    expect(requireOwnerPrincipalAuth).toHaveBeenCalledWith();
    expect(createUsageLedger).toHaveBeenCalledOnce();
    expect(createUsageLedger).toHaveBeenCalledWith({
      db: { source: "owner-db" },
      ownerPrincipalId: "user-1",
    });
    expect(listCachedInlineAnalyses).toHaveBeenCalledWith(
      { source: "owner-db" },
      [
        expect.objectContaining({ paperId: "paper-1" }),
        expect.objectContaining({ paperId: "paper-2" }),
      ],
      expect.any(AbortSignal),
    );
    expect(claimInlineAnalysisGeneration).toHaveBeenCalledWith(
      { source: "owner-db" },
      [
        expect.objectContaining({
          paperId: "paper-2",
          version: INLINE_ANALYSIS_VERSION,
          inputFingerprint: expect.stringMatching(/^[0-9a-f]{64}$/) as string,
        }),
      ],
      expect.any(String),
      30,
      expect.any(AbortSignal),
      "automatic",
    );
    expect(analyzePapersInline).toHaveBeenCalledWith(
      [expect.objectContaining({ paperId: "paper-2" })],
      expect.anything(),
    );
    const analyzeOptions = analyzePapersInline.mock.calls[0]?.[1] as
      | { usageLedger?: { record?: unknown } }
      | undefined;
    expect(typeof analyzeOptions?.usageLedger?.record).toBe("function");
    expect(completeInlineAnalysisGeneration).toHaveBeenCalledWith(
      { source: "owner-db" },
      [
        expect.objectContaining({
          paperId: "paper-2",
          version: INLINE_ANALYSIS_VERSION,
          analysis,
          source: "abstract",
        }),
      ],
      expect.any(String),
      expect.any(AbortSignal),
    );
    expect(releaseInlineAnalysisGeneration).not.toHaveBeenCalled();
    expect(results.map((result) => result.paperId)).toEqual(["paper-1", "paper-2"]);
  });

  it("does not cache failure placeholders or release them into automatic retry", async () => {
    const listCachedInlineAnalyses = vi
      .fn()
      .mockResolvedValue(new Map([["paper-1", cacheRecord("paper-1", failureAnalysis)]]));
    const claimInlineAnalysisGeneration = vi
      .fn()
      .mockResolvedValue(new Set(["paper-1", "paper-2"]));
    const analyzePapersInline = vi.fn().mockImplementation((papers: PaperInput[]) =>
      Promise.resolve(
        papers.map((paper) => ({
          paperId: paper.paperId,
          analysis: paper.paperId === "paper-2" ? failureAnalysis : analysis,
          source: "abstract" as const,
        })),
      ),
    );
    const completeInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(["paper-1"]));
    const releaseInlineAnalysisGeneration = vi.fn(releaseClaimedIdentities);

    const results = await resolveInlineAnalysis(
      { papers: [input("paper-1"), input("paper-2")] },
      {
        listCachedInlineAnalyses,
        claimInlineAnalysisGeneration,
        analyzePapersInline,
        completeInlineAnalysisGeneration,
        releaseInlineAnalysisGeneration,
      },
    );

    expect(completeInlineAnalysisGeneration).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({ paperId: "paper-1", analysis })],
      expect.any(String),
      expect.any(AbortSignal),
    );
    expect(releaseInlineAnalysisGeneration).not.toHaveBeenCalled();
    expect(results).toEqual([
      expect.objectContaining({ paperId: "paper-1", analysis }),
      expect.objectContaining({ paperId: "paper-2", failureKind: "terminal" }),
    ]);
  });
});

describe("shared inline analysis coordination", () => {
  it("waits for another worker's shared result instead of generating a duplicate", async () => {
    const listCachedInlineAnalyses = vi.fn().mockResolvedValue(new Map());
    const claimInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set());
    const analyzePapersInline = vi.fn();
    const completeInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set());
    const releaseInlineAnalysisGeneration = vi.fn(releaseClaimedIdentities);
    const waitForCachedInlineAnalyses = vi
      .fn()
      .mockResolvedValue(new Map([["paper-1", cacheRecord("paper-1")]]));

    const results = await resolveInlineAnalysis(
      { papers: [input("paper-1")] },
      {
        listCachedInlineAnalyses,
        claimInlineAnalysisGeneration,
        analyzePapersInline,
        completeInlineAnalysisGeneration,
        releaseInlineAnalysisGeneration,
        waitForCachedInlineAnalyses,
      },
    );

    expect(analyzePapersInline).not.toHaveBeenCalled();
    expect(createUsageLedger).not.toHaveBeenCalled();
    expect(waitForCachedInlineAnalyses).toHaveBeenCalledWith(
      { source: "owner-db" },
      [
        expect.objectContaining({
          paperId: "paper-1",
          version: INLINE_ANALYSIS_VERSION,
          inputFingerprint: expect.any(String) as string,
        }),
      ],
      expect.anything(),
    );
    expect(results).toEqual([
      expect.objectContaining({ paperId: "paper-1", analysis, source: "abstract" }),
    ]);
  });

  it("keeps a coalesced generation alive when one authenticated subscriber aborts", async () => {
    requireOwnerPrincipalAuth
      .mockResolvedValueOnce({
        db: { source: "owner-db" },
        user: { id: "user-1", email: "one@example.com" },
      })
      .mockResolvedValueOnce({
        db: { source: "owner-db" },
        user: { id: "user-2", email: "two@example.com" },
      });
    const listCachedInlineAnalyses = vi.fn().mockResolvedValue(new Map());
    const claimInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(["paper-1"]));
    let finishAnalysis:
      | ((value: Array<{ paperId: string; analysis: AIAnalysis; source: "abstract" }>) => void)
      | undefined;
    let sharedOwnerSignal: AbortSignal | undefined;
    const analyzePapersInline = vi.fn(
      (_papers: PaperInput[], options?: { signal?: AbortSignal }) =>
        new Promise<Array<{ paperId: string; analysis: AIAnalysis; source: "abstract" }>>(
          (resolve) => {
            sharedOwnerSignal = options?.signal;
            finishAnalysis = resolve;
          },
        ),
    );
    const completeInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(["paper-1"]));
    const releaseInlineAnalysisGeneration = vi.fn(releaseClaimedIdentities);
    const deps = {
      listCachedInlineAnalyses,
      claimInlineAnalysisGeneration,
      analyzePapersInline,
      completeInlineAnalysisGeneration,
      releaseInlineAnalysisGeneration,
    };

    const firstController = new AbortController();
    const secondController = new AbortController();
    const first = resolveInlineAnalysis(
      { papers: [input("paper-1")], signal: firstController.signal },
      deps,
    );
    const firstRejection = first.catch((error: unknown) => error);
    await vi.waitFor(() => {
      expect(analyzePapersInline).toHaveBeenCalledTimes(1);
    });
    const second = resolveInlineAnalysis(
      { papers: [input("paper-1")], signal: secondController.signal },
      deps,
    );
    await vi.waitFor(() => {
      expect(requireOwnerPrincipalAuth).toHaveBeenCalledTimes(2);
    });
    firstController.abort(new DOMException("first caller left", "AbortError"));

    await expect(firstRejection).resolves.toMatchObject({ name: "AbortError" });
    expect(sharedOwnerSignal?.aborted).toBe(false);
    finishAnalysis?.([{ paperId: "paper-1", analysis, source: "abstract" }]);

    const secondResults = await second;

    expect(requireOwnerPrincipalAuth).toHaveBeenCalledTimes(2);
    expect(claimInlineAnalysisGeneration).toHaveBeenCalledTimes(1);
    expect(analyzePapersInline).toHaveBeenCalledTimes(1);
    expect(createUsageLedger).toHaveBeenCalledTimes(1);
    expect(createUsageLedger).toHaveBeenCalledWith({
      db: { source: "owner-db" },
      ownerPrincipalId: "user-1",
    });
    expect(secondResults).toEqual([
      expect.objectContaining({ paperId: "paper-1", analysis, source: "abstract" }),
    ]);
  });
});

describe("shared inline analysis coordination continuation", () => {
  it("waits in parallel after one shared claim attempt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T00:00:00.000Z"));
    const startedAt = Date.now();
    const listCachedInlineAnalyses = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          Date.now() - startedAt >= 10_000
            ? new Map([["paper-2", cacheRecord("paper-2")]])
            : new Map(),
        ),
      );
    const claimInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(["paper-1"]));
    const analyzePapersInline = vi.fn(
      (papers: PaperInput[]) =>
        new Promise<Array<{ paperId: string; analysis: AIAnalysis; source: "abstract" }>>(
          (resolve) => {
            setTimeout(() => {
              resolve([{ paperId: papers[0].paperId, analysis, source: "abstract" }]);
            }, 20_000);
          },
        ),
    );
    const completeInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(["paper-1"]));
    const releaseInlineAnalysisGeneration = vi.fn(releaseClaimedIdentities);

    try {
      const resultPromise = resolveInlineAnalysis(
        { papers: [input("paper-1"), input("paper-2")] },
        {
          listCachedInlineAnalyses,
          claimInlineAnalysisGeneration,
          analyzePapersInline,
          completeInlineAnalysisGeneration,
          releaseInlineAnalysisGeneration,
        },
      );
      await vi.advanceTimersByTimeAsync(20_000);

      await expect(resultPromise).resolves.toEqual([
        expect.objectContaining({ paperId: "paper-1", analysis }),
        expect.objectContaining({ paperId: "paper-2", analysis }),
      ]);
      expect(claimInlineAnalysisGeneration).toHaveBeenCalledTimes(1);
      expect(claimInlineAnalysisGeneration.mock.calls[0]?.[1]).toEqual([
        expect.objectContaining({ paperId: "paper-1" }),
        expect.objectContaining({ paperId: "paper-2" }),
      ]);
      expect(claimInlineAnalysisGeneration.mock.calls[0]?.[3]).toBe(30);
      expect(releaseInlineAnalysisGeneration).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("preserves a completed row and terminal-fences an omitted claimed result", async () => {
    const listCachedInlineAnalyses = vi.fn().mockResolvedValue(new Map());
    const claimInlineAnalysisGeneration = vi
      .fn()
      .mockResolvedValue(new Set(["paper-1", "paper-2"]));
    const analyzePapersInline = vi.fn().mockImplementation((papers: PaperInput[]) =>
      Promise.resolve([
        {
          paperId: papers[0].paperId,
          analysis: papers[0].paperId === "paper-1" ? analysis : failureAnalysis,
          source: "abstract" as const,
        },
      ]),
    );
    const completeInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(["paper-1"]));
    const releaseInlineAnalysisGeneration = vi
      .fn()
      .mockRejectedValue(new Error("temporary cleanup failure"));
    const terminalFailInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(["paper-2"]));

    await expect(
      resolveInlineAnalysis(
        { papers: [input("paper-1"), input("paper-2")] },
        {
          listCachedInlineAnalyses,
          claimInlineAnalysisGeneration,
          analyzePapersInline,
          completeInlineAnalysisGeneration,
          releaseInlineAnalysisGeneration,
          terminalFailInlineAnalysisGeneration,
        },
      ),
    ).resolves.toEqual([
      expect.objectContaining({ paperId: "paper-1", analysis }),
      expect.objectContaining({ paperId: "paper-2", failureKind: "terminal" }),
    ]);

    expect(completeInlineAnalysisGeneration).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({ paperId: "paper-1" })],
      expect.any(String),
      expect.any(AbortSignal),
    );
    expect(terminalFailInlineAnalysisGeneration).toHaveBeenCalledWith(
      expect.anything(),
      [expect.objectContaining({ paperId: "paper-2" })],
      expect.any(String),
      "terminal_generation_failure",
      expect.any(AbortSignal),
    );
    expect(releaseInlineAnalysisGeneration).not.toHaveBeenCalled();
  });
});

describe("shared inline analysis identity and timing", () => {
  it("generates each globally shared paper from only its own canonical prompt input", async () => {
    const listCachedInlineAnalyses = vi.fn().mockResolvedValue(new Map());
    const claimInlineAnalysisGeneration = vi
      .fn()
      .mockResolvedValue(new Set(["paper-1", "paper-2"]));
    const analyzePapersInline = vi.fn().mockImplementation((papers: PaperInput[]) =>
      Promise.resolve(
        papers.map((paper) => ({
          paperId: paper.paperId,
          analysis,
          source: "abstract" as const,
        })),
      ),
    );
    const completeInlineAnalysisGeneration = vi
      .fn()
      .mockResolvedValue(new Set(["paper-1", "paper-2"]));
    const releaseInlineAnalysisGeneration = vi.fn(releaseClaimedIdentities);

    await resolveInlineAnalysis(
      {
        papers: [
          { ...input("paper-1"), title: "  Paper   One ", abstract: " Abstract\nOne " },
          input("paper-2"),
        ],
      },
      {
        listCachedInlineAnalyses,
        claimInlineAnalysisGeneration,
        analyzePapersInline,
        completeInlineAnalysisGeneration,
        releaseInlineAnalysisGeneration,
      },
    );

    expect(analyzePapersInline).toHaveBeenCalledTimes(2);
    expect(analyzePapersInline.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        paperId: "paper-1",
        title: "Paper One",
        abstract: "Abstract One",
      }),
    ]);
    expect(analyzePapersInline.mock.calls[1]?.[0]).toEqual([
      expect.objectContaining({ paperId: "paper-2" }),
    ]);
  });

  it("keeps one request to a single five-paper provider wave", async () => {
    const paperIds = Array.from({ length: 10 }, (_, index) => `paper-${String(index + 1)}`);
    const listCachedInlineAnalyses = vi.fn().mockResolvedValue(new Map());
    const claimInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(paperIds));
    let active = 0;
    let maxActive = 0;
    const analyzePapersInline = vi.fn().mockImplementation(async (papers: PaperInput[]) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return [{ paperId: papers[0].paperId, analysis, source: "abstract" as const }];
    });
    const completeInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(paperIds));
    const releaseInlineAnalysisGeneration = vi.fn(releaseClaimedIdentities);

    const results = await resolveInlineAnalysis(
      { papers: paperIds.map(input) },
      {
        listCachedInlineAnalyses,
        claimInlineAnalysisGeneration,
        analyzePapersInline,
        completeInlineAnalysisGeneration,
        releaseInlineAnalysisGeneration,
      },
    );

    expect(results).toHaveLength(5);
    expect(analyzePapersInline).toHaveBeenCalledTimes(5);
    expect(maxActive).toBe(5);
  });

  it("completes one slow provider wave without starting papers six through ten", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T00:00:00.000Z"));
    const paperIds = Array.from({ length: 10 }, (_, index) => `paper-${String(index + 1)}`);
    const listCachedInlineAnalyses = vi.fn().mockResolvedValue(new Map());
    const claimInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(paperIds.slice(0, 5)));
    const analyzePapersInline = vi.fn(
      (papers: PaperInput[]) =>
        new Promise<Array<{ paperId: string; analysis: AIAnalysis; source: "abstract" }>>(
          (resolve) => {
            setTimeout(() => {
              resolve([{ paperId: papers[0].paperId, analysis, source: "abstract" }]);
            }, 20_000);
          },
        ),
    );
    const completeInlineAnalysisGeneration = vi
      .fn()
      .mockResolvedValue(new Set(paperIds.slice(0, 5)));
    const releaseInlineAnalysisGeneration = vi.fn(releaseClaimedIdentities);

    try {
      const resultPromise = resolveInlineAnalysis(
        { papers: paperIds.map(input) },
        {
          listCachedInlineAnalyses,
          claimInlineAnalysisGeneration,
          analyzePapersInline,
          completeInlineAnalysisGeneration,
          releaseInlineAnalysisGeneration,
        },
      );
      await vi.advanceTimersByTimeAsync(20_000);

      await expect(resultPromise).resolves.toHaveLength(5);
      expect(analyzePapersInline).toHaveBeenCalledTimes(5);
      expect(analyzePapersInline.mock.calls.map((call) => call[0][0].paperId)).toEqual(
        paperIds.slice(0, 5),
      );
      expect(completeInlineAnalysisGeneration.mock.calls[0]?.[1]).toHaveLength(5);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses different shared identities when the same paper id carries different content", async () => {
    const listCachedInlineAnalyses = vi.fn().mockResolvedValue(new Map());
    const claimInlineAnalysisGeneration = vi
      .fn<
        (
          db: RepositoryDbHandle,
          entries: PaperInlineAnalysisIdentity[],
          leaseToken: string,
        ) => Promise<Set<string>>
      >()
      .mockResolvedValue(new Set(["paper-1"]));
    const analyzePapersInline = vi
      .fn()
      .mockResolvedValue([{ paperId: "paper-1", analysis, source: "abstract" as const }]);
    const completeInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(["paper-1"]));
    const releaseInlineAnalysisGeneration = vi.fn(releaseClaimedIdentities);
    const deps = {
      listCachedInlineAnalyses,
      claimInlineAnalysisGeneration,
      analyzePapersInline,
      completeInlineAnalysisGeneration,
      releaseInlineAnalysisGeneration,
    };

    await resolveInlineAnalysis({ papers: [input("paper-1")] }, deps);
    await resolveInlineAnalysis(
      {
        papers: [{ ...input("paper-1"), abstract: "A different abstract for paper-1" }],
      },
      deps,
    );

    const firstIdentity = claimInlineAnalysisGeneration.mock.calls[0][1][0];
    const secondIdentity = claimInlineAnalysisGeneration.mock.calls[1][1][0];
    expect(firstIdentity).toMatchObject({ paperId: "paper-1" });
    expect(secondIdentity).toMatchObject({ paperId: "paper-1" });
    expect(firstIdentity.inputFingerprint).not.toBe(secondIdentity.inputFingerprint);
  });

  it("includes year in the shared identity but normalizes prompt whitespace", async () => {
    const listCachedInlineAnalyses = vi.fn().mockResolvedValue(new Map());
    const claimInlineAnalysisGeneration = vi
      .fn<
        (
          db: RepositoryDbHandle,
          entries: PaperInlineAnalysisIdentity[],
          leaseToken: string,
        ) => Promise<Set<string>>
      >()
      .mockResolvedValue(new Set(["paper-1"]));
    const analyzePapersInline = vi
      .fn()
      .mockResolvedValue([{ paperId: "paper-1", analysis, source: "abstract" as const }]);
    const completeInlineAnalysisGeneration = vi.fn().mockResolvedValue(new Set(["paper-1"]));
    const releaseInlineAnalysisGeneration = vi.fn(releaseClaimedIdentities);
    const deps = {
      listCachedInlineAnalyses,
      claimInlineAnalysisGeneration,
      analyzePapersInline,
      completeInlineAnalysisGeneration,
      releaseInlineAnalysisGeneration,
    };

    await resolveInlineAnalysis(
      { papers: [{ ...input("paper-1"), title: " Paper   One ", abstract: "Abstract\nOne" }] },
      deps,
    );
    await resolveInlineAnalysis(
      { papers: [{ ...input("paper-1"), title: "Paper One", abstract: "Abstract One" }] },
      deps,
    );
    await resolveInlineAnalysis(
      {
        papers: [{ ...input("paper-1"), title: "Paper One", abstract: "Abstract One", year: 2025 }],
      },
      deps,
    );

    const [whitespaceIdentity, canonicalIdentity, laterYearIdentity] =
      claimInlineAnalysisGeneration.mock.calls.map((call) => call[1][0]);
    expect(whitespaceIdentity.inputFingerprint).toBe(canonicalIdentity.inputFingerprint);
    expect(laterYearIdentity.inputFingerprint).not.toBe(canonicalIdentity.inputFingerprint);
  });
});
