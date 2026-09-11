import { readdirSync } from "node:fs";
import { basename } from "node:path";

const MIGRATION_FILE_PATTERN = /^(\d+)_.*\.sql$/;

export function readExpectedMigrationVersions(migrationsDirectory: string): string[] {
  return readdirSync(migrationsDirectory)
    .map((fileName) => MIGRATION_FILE_PATTERN.exec(basename(fileName))?.[1])
    .filter((version): version is string => Boolean(version))
    .sort();
}

export function assertMigrationRevisionMatches(expected: string[], actual: string[]): void {
  const normalizedExpected = [...new Set(expected)].sort();
  const normalizedActual = [...new Set(actual)].sort();
  const missing = normalizedExpected.filter((version) => !normalizedActual.includes(version));
  const unexpected = normalizedActual.filter((version) => !normalizedExpected.includes(version));

  if (missing.length === 0 && unexpected.length === 0) return;

  throw new Error(
    [
      "PostgreSQL migration revision does not match the repository.",
      `expected=${normalizedExpected.join(",")}`,
      `actual=${normalizedActual.join(",")}`,
      `missing=${missing.join(",") || "none"}`,
      `unexpected=${unexpected.join(",") || "none"}`,
      "Run `npm run db:reset:local` before retrying the integration profile.",
    ].join("\n"),
  );
}
