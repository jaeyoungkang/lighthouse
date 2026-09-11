import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  type CairRepositoryView,
  type ChangedFile,
  RECORD_POLICY_FILES,
  parseCairRecords,
  validateCairChanges,
  validateCairRecord,
} from "./lib/cair-validation";

const repoRoot = path.resolve(__dirname, "..", "..");

interface ValidateCairCliDeps {
  repoRoot: string;
  argv: string[];
  stdout: Pick<typeof process.stdout, "write">;
  stderr: Pick<typeof process.stderr, "write">;
  collectChangedFiles: typeof collectChangedFiles;
  createRepositoryView: typeof createRepositoryView;
  validateCairChanges: typeof validateCairChanges;
}

interface ChangedPath {
  path: string;
  baselinePath?: string;
}

function runGit(root: string, args: string[], allowFailure = false, trimOutput = true): string {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  if (result.status !== 0) return "";
  return trimOutput ? result.stdout.trim() : result.stdout;
}

function splitNullPaths(value: string): string[] {
  return value.split("\0").filter(Boolean);
}

function findComparisonBase(
  root: string,
  githubBaseRef?: string | null,
  failWithoutBase = false,
  ciComparisonBase?: string | null,
): string | null {
  if (githubBaseRef) {
    const candidate = `origin/${githubBaseRef}`;
    const verified = runGit(root, ["rev-parse", "--verify", "--quiet", candidate], true);
    if (!verified) {
      throw new Error(
        `required PR comparison base "${candidate}" is unavailable; fetch the GitHub base branch before running mc:validate-cair`,
      );
    }
    const mergeBase = runGit(root, ["merge-base", candidate, "HEAD"], true);
    if (!mergeBase) {
      throw new Error(
        `required PR comparison base "${candidate}" has no merge base with HEAD; repair the checkout history before running mc:validate-cair`,
      );
    }
    return mergeBase;
  }

  if (ciComparisonBase) {
    const verified = runGit(root, ["rev-parse", "--verify", "--quiet", ciComparisonBase], true);
    if (!verified) {
      throw new Error(
        `required CI comparison base "${ciComparisonBase}" is unavailable; fetch the push base before running mc:validate-cair`,
      );
    }
    const mergeBase = runGit(root, ["merge-base", ciComparisonBase, "HEAD"], true);
    if (!mergeBase) {
      throw new Error(
        `required CI comparison base "${ciComparisonBase}" has no merge base with HEAD`,
      );
    }
    return mergeBase;
  }

  const verified = runGit(root, ["rev-parse", "--verify", "--quiet", "origin/main"], true);
  if (verified) {
    const mergeBase = runGit(root, ["merge-base", "origin/main", "HEAD"], true);
    const head = runGit(root, ["rev-parse", "--verify", "HEAD"], true);
    if (mergeBase && mergeBase !== head) return mergeBase;
  }
  if (failWithoutBase && !verified) {
    throw new Error(
      "CI comparison base origin/main is unavailable; fetch origin/main before running mc:validate-cair",
    );
  }
  const parent = runGit(root, ["rev-parse", "--verify", "--quiet", "HEAD^"], true);
  if (parent) return parent;
  if (failWithoutBase) {
    throw new Error(
      "CI comparison base is unavailable; fetch origin/main or enough HEAD history before running mc:validate-cair",
    );
  }
  return null;
}

function parseNameStatus(value: string): ChangedPath[] {
  const fields = splitNullPaths(value);
  const changedPaths: ChangedPath[] = [];
  for (let index = 0; index < fields.length; ) {
    const status = fields[index] ?? "";
    const firstPath = fields[index + 1];
    if (!firstPath) break;
    if (status.startsWith("R") || status.startsWith("C")) {
      const secondPath = fields[index + 2];
      if (!secondPath) break;
      changedPaths.push({ path: secondPath, baselinePath: firstPath });
      index += 3;
      continue;
    }
    changedPaths.push({
      path: firstPath,
      baselinePath: status === "A" ? undefined : firstPath,
    });
    index += 2;
  }
  return changedPaths;
}

