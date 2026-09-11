import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanLocalArtifacts,
  planLoadSmokeReportRetention,
  pruneLoadSmokeReports,
  runLocalArtifactCleanupCli,
} from "../cleanup";

const roots: string[] = [];

function createRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "lighthouse-local-artifacts-"));
  roots.push(root);
  return root;
}

function writeReport(directory: string, name: string, modifiedAtMs: number): string {
  mkdirSync(directory, { recursive: true });
  const filePath = path.join(directory, name);
  writeFileSync(filePath, name);
  const timestamp = new Date(modifiedAtMs);
  utimesSync(filePath, timestamp, timestamp);
  return filePath;
}

function captureStdout(run: () => void): string {
  const writes: string[] = [];
  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    writes.push(String(chunk));
    return true;
  }) as typeof process.stdout.write;
  try {
    run();
  } finally {
    process.stdout.write = originalWrite;
  }
  return writes.join("");
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

describe("load-smoke report retention", () => {
  it("keeps the newest reports within the configured bound", () => {
    const root = createRoot();
    const directory = path.join(root, "reports", "load-smoke");
    for (let index = 0; index < 12; index += 1) {
      writeReport(directory, `report-${String(index).padStart(2, "0")}.json`, index + 1);
    }

    const plan = pruneLoadSmokeReports(directory, { keep: 10 });

    expect(plan.remove.map((filePath) => path.basename(filePath))).toEqual([
      "report-01.json",
      "report-00.json",
    ]);
    expect(plan.retain).toHaveLength(10);
    expect(readFileSync(path.join(directory, "report-11.json"), "utf8")).toBe("report-11.json");
  });

  it("preserves the report from the current run even when another file has a later timestamp", () => {
    const root = createRoot();
    const directory = path.join(root, "reports", "load-smoke");
    const current = writeReport(directory, "current.json", 1);
    writeReport(directory, "future.json", 2);

    const plan = planLoadSmokeReportRetention(directory, { keep: 1, preserve: current });

    expect(plan.retain).toEqual([current]);
    expect(plan.remove.map((filePath) => path.basename(filePath))).toEqual(["future.json"]);
  });

  it("ignores non-json files and does not follow symlinks", () => {
    const root = createRoot();
    const directory = path.join(root, "reports", "load-smoke");
    const external = writeReport(root, "external.json", 1);
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, "notes.txt"), "keep");
    symlinkSync(external, path.join(directory, "linked.json"));

    const plan = pruneLoadSmokeReports(directory, { keep: 1 });

    expect(plan).toEqual({ remove: [], retain: [] });
    expect(readFileSync(external, "utf8")).toBe("external.json");
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects unsafe retention bound %s",
    (keep) => {
      const root = createRoot();
      expect(() => planLoadSmokeReportRetention(root, { keep })).toThrow(
        "load-smoke report retention must be a positive integer",
      );
    },
  );

  it("rejects a non-directory report boundary", () => {
    const root = createRoot();
    const filePath = path.join(root, "load-smoke");
    writeFileSync(filePath, "not a directory");

    expect(() => planLoadSmokeReportRetention(filePath)).toThrow(
      "artifact path is not a directory",
    );
  });
});

