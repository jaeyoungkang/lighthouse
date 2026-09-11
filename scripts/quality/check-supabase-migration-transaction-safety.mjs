// guard:supabase-migration-transaction-safety — checked-in Supabase migrations
// must be safe under the transaction-wrapped production apply path.
//
// Why this gate exists (#183 production migration follow-up): Supabase migration
// application can wrap a migration file in a transaction. PostgreSQL rejects
// `CREATE INDEX CONCURRENTLY` in that context with SQLSTATE 25001, which blocks
// production schema rollout before the ownership migration can apply.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const MIGRATION_DIR = path.join(ROOT, "supabase", "migrations");
const TX_UNSAFE_DDL_RE = /\b(?:CREATE|DROP|REINDEX)\s+(?:UNIQUE\s+)?INDEX\s+CONCURRENTLY\b/i;

const migrationFiles = [];
await collectMigrationFiles(MIGRATION_DIR);
migrationFiles.sort();

const violations = [];
for (const file of migrationFiles) {
  const contents = await readFile(file, "utf8");
  const rel = path.relative(ROOT, file);
  const lines = contents.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const sqlBeforeLineComment = lines[index].split("--")[0];
    if (TX_UNSAFE_DDL_RE.test(sqlBeforeLineComment)) {
      violations.push({ file: rel, line: index + 1, text: lines[index].trim() });
    }
  }
}

if (violations.length > 0) {
  console.error(
    "[guard:supabase-migration-transaction-safety] transaction-wrapped migration에서 실행할 수 없는 DDL을 발견했습니다:",
  );
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} ${violation.text}`);
  }
  console.error(
    "  checked-in Supabase migration에는 CREATE/DROP/REINDEX INDEX CONCURRENTLY를 넣지 마세요. 운영상 online DDL이 꼭 필요하면 별도 수동 runbook으로 transaction 밖에서 실행해야 합니다.",
  );
  process.exit(1);
}

console.log(
  `[guard:supabase-migration-transaction-safety] OK (${migrationFiles.length}개 Supabase migration 스캔, transaction-unsafe concurrent index DDL 0건).`,
);

async function collectMigrationFiles(targetPath) {
  let targetStat;
  try {
    targetStat = await stat(targetPath);
  } catch {
    return;
  }

  if (targetStat.isDirectory()) {
    const entries = await readdir(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      await collectMigrationFiles(path.join(targetPath, entry.name));
    }
    return;
  }

  if (path.basename(targetPath).endsWith(".sql")) {
    migrationFiles.push(targetPath);
  }
}