function collectChangedPaths(
  root: string,
  stagedOnly: boolean,
  comparisonBase: string | null,
): ChangedPath[] {
  const changed = new Map<string, ChangedPath>();
  const addEntries = (entries: readonly ChangedPath[]) => {
    for (const entry of entries) {
      const existing = changed.get(entry.path);
      changed.set(entry.path, {
        path: entry.path,
        baselinePath: existing?.baselinePath ?? entry.baselinePath,
      });
    }
  };

  if (stagedOnly) {
    addEntries(
      parseNameStatus(
        runGit(
          root,
          ["diff", "--cached", "--name-status", "-z", "--find-renames", "--diff-filter=ACMRD"],
          false,
          false,
        ),
      ),
    );
    return [...changed.values()].sort((left, right) => left.path.localeCompare(right.path));
  }

  if (comparisonBase) {
    addEntries(
      parseNameStatus(
        runGit(
          root,
          [
            "diff",
            "--name-status",
            "-z",
            "--find-renames",
            "--diff-filter=ACMRD",
            `${comparisonBase}...HEAD`,
          ],
          false,
          false,
        ),
      ),
    );
  }
  for (const args of [
    ["diff", "--name-status", "-z", "--find-renames", "--diff-filter=ACMRD"],
    ["diff", "--cached", "--name-status", "-z", "--find-renames", "--diff-filter=ACMRD"],
  ]) {
    addEntries(parseNameStatus(runGit(root, args, false, false)));
  }
  addEntries(
    splitNullPaths(
      runGit(root, ["ls-files", "--others", "--exclude-standard", "-z"], false, false),
    ).map((filePath) => ({ path: filePath })),
  );
  return [...changed.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function readGitFile(root: string, spec: string): string | undefined {
  const result = spawnSync("git", ["show", spec], {
    cwd: root,
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout : undefined;
}

export function collectChangedFiles(
  root: string,
  stagedOnly: boolean,
  githubBaseRef: string | null | undefined = process.env.GITHUB_BASE_REF,
  ci = Boolean(process.env.CI || process.env.GITHUB_ACTIONS),
  ciComparisonBase: string | null | undefined = process.env.CAIR_COMPARISON_BASE,
): ChangedFile[] {
  const comparisonBase = stagedOnly
    ? "HEAD"
    : findComparisonBase(root, githubBaseRef, ci, ciComparisonBase);
  return collectChangedPaths(root, stagedOnly, comparisonBase).flatMap((changedPath) => {
    try {
      const source = stagedOnly
        ? readGitFile(root, `:${changedPath.path}`)
        : existsSync(path.join(root, changedPath.path))
          ? readFileSync(path.join(root, changedPath.path), "utf8")
          : undefined;
      const baselineSource =
        comparisonBase && changedPath.baselinePath
          ? readGitFile(root, `${comparisonBase}:${changedPath.baselinePath}`)
          : undefined;
      if (source === undefined && baselineSource === undefined) return [];
      return [
        {
          path: changedPath.path,
          source: source ?? "",
          baselineSource,
          ...(changedPath.baselinePath && changedPath.baselinePath !== changedPath.path
            ? { baselinePath: changedPath.baselinePath }
            : {}),
          deleted: source === undefined,
        },
      ];
    } catch {
      return [];
    }
  });
}

export function createRepositoryView(
  root: string,
  stagedOnly: boolean,
): CairRepositoryView | undefined {
  if (!stagedOnly) return undefined;
  return {
    exists: (relativePath) => {
      if (readGitFile(root, `:${relativePath}`) !== undefined) return true;
      return (
        runGit(root, ["ls-files", "--cached", "--", relativePath, `${relativePath}/**`], true)
          .length > 0
      );
    },
    listFiles: (relativeDirectory) =>
      splitNullPaths(
        runGit(root, ["ls-files", "--cached", "-z", "--", relativeDirectory], true, false),
      ),
    readFile: (relativePath) => readGitFile(root, `:${relativePath}`),
  };
}

export interface CairInventorySourceFile {
  path: string;
  source: string;
}

const ARCHIVE_PREFIX = "docs/archive/";

/**
 * Enumerates every `.md` file under `docs/` (recursively) plus `AGENTS.md` —
 * the full set of files that can carry a CAIR record — excluding the
 * RECORD_POLICY_FILES that only *describe* the CAIR mechanism and
 * `docs/archive/**` (retired history, not current contract surface).
 *
 * Note: `git ls-files -- 'docs/*.md'` is used rather than `'docs/**\/*.md'`.
 * Git's default (non-`:(glob)`-magic) pathspec matching already lets a bare
 * `*` cross `/`, so `'docs/*.md'` alone matches every tracked markdown file
 * under `docs/` recursively; a literal `**` pathspec segment requires an
 * actual `/` to appear after it, so it silently drops files that sit
 * directly under `docs/` (e.g. `docs/mission-control.md`,
 * `docs/principles.md`). Using only `'docs/*.md'` avoids that undercount.
 */
export function collectAllCairInventoryFiles(root: string): CairInventorySourceFile[] {
  const trackedMarkdown = splitNullPaths(
    runGit(root, ["ls-files", "-z", "--", "docs/*.md"], true, false),
  );
  const candidatePaths = [...new Set([...trackedMarkdown, "AGENTS.md"])]
    .filter((candidatePath) => !RECORD_POLICY_FILES.has(candidatePath))
    .filter((candidatePath) => !candidatePath.startsWith(ARCHIVE_PREFIX))
    .sort();

  return candidatePaths.flatMap((candidatePath) => {
    const absolutePath = path.join(root, candidatePath);
    if (!existsSync(absolutePath)) return [];
    return [{ path: candidatePath, source: readFileSync(absolutePath, "utf8") }];
  });
}

export interface RunCairInventoryDeps {
  repoRoot: string;
  argv: string[];
  stdout: Pick<typeof process.stdout, "write">;
  stderr: Pick<typeof process.stderr, "write">;
  collectAllCairInventoryFiles: typeof collectAllCairInventoryFiles;
  parseCairRecords: typeof parseCairRecords;
  validateCairRecord: typeof validateCairRecord;
}

/**
 * Full-scan advisory inventory: unlike the diff-scoped default mode, this
 * walks every current CAIR-eligible file regardless of what changed, so
 * latent (pre-existing, never-touched) violations become visible. It reuses
 * `parseCairRecords`/`validateCairRecord` as-is — the parsing and validation
 * rules are identical to the diff-scoped path, only the file selection and
 * exit policy differ. Advisory by default (always exits 0); pass `--strict`
 * to fail the process when latent problems exist.
 */
export function runCairInventory(deps: RunCairInventoryDeps): number {
  const strict = deps.argv.includes("--strict");
  const files = deps.collectAllCairInventoryFiles(deps.repoRoot);

  let headingCount = 0;
  let recordCount = 0;
  let conformingCount = 0;
  let nonconformingCount = 0;
  let legacyCount = 0;
  const problemLines: string[] = [];

  for (const file of files) {
    const records = deps.parseCairRecords(file.path, file.source);
    if (records.length === 0) continue;
    headingCount += 1;

    const legacyRecords = records.filter((record) => record.fields.size === 0);
    const structuredRecords = records.filter((record) => record.fields.size > 0);

    if (legacyRecords.length > 0) {
      legacyCount += 1;
      for (const record of legacyRecords) {
        problemLines.push(
          `${file.path}:${String(record.headingLine)}: CAIR heading present but no recognized fields parsed (legacy/unparseable format)`,
        );
      }
    }

    for (const record of structuredRecords) {
      recordCount += 1;
      const errors = deps.validateCairRecord(deps.repoRoot, record, file.source);
      if (errors.length === 0) {
        conformingCount += 1;
      } else {
        nonconformingCount += 1;
        problemLines.push(errors[0]);
      }
    }
  }

  deps.stdout.write(
    "mc:cair-inventory — full-scan advisory (docs/**/*.md + AGENTS.md; excludes docs/archive/** and RECORD_POLICY_FILES mechanism docs)\n",
  );
  if (problemLines.length > 0) {
    for (const line of problemLines) deps.stdout.write(`  - ${line}\n`);
  } else {
    deps.stdout.write("  no latent issues found\n");
  }
  deps.stdout.write(
    `cair-inventory: scanned=${String(files.length)} heading=${String(headingCount)} records=${String(recordCount)} conforming=${String(conformingCount)} nonconforming=${String(nonconformingCount)} legacy=${String(legacyCount)}\n`,
  );

  return strict && nonconformingCount + legacyCount > 0 ? 1 : 0;
}

export function shouldRunValidateCairCli(argv: string[] = process.argv): boolean {
  return path.basename((argv[1] ?? "").replaceAll("\\", "/")) === "mc-validate-cair.ts";
}

export async function runValidateCairCli(
  deps: ValidateCairCliDeps = {
    repoRoot,
    argv: process.argv,
    stdout: process.stdout,
    stderr: process.stderr,
    collectChangedFiles,
    createRepositoryView,
    validateCairChanges,
  },
): Promise<number> {
  await Promise.resolve();
  if (deps.argv.includes("--all")) {
    return runCairInventory({
      repoRoot: deps.repoRoot,
      argv: deps.argv,
      stdout: deps.stdout,
      stderr: deps.stderr,
      collectAllCairInventoryFiles,
      parseCairRecords,
      validateCairRecord,
    });
  }
  try {
    const stagedOnly = deps.argv.includes("--staged");
    const changedFiles = deps.collectChangedFiles(deps.repoRoot, stagedOnly);
    const repositoryView = deps.createRepositoryView(deps.repoRoot, stagedOnly);
    const result = deps.validateCairChanges(deps.repoRoot, changedFiles, repositoryView);
    if (result.errors.length > 0) {
      deps.stderr.write("mc:validate-cair — FAIL\n");
      for (const error of result.errors) deps.stderr.write(`  - ${error}\n`);
      return 1;
    }
    deps.stdout.write(
      `mc:validate-cair — changed CAIR records green${stagedOnly ? " (staged)" : ""}\n`,
    );
    deps.stdout.write(
      `  files ${String(result.changedFileCount).padStart(3)}  records ${String(result.recordCount).padStart(3)}  contracts ${String(result.contractFileCount).padStart(3)}  declarations ${String(result.declarationCount).padStart(3)}\n`,
    );
    return 0;
  } catch (error: unknown) {
    deps.stderr.write(
      `mc:validate-cair — unexpected failure\n${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
}

if (shouldRunValidateCairCli()) {
  void runValidateCairCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