describe("local artifact cleanup", () => {
  it("reports no removals for an empty repository root", () => {
    const root = createRoot();

    expect(cleanLocalArtifacts({ apply: true, includePdfStorage: true, repoRoot: root })).toEqual({
      applied: true,
      loadSmokeReportsRemoved: [],
      targetsRemoved: [],
      targetsWouldRemove: [],
    });
  });

  it("is dry-run by default and retains local storage", () => {
    const root = createRoot();
    writeReport(path.join(root, "coverage"), "report.json", 1);
    writeReport(path.join(root, "storage", "pdfs"), "paper.json", 1);

    const result = cleanLocalArtifacts({
      apply: false,
      includePdfStorage: false,
      repoRoot: root,
    });

    expect(result).toEqual({
      applied: false,
      loadSmokeReportsRemoved: [],
      targetsRemoved: [],
      targetsWouldRemove: [path.join(root, "coverage")],
    });
    expect(readFileSync(path.join(root, "storage", "pdfs", "paper.json"), "utf8")).toBe(
      "paper.json",
    );
  });

  it("removes generated coverage and only removes PDF storage with explicit opt-in", () => {
    const root = createRoot();
    writeReport(path.join(root, "coverage"), "report.json", 1);
    writeReport(path.join(root, "storage", "pdfs"), "paper.json", 1);

    expect(cleanLocalArtifacts({ apply: true, includePdfStorage: false, repoRoot: root })).toEqual({
      applied: true,
      loadSmokeReportsRemoved: [],
      targetsRemoved: [path.join(root, "coverage")],
      targetsWouldRemove: [path.join(root, "coverage")],
    });
    expect(() => readFileSync(path.join(root, "coverage", "report.json"), "utf8")).toThrow();
    expect(readFileSync(path.join(root, "storage", "pdfs", "paper.json"), "utf8")).toBe(
      "paper.json",
    );

    cleanLocalArtifacts({ apply: true, includePdfStorage: true, repoRoot: root });
    expect(() => readFileSync(path.join(root, "storage", "pdfs", "paper.json"), "utf8")).toThrow();
  });

  it("refuses to traverse a symlink placed at a known directory boundary", () => {
    const root = createRoot();
    const external = createRoot();
    writeFileSync(path.join(external, "keep.txt"), "keep");
    symlinkSync(external, path.join(root, "coverage"), "dir");

    expect(() =>
      cleanLocalArtifacts({ apply: true, includePdfStorage: false, repoRoot: root }),
    ).toThrow("refusing to clean a non-directory artifact path");
    expect(readFileSync(path.join(external, "keep.txt"), "utf8")).toBe("keep");
  });

  it("maps CLI flags to an explicit PDF storage cleanup", () => {
    const root = createRoot();
    writeReport(path.join(root, "storage", "pdfs"), "paper.json", 1);
    const output = captureStdout(() => {
      runLocalArtifactCleanupCli(["--apply", "--include-pdf-storage"], root);
    });

    expect(() => readFileSync(path.join(root, "storage", "pdfs", "paper.json"), "utf8")).toThrow();
    expect(output).toContain("local artifact cleanup: applied");
    expect(output).toContain("retired local PDF storage: included");
  });

  it("keeps dry-run and PDF retention as the CLI defaults", () => {
    const root = createRoot();
    writeReport(path.join(root, "coverage"), "report.json", 1);
    writeReport(path.join(root, "storage", "pdfs"), "paper.json", 1);

    const output = captureStdout(() => {
      runLocalArtifactCleanupCli([], root);
    });

    expect(output).toContain("local artifact cleanup: dry-run");
    expect(output).toContain("retired local PDF storage: retained");
    expect(readFileSync(path.join(root, "coverage", "report.json"), "utf8")).toBe("report.json");
    expect(readFileSync(path.join(root, "storage", "pdfs", "paper.json"), "utf8")).toBe(
      "paper.json",
    );
  });

  it("maps a bounded retention flag and rejects malformed values", () => {
    const root = createRoot();
    const reportDirectory = path.join(root, "reports", "load-smoke");
    writeReport(reportDirectory, "old.json", 1);
    writeReport(reportDirectory, "new.json", 2);

    const output = captureStdout(() => {
      runLocalArtifactCleanupCli(["--keep-load-smoke", "1"], root);
    });
    expect(output).toContain("load-smoke reports to remove: reports/load-smoke/old.json");
    expect(readFileSync(path.join(reportDirectory, "old.json"), "utf8")).toBe("old.json");

    for (const args of [
      ["--keep-load-smoke"],
      ["--keep-load-smoke", "0"],
      ["--keep-load-smoke", "1.5"],
      ["--keep-load-smoke", "-1"],
    ]) {
      expect(() => {
        runLocalArtifactCleanupCli(args, root);
      }).toThrow(/--keep-load-smoke (?:requires|must be) a positive integer/u);
    }
  });

  it("rejects unknown CLI options before cleaning", () => {
    const root = createRoot();
    writeReport(path.join(root, "coverage"), "report.json", 1);

    expect(() => {
      runLocalArtifactCleanupCli(["--force"], root);
    }).toThrow("unknown artifact cleanup option");
    expect(readFileSync(path.join(root, "coverage", "report.json"), "utf8")).toBe("report.json");
  });
});
