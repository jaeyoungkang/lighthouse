import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertMigrationRevisionMatches,
  readExpectedMigrationVersions,
} from "../migration-revision";
import { assertLoopbackUrl } from "../run-gap-report-concurrency";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("PostgreSQL integration migration revision", () => {
  it("reads only canonical migration files and returns their revisions in order", () => {
    const root = mkdtempSync(path.join(tmpdir(), "lighthouse-migrations-"));
    temporaryRoots.push(root);
    for (const name of [
      "00002_second.sql",
      "00001_first.sql",
      "README.md",
      "00003_not-a-migration.sql.bak",
    ]) {
      writeFileSync(path.join(root, name), "-- fixture\n");
    }

    expect(readExpectedMigrationVersions(root)).toEqual(["00001", "00002"]);
  });

  it("accepts an exact migration ledger match regardless of query order", () => {
    expect(() => {
      assertMigrationRevisionMatches(["00001", "00002"], ["00002", "00001"]);
    }).not.toThrow();
  });

  it("fails with missing and unexpected revisions instead of running against schema drift", () => {
    expect(() => {
      assertMigrationRevisionMatches(["00001", "00002", "00003"], ["00001", "00004"]);
    }).toThrow(
      [
        "PostgreSQL migration revision does not match the repository.",
        "expected=00001,00002,00003",
        "actual=00001,00004",
        "missing=00002,00003",
        "unexpected=00004",
        "Run `npm run db:reset:local` before retrying the integration profile.",
      ].join("\n"),
    );
  });

  it("fails closed for either one-sided migration drift", () => {
    expect(() => {
      assertMigrationRevisionMatches(["00001", "00002"], ["00001"]);
    }).toThrow("missing=00002");
    expect(() => {
      assertMigrationRevisionMatches(["00001"], ["00001", "00002"]);
    }).toThrow("unexpected=00002");
  });
});

describe("PostgreSQL integration cleanup boundary", () => {
  it.each([
    "http://127.0.0.1:54321",
    "http://localhost:54321",
    "postgresql://postgres:postgres@[::1]:54322/postgres",
  ])("accepts local service URL %s", (url) => {
    expect(() => {
      assertLoopbackUrl("integration URL", url);
    }).not.toThrow();
  });

  it("rejects a non-loopback service before destructive cleanup", () => {
    expect(() => {
      assertLoopbackUrl("integration URL", "postgresql://db.example.com/lighthouse");
    }).toThrow("integration URL must be loopback-only for destructive integration cleanup.");
  });
});
