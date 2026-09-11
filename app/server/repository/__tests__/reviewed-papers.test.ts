import { describe, expect, it, vi } from "vitest";
import { createRepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";
import {
  chunkReviewedStatusPaperRefs,
  listReviewedPapers,
  markAsReviewed,
  REVIEWED_STATUS_MAX_REF_CHARACTERS,
  REVIEWED_STATUS_MAX_REFS,
  REVIEWED_STATUS_REF_QUERY_BUDGET,
  unmarkReviewed,
} from "../reviewed-papers";

function createDbForUpsert(error: Error | null = null) {
  const upsert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn(() => ({ upsert }));
  const schema = vi.fn(() => ({ from }));
  return {
    db: createRepositoryDbHandle({ schema } as never),
    spies: { schema, from, upsert },
  };
}

function createDbForDelete(error: Error | null = null) {
  const secondEq = vi.fn().mockResolvedValue({ error });
  const firstEq = vi.fn(() => ({ eq: secondEq }));
  const deleteMock = vi.fn(() => ({ eq: firstEq }));
  const from = vi.fn(() => ({ delete: deleteMock }));
  const schema = vi.fn(() => ({ from }));
  return {
    db: createRepositoryDbHandle({ schema } as never),
    spies: { schema, from, deleteMock, firstEq, secondEq },
  };
}

function createDbForList(error: Error | null = null) {
  const rows = [
    {
      id: "00000000-0000-0000-0000-000000000002",
      user_id: null,
      owner_principal_id: "owner-1",
      paper_id: "paper-2",
      title: "Paper 2",
      url: null,
      authors: [],
      year: null,
      citation_count: null,
      reviewed_at: "2026-08-14T00:00:00.000Z",
    },
  ];
  const result = { data: rows, error };
  const limit = vi.fn().mockResolvedValue(result);
  const query = {
    limit,
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  const orderById = vi.fn(() => query);
  const orderByReviewedAt = vi.fn(() => ({ order: orderById }));
  const eq = vi.fn(() => ({ order: orderByReviewedAt }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const schema = vi.fn(() => ({ from }));
  return {
    db: createRepositoryDbHandle({ schema } as never),
    spies: { schema, from, select, eq, orderByReviewedAt, orderById, limit },
  };
}

describe("reviewed papers repository", () => {
  it("chunks reviewed-status aliases below the PostgREST request budget", () => {
    const aliases = Array.from(
      { length: 640 },
      (_, index) => `pap_${String(index).padStart(4, "0")}_${"x".repeat(28)}`,
    );

    const chunks = chunkReviewedStatusPaperRefs(aliases);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat()).toEqual(aliases);
    for (const chunk of chunks) {
      const encodedSize = chunk.reduce(
        (sum, paperId) =>
          sum +
          new URLSearchParams({ paper_id: paperId }).toString().length -
          "paper_id=".length +
          16,
        0,
      );
      expect(encodedSize).toBeLessThanOrEqual(REVIEWED_STATUS_REF_QUERY_BUDGET);
    }
  });

  it("drops oversized aliases and caps the total reviewed-status input", () => {
    const valid = Array.from(
      { length: REVIEWED_STATUS_MAX_REFS + 10 },
      (_, index) => `pap_${String(index)}`,
    );
    const oversized = "x".repeat(REVIEWED_STATUS_MAX_REF_CHARACTERS + 1);

    const chunks = chunkReviewedStatusPaperRefs([oversized, ...valid]);

    expect(chunks.flat()).toHaveLength(REVIEWED_STATUS_MAX_REFS);
    expect(chunks.flat()).not.toContain(oversized);
    expect(
      chunks.every(
        (chunk) =>
          chunk.reduce(
            (sum, paperId) =>
              sum +
              new URLSearchParams({ paper_id: paperId }).toString().length -
              "paper_id=".length +
              16,
            0,
          ) <= REVIEWED_STATUS_REF_QUERY_BUDGET,
      ),
    ).toBe(true);
  });

  it("uses PostgREST form-query encoding for punctuation-heavy aliases", () => {
    const aliases = Array.from(
      { length: REVIEWED_STATUS_MAX_REFS },
      (_, index) => `${"!".repeat(240)}${String(index).padStart(6, "0")}`,
    );

    const chunks = chunkReviewedStatusPaperRefs(aliases);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      const filter = `in.(${chunk.map((paperId) => `"${paperId}"`).join(",")})`;
      const actualEncodedLength = new URLSearchParams({ paper_id: filter }).toString().length;
      expect(actualEncodedLength).toBeLessThanOrEqual(REVIEWED_STATUS_REF_QUERY_BUDGET);
    }
  });

  it("orders an owner list by reviewed time and id for deterministic ties", async () => {
    const { db, spies } = createDbForList();

    await expect(listReviewedPapers(db, "owner-1")).resolves.toEqual([
      expect.objectContaining({ id: "00000000-0000-0000-0000-000000000002" }),
    ]);

    expect(spies.eq).toHaveBeenCalledWith("owner_principal_id", "owner-1");
    expect(spies.orderByReviewedAt).toHaveBeenCalledWith("reviewed_at", { ascending: false });
    expect(spies.orderById).toHaveBeenCalledWith("id", { ascending: false });
  });

  it("bounds the reviewed-paper source when a library-context limit is requested", async () => {
    const { db, spies } = createDbForList();

    await listReviewedPapers(db, "owner-1", { limit: 2_000 });

    expect(spies.limit).toHaveBeenCalledWith(2_000);
  });

  it("marks a paper reviewed by owner principal with an owner-scoped conflict target", async () => {
    const { db, spies } = createDbForUpsert(null);

    await markAsReviewed(db, "moonlight-user-1", {
      paperId: "paper-1",
      title: "Paper 1",
    });

    // 소유권 키는 owner_principal_id이고(uuid가 아닌 Moonlight sub도 담는다),
    // upsert onConflict 타깃도 owner_principal_id,paper_id로 옮겨졌다.
    expect(spies.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        owner_principal_id: "moonlight-user-1",
        paper_id: "paper-1",
        title: "Paper 1",
      }),
      { onConflict: "owner_principal_id,paper_id" },
    );
  });

  it("throws when marking a paper as reviewed fails", async () => {
    const failure = new Error("upsert failed");
    const { db, spies } = createDbForUpsert(failure);

    await expect(
      markAsReviewed(db, "user-1", {
        paperId: "paper-1",
        title: "Paper 1",
      }),
    ).rejects.toThrow("upsert failed");

    expect(spies.schema).toHaveBeenCalledWith("lighthouse");
    expect(spies.from).toHaveBeenCalledWith("reviewed_papers");
  });

  it("throws when deleting a reviewed paper fails", async () => {
    const failure = new Error("delete failed");
    const { db, spies } = createDbForDelete(failure);

    await expect(unmarkReviewed(db, "user-1", "paper-1")).rejects.toThrow("delete failed");

    expect(spies.schema).toHaveBeenCalledWith("lighthouse");
    expect(spies.from).toHaveBeenCalledWith("reviewed_papers");
    expect(spies.firstEq).toHaveBeenCalledWith("owner_principal_id", "user-1");
    expect(spies.secondEq).toHaveBeenCalledWith("paper_id", "paper-1");
  });
});
