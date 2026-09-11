import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = path.join(process.cwd(), "scripts/sync-agent-skills.py");
const temporaryRoots: string[] = [];

function isWorkflowFile(name: string): boolean {
  return name.endsWith(".yml") || name.endsWith(".yaml");
}

function workflowJobs(content: string): Array<{ name: string; body: string }> {
  const lines = content.split("\n");
  const jobsStart = lines.findIndex((line) => line === "jobs:");
  if (jobsStart < 0) return [];

  const starts = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => index > jobsStart && /^  [a-zA-Z0-9_-]+:\s*$/.test(line));

  return starts.map(({ line, index }, position) => ({
    name: line.trim().slice(0, -1),
    body: lines.slice(index, starts[position + 1]?.index ?? lines.length).join("\n"),
  }));
}

function hasPythonBeforeEveryNpmCi(body: string): boolean {
  const setupIndex = body.indexOf("actions/setup-python@");
  const npmCiIndexes = [...body.matchAll(/\bnpm\s+ci\b/g)].map((match) => match.index);
  return (
    setupIndex >= 0 && npmCiIndexes.length > 0 && npmCiIndexes.every((index) => setupIndex < index)
  );
}

function makeRoot(): string {
  const root = mkdtempSync(path.join(tmpdir(), "lighthouse-skill-sync-"));
  temporaryRoots.push(root);
  return root;
}

function runSync(root: string, ...extraArgs: string[]) {
  return spawnSync(
    "python3",
    [
      SCRIPT,
      "--source",
      path.join(root, "shared-skills"),
      "--claude-dir",
      path.join(root, ".claude/skills"),
      "--codex-dir",
      path.join(root, ".agents/skills"),
      ...extraArgs,
    ],
    { encoding: "utf-8" },
  );
}

function writeSkill(root: string): void {
  const skillDir = path.join(root, "shared-skills/demo");
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    path.join(skillDir, "SKILL.md"),
    "---\nname: demo\ndescription: Test skill.\n---\n\n# Demo\n",
  );
}

function writeNestedGitMetadata(root: string): void {
  const gitDir = path.join(root, "shared-skills/demo/.git");
  mkdirSync(path.join(gitDir, "objects"), { recursive: true });
  writeFileSync(path.join(gitDir, "HEAD"), "ref: refs/heads/main\n");
  writeFileSync(path.join(gitDir, "index"), "mutable git metadata\n");
}

function copyPackagedSkill(root: string): string {
  const sharedSkills = path.join(root, "shared-skills");
  mkdirSync(sharedSkills, { recursive: true });
  for (const name of [
    "architecture-fitness-review.skill",
    "architecture-fitness-review.provenance.json",
  ]) {
    copyFileSync(path.join("shared-skills", name), path.join(sharedSkills, name));
  }
  return sharedSkills;
}

