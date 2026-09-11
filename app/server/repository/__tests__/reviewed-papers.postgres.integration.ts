import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createRepositoryDbHandle } from "@/app/lib/supabase/repository-db-handle";
import { listReviewedPapers } from "@/app/server/repository/reviewed-papers";

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

describe("reviewed papers PostgreSQL ordering", () => {
  const admin = new Client({ connectionString: DATABASE_URL });
  const db = createDb();
  const owners = new Set<string>();
  let ownerPrincipalId = "";

  beforeAll(async () => {
    await admin.connect();
  });

  beforeEach(() => {
    ownerPrincipalId = `lh645-${randomUUID()}`;
    owners.add(ownerPrincipalId);
  });

  afterEach(async () => {
    await admin.query(
      "delete from lighthouse.reviewed_papers where owner_principal_id = any($1::text[])",
      [[...owners]],
    );
    owners.clear();
  });

  afterAll(async () => {
    await admin.end();
  });

  it("keeps equal reviewed timestamps in descending id order through the repository", async () => {
    const reviewedAt = "2026-08-14T00:00:00.000Z";
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const expectedIds = [...ids].sort().reverse();

    await admin.query(
      `insert into lighthouse.reviewed_papers
        (id, owner_principal_id, paper_id, title, reviewed_at)
       select input.id, $1, input.paper_id, input.title, $2::timestamptz
       from unnest($3::uuid[], $4::text[], $5::text[])
         as input(id, paper_id, title)`,
      [
        ownerPrincipalId,
        reviewedAt,
        ids,
        ids.map((_, index) => `paper-${index.toString()}`),
        ids.map((_, index) => `Paper ${index.toString()}`),
      ],
    );

    const papers = await listReviewedPapers(db, ownerPrincipalId);
    expect(papers.map((paper) => paper.id)).toEqual(expectedIds);

    const indexResult = await admin.query<{ indexdef: string }>(
      `select indexdef
       from pg_indexes
       where schemaname = 'lighthouse'
         and indexname = 'idx_reviewed_papers_owner_reviewed_at_id'`,
    );
    expect(indexResult.rows).toHaveLength(1);
    expect(indexResult.rows[0]?.indexdef.replace(/\s+/g, " ")).toContain(
      "(owner_principal_id, reviewed_at DESC, id DESC)",
    );
  });
});
