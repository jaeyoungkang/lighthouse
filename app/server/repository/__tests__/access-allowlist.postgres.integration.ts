import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createRepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";
import { listAccessAllowlistEntriesUnchecked } from "@/app/server/repository/access-allowlist";

const API_URL = requireIntegrationEnv("LIGHTHOUSE_DB_INTEGRATION_API_URL");
const DATABASE_URL = requireIntegrationEnv("LIGHTHOUSE_DB_INTEGRATION_DATABASE_URL");
const SERVICE_ROLE_KEY = requireIntegrationEnv("LIGHTHOUSE_DB_INTEGRATION_SERVICE_ROLE_KEY");

function requireIntegrationEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required; use npm run test:db:gap-report-concurrency`);
  return value;
}

function createDb() {
  const client = createClient(API_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  }) as unknown as SupabaseClient;
  return createRepositoryDbHandle(client);
}

describe("access allowlist PostgreSQL keyset pagination", () => {
  const admin = new Client({ connectionString: DATABASE_URL });
  const db = createDb();
  let prefix = "";

  beforeAll(async () => {
    await admin.connect();
  });

  beforeEach(async () => {
    prefix = `lh649-${randomUUID()}`;
    await admin.query(
      `insert into lighthouse.access_allowlist_entries (email, updated_by)
       select format('%s-%s@example.com', $1::text, lpad(ordinal::text, 3, '0')),
              'admin@corca.ai'
       from generate_series(0, 119) as ordinal`,
      [prefix],
    );
  });

  afterEach(async () => {
    await admin.query("delete from lighthouse.access_allowlist_entries where email like $1", [
      `${prefix}-%`,
    ]);
  });

  afterAll(async () => {
    await admin.end();
  });

  it("keeps first, next, previous, last, insert, and delete boundaries globally ordered", async () => {
    const email = (ordinal: number) =>
      `${prefix}-${ordinal.toString().padStart(3, "0")}@example.com`;
    const first = await listAccessAllowlistEntriesUnchecked(db);

    expect(first.entries.map((entry) => entry.email)).toEqual(
      Array.from({ length: 50 }, (_, ordinal) => email(ordinal)),
    );
    expect(first.previousCursor).toBeNull();
    expect(first.nextCursor).toBe(first.entries.at(-1)?.cursor_id);

    const insertedEmail = `${prefix}-049z@example.com`;
    await admin.query(
      `insert into lighthouse.access_allowlist_entries (email, updated_by)
       values ($1, 'admin@corca.ai')`,
      [insertedEmail],
    );

    const next = await listAccessAllowlistEntriesUnchecked(db, {
      cursor: first.nextCursor ?? undefined,
      direction: "after",
    });
    expect(next.entries.map((entry) => entry.email)).toEqual([
      insertedEmail,
      ...Array.from({ length: 49 }, (_, index) => email(index + 50)),
    ]);

    const previous = await listAccessAllowlistEntriesUnchecked(db, {
      cursor: next.previousCursor ?? undefined,
      direction: "before",
    });
    expect(previous.entries.map((entry) => entry.email)).toEqual(
      Array.from({ length: 50 }, (_, ordinal) => email(ordinal)),
    );

    const last = await listAccessAllowlistEntriesUnchecked(db, { direction: "before" });
    expect(last.entries.map((entry) => entry.email)).toEqual(
      Array.from({ length: 50 }, (_, index) => email(index + 70)),
    );
    expect(last.previousCursor).toBe(last.entries[0]?.cursor_id);
    expect(last.nextCursor).toBeNull();

    const boundary = first.entries.at(-1);
    expect(boundary).toBeDefined();
    await admin.query(
      "delete from lighthouse.access_allowlist_entries where email like $1 and email > $2",
      [`${prefix}-%`, boundary?.email],
    );

    const emptied = await listAccessAllowlistEntriesUnchecked(db, {
      cursor: boundary?.cursor_id,
      direction: "after",
    });
    expect(emptied).toEqual({
      entries: [],
      previousCursor: boundary?.cursor_id,
      nextCursor: null,
    });
  });
});
