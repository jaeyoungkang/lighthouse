import { describe, expect, it, vi } from "vitest";
import type { GapNetworkMetadata } from "@/app/domain/research-route-payload";
import type { RouteAiComment } from "@/app/domain/route-ai-comment";
import { createRepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";

function metadata(): GapNetworkMetadata {
  return {
    type: "gap_network",
    version: 1,
    sourceSnapshotId: "search-1",
    query: "autonomous science",
    papers: [],
    gapNetworkReport: {
      clusters: [],
      conceptEdges: [],
      gapPairs: [],
      metrics: { clusterCount: 0, totalPaperCount: 0, totalEdgeCount: 0, gapPairCount: 0 },
      insight: { hypotheses: [] },
    },
  };
}

function reportRow() {
  return {
    id: "gap-1",
    source_snapshot_id: "search-1",
    source_input_digest: "digest-1",
    title: "연구 공백: autonomous science",
    content: "Gap network",
    created_by: "user" as const,
    metadata: metadata(),
    refs: ["search-1"],
    status: "ready" as const,
    version: 0,
    created_at: "2026-06-16T00:00:00.000Z",
    updated_at: "2026-06-16T00:00:00.000Z",
  };
}

function reactionRow(reaction: RouteAiComment | null = null) {
  return {
    gap_report_id: "gap-1",
    viewer_principal_id: "viewer-1",
    artifact_version: 0,
    reaction,
    reaction_history: reaction ? [reaction] : [],
    reaction_version: reaction ? 1 : 0,
    created_at: "2026-06-16T00:00:00.000Z",
    updated_at: "2026-06-16T00:00:00.000Z",
  };
}

function createDb(rows: {
  report?: ReturnType<typeof reportRow>;
  reaction?: ReturnType<typeof reactionRow>;
  reportLookups?: Array<ReturnType<typeof reportRow> | null>;
  insertError?: unknown;
}) {
  const calls: Array<{ table: string; operation: string; payload?: unknown }> = [];
  const from = vi.fn((tableName: string) => {
    const row = tableName === "gap_reports" ? rows.report : rows.reaction;
    let terminalRow: typeof row | null = row ?? null;
    let operation: "select" | "insert" | "update" = "select";
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.eq = vi.fn(() => chain);
    chain.neq = vi.fn((_column: string, value: unknown) => {
      if (tableName === "gap_report_reactions" && rows.reaction?.artifact_version === value) {
        terminalRow = null;
      }
      return chain;
    });
    chain.select = vi.fn(() => chain);
    chain.single = vi.fn(() =>
      Promise.resolve(
        operation === "insert" && Object.hasOwn(rows, "insertError")
          ? { data: null, error: rows.insertError }
          : { data: terminalRow, error: null },
      ),
    );
    chain.maybeSingle = vi.fn(() => {
      if (tableName === "gap_reports" && operation === "select" && rows.reportLookups?.length) {
        return Promise.resolve({ data: rows.reportLookups.shift() ?? null, error: null });
      }
      return Promise.resolve({ data: terminalRow, error: null });
    });
    chain.insert = vi.fn((payload: unknown) => {
      operation = "insert";
      calls.push({ table: tableName, operation: "insert", payload });
      return chain;
    });
    chain.update = vi.fn((payload: unknown) => {
      operation = "update";
      calls.push({ table: tableName, operation: "update", payload });
      if (terminalRow && typeof payload === "object" && payload !== null) {
        terminalRow = { ...terminalRow, ...payload } as typeof row;
      }
      return chain;
    });
    return chain;
  });
  return {
    db: createRepositoryDbHandle({ schema: vi.fn(() => ({ from })) } as never),
    calls,
    from,
  };
}

describe("gap reports repository", () => {
  it("persists a shared artifact with a content digest and no owner or reaction columns", async () => {
    const fake = createDb({ report: reportRow() });
    const { createGapReportUnchecked } = await import("../gap-reports");

    const document = await createGapReportUnchecked(
      fake.db,
      {
        viewerPrincipalId: "builder-1",
        type: "gap_network",
        title: "연구 공백: autonomous science",
        content: "Gap network",
        createdBy: "user",
        metadata: metadata(),
        refs: ["search-1"],
      },
      "digest-1",
    );

    expect(document.viewerPrincipalId).toBe("builder-1");
    expect(document).not.toHaveProperty("ownerPrincipalId");
    expect(fake.calls[0]).toMatchObject({
      table: "gap_reports",
      operation: "insert",
      payload: {
        source_snapshot_id: "search-1",
        source_input_digest: "digest-1",
      },
    });
    expect(fake.calls[0]?.payload).not.toHaveProperty("owner_principal_id");
    expect(fake.calls[0]?.payload).not.toHaveProperty("reaction");
  });

  it("looks up the shared artifact by digest and maps the current runtime principal", async () => {
    const fake = createDb({ report: reportRow() });
    const { getGapReportBySourceInputDigestUnchecked } = await import("../gap-reports");

    const document = await getGapReportBySourceInputDigestUnchecked(
      fake.db,
      "digest-1",
      "viewer-2",
    );

    expect(document?.viewerPrincipalId).toBe("viewer-2");
    expect(document).not.toHaveProperty("ownerPrincipalId");
    const chain = fake.from.mock.results[0]?.value as { eq: ReturnType<typeof vi.fn> } | undefined;
    expect(chain?.eq).toHaveBeenCalledWith("source_input_digest", "digest-1");
  });

  it("returns an existing digest reservation without inserting", async () => {
    const fake = createDb({ report: reportRow(), reportLookups: [reportRow()] });
    const { reserveGapReportUnchecked } = await import("../gap-reports");

    const document = await reserveGapReportUnchecked(
      fake.db,
      {
        viewerPrincipalId: "viewer-2",
        type: "gap_network",
        title: "연구 공백",
        content: "",
        createdBy: "user",
        metadata: metadata(),
        refs: ["search-1"],
      },
      "digest-1",
    );

    expect(document.viewerPrincipalId).toBe("viewer-2");
    expect(fake.calls).not.toContainEqual(
      expect.objectContaining({ table: "gap_reports", operation: "insert" }),
    );
  });

  it("re-reads the winning digest reservation after a unique conflict", async () => {
    const concurrent = { ...reportRow(), id: "gap-concurrent" };
    const fake = createDb({
      report: concurrent,
      reportLookups: [null, concurrent],
      insertError: { code: "23505" },
    });
    const { reserveGapReportUnchecked } = await import("../gap-reports");

    await expect(
      reserveGapReportUnchecked(
        fake.db,
        {
          viewerPrincipalId: "viewer-2",
          type: "gap_network",
          title: "연구 공백",
          content: "",
          createdBy: "user",
          metadata: metadata(),
          refs: ["search-1"],
        },
        "digest-1",
      ),
    ).resolves.toMatchObject({ id: "gap-concurrent", viewerPrincipalId: "viewer-2" });
    expect(fake.from).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["ordinary error", new Error("insert failed")],
    ["primitive", "23505"],
    ["wrong code", { code: "other" }],
  ])("does not reinterpret %s as a unique-constraint race", async (_label, insertError) => {
    const fake = createDb({ report: reportRow(), reportLookups: [null], insertError });
    const { reserveGapReportUnchecked } = await import("../gap-reports");

    await expect(
      reserveGapReportUnchecked(
        fake.db,
        {
          viewerPrincipalId: "viewer-2",
          type: "gap_network",
          title: "연구 공백",
          content: "",
          createdBy: "user",
          metadata: metadata(),
          refs: ["search-1"],
        },
        "digest-1",
      ),
    ).rejects.toBe(insertError);
    expect(fake.from).toHaveBeenCalledTimes(2);
  });

  it("rethrows a unique conflict when the winning digest row is unavailable", async () => {
    const insertError = { code: "23505" };
    const fake = createDb({
      report: reportRow(),
      reportLookups: [null, null],
      insertError,
    });
    const { reserveGapReportUnchecked } = await import("../gap-reports");

    await expect(
      reserveGapReportUnchecked(
        fake.db,
        {
          viewerPrincipalId: "viewer-2",
          type: "gap_network",
          title: "연구 공백",
          content: "",
          createdBy: "user",
          metadata: metadata(),
          refs: ["search-1"],
        },
        "digest-1",
      ),
    ).rejects.toBe(insertError);
    expect(fake.from).toHaveBeenCalledTimes(3);
  });

  it("stores reaction preference under the viewer and artifact version", async () => {
    const reaction: RouteAiComment = {
      id: "reaction-1",
      title: "저장된 반응",
      body: "현재 사용자의 선호다.",
      chips: [],
      timestamp: "2026-06-16T00:00:00.000Z",
    };
    const fake = createDb({ reaction: reactionRow(reaction) });
    const { updateGapReportReactionPreferenceIfVersionUnchecked } = await import("../gap-reports");

    const preference = await updateGapReportReactionPreferenceIfVersionUnchecked(fake.db, {
      gapReportId: "gap-1",
      viewerPrincipalId: "viewer-1",
      artifactVersion: 0,
      expectedReactionVersion: 0,
      reaction,
      reactionHistory: [reaction],
    });

    expect(preference).toMatchObject({
      gapReportId: "gap-1",
      viewerPrincipalId: "viewer-1",
      artifactVersion: 0,
      reactionVersion: 1,
    });
    const insertCall = fake.calls.find(
      (call) => call.table === "gap_report_reactions" && call.operation === "insert",
    );
    expect(insertCall?.payload).toMatchObject({
      viewer_principal_id: "viewer-1",
      artifact_version: 0,
    });
  });

  it("keeps non-initial reaction CAS inside the same artifact version", async () => {
    const reaction: RouteAiComment = {
      id: "reaction-2",
      title: "다음 선택",
      body: "같은 아티팩트 안의 다음 선호다.",
      chips: [],
      timestamp: "2026-06-16T00:01:00.000Z",
    };
    const fake = createDb({ reaction: reactionRow(reaction) });
    const { updateGapReportReactionPreferenceIfVersionUnchecked } = await import("../gap-reports");

    await updateGapReportReactionPreferenceIfVersionUnchecked(fake.db, {
      gapReportId: "gap-1",
      viewerPrincipalId: "viewer-1",
      artifactVersion: 0,
      expectedReactionVersion: 1,
      reaction,
      reactionHistory: [reaction],
    });

    const chain = fake.from.mock.results[0]?.value as { eq: ReturnType<typeof vi.fn> } | undefined;
    expect(chain?.eq).toHaveBeenCalledWith("artifact_version", 0);
    expect(chain?.eq).toHaveBeenCalledWith("reaction_version", 1);
  });
});
