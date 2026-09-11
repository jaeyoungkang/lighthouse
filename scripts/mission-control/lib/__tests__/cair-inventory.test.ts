import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  collectAllCairInventoryFiles,
  runCairInventory,
  runValidateCairCli,
} from "../../mc-validate-cair";
import { parseCairRecords, validateCairRecord } from "../cair-validation";

const CONFORMING_RECORD = `## Contract Architecture Impact Review

Contract delta: keep the current owner while clarifying one approved contract.
Verdict: none
Affected axes: Source of truth and authority; State lifetime and recovery
Existing-boundary evidence: the current route and store already enforce the invariant.
Human decision required: no
`;

// Mirrors the real latent violation in
// docs/contracts/story-chain/promises/search-url-restores-search.md (~line 60):
// a lowercase, comma-separated axis list instead of the canonical
// semicolon-separated "<Axis>; <Axis>" vocabulary.
const NONCONFORMING_RECORD = `## Contract Architecture Impact Review

Contract delta: adjust one contract without changing ownership.
Verdict: none
Affected axes: source of truth and authority, state lifetime and recovery
Existing-boundary evidence: the current route already enforces this invariant.
Human decision required: no
`;

// Mirrors the real latent violation in docs/runtime-flows/gap-network-analysis.md:
// bullet-prose using a non-canonical (Korean, non-Latin) field label, so none of
// the recognized field names ever match and the record parses with zero fields.
const LEGACY_RECORD = `## Contract Architecture Impact Review

- 판정: \`reshape\`
해당 항목은 과거 서술형 기록이며 현재 필드 규칙을 쓰지 않는다.
`;

function initRepo(root: string): void {
  execFileSync("git", ["init"], { cwd: root });
  execFileSync("git", ["config", "user.email", "cair-inventory@example.com"], { cwd: root });
  execFileSync("git", ["config", "user.name", "CAIR Inventory Test"], { cwd: root });
}

function createRepoWithFiles(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "lighthouse-cair-inventory-"));
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  }
  initRepo(root);
  execFileSync("git", ["add", "."], { cwd: root });
  return root;
}

function captureStdout(): { write: (value: string) => boolean; lines: string[] } {
  const lines: string[] = [];
  return {
    write: (value: string) => {
      lines.push(value);
      return true;
    },
    lines,
  };
}

function runInventory(root: string, argv: string[]) {
  const stdout = captureStdout();
  const stderr = captureStdout();
  const exitCode = runCairInventory({
    repoRoot: root,
    argv,
    stdout,
    stderr,
    collectAllCairInventoryFiles,
    parseCairRecords,
    validateCairRecord,
  });
  return { exitCode, stdout: stdout.lines.join(""), stderr: stderr.lines.join("") };
}

describe("mc:cair-inventory (--all full-scan advisory mode)", () => {
  it("counts conforming, nonconforming, and legacy/unparseable records and exits 0 by default", () => {
    const root = createRepoWithFiles({
      "docs/contracts/story-chain/promises/conforming.md": CONFORMING_RECORD,
      "docs/contracts/story-chain/promises/nonconforming.md": NONCONFORMING_RECORD,
      "docs/runtime-flows/legacy.md": LEGACY_RECORD,
    });

    const { exitCode, stdout } = runInventory(root, ["--all"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain(
      "cair-inventory: scanned=3 heading=3 records=2 conforming=1 nonconforming=1 legacy=1",
    );
    expect(stdout).toContain("docs/contracts/story-chain/promises/nonconforming.md:1:");
    expect(stdout).toContain("unknown affected axis");
    expect(stdout).toContain(
      "docs/runtime-flows/legacy.md:1: CAIR heading present but no recognized fields parsed (legacy/unparseable format)",
    );
  });

  it("exits 1 under --strict when nonconforming or legacy records exist", () => {
    const root = createRepoWithFiles({
      "docs/contracts/story-chain/promises/conforming.md": CONFORMING_RECORD,
      "docs/contracts/story-chain/promises/nonconforming.md": NONCONFORMING_RECORD,
      "docs/runtime-flows/legacy.md": LEGACY_RECORD,
    });

    const strict = runInventory(root, ["--all", "--strict"]);
    expect(strict.exitCode).toBe(1);

    const advisory = runInventory(root, ["--all"]);
    expect(advisory.exitCode).toBe(0);
  });

  it("excludes RECORD_POLICY_FILES and docs/archive/** from the scan", () => {
    const root = createRepoWithFiles({
      // Same shape as the real docs/agent-skills.md / docs/mission-control.md:
      // these files only describe the CAIR mechanism and must stay excluded
      // even though they contain the exact heading.
      "docs/agent-skills.md": LEGACY_RECORD,
      "docs/mission-control.md": NONCONFORMING_RECORD,
      // Archived history is not current contract surface.
      "docs/archive/old-record.md": NONCONFORMING_RECORD,
      "docs/contracts/story-chain/promises/conforming.md": CONFORMING_RECORD,
    });

    const files = collectAllCairInventoryFiles(root);
    const scannedPaths = files.map((file) => file.path);
    expect(scannedPaths).not.toContain("docs/agent-skills.md");
    expect(scannedPaths).not.toContain("docs/mission-control.md");
    expect(scannedPaths).not.toContain("docs/archive/old-record.md");
    expect(scannedPaths).toContain("docs/contracts/story-chain/promises/conforming.md");

    const { exitCode, stdout } = runInventory(root, ["--all"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain(
      "cair-inventory: scanned=1 heading=1 records=1 conforming=1 nonconforming=0 legacy=0",
    );
  });

  it("reports zero nonconforming and legacy counts for an all-clean scan", () => {
    const root = createRepoWithFiles({
      "docs/contracts/story-chain/promises/conforming-a.md": CONFORMING_RECORD,
      "docs/contracts/story-chain/promises/conforming-b.md": CONFORMING_RECORD,
    });

    const { exitCode, stdout } = runInventory(root, ["--all"]);

    expect(exitCode).toBe(0);
    expect(stdout).toContain(
      "cair-inventory: scanned=2 heading=2 records=2 conforming=2 nonconforming=0 legacy=0",
    );
  });

  it("routes --all through runValidateCairCli without touching the diff-scoped path", async () => {
    const root = createRepoWithFiles({
      "docs/contracts/story-chain/promises/conforming.md": CONFORMING_RECORD,
    });
    const stdout = captureStdout();
    const stderr = captureStdout();
    const unexpectedCall = () => {
      throw new Error("diff-scoped dependency must not be called in --all mode");
    };

    const exitCode = await runValidateCairCli({
      repoRoot: root,
      argv: ["node", "mc-validate-cair.ts", "--all"],
      stdout,
      stderr,
      collectChangedFiles: unexpectedCall as never,
      createRepositoryView: unexpectedCall as never,
      validateCairChanges: unexpectedCall as never,
    });

    expect(exitCode).toBe(0);
    expect(stdout.lines.join("")).toContain(
      "cair-inventory: scanned=1 heading=1 records=1 conforming=1 nonconforming=0 legacy=0",
    );
  });
});
