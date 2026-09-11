import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { INLINE_ANALYSIS_VERSION, type AIAnalysis } from "@/app/domain/analysis";
import { createRepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";
import {
  claimSharedPaperInlineAnalysisGeneration,
  completeSharedPaperInlineAnalysisGeneration,
  listSharedPaperInlineAnalysisCache,
  releaseSharedPaperInlineAnalysisGeneration,
} from "@/app/server/repository/paper-inline-analysis-cache";

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
const inputFingerprint = "a".repeat(64);

function cacheRow(
  paperId = "paper-1",
  fingerprint = inputFingerprint,
  version = INLINE_ANALYSIS_VERSION,
) {
  return {
    paper_id: paperId,
    version,
    input_fingerprint: fingerprint,
    analysis,
    source: "abstract",
    created_at: "2026-07-13T00:00:00.000Z",
    updated_at: "2026-07-13T00:00:00.000Z",
  };
}

function createDb(listRows = [cacheRow()]) {
  const eq = vi.fn();
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const inFilter = vi.fn((column: string) =>
    column === "input_fingerprint"
      ? Promise.resolve({
          data: [
            {
              paper_id: "paper-1",
              version: INLINE_ANALYSIS_VERSION,
              input_fingerprint: inputFingerprint,
              analysis,
              source: "abstract",
              created_at: "2026-07-13T00:00:00.000Z",
              updated_at: "2026-07-13T00:00:00.000Z",
            },
          ],
          error: null,
        })
      : chain,
  );
  chain.select = vi.fn();
  chain.eq = eq;
  chain.in = inFilter;
  chain.select.mockReturnValue(chain);
  eq.mockReturnValue(chain);
  const from = vi.fn().mockReturnValue(chain);
  const rpc = vi.fn().mockImplementation((name: string) => {
    if (name === "list_paper_inline_analysis_cache") {
      return Promise.resolve({ data: listRows, error: null });
    }
    if (name === "claim_paper_inline_analysis_generation") {
      return Promise.resolve({
        data: [
          {
            paper_id: "paper-1",
            version: INLINE_ANALYSIS_VERSION,
            input_fingerprint: inputFingerprint,
          },
        ],
        error: null,
      });
    }
    if (
      name === "complete_paper_inline_analysis_generation" ||
      name === "release_paper_inline_analysis_generation"
    ) {
      return Promise.resolve({
        data: [
          {
            paper_id: "paper-1",
            version: INLINE_ANALYSIS_VERSION,
            input_fingerprint: inputFingerprint,
          },
        ],
        error: null,
      });
    }
    return Promise.resolve({ data: [], error: null });
  });
  const schema = vi.fn().mockReturnValue({ from, rpc });

  return {
    db: createRepositoryDbHandle({ schema } as never),
    eq,
    from,
    inFilter,
    rpc,
    schema,
  };
}

async function verifySharedCacheRpcAbortSignals(): Promise<void> {
  const controller = new AbortController();
  const observed: Array<[string, AbortSignal]> = [];
  const rpc = vi.fn((name: string) => ({
    abortSignal: (signal: AbortSignal) => {
      observed.push([name, signal]);
      let data: unknown[];
      if (name === "list_paper_inline_analysis_cache") data = [cacheRow()];
      else {
        data = [
          {
            paper_id: "paper-1",
            version: INLINE_ANALYSIS_VERSION,
            input_fingerprint: inputFingerprint,
          },
        ];
      }
      return Promise.resolve({ data, error: null });
    },
  }));
  const db = createRepositoryDbHandle({ schema: vi.fn().mockReturnValue({ rpc }) } as never);
  const identity = {
    paperId: "paper-1",
    version: INLINE_ANALYSIS_VERSION,
    inputFingerprint,
  };

  await listSharedPaperInlineAnalysisCache(db, [identity], controller.signal);
  await claimSharedPaperInlineAnalysisGeneration(db, [identity], "lease-1", 50, controller.signal);
  await completeSharedPaperInlineAnalysisGeneration(
    db,
    [{ ...identity, analysis, source: "abstract" }],
    "lease-1",
    controller.signal,
  );
  await releaseSharedPaperInlineAnalysisGeneration(db, [identity], "lease-1", controller.signal);

  expect(observed.map(([name]) => name)).toEqual([
    "list_paper_inline_analysis_cache",
    "claim_paper_inline_analysis_generation",
    "complete_paper_inline_analysis_generation",
    "release_paper_inline_analysis_generation",
  ]);
  expect(observed.every(([, signal]) => signal === controller.signal)).toBe(true);
}

describe("shared paper inline analysis cache repository", () => {
  it("reads ready rows by paper input identity without a principal predicate", async () => {
    const fake = createDb();

    const cached = await listSharedPaperInlineAnalysisCache(fake.db as never, [
      {
        paperId: "paper-1",
        version: INLINE_ANALYSIS_VERSION,
        inputFingerprint,
      },
    ]);

    expect(fake.schema).toHaveBeenCalledWith("lighthouse");
    expect(fake.rpc).toHaveBeenCalledWith("list_paper_inline_analysis_cache", {
      p_entries: [
        {
          paper_id: "paper-1",
          version: INLINE_ANALYSIS_VERSION,
          input_fingerprint: inputFingerprint,
        },
      ],
    });
    expect(fake.from).not.toHaveBeenCalled();
    expect(cached.get("paper-1")).toMatchObject({ paperId: "paper-1", analysis });
  });

  it("does not reuse a ready row when the paper content fingerprint differs", async () => {
    const fake = createDb();

    const cached = await listSharedPaperInlineAnalysisCache(fake.db as never, [
      {
        paperId: "paper-1",
        version: INLINE_ANALYSIS_VERSION,
        inputFingerprint: "b".repeat(64),
      },
    ]);

    expect(cached).toEqual(new Map());
  });

  it("does not reuse a ready row from a previous analysis contract version", async () => {
    const fake = createDb([cacheRow("paper-1", inputFingerprint, INLINE_ANALYSIS_VERSION - 1)]);

    const cached = await listSharedPaperInlineAnalysisCache(fake.db as never, [
      {
        paperId: "paper-1",
        version: INLINE_ANALYSIS_VERSION,
        inputFingerprint,
      },
    ]);

    expect(cached).toEqual(new Map());
  });

  it("keeps exact requested identities when an RPC response contains cross-product rows", async () => {
    const fingerprintB = "b".repeat(64);
    const fake = createDb([
      cacheRow("paper-1", inputFingerprint),
      cacheRow("paper-2", fingerprintB),
      cacheRow("paper-1", fingerprintB),
      cacheRow("paper-2", inputFingerprint),
    ]);

    const cached = await listSharedPaperInlineAnalysisCache(fake.db as never, [
      {
        paperId: "paper-1",
        version: INLINE_ANALYSIS_VERSION,
        inputFingerprint,
      },
      {
        paperId: "paper-2",
        version: INLINE_ANALYSIS_VERSION,
        inputFingerprint: fingerprintB,
      },
    ]);

    expect([...cached.values()].map((row) => [row.paperId, row.inputFingerprint])).toEqual([
      ["paper-1", inputFingerprint],
      ["paper-2", fingerprintB],
    ]);
  });

  it("claims and completes a paper-input lease without accepting a principal key", async () => {
    const fake = createDb();

    const claimed = await claimSharedPaperInlineAnalysisGeneration(
      fake.db as never,
      [{ paperId: "paper-1", version: INLINE_ANALYSIS_VERSION, inputFingerprint }],
      "lease-1",
    );
    const completed = await completeSharedPaperInlineAnalysisGeneration(
      fake.db as never,
      [
        {
          paperId: "paper-1",
          version: INLINE_ANALYSIS_VERSION,
          inputFingerprint,
          analysis,
          source: "abstract",
        },
      ],
      "lease-1",
    );

    expect(fake.rpc).toHaveBeenNthCalledWith(1, "claim_paper_inline_analysis_generation", {
      p_entries: [
        {
          paper_id: "paper-1",
          version: INLINE_ANALYSIS_VERSION,
          input_fingerprint: inputFingerprint,
        },
      ],
      p_lease_token: "lease-1",
      p_lease_seconds: 50,
    });
    expect(fake.rpc).toHaveBeenNthCalledWith(2, "complete_paper_inline_analysis_generation", {
      p_entries: [
        {
          paper_id: "paper-1",
          version: INLINE_ANALYSIS_VERSION,
          input_fingerprint: inputFingerprint,
          analysis,
          source: "abstract",
        },
      ],
      p_lease_token: "lease-1",
    });
    expect(claimed).toEqual(new Set(["paper-1"]));
    expect(completed).toEqual(new Set(["paper-1"]));
  });
});

describe("shared paper inline analysis cache lease safety", () => {
  it("releases only the token-matched pending identities through the shared RPC", async () => {
    const fake = createDb();

    const released = await releaseSharedPaperInlineAnalysisGeneration(
      fake.db as never,
      [{ paperId: "paper-1", version: INLINE_ANALYSIS_VERSION, inputFingerprint }],
      "lease-1",
    );

    expect(released).toEqual(new Set(["paper-1"]));
    expect(fake.rpc).toHaveBeenCalledWith("release_paper_inline_analysis_generation", {
      p_entries: [
        {
          paper_id: "paper-1",
          version: INLINE_ANALYSIS_VERSION,
          input_fingerprint: inputFingerprint,
        },
      ],
      p_lease_token: "lease-1",
    });
  });

  it("does not confirm release for a mismatched returned identity", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          paper_id: "paper-1",
          version: INLINE_ANALYSIS_VERSION,
          input_fingerprint: "b".repeat(64),
        },
      ],
      error: null,
    });
    const db = createRepositoryDbHandle({ schema: vi.fn().mockReturnValue({ rpc }) } as never);

    const released = await releaseSharedPaperInlineAnalysisGeneration(
      db,
      [{ paperId: "paper-1", version: INLINE_ANALYSIS_VERSION, inputFingerprint }],
      "lease-1",
    );

    expect(released).toEqual(new Set());
  });

  it("threads the route deadline signal through every shared-cache RPC transport", async () => {
    await verifySharedCacheRpcAbortSignals();
  });

  it("pins shared identity and token-matched claim, complete, and release transitions", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "supabase/migrations/00020_shared_inline_analysis_cache.sql"),
      "utf8",
    );
    const tableDefinition = sql.slice(
      sql.indexOf("create table lighthouse.paper_inline_analysis_cache"),
      sql.indexOf("create index paper_inline_analysis_cache_ready_version_idx"),
    );

    expect(tableDefinition).toMatch(
      /constraint\s+paper_inline_analysis_cache_input_key\s+unique\s*\(\s*paper_id\s*,\s*version\s*,\s*input_fingerprint\s*\)/,
    );
    expect(tableDefinition).not.toContain("owner_principal_id");
    expect(tableDefinition).not.toContain("user_id");
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+table\s+lighthouse\.paper_inline_analysis_cache\s+from\s+public\s*,\s*anon\s*,\s*authenticated\s*,\s*service_role\s*;/,
    );
    expect(sql).not.toMatch(
      /grant\s+select\s*,\s*insert\s*,\s*update\s*,\s*delete\s+on\s+lighthouse\.paper_inline_analysis_cache/,
    );
    const claimFunction = sql.slice(
      sql.indexOf("create or replace function lighthouse.claim_paper_inline_analysis_generation"),
      sql.indexOf(
        "create or replace function lighthouse.complete_paper_inline_analysis_generation",
      ),
    );
    const completeFunction = sql.slice(
      sql.indexOf(
        "create or replace function lighthouse.complete_paper_inline_analysis_generation",
      ),
      sql.indexOf("create or replace function lighthouse.release_paper_inline_analysis_generation"),
    );
    const releaseFunction = sql.slice(
      sql.indexOf("create or replace function lighthouse.release_paper_inline_analysis_generation"),
      sql.indexOf("revoke all on function lighthouse.claim_paper_inline_analysis_generation"),
    );

    const listFunction = sql.slice(
      sql.indexOf("create or replace function lighthouse.list_paper_inline_analysis_cache"),
      sql.indexOf("create or replace function lighthouse.claim_paper_inline_analysis_generation"),
    );

    expect(listFunction).toContain("cache.paper_id = requested.paper_id");
    expect(listFunction).toContain("cache.version = requested.version");
    expect(listFunction).toContain("cache.input_fingerprint = requested.input_fingerprint");
    expect(listFunction).not.toContain("= any");
    expect(claimFunction).toContain("p_lease_seconds integer default 50");
    expect(claimFunction).toContain("on conflict (paper_id, version, input_fingerprint) do update");
    expect(claimFunction).not.toContain("paper_inline_analysis_cache.lease_token = p_lease_token");
    expect(claimFunction).toContain("lease_expires_at <= now()");
    expect(claimFunction).toContain("lease_expires_at = excluded.lease_expires_at");
    expect(sql).not.toContain("renew_paper_inline_analysis_generation");
    expect(completeFunction).toContain("cache.paper_id = entry.paper_id");
    expect(completeFunction).toContain("cache.version = entry.version");
    expect(completeFunction).toContain("cache.input_fingerprint = entry.input_fingerprint");
    expect(completeFunction).toContain("cache.lease_token = p_lease_token");
    expect(releaseFunction).toContain("cache.paper_id = entry.paper_id");
    expect(releaseFunction).toContain("cache.version = entry.version");
    expect(releaseFunction).toContain("cache.input_fingerprint = entry.input_fingerprint");
    expect(releaseFunction).toContain("cache.lease_token = p_lease_token");
    expect(sql).toContain("analysis ->> 'confidence' = 'low'");
  });

  it("keeps retention cleanup bounded and outside current, rollback, and pending identities", () => {
    const sql = readFileSync(
      path.join(process.cwd(), "supabase/migrations/00021_inline_analysis_cache_retention.sql"),
      "utf8",
    );
    const smoke = readFileSync(
      path.join(
        process.cwd(),
        "scripts/architecture-fitness/inline-analysis-cache-retention-smoke.sql",
      ),
      "utf8",
    );
    const cleanupFunction = sql.slice(
      sql.indexOf("create or replace function lighthouse.cleanup_paper_inline_analysis_cache"),
      sql.indexOf("revoke all on function lighthouse.cleanup_paper_inline_analysis_cache"),
    );

    expect(cleanupFunction).toContain("p_batch_size integer default 200");
    expect(cleanupFunction).toContain("p_current_version is null");
    expect(cleanupFunction).toContain("p_batch_size is null");
    expect(cleanupFunction).toContain("p_batch_size > 500");
    expect(cleanupFunction).toContain("p_updated_before is null");
    expect(cleanupFunction).toContain("p_updated_before > now() - interval '30 days'");
    expect(cleanupFunction).toContain("p_preserved_versions is null");
    expect(cleanupFunction).toContain("preserved.version is null");
    expect(cleanupFunction).toContain("cache.status = 'ready'");
    expect(cleanupFunction).toContain("p_delete_version >= p_current_version");
    expect(cleanupFunction).toContain("p_delete_version = any(p_preserved_versions)");
    expect(cleanupFunction).toContain("cache.version = p_delete_version");
    expect(cleanupFunction).toContain("cache.updated_at < p_updated_before");
    expect(cleanupFunction).toContain("for update skip locked");
    expect(cleanupFunction).toContain("limit p_batch_size");
    expect(cleanupFunction).not.toContain("security definer");
    expect(sql).toContain("set local lock_timeout = '3s'");
    expect(sql).toContain("set local statement_timeout = '30s'");
    expect(sql).toMatch(/on lighthouse\.paper_inline_analysis_cache \(version, updated_at, id\)/);
    expect(sql).toMatch(
      /revoke all on function lighthouse\.cleanup_paper_inline_analysis_cache\([\s\S]*?\) from public, anon, authenticated, service_role;/,
    );
    expect(sql).not.toMatch(
      /grant execute on function lighthouse\.cleanup_paper_inline_analysis_cache/,
    );
    expect(smoke).toMatch(
      /create trigger retention_smoke_forced_delete_failure\s+after delete on lighthouse\.paper_inline_analysis_cache/,
    );
    expect(smoke).toContain("retention smoke forced delete failure");
    expect(smoke).toContain("failed cleanup did not roll back its ready-row delete");
    expect(smoke).toContain("failed cleanup changed a pending lease row");
    expect(smoke).toContain("same-cutoff cleanup retry deleted % rows instead of 1");
  });
});