function writeUnsafePackagedSkill(root: string, entryName: string, unixMode: number): void {
  const sharedSkills = path.join(root, "shared-skills");
  mkdirSync(sharedSkills, { recursive: true });
  const archivePath = path.join(sharedSkills, "architecture-fitness-review.skill");
  const skillContent = "---\nname: architecture-fitness-review\n---\n";
  const result = spawnSync(
    "python3",
    [
      "-c",
      `import sys, zipfile
archive_path, entry_name, unix_mode, skill_content = sys.argv[1:]
with zipfile.ZipFile(archive_path, "w") as archive:
    archive.writestr("architecture-fitness-review/SKILL.md", skill_content)
    info = zipfile.ZipInfo(entry_name)
    info.create_system = 3
    info.external_attr = int(unix_mode) << 16
    archive.writestr(info, b"target")`,
      archivePath,
      entryName,
      String(unixMode),
      skillContent,
    ],
    { encoding: "utf8" },
  );
  expect(result.status, result.stderr || result.stdout).toBe(0);

  const fileDigest = createHash("sha256").update(skillContent).digest("hex");
  const treeDigest = createHash("sha256")
    .update("SKILL.md")
    .update(Buffer.from([0]))
    .update(Buffer.from(fileDigest, "hex"))
    .update(Buffer.from([0]))
    .digest("hex");
  writeFileSync(
    path.join(sharedSkills, "architecture-fitness-review.provenance.json"),
    `${JSON.stringify(
      {
        schemaVersion: 2,
        skill: "architecture-fitness-review",
        packageVersion: "0.9.1",
        sourceRepository: "https://github.com/jaeyoung2026/architecture-fitness.git",
        sourceRevision: "a".repeat(40),
        artifactPath: "skills/architecture-fitness-review",
        artifactArchive: "architecture-fitness-review.skill",
        artifactArchiveSha256: createHash("sha256").update(readFileSync(archivePath)).digest("hex"),
        artifactTreeSha256: treeDigest,
        fileCount: 1,
        files: { "SKILL.md": fileDigest },
        installCommand: "python3 scripts/sync-agent-skills.py --prune",
        integrityCheckCommand: "npm run guard:skills",
      },
      null,
      2,
    )}\n`,
  );
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("Agent Skill install-time sync", () => {
  it("recreates missing runtime roots and rejects canonical nested .git metadata", () => {
    const root = makeRoot();
    writeSkill(root);

    const missingCheck = runSync(root, "--check");
    expect(missingCheck.status).not.toBe(0);
    expect(missingCheck.stderr).toContain("missing generated skill");

    const sync = runSync(root, "--prune");
    expect(sync.status, sync.stderr || sync.stdout).toBe(0);

    for (const runtimeRoot of [".agents/skills", ".claude/skills"]) {
      const generated = path.join(root, runtimeRoot, "demo");
      expect(readFileSync(path.join(generated, "SKILL.md"), "utf-8")).toContain("name: demo");
      expect(existsSync(path.join(generated, ".skill-sync-generated"))).toBe(true);
      expect(existsSync(path.join(generated, ".git"))).toBe(false);
    }

    writeNestedGitMetadata(root);
    const check = runSync(root, "--check");
    expect(check.status).not.toBe(0);
    expect(check.stderr).toContain("Canonical Agent Skills contain nested Git metadata");
    expect(check.stderr).toContain("Preserve any required Git objects or stashes");

    const syncWithNestedGit = runSync(root, "--prune");
    expect(syncWithNestedGit.status).not.toBe(0);
    expect(syncWithNestedGit.stderr).toContain(
      "Canonical Agent Skills contain nested Git metadata",
    );
  });

  it("wires package installation to the pruning sync owner", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf-8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.postinstall).toBe("python3 scripts/sync-agent-skills.py --prune");
  });

  it("installs a pinned portable skill archive and rejects archive drift", () => {
    const root = makeRoot();
    const sharedSkills = copyPackagedSkill(root);

    const sync = runSync(root, "--prune");
    expect(sync.status, sync.stderr || sync.stdout).toBe(0);
    for (const runtimeRoot of [".agents/skills", ".claude/skills"]) {
      const generated = path.join(root, runtimeRoot, "architecture-fitness-review");
      expect(readFileSync(path.join(generated, "SKILL.md"), "utf8")).toContain(
        "name: architecture-fitness-review",
      );
      expect(readFileSync(path.join(generated, ".skill-sync-generated"), "utf8")).toContain(
        "architecture-fitness-review.skill",
      );
    }

    const archive = path.join(sharedSkills, "architecture-fitness-review.skill");
    const bytes = readFileSync(archive);
    bytes[bytes.length - 1] = (bytes[bytes.length - 1] ?? 0) ^ 1;
    writeFileSync(archive, bytes);
    const drift = runSync(root, "--check");
    expect(drift.status).not.toBe(0);
    expect(drift.stderr).toContain("Packaged skill archive digest drift");
  });

  it("rejects runtime symlinks even when their resolved bytes match", () => {
    const root = makeRoot();
    writeSkill(root);
    expect(runSync(root, "--prune").status).toBe(0);

    const generatedSkill = path.join(root, ".agents/skills/demo/SKILL.md");
    const externalCopy = path.join(root, "matching-skill.md");
    copyFileSync(generatedSkill, externalCopy);
    rmSync(generatedSkill);
    symlinkSync(externalCopy, generatedSkill);

    const check = runSync(root, "--check");
    expect(check.status).not.toBe(0);
    expect(check.stderr).toContain("Agent skill tree must not contain symlinks");
  });

  it("rejects provenance that misattributes the pinned package", () => {
    const root = makeRoot();
    const sharedSkills = copyPackagedSkill(root);
    const provenancePath = path.join(sharedSkills, "architecture-fitness-review.provenance.json");
    const provenance = JSON.parse(readFileSync(provenancePath, "utf8")) as Record<string, unknown>;
    provenance.sourceRepository = "https://example.com/misattributed.git";
    writeFileSync(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`);

    const check = runSync(root, "--check");
    expect(check.status).not.toBe(0);
    expect(check.stderr).toContain("provenance sourceRepository must equal");
  });

  it.each([
    ["file symlink", "architecture-fitness-review/link", 0o120777, "must not contain symlinks"],
    [
      "directory symlink",
      "architecture-fitness-review/link/",
      0o120777,
      "must not contain symlinks",
    ],
    ["traversal", "architecture-fitness-review/../escape", 0o100644, "unsafe path"],
    [
      "non-canonical path",
      "architecture-fitness-review//duplicate",
      0o100644,
      "non-canonical path",
    ],
    ["duplicate path", "architecture-fitness-review/SKILL.md", 0o100644, "duplicate path"],
    ["reserved path", "architecture-fitness-review/.git/config", 0o100644, "reserved runtime path"],
  ])("rejects a packaged archive %s", (_label, entryName, unixMode, message) => {
    const root = makeRoot();
    writeUnsafePackagedSkill(root, entryName, unixMode);
    const check = runSync(root, "--check");
    expect(check.status).not.toBe(0);
    expect(check.stderr).toContain(message);
  });

  it("provisions Python in every GitHub Actions job that installs packages", () => {
    const workflowRoot = ".github/workflows";
    const workflowFiles = readdirSync(workflowRoot).filter(isWorkflowFile);

    for (const workflowFile of workflowFiles) {
      const jobs = workflowJobs(readFileSync(path.join(workflowRoot, workflowFile), "utf-8"));
      for (const job of jobs.filter(({ body }) => /\bnpm\s+ci\b/.test(body))) {
        expect(
          hasPythonBeforeEveryNpmCi(job.body),
          `${workflowFile} job ${job.name} must provision Python before every npm ci`,
        ).toBe(true);
      }
    }
  });

  it("detects npm ci variants in both workflow file extensions", () => {
    expect(["quality.yml", "mutation.yaml"].filter(isWorkflowFile)).toHaveLength(2);

    const jobs = workflowJobs(`jobs:
  named:
    steps:
      - name: Install
        run: npm ci --ignore-scripts=false
  multiline:
    steps:
      - uses: actions/setup-python@v5
      - run: |
          npm ci
          npm test
`);

    expect(jobs.map(({ name }) => name)).toEqual(["named", "multiline"]);
    expect(jobs.every(({ body }) => /\bnpm\s+ci\b/.test(body))).toBe(true);
    expect(hasPythonBeforeEveryNpmCi(jobs[1]?.body ?? "")).toBe(true);

    const [wrongOrder] = workflowJobs(`jobs:
  wrong-order:
    steps:
      - run: npm ci
      - uses: actions/setup-python@v5
`);
    expect(hasPythonBeforeEveryNpmCi(wrongOrder.body)).toBe(false);
  });
});
