import { existsSync, lstatSync, readdirSync, rmSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_LOAD_SMOKE_REPORT_RETENTION = 10;

type ReportEntry = {
  filePath: string;
  modifiedAtMs: number;
  name: string;
};

export type LoadSmokeRetentionPlan = {
  remove: string[];
  retain: string[];
};

export type LocalArtifactCleanupOptions = {
  apply: boolean;
  includePdfStorage: boolean;
  keepLoadSmokeReports?: number;
  repoRoot: string;
};

export type LocalArtifactCleanupResult = {
  applied: boolean;
  loadSmokeReportsRemoved: string[];
  targetsRemoved: string[];
  targetsWouldRemove: string[];
};

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function listRegularJsonFiles(directory: string): ReportEntry[] {
  if (!existsSync(directory)) return [];
  if (!lstatSync(directory).isDirectory()) {
    throw new Error(`artifact path is not a directory: ${directory}`);
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isFile() || path.extname(entry.name) !== ".json") return [];
    const filePath = path.join(directory, entry.name);
    const metadata = statSync(filePath);
    return [{ filePath, modifiedAtMs: metadata.mtimeMs, name: entry.name }];
  });
}

export function planLoadSmokeReportRetention(
  directory: string,
  options: { keep?: number; preserve?: string } = {},
): LoadSmokeRetentionPlan {
  const keep = options.keep ?? DEFAULT_LOAD_SMOKE_REPORT_RETENTION;
  assertPositiveInteger(keep, "load-smoke report retention");

  const entries = listRegularJsonFiles(directory).sort(
    (left, right) => right.modifiedAtMs - left.modifiedAtMs || left.name.localeCompare(right.name),
  );
  const preservedPath = options.preserve === undefined ? null : path.resolve(options.preserve);
  const preservedEntry = entries.find((entry) => path.resolve(entry.filePath) === preservedPath);
  const retained = new Set<string>();

  if (preservedEntry !== undefined) retained.add(preservedEntry.filePath);
  for (const entry of entries) {
    if (retained.size >= keep) break;
    retained.add(entry.filePath);
  }

  return {
    remove: entries.filter((entry) => !retained.has(entry.filePath)).map((entry) => entry.filePath),
    retain: entries.filter((entry) => retained.has(entry.filePath)).map((entry) => entry.filePath),
  };
}

export function pruneLoadSmokeReports(
  directory: string,
  options: { keep?: number; preserve?: string } = {},
): LoadSmokeRetentionPlan {
  const plan = planLoadSmokeReportRetention(directory, options);
  for (const filePath of plan.remove) unlinkSync(filePath);
  return plan;
}

function knownDirectory(repoRoot: string, relativePath: string): string {
  const resolvedRoot = path.resolve(repoRoot);
  const resolvedTarget = path.resolve(resolvedRoot, relativePath);
  if (!resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`artifact cleanup target escaped the repository: ${relativePath}`);
  }
  return resolvedTarget;
}

function removeDirectoryIfPresent(directory: string): boolean {
  if (!existsSync(directory)) return false;
  if (!lstatSync(directory).isDirectory()) {
    throw new Error(`refusing to clean a non-directory artifact path: ${directory}`);
  }
  rmSync(directory, { force: true, recursive: true });
  return true;
}

export function cleanLocalArtifacts(
  options: LocalArtifactCleanupOptions,
): LocalArtifactCleanupResult {
  const keep = options.keepLoadSmokeReports ?? DEFAULT_LOAD_SMOKE_REPORT_RETENTION;
  const coverageDirectory = knownDirectory(options.repoRoot, "coverage");
  const reportDirectory = knownDirectory(options.repoRoot, "reports/load-smoke");
  const pdfStorageDirectory = knownDirectory(options.repoRoot, "storage/pdfs");
  const retentionPlan = planLoadSmokeReportRetention(reportDirectory, { keep });
  const removableDirectories = [
    coverageDirectory,
    ...(options.includePdfStorage ? [pdfStorageDirectory] : []),
  ];
  const targetsWouldRemove = removableDirectories.filter(existsSync);

  if (!options.apply) {
    return {
      applied: false,
      loadSmokeReportsRemoved: retentionPlan.remove,
      targetsRemoved: [],
      targetsWouldRemove,
    };
  }

  const targetsRemoved = removableDirectories.filter((directory) =>
    removeDirectoryIfPresent(directory),
  );
  for (const filePath of retentionPlan.remove) unlinkSync(filePath);
  return {
    applied: true,
    loadSmokeReportsRemoved: retentionPlan.remove,
    targetsRemoved,
    targetsWouldRemove,
  };
}

function parsePositiveInteger(value: string | undefined, flag: string): number {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new Error(`${flag} requires a positive integer`);
  }
  const parsed = Number.parseInt(value, 10);
  assertPositiveInteger(parsed, flag);
  return parsed;
}

function parseCliArgs(args: string[]): Omit<LocalArtifactCleanupOptions, "repoRoot"> {
  let apply = false;
  let includePdfStorage = false;
  let keepLoadSmokeReports = DEFAULT_LOAD_SMOKE_REPORT_RETENTION;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--apply") {
      apply = true;
    } else if (argument === "--include-pdf-storage") {
      includePdfStorage = true;
    } else if (argument === "--keep-load-smoke") {
      keepLoadSmokeReports = parsePositiveInteger(args[index + 1], argument);
      index += 1;
    } else {
      throw new Error(`unknown artifact cleanup option: ${argument}`);
    }
  }

  return { apply, includePdfStorage, keepLoadSmokeReports };
}

function formatRelativePaths(repoRoot: string, filePaths: string[]): string {
  if (filePaths.length === 0) return "none";
  const visible = filePaths.slice(0, 10).map((filePath) => path.relative(repoRoot, filePath));
  const remainder = filePaths.length - visible.length;
  return `${visible.join(", ")}${remainder > 0 ? `, … (+${String(remainder)} more)` : ""}`;
}

export function runLocalArtifactCleanupCli(args: string[], repoRoot = process.cwd()): void {
  const options = parseCliArgs(args);
  const result = cleanLocalArtifacts({ ...options, repoRoot });
  const mode = result.applied ? "applied" : "dry-run";
  process.stdout.write(
    [
      `local artifact cleanup: ${mode}`,
      `load-smoke reports to remove: ${formatRelativePaths(repoRoot, result.loadSmokeReportsRemoved)}`,
      `directories to remove: ${formatRelativePaths(repoRoot, result.targetsWouldRemove)}`,
      options.includePdfStorage
        ? "retired local PDF storage: included by explicit request"
        : "retired local PDF storage: retained (pass --include-pdf-storage to include it)",
    ].join("\n") + "\n",
  );
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    runLocalArtifactCleanupCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `artifact cleanup failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
