import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";
import {
  isInternalEmail,
  isValidExternalAccessEmail,
  normalizeAccessEmail,
} from "@/app/server/auth/access-policy";
import {
  listInvitedAccessForAdmin,
  resolveProductAccessForEmail,
  updateInvitedAccessMembershipForAdmin,
} from "@/app/server/domain-access/access-allowlist-access";
import {
  deleteAccessAllowlistEntryUnchecked,
  getAccessAllowlistEntryUnchecked,
  listAccessAllowlistEntriesUnchecked,
  upsertAccessAllowlistEntryUnchecked,
} from "@/app/server/repository/access-allowlist";

function createAccessMembershipDb({
  singleData = null,
  singleError = null,
  cursorData = null,
  listData = [],
  listError = null,
  upsertError = null,
  deleteError = null,
}: {
  singleData?: unknown;
  singleError?: unknown;
  cursorData?: unknown;
  listData?: unknown[];
  listError?: unknown;
  upsertError?: unknown;
  deleteError?: unknown;
} = {}) {
  const membershipMaybeSingle = vi.fn().mockResolvedValue({ data: singleData, error: singleError });
  const cursorMaybeSingle = vi.fn().mockResolvedValue({ data: cursorData, error: singleError });
  const eq = vi.fn((column: string) => ({
    maybeSingle: column === "cursor_id" ? cursorMaybeSingle : membershipMaybeSingle,
  }));
  const limit = vi.fn().mockResolvedValue({ data: listData, error: listError });
  const query = {
    eq,
    gt: vi.fn(),
    lt: vi.fn(),
    order: vi.fn(),
    limit,
  };
  query.gt.mockReturnValue(query);
  query.lt.mockReturnValue(query);
  query.order.mockReturnValue(query);
  const select = vi.fn(() => query);
  const upsert = vi.fn().mockResolvedValue({ error: upsertError });
  const deleteEq = vi.fn().mockResolvedValue({ error: deleteError });
  const deleteRows = vi.fn(() => ({ eq: deleteEq }));
  const from = vi.fn(() => ({ select, upsert, delete: deleteRows }));
  const schema = vi.fn(() => ({ from }));

  return {
    db: createRepositoryDbHandle({ schema } as never),
    spies: {
      cursorMaybeSingle,
      deleteEq,
      deleteRows,
      eq,
      from,
      gt: query.gt,
      limit,
      lt: query.lt,
      membershipMaybeSingle,
      order: query.order,
      schema,
      upsert,
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("access allowlist pagination", () => {
  it("uses an opaque cursor boundary for bounded forward and backward keyset pages", async () => {
    const cursor = "11111111-1111-4111-8111-111111111111";
    const earlier = {
      cursor_id: "22222222-2222-4222-8222-222222222222",
      email: "alpha@example.com",
      updated_by: "admin@corca.ai",
      updated_at: "2026-07-26T12:00:00.000Z",
    };
    const later = {
      cursor_id: "33333333-3333-4333-8333-333333333333",
      email: "zulu@example.com",
      updated_by: "admin@corca.ai",
      updated_at: "2026-07-26T12:00:00.000Z",
    };
    const { db: forwardDb, spies: forwardSpies } = createAccessMembershipDb({
      cursorData: { email: "middle@example.com" },
      listData: [later],
    });

    await expect(
      listAccessAllowlistEntriesUnchecked(forwardDb, { cursor, direction: "after" }),
    ).resolves.toEqual({
      entries: [later],
      previousCursor: later.cursor_id,
      nextCursor: null,
    });
    expect(forwardSpies.eq).toHaveBeenCalledWith("cursor_id", cursor);
    expect(forwardSpies.gt).toHaveBeenCalledWith("email", "middle@example.com");
    expect(forwardSpies.order).toHaveBeenCalledWith("email", { ascending: true });

    const { db: backwardDb, spies: backwardSpies } = createAccessMembershipDb({
      cursorData: { email: "middle@example.com" },
      listData: [later, earlier],
    });
    await expect(
      listAccessAllowlistEntriesUnchecked(backwardDb, { cursor, direction: "before" }),
    ).resolves.toEqual({
      entries: [earlier, later],
      previousCursor: null,
      nextCursor: later.cursor_id,
    });
    expect(backwardSpies.lt).toHaveBeenCalledWith("email", "middle@example.com");
    expect(backwardSpies.order).toHaveBeenCalledWith("email", { ascending: false });
  });

  it("bounds the first page and derives the next cursor from the last visible row", async () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({
      cursor_id: `cursor-${String(index)}`,
      email: `pilot-${String(index).padStart(2, "0")}@example.com`,
      updated_by: "admin@corca.ai",
      updated_at: "2026-07-26T12:00:00.000Z",
    }));
    const { db, spies } = createAccessMembershipDb({ listData: rows });

    const page = await listAccessAllowlistEntriesUnchecked(db);

    expect(page.entries).toHaveLength(50);
    expect(page.entries.at(-1)?.email).toBe("pilot-49@example.com");
    expect(page.previousCursor).toBeNull();
    expect(page.nextCursor).toBe("cursor-49");
    expect(spies.limit).toHaveBeenCalledWith(51);
  });

  it("reads the last page backward and returns it in ascending display order", async () => {
    const rows = Array.from({ length: 51 }, (_, index) => {
      const ordinal = 99 - index;
      return {
        cursor_id: `cursor-${String(ordinal)}`,
        email: `pilot-${String(ordinal).padStart(2, "0")}@example.com`,
        updated_by: "admin@corca.ai",
        updated_at: "2026-07-26T12:00:00.000Z",
      };
    });
    const { db, spies } = createAccessMembershipDb({ listData: rows });

    const page = await listAccessAllowlistEntriesUnchecked(db, { direction: "before" });

    expect(page.entries).toHaveLength(50);
    expect(page.entries[0].email).toBe("pilot-50@example.com");
    expect(page.entries.at(-1)?.email).toBe("pilot-99@example.com");
    expect(page.previousCursor).toBe("cursor-50");
    expect(page.nextCursor).toBeNull();
    expect(spies.order).toHaveBeenCalledWith("email", { ascending: false });
    expect(spies.limit).toHaveBeenCalledWith(51);
  });

  it("resets a missing cursor boundary to the first page", async () => {
    const row = {
      cursor_id: "cursor-0",
      email: "pilot@example.com",
      updated_by: "admin@corca.ai",
      updated_at: "2026-07-26T12:00:00.000Z",
    };
    const { db, spies } = createAccessMembershipDb({ listData: [row] });

    await expect(
      listAccessAllowlistEntriesUnchecked(db, {
        cursor: "11111111-1111-4111-8111-111111111111",
        direction: "before",
      }),
    ).resolves.toEqual({
      entries: [row],
      previousCursor: null,
      nextCursor: null,
    });
    expect(spies.lt).not.toHaveBeenCalled();
    expect(spies.order).toHaveBeenCalledWith("email", { ascending: true });
  });

  it.each([
    ["after", "previousCursor", "nextCursor"],
    ["before", "nextCursor", "previousCursor"],
  ] as const)(
    "keeps a %s cursor as the recovery boundary when concurrent deletion empties the page",
    async (direction, recoveryKey, oppositeKey) => {
      const cursor = "11111111-1111-4111-8111-111111111111";
      const { db } = createAccessMembershipDb({
        cursorData: { email: "middle@example.com" },
      });

      const page = await listAccessAllowlistEntriesUnchecked(db, { cursor, direction });

      expect(page.entries).toEqual([]);
      expect(page[recoveryKey]).toBe(cursor);
      expect(page[oppositeKey]).toBeNull();
    },
  );
});

describe("access-policy", () => {
  it("normalizes email addresses before policy checks", () => {
    expect(normalizeAccessEmail(" Researcher@Example.COM ")).toBe("researcher@example.com");
  });

  it("treats @corca.ai addresses as internal users", () => {
    expect(isInternalEmail("jaeyoung@corca.ai")).toBe(true);
    expect(isInternalEmail("pilot@example.com")).toBe(false);
    expect(isInternalEmail("external@example.com@corca.ai")).toBe(false);
  });

  it("accepts normalized external emails and rejects internal or malformed entries", () => {
    expect(isValidExternalAccessEmail(" Researcher@Example.COM ")).toBe(true);
    expect(isValidExternalAccessEmail("member@corca.ai")).toBe(false);
    expect(isValidExternalAccessEmail("not-an-email")).toBe(false);
  });

  it("reads, lists, upserts, and deletes allowlist membership through the repository", async () => {
    const membershipRow = {
      email: "pilot@example.com",
      updated_by: "admin@corca.ai",
      updated_at: "2026-07-26T12:00:00.000Z",
    };
    const pageRow = {
      cursor_id: "11111111-1111-4111-8111-111111111111",
      ...membershipRow,
    };
    const { db: readDb, spies: readSpies } = createAccessMembershipDb({
      singleData: membershipRow,
      listData: [pageRow],
    });

    await expect(getAccessAllowlistEntryUnchecked(readDb, membershipRow.email)).resolves.toEqual(
      membershipRow,
    );
    await expect(listAccessAllowlistEntriesUnchecked(readDb)).resolves.toEqual({
      entries: [pageRow],
      previousCursor: null,
      nextCursor: null,
    });
    expect(readSpies.schema).toHaveBeenCalledWith("lighthouse");
    expect(readSpies.from).toHaveBeenCalledWith("access_allowlist_entries");
    expect(readSpies.eq).toHaveBeenCalledWith("email", membershipRow.email);
    expect(readSpies.order).toHaveBeenCalledWith("email", { ascending: true });
    expect(readSpies.limit).toHaveBeenCalledWith(51);

    const { db: writeDb, spies: writeSpies } = createAccessMembershipDb();
    await upsertAccessAllowlistEntryUnchecked(writeDb, {
      email: membershipRow.email,
      updatedBy: "admin@corca.ai",
    });
    expect(writeSpies.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          email: membershipRow.email,
          updated_by: "admin@corca.ai",
        }),
      ],
      { onConflict: "email", defaultToNull: false },
    );
    await deleteAccessAllowlistEntryUnchecked(writeDb, membershipRow.email);
    expect(writeSpies.deleteRows).toHaveBeenCalledTimes(1);
    expect(writeSpies.deleteEq).toHaveBeenCalledWith("email", membershipRow.email);
  });

  it("allows internal users and exact external allowlist entries", async () => {
    const { db: externalDb } = createAccessMembershipDb({
      singleData: {
        email: "pilot@example.com",
        updated_by: "admin@corca.ai",
        updated_at: "2026-07-26T12:00:00.000Z",
      },
    });
    const { db: internalDb, spies: internalSpies } = createAccessMembershipDb();

    await expect(resolveProductAccessForEmail(externalDb, " Pilot@Example.com ")).resolves.toBe(
      "allowed",
    );
    await expect(resolveProductAccessForEmail(internalDb, " Admin@Corca.AI ")).resolves.toBe(
      "allowed",
    );
    expect(internalSpies.from).not.toHaveBeenCalled();
  });

  it("denies missing DB membership even when the retired environment variable is populated", async () => {
    vi.stubEnv("LIGHTHOUSE_ALLOWED_EMAILS", "pilot@example.com");
    const { db } = createAccessMembershipDb();

    await expect(resolveProductAccessForEmail(db, "pilot@example.com")).resolves.toBe("denied");
  });

  it("fails closed when the external decision cannot be read", async () => {
    const { db } = createAccessMembershipDb({
      singleError: new Error("database unavailable"),
    });

    await expect(resolveProductAccessForEmail(db, "pilot@example.com")).resolves.toBe(
      "unavailable",
    );
  });

  it("maps a bounded DB membership page for the internal admin surface", async () => {
    const { db } = createAccessMembershipDb({
      listData: [
        {
          cursor_id: "11111111-1111-4111-8111-111111111111",
          email: "pilot@example.com",
          updated_by: "admin@corca.ai",
          updated_at: "2026-07-26T12:00:00.000Z",
        },
      ],
    });
    const auth = {
      db,
      source: "supabase" as const,
      user: { id: "admin-1", email: "Admin@Corca.AI" },
    };

    await expect(listInvitedAccessForAdmin(auth)).resolves.toEqual({
      entries: [
        {
          cursor: "11111111-1111-4111-8111-111111111111",
          email: "pilot@example.com",
          updatedAt: "2026-07-26T12:00:00.000Z",
          updatedBy: "admin@corca.ai",
        },
      ],
      previousCursor: null,
      nextCursor: null,
    });
  });

  it("normalizes the external decision and derives the operator from admin auth", async () => {
    const { db, spies } = createAccessMembershipDb();
    const auth = {
      db,
      source: "supabase" as const,
      user: { id: "admin-1", email: "Admin@Corca.AI" },
    };

    await expect(
      updateInvitedAccessMembershipForAdmin(auth, {
        email: " Pilot@Example.COM ",
        operation: "add",
      }),
    ).resolves.toBe("pilot@example.com");
    expect(spies.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          email: "pilot@example.com",
          updated_by: "admin@corca.ai",
        }),
      ],
      { onConflict: "email", defaultToNull: false },
    );
  });

  it("deletes external membership when an internal admin removes access", async () => {
    const { db, spies } = createAccessMembershipDb();
    const auth = {
      db,
      source: "supabase" as const,
      user: { id: "admin-1", email: "admin@corca.ai" },
    };

    await expect(
      updateInvitedAccessMembershipForAdmin(auth, {
        email: " Pilot@Example.COM ",
        operation: "remove",
      }),
    ).resolves.toBe("pilot@example.com");
    expect(spies.deleteEq).toHaveBeenCalledWith("email", "pilot@example.com");
    expect(spies.upsert).not.toHaveBeenCalled();
  });

  it("preserves membership when the delete operation fails", async () => {
    const { db } = createAccessMembershipDb({ deleteError: new Error("delete failed") });

    await expect(
      updateInvitedAccessMembershipForAdmin(
        {
          db,
          source: "supabase",
          user: { id: "admin-1", email: "admin@corca.ai" },
        },
        { email: "pilot@example.com", operation: "remove" },
      ),
    ).rejects.toThrow("delete failed");
  });

  it("rejects malformed and internal invited-access membership inputs", async () => {
    const { db, spies } = createAccessMembershipDb();
    const auth = {
      db,
      source: "supabase" as const,
      user: { id: "admin-1", email: "admin@corca.ai" },
    };

    await expect(
      updateInvitedAccessMembershipForAdmin(auth, {
        email: "member@corca.ai",
        operation: "add",
      }),
    ).rejects.toThrow("Invalid external invited-access email");
    await expect(
      updateInvitedAccessMembershipForAdmin(auth, {
        email: "invalid",
        operation: "add",
      }),
    ).rejects.toThrow("Invalid external invited-access email");
    expect(spies.upsert).not.toHaveBeenCalled();
  });

  it("rejects invited-access mutations without an internal admin context", async () => {
    const { db, spies } = createAccessMembershipDb();

    await expect(
      updateInvitedAccessMembershipForAdmin(
        {
          db,
          source: "supabase",
          user: { id: "external-1", email: "operator@example.com" },
        },
        { email: "pilot@example.com", operation: "add" },
      ),
    ).rejects.toThrow("Internal admin context required");
    expect(spies.upsert).not.toHaveBeenCalled();
  });
});

describe("access allowlist schema", () => {
  it("defines a service-role-only membership table with an opaque cursor", () => {
    const migration = readFileSync(
      path.resolve(process.cwd(), "supabase/migrations/00023_access_allowlist_entries.sql"),
      "utf8",
    );

    expect(migration).toContain("email text primary key");
    expect(migration).toContain("email = lower(btrim(email))");
    expect(migration).toContain("email not like '%@corca.ai'");
    expect(migration).toContain("updated_by ~ '^[^[:space:]@]+@corca");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("grant select, insert, update, delete");
    expect(migration).not.toContain("is_allowed");

    const cursorMigration = readFileSync(
      path.resolve(process.cwd(), "supabase/migrations/00027_access_allowlist_cursor.sql"),
      "utf8",
    );
    expect(cursorMigration).toContain("cursor_id uuid not null default gen_random_uuid()");
    expect(cursorMigration).toContain("unique index");
  });
});
