import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderRejectedResult } from "../claim-inventory";
import {
  renderKnowledgeObjectBlock,
  renderKnowledgeObjectStore,
  validateKnowledgeObjectStore,
  validateStructuredKnowledgeCandidate,
  type KnowledgeObject,
} from "../knowledge-object";
import { renderSharedMemoryEntry } from "../shared-memory-entry.mjs";

const REPO_ROOT = process.cwd();
const REVIEW_SCRIPT = path.join(REPO_ROOT, "scripts/project-knowledge/review.ts");
const START_SCRIPT = path.join(REPO_ROOT, "scripts/project-knowledge/start.ts");
const TSX = path.join(REPO_ROOT, "node_modules/.bin/tsx");

function write(root: string, relativePath: string, contents: string): void {
  const target = path.join(root, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
}

function candidate(authorityRef = "docs/agent-skills.md"): string {
  return `---
status: candidate
confidence: high
last_reviewed: 2026-08-10
knowledge_lane: process
authority_refs:
  - ${authorityRef}
source_refs:
  - commit: 60a9d7781ded06374b15212d01b6a609a9811424
---

# Narrative: process rationale
`;
}

function setup(): string {
  const root = mkdtempSync(path.join(tmpdir(), "project-knowledge-review-boundary-"));
  write(root, "docs/project-knowledge/shared-memory.md", "# Shared memory\n");
  write(root, "docs/project-knowledge/README.md", "# Project Knowledge\n");
  write(root, "docs/agent-skills.md", "# Agent skills\n");
  write(root, ".project-knowledge-local/candidate.md", candidate());
  return root;
}

function setupStructuredCandidate(root: string): void {
  const git = (args: string[]) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
  expect(git(["init", "-q"]).status).toBe(0);
  expect(git(["config", "user.email", "project-knowledge@example.test"]).status).toBe(0);
  expect(git(["config", "user.name", "Project Knowledge Test"]).status).toBe(0);
  expect(git(["add", "docs/agent-skills.md"]).status).toBe(0);
  expect(git(["commit", "-qm", "test authority"]).status).toBe(0);
  const commit = git(["rev-parse", "HEAD"]).stdout.trim();
  const object: KnowledgeObject = {
    id: "product-making.review-boundary",
    lifecycle: "shared-consolidated",
    plane: "product-making",
    kind: "case",
    title: "Structured review boundary",
    aliases: ["review claim"],
    statement: "Structured reviews replace a validated projection atomically.",
    scope: ["Project Knowledge review"],
    non_scope: ["product runtime"],
    forces: ["recovery needs an exact applied-result identity"],
    rejected_alternatives: [
      { alternative: "append an untyped narrative", reason: "it has no stable object identity" },
    ],
    authority_refs: ["docs/agent-skills.md"],
    grounding: [
      {
        type: "commit",
        ref: commit,
        path: "docs/agent-skills.md",
        note: "test authority commit",
      },
    ],
    relations: [],
    temporal_status: "current",
    evolution: [{ date: "2026-08-13", note: "test object created" }],
    refresh_conditions: ["review recovery changes"],
    answers: ["Was this structured candidate applied?"],
    legacy_refs: [],
  };
  const candidateBody = `---
consolidation: structured
extraction_outcome: create
review_summary: test structured approval
review_checks:
  command_free: pass
  one_pr_falsification: pass
  verdict_free: pass
  second_situation: pass
  single_subject: pass
  deletion: pass
---

${renderKnowledgeObjectBlock(object)}`;
  write(root, "docs/project-knowledge/knowledge-objects.md", renderKnowledgeObjectStore([]));
  write(root, ".project-knowledge-local/candidate.md", candidateBody);
}

function run(root: string, args: string[]) {
  return spawnSync(TSX, [REVIEW_SCRIPT, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

function runStart(root: string) {
  return spawnSync(TSX, [START_SCRIPT], { cwd: root, encoding: "utf8" });
}

function candidateRows(output: string): string[] {
  return output
    .split("\n")
    .filter((line) => line.startsWith("- .project-knowledge-local/candidate"))
    .sort();
}

function runAsync(root: string, args: string[]) {
  const child = spawn(TSX, [REVIEW_SCRIPT, ...args], { cwd: root, stdio: "pipe" });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const completed = new Promise<{ status: number | null; stdout: string; stderr: string }>(
    (resolve) => {
      child.on("close", (status) => {
        resolve({ status, stdout, stderr });
      });
    },
  );
  return { child, completed };
}

async function waitForClaim(candidatePath: string, exitCode: () => number | null): Promise<string> {
  const localRoot = path.dirname(candidatePath);
  for (let attempt = 0; attempt < 5_000; attempt += 1) {
    const claimName = readdirSync(localRoot).find((name) => name.startsWith("candidate.review-"));
    if (claimName && !existsSync(candidatePath)) {
      if (exitCode() !== null) throw new Error("review completed before replacement interleaving");
      return path.join(localRoot, claimName);
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error("timed out waiting for candidate claim");
}

describe("Project Knowledge review target boundary", () => {
  it("applies a structured candidate to the object projection without changing legacy bytes", () => {
    const root = setup();
    try {
      setupStructuredCandidate(root);
      const legacyBefore = readFileSync(
        path.join(root, "docs/project-knowledge/shared-memory.md"),
        "utf8",
      );

      const result = run(root, ["--approve", ".project-knowledge-local/candidate.md"]);

      expect(result.status, result.stderr).toBe(0);
      const objectStore = readFileSync(
        path.join(root, "docs/project-knowledge/knowledge-objects.md"),
        "utf8",
      );
      const validation = validateKnowledgeObjectStore(objectStore, { verifyGrounding: false });
      expect(validation.reasons).toEqual([]);
      expect(validation.records[0]?.object.id).toBe("product-making.review-boundary");
      expect(validation.records[0]?.object.last_review_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(readFileSync(path.join(root, "docs/project-knowledge/shared-memory.md"), "utf8")).toBe(
        legacyBefore,
      );
      expect(existsSync(path.join(root, ".project-knowledge-local/candidate.md"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("recognizes and discards a structured claim only after its exact result is durable", () => {
    const root = setup();
    try {
      setupStructuredCandidate(root);
      const reviewId = "abababab-abab-4bab-8bab-abababababab";
      const candidatePath = path.join(root, ".project-knowledge-local/candidate.md");
      const candidateBody = readFileSync(candidatePath, "utf8");
      const record = validateStructuredKnowledgeCandidate(candidateBody, {
        authorityRoot: root,
        verifyGrounding: false,
      }).records[0];
      const claimRelative = `.project-knowledge-local/candidate.review-${reviewId}.md`;
      renameSync(candidatePath, path.join(root, claimRelative));
      write(
        root,
        "docs/project-knowledge/knowledge-objects.md",
        renderKnowledgeObjectStore([{ ...record.object, last_review_id: reviewId }]),
      );

      const listed = run(root, ["--list"]);
      const discarded = run(root, ["--discard-applied-claim", claimRelative]);

      expect(listed.stdout).toContain(`${claimRelative} [already-shared]`);
      expect(discarded.status, discarded.stderr).toBe(0);
      expect(existsSync(path.join(root, claimRelative))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("approves only the exact local candidate and removes it after append", () => {
    const root = setup();
    try {
      const sharedBefore = readFileSync(
        path.join(root, "docs/project-knowledge/shared-memory.md"),
        "utf8",
      );
      const result = run(root, ["--approve", ".project-knowledge-local/candidate.md"]);

      expect(result.status).toBe(0);
      const sharedAfter = readFileSync(
        path.join(root, "docs/project-knowledge/shared-memory.md"),
        "utf8",
      );
      expect(sharedAfter.startsWith(sharedBefore)).toBe(true);
      expect(sharedAfter).toContain("# Narrative: process rationale");
      expect(sharedAfter).toContain("<!-- project-knowledge-entry:v1");
      expect(() =>
        readFileSync(path.join(root, ".project-knowledge-local/candidate.md"), "utf8"),
      ).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("serializes shared approval and restores the candidate when another reviewer owns the lock", () => {
    const root = setup();
    try {
      write(
        root,
        ".project-knowledge-local/.shared-memory-review.lock",
        `${JSON.stringify({ pid: process.pid, token: "active", createdAt: new Date().toISOString() })}\n`,
      );

      const result = run(root, ["--approve", ".project-knowledge-local/candidate.md"]);

      expect(result.status).not.toBe(0);
      expect(readFileSync(path.join(root, ".project-knowledge-local/candidate.md"), "utf8")).toBe(
        candidate(),
      );
      expect(readFileSync(path.join(root, "docs/project-knowledge/shared-memory.md"), "utf8")).toBe(
        "# Shared memory\n",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reaps a dead shared-approval lock before appending one complete frame", () => {
    const root = setup();
    try {
      write(
        root,
        ".project-knowledge-local/.shared-memory-review.lock",
        `${JSON.stringify({ pid: 2_147_483_647, token: "dead", createdAt: "2026-08-10T00:00:00Z" })}\n`,
      );

      const result = run(root, ["--approve", ".project-knowledge-local/candidate.md"]);

      expect(result.status, result.stderr).toBe(0);
      expect(
        existsSync(path.join(root, ".project-knowledge-local/.shared-memory-review.lock")),
      ).toBe(false);
      expect(
        readFileSync(path.join(root, "docs/project-knowledge/shared-memory.md"), "utf8"),
      ).toContain("<!-- project-knowledge-entry:v1");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects another existing file without mutating either file", () => {
    const root = setup();
    try {
      write(root, "other-candidate.md", candidate());
      const sharedBefore = readFileSync(
        path.join(root, "docs/project-knowledge/shared-memory.md"),
        "utf8",
      );
      const result = run(root, ["--approve", path.join(root, "other-candidate.md")]);

      expect(result.status).not.toBe(0);
      expect(readFileSync(path.join(root, "other-candidate.md"), "utf8")).toBe(candidate());
      expect(readFileSync(path.join(root, ".project-knowledge-local/candidate.md"), "utf8")).toBe(
        candidate(),
      );
      expect(readFileSync(path.join(root, "docs/project-knowledge/shared-memory.md"), "utf8")).toBe(
        sharedBefore,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a missing path instead of falling back to the local candidate", () => {
    const root = setup();
    try {
      const result = run(root, ["--approve", ".project-knowledge-local/typo.md"]);

      expect(result.status).not.toBe(0);
      expect(readFileSync(path.join(root, ".project-knowledge-local/candidate.md"), "utf8")).toBe(
        candidate(),
      );
      expect(readFileSync(path.join(root, "docs/project-knowledge/shared-memory.md"), "utf8")).toBe(
        "# Shared memory\n",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a symlink at the canonical candidate path", () => {
    const root = setup();
    try {
      const candidatePath = path.join(root, ".project-knowledge-local/candidate.md");
      const targetPath = path.join(root, "symlink-target.md");
      writeFileSync(targetPath, candidate(), "utf8");
      unlinkSync(candidatePath);
      symlinkSync(targetPath, candidatePath);

      const result = run(root, ["--approve", ".project-knowledge-local/candidate.md"]);

      expect(result.status).not.toBe(0);
      expect(lstatSync(candidatePath).isSymbolicLink()).toBe(true);
      expect(readFileSync(targetPath, "utf8")).toBe(candidate());
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a symlinked local root without reading or deleting its outside candidate", () => {
    const root = setup();
    const outside = mkdtempSync(path.join(tmpdir(), "project-knowledge-outside-root-"));
    try {
      const localRoot = path.join(root, ".project-knowledge-local");
      rmSync(localRoot, { recursive: true, force: true });
      write(outside, "candidate.md", candidate());
      symlinkSync(outside, localRoot);

      const result = run(root, ["--approve", ".project-knowledge-local/candidate.md"]);

      expect(result.status).not.toBe(0);
      expect(lstatSync(localRoot).isSymbolicLink()).toBe(true);
      expect(readFileSync(path.join(outside, "candidate.md"), "utf8")).toBe(candidate());
      expect(readFileSync(path.join(root, "docs/project-knowledge/shared-memory.md"), "utf8")).toBe(
        "# Shared memory\n",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("does not let pk:start initialize through a symlinked local root", () => {
    const root = setup();
    const outside = mkdtempSync(path.join(tmpdir(), "project-knowledge-start-root-"));
    try {
      const localRoot = path.join(root, ".project-knowledge-local");
      rmSync(localRoot, { recursive: true, force: true });
      symlinkSync(outside, localRoot);

      const result = runStart(root);

      expect(result.status).not.toBe(0);
      expect(lstatSync(localRoot).isSymbolicLink()).toBe(true);
      expect(readdirSync(outside)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("rejects an authority ref whose filesystem target escapes the repository", () => {
    const root = setup();
    const outside = mkdtempSync(path.join(tmpdir(), "project-knowledge-outside-authority-"));
    try {
      write(outside, "authority.md", "# Outside authority\n");
      symlinkSync(path.join(outside, "authority.md"), path.join(root, "docs/authority-link.md"));
      write(root, ".project-knowledge-local/candidate.md", candidate("docs/authority-link.md"));

      const result = run(root, ["--approve", ".project-knowledge-local/candidate.md"]);

      expect(result.status).not.toBe(0);
      expect(readFileSync(path.join(outside, "authority.md"), "utf8")).toBe(
        "# Outside authority\n",
      );
      expect(readFileSync(path.join(root, "docs/project-knowledge/shared-memory.md"), "utf8")).toBe(
        "# Shared memory\n",
      );
      expect(readFileSync(path.join(root, ".project-knowledge-local/candidate.md"), "utf8")).toBe(
        candidate("docs/authority-link.md"),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("rejects an authority ref that is a repository-internal symlink", () => {
    const root = setup();
    try {
      symlinkSync("agent-skills.md", path.join(root, "docs/authority-link.md"));
      write(root, ".project-knowledge-local/candidate.md", candidate("docs/authority-link.md"));

      const result = run(root, ["--approve", ".project-knowledge-local/candidate.md"]);

      expect(result.status).not.toBe(0);
      expect(readFileSync(path.join(root, "docs/project-knowledge/shared-memory.md"), "utf8")).toBe(
        "# Shared memory\n",
      );
      expect(readFileSync(path.join(root, ".project-knowledge-local/candidate.md"), "utf8")).toBe(
        candidate("docs/authority-link.md"),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    {
      action: "approval",
      args: ["--approve", ".project-knowledge-local/candidate.md"],
    },
    {
      action: "rejection",
      args: ["--reject", ".project-knowledge-local/candidate.md", "--reason", "not shared"],
    },
  ])(
    "preserves a candidate created after $action atomically claims the reviewed artifact",
    async ({ action, args }) => {
      const root = setup();
      try {
        const candidatePath = path.join(root, ".project-knowledge-local/candidate.md");
        const oldCandidate = `${candidate().replace(
          "process rationale",
          "old process rationale",
        )}\n${"old evidence\n".repeat(500_000)}`;
        const newCandidate = candidate().replace("process rationale", "new process rationale");
        writeFileSync(candidatePath, oldCandidate, "utf8");

        const { child, completed } = runAsync(root, args);
        await waitForClaim(candidatePath, () => child.exitCode);
        writeFileSync(candidatePath, newCandidate, "utf8");
        const result = await completed;

        expect(result.status, result.stderr).toBe(0);
        expect(readFileSync(candidatePath, "utf8")).toBe(newCandidate);
        if (action === "approval") {
          const shared = readFileSync(
            path.join(root, "docs/project-knowledge/shared-memory.md"),
            "utf8",
          );
          expect(shared).toContain("old process rationale");
          expect(shared).not.toContain("new process rationale");
        } else {
          const rejectedPaths = readdirSync(path.join(root, ".project-knowledge-local"))
            .filter((name) => name.startsWith("rejected-candidate-"))
            .map((name) => path.join(root, ".project-knowledge-local", name));
          expect(rejectedPaths).toHaveLength(1);
          const rejectedPath = rejectedPaths.at(0);
          if (!rejectedPath) throw new Error("rejected candidate was not preserved");
          expect(readFileSync(rejectedPath, "utf8")).toContain("old process rationale");
          expect(lstatSync(rejectedPath).isSymbolicLink()).toBe(false);
        }
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
    20_000,
  );

  it("never overwrites a concurrent checkpoint while restoring a local-only claim", async () => {
    const root = setup();
    try {
      const candidatePath = path.join(root, ".project-knowledge-local/candidate.md");
      const oldCandidate = `${candidate()}\n${"old evidence\n".repeat(500_000)}`;
      const newCandidate = candidate().replace("process rationale", "new checkpoint rationale");
      writeFileSync(candidatePath, oldCandidate, "utf8");

      const { child, completed } = runAsync(root, [
        "--local-only",
        ".project-knowledge-local/candidate.md",
      ]);
      const claimPath = await waitForClaim(candidatePath, () => child.exitCode);
      writeFileSync(candidatePath, newCandidate, "utf8");
      const result = await completed;

      expect(result.status).not.toBe(0);
      expect(readFileSync(candidatePath, "utf8")).toBe(newCandidate);
      expect(readFileSync(claimPath, "utf8")).toBe(oldCandidate);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 20_000);

  it.each([
    {
      action: "approval",
      args: ["--approve", ".project-knowledge-local/candidate.md"],
    },
    {
      action: "rejection",
      args: ["--reject", ".project-knowledge-local/candidate.md", "--reason", "not shared"],
    },
  ])(
    "does not recover a claim still owned by an active $action",
    async ({ action, args }) => {
      const root = setup();
      try {
        const candidatePath = path.join(root, ".project-knowledge-local/candidate.md");
        writeFileSync(
          candidatePath,
          `${candidate()}\n${"active evidence\n".repeat(500_000)}`,
          "utf8",
        );

        const { child, completed } = runAsync(root, args);
        const claimPath = await waitForClaim(candidatePath, () => child.exitCode);
        const recovered = run(root, ["--recover", path.relative(root, claimPath)]);
        const original = await completed;

        expect(recovered.status).not.toBe(0);
        expect(original.status, original.stderr).toBe(0);
        expect(existsSync(candidatePath)).toBe(false);
        expect(existsSync(claimPath)).toBe(false);
        if (action === "approval") {
          expect(
            readFileSync(path.join(root, "docs/project-knowledge/shared-memory.md"), "utf8"),
          ).toContain("active evidence");
        } else {
          expect(
            readdirSync(path.join(root, ".project-knowledge-local")).some((name) =>
              name.startsWith("rejected-candidate-"),
            ),
          ).toBe(true);
        }
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
    20_000,
  );

  it("does not follow or replace a substituted reject destination", async () => {
    const root = setup();
    const outside = mkdtempSync(path.join(tmpdir(), "project-knowledge-reject-destination-"));
    try {
      const candidatePath = path.join(root, ".project-knowledge-local/candidate.md");
      writeFileSync(candidatePath, `${candidate()}\n${"old evidence\n".repeat(500_000)}`, "utf8");
      const outsideTarget = path.join(outside, "outside.md");
      writeFileSync(outsideTarget, "ORIGINAL\n", "utf8");

      const { child, completed } = runAsync(root, [
        "--reject",
        ".project-knowledge-local/candidate.md",
        "--reason",
        "not shared",
      ]);
      const claimPath = await waitForClaim(candidatePath, () => child.exitCode);
      const rejectedPath = claimPath.replace("candidate.review-", "rejected-candidate-");
      symlinkSync(outsideTarget, rejectedPath);
      const result = await completed;

      expect(result.status).not.toBe(0);
      expect(readFileSync(outsideTarget, "utf8")).toBe("ORIGINAL\n");
      expect(lstatSync(rejectedPath).isSymbolicLink()).toBe(true);
      expect(existsSync(candidatePath)).toBe(false);
      expect(readFileSync(claimPath, "utf8")).toContain("process rationale");
      const listed = run(root, ["--list"]);
      expect(listed.stdout).toContain(`${path.relative(root, claimPath)} [conflict]`);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  }, 20_000);

  it("lists and explicitly recovers an interrupted pending claim", () => {
    const root = setup();
    try {
      const claimRelative =
        ".project-knowledge-local/candidate.review-11111111-1111-4111-8111-111111111111.md";
      renameSync(
        path.join(root, ".project-knowledge-local/candidate.md"),
        path.join(root, claimRelative),
      );

      const listed = run(root, ["--list"]);
      expect(listed.status).toBe(0);
      expect(listed.stdout).toContain(`${claimRelative} [pending]`);

      const recovered = run(root, ["--recover", claimRelative]);
      expect(recovered.status).toBe(0);
      expect(readFileSync(path.join(root, ".project-knowledge-local/candidate.md"), "utf8")).toBe(
        candidate(),
      );
      expect(existsSync(path.join(root, claimRelative))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses recovery while a complete live review owner is present", () => {
    const root = setup();
    try {
      const id = "13131313-1313-4131-8131-131313131313";
      const claimRelative = `.project-knowledge-local/candidate.review-${id}.md`;
      renameSync(
        path.join(root, ".project-knowledge-local/candidate.md"),
        path.join(root, claimRelative),
      );
      write(
        root,
        `.project-knowledge-local/review-owner-${id}.json`,
        `${JSON.stringify({ reviewId: id, pid: process.pid, token: "live-owner" })}\n`,
      );

      const listed = run(root, ["--list"]);
      const recovered = run(root, ["--recover", claimRelative]);

      expect(listed.stdout).toContain(`${claimRelative} [active] reason=live-review-owner`);
      expect(recovered.status).not.toBe(0);
      expect(existsSync(path.join(root, claimRelative))).toBe(true);
      expect(existsSync(path.join(root, ".project-knowledge-local/candidate.md"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reaps an observed stale review owner before recovering its claim", () => {
    const root = setup();
    try {
      const id = "14141414-1414-4141-8141-141414141414";
      const claimRelative = `.project-knowledge-local/candidate.review-${id}.md`;
      const ownerRelative = `.project-knowledge-local/review-owner-${id}.json`;
      renameSync(
        path.join(root, ".project-knowledge-local/candidate.md"),
        path.join(root, claimRelative),
      );
      write(
        root,
        ownerRelative,
        `${JSON.stringify({ reviewId: id, pid: 2_147_483_647, token: "stale-owner" })}\n`,
      );

      const listed = run(root, ["--list"]);
      const recovered = run(root, ["--recover", claimRelative]);

      expect(listed.stdout).toContain(`${claimRelative} [pending] reason=stale-review-owner`);
      expect(recovered.status, recovered.stderr).toBe(0);
      expect(existsSync(path.join(root, ownerRelative))).toBe(false);
      expect(readFileSync(path.join(root, ".project-knowledge-local/candidate.md"), "utf8")).toBe(
        candidate(),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("shows the same isolated pending and invalid claim states in start and list", () => {
    const root = setup();
    const outside = mkdtempSync(path.join(tmpdir(), "project-knowledge-invalid-claim-"));
    try {
      const pending =
        ".project-knowledge-local/candidate.review-44444444-4444-4444-8444-444444444444.md";
      const symlinkClaim =
        ".project-knowledge-local/candidate.review-55555555-5555-4555-8555-555555555555.md";
      const malformed = ".project-knowledge-local/candidate.review-not-a-uuid.md";
      renameSync(
        path.join(root, ".project-knowledge-local/candidate.md"),
        path.join(root, pending),
      );
      write(outside, "outside.md", candidate());
      symlinkSync(path.join(outside, "outside.md"), path.join(root, symlinkClaim));
      write(root, malformed, candidate());

      const listed = run(root, ["--list"]);
      const started = runStart(root);

      expect(listed.status, listed.stderr).toBe(0);
      expect(started.status, started.stderr).toBe(0);
      expect(candidateRows(started.stdout)).toEqual(candidateRows(listed.stdout));
      expect(listed.stdout).toContain(`${pending} [pending] reason=no-result`);
      expect(listed.stdout).toContain(
        `${symlinkClaim} [invalid] reason=claim-must-be-regular-file`,
      );
      expect(listed.stdout).toContain(`${malformed} [invalid] reason=malformed-claim-name`);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("isolates an unreadable rejected result without hiding another pending claim", () => {
    const root = setup();
    try {
      const blockedId = "12121212-1212-4121-8121-121212121212";
      const pendingId = "34343434-3434-4343-8343-343434343434";
      const blockedClaim = `.project-knowledge-local/candidate.review-${blockedId}.md`;
      const pendingClaim = `.project-knowledge-local/candidate.review-${pendingId}.md`;
      renameSync(
        path.join(root, ".project-knowledge-local/candidate.md"),
        path.join(root, blockedClaim),
      );
      write(root, pendingClaim, candidate());
      const unreadableResult = path.join(
        root,
        `.project-knowledge-local/rejected-candidate-${blockedId}.md`,
      );
      writeFileSync(unreadableResult, renderRejectedResult(blockedId, candidate()), "utf8");
      chmodSync(unreadableResult, 0o000);

      const listed = run(root, ["--list"]);

      expect(listed.status, listed.stderr).toBe(0);
      expect(listed.stdout).toContain(
        `${blockedClaim} [conflict] reason=ambiguous-or-partial-result`,
      );
      expect(listed.stdout).toContain(`${pendingClaim} [pending] reason=no-result`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps a partial rejected result and its claim in conflict", () => {
    const root = setup();
    try {
      const id = "66666666-6666-4666-8666-666666666666";
      const claimRelative = `.project-knowledge-local/candidate.review-${id}.md`;
      renameSync(
        path.join(root, ".project-knowledge-local/candidate.md"),
        path.join(root, claimRelative),
      );
      write(root, `.project-knowledge-local/rejected-candidate-${id}.md`, "partial result\n");

      const listed = run(root, ["--list"]);
      const recovered = run(root, ["--recover", claimRelative]);
      const discarded = run(root, ["--discard-applied-claim", claimRelative]);

      expect(listed.stdout).toContain(
        `${claimRelative} [conflict] reason=ambiguous-or-partial-result`,
      );
      expect(recovered.status).not.toBe(0);
      expect(discarded.status).not.toBe(0);
      expect(existsSync(path.join(root, claimRelative))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("discards a claim only after a complete framed rejected result", () => {
    const root = setup();
    try {
      const id = "77777777-7777-4777-8777-777777777777";
      const claimRelative = `.project-knowledge-local/candidate.review-${id}.md`;
      renameSync(
        path.join(root, ".project-knowledge-local/candidate.md"),
        path.join(root, claimRelative),
      );
      write(
        root,
        `.project-knowledge-local/rejected-candidate-${id}.md`,
        renderRejectedResult(id, candidate(), "not shared"),
      );

      const listed = run(root, ["--list"]);
      const discarded = run(root, ["--discard-applied-claim", claimRelative]);

      expect(listed.stdout).toContain(
        `${claimRelative} [already-rejected] reason=complete-rejected-result`,
      );
      expect(discarded.status, discarded.stderr).toBe(0);
      expect(existsSync(path.join(root, claimRelative))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("treats duplicate complete shared review identities as conflict", () => {
    const root = setup();
    try {
      const id = "88888888-8888-4888-8888-888888888888";
      const claimRelative = `.project-knowledge-local/candidate.review-${id}.md`;
      renameSync(
        path.join(root, ".project-knowledge-local/candidate.md"),
        path.join(root, claimRelative),
      );
      const frame = renderSharedMemoryEntry({
        reviewId: id,
        date: "2026-08-10",
        sourcePath: ".project-knowledge-local/candidate.md",
        candidate: candidate(),
      });
      write(root, "docs/project-knowledge/shared-memory.md", `# Shared memory\n${frame}${frame}`);

      const listed = run(root, ["--list"]);

      expect(listed.stdout).toContain(
        `${claimRelative} [conflict] reason=ambiguous-or-partial-result`,
      );
      expect(existsSync(path.join(root, claimRelative))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("isolates an unrelated invalid authority frame from a valid completed claim", () => {
    const root = setup();
    try {
      const claimId = "89898989-8989-4989-8989-898989898989";
      const invalidId = "90909090-9090-4090-8090-909090909090";
      const claimRelative = `.project-knowledge-local/candidate.review-${claimId}.md`;
      renameSync(
        path.join(root, ".project-knowledge-local/candidate.md"),
        path.join(root, claimRelative),
      );
      const validFrame = renderSharedMemoryEntry({
        reviewId: claimId,
        date: "2026-08-10",
        sourcePath: ".project-knowledge-local/candidate.md",
        candidate: candidate(),
      });
      const invalidFrame = renderSharedMemoryEntry({
        reviewId: invalidId,
        date: "2026-08-10",
        sourcePath: ".project-knowledge-local/candidate.md",
        candidate: candidate("docs/missing-unrelated-authority.md"),
      });
      write(
        root,
        "docs/project-knowledge/shared-memory.md",
        `# Shared memory\n${invalidFrame}${validFrame}`,
      );

      const listed = run(root, ["--list"]);
      const discarded = run(root, ["--discard-applied-claim", claimRelative]);

      expect(listed.stdout).toContain(
        `${claimRelative} [already-shared] reason=complete-shared-result`,
      );
      expect(discarded.status, discarded.stderr).toBe(0);
      expect(existsSync(path.join(root, claimRelative))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails every claim closed when shared framing is malformed", () => {
    const root = setup();
    try {
      const claimId = "99999999-9999-4999-8999-999999999999";
      const otherId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      const claimRelative = `.project-knowledge-local/candidate.review-${claimId}.md`;
      renameSync(
        path.join(root, ".project-knowledge-local/candidate.md"),
        path.join(root, claimRelative),
      );
      const malformed = renderSharedMemoryEntry({
        reviewId: otherId,
        date: "2026-08-10",
        sourcePath: ".project-knowledge-local/candidate.md",
        candidate: candidate().replace("knowledge_lane: process", "knowledge_lane: project"),
      }).replace(/sha256=[0-9a-f]{64}/, `sha256=${"0".repeat(64)}`);
      write(root, "docs/project-knowledge/shared-memory.md", `# Shared memory\n${malformed}`);

      const listed = run(root, ["--list"]);

      expect(listed.stdout).toContain(
        `${claimRelative} [conflict] reason=ambiguous-or-partial-result`,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses to append onto malformed shared framing and restores the candidate", () => {
    const root = setup();
    try {
      const sharedPath = path.join(root, "docs/project-knowledge/shared-memory.md");
      const malformed = renderSharedMemoryEntry({
        reviewId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        date: "2026-08-10",
        sourcePath: ".project-knowledge-local/candidate.md",
        candidate: candidate().replace("knowledge_lane: process", "knowledge_lane: project"),
      }).replace(/sha256=[0-9a-f]{64}/, `sha256=${"0".repeat(64)}`);
      writeFileSync(sharedPath, `# Shared memory\n${malformed}`, "utf8");
      const before = readFileSync(sharedPath, "utf8");

      const result = run(root, ["--approve", ".project-knowledge-local/candidate.md"]);

      expect(result.status).not.toBe(0);
      expect(readFileSync(sharedPath, "utf8")).toBe(before);
      expect(readFileSync(path.join(root, ".project-knowledge-local/candidate.md"), "utf8")).toBe(
        candidate(),
      );
      expect(
        readdirSync(path.join(root, ".project-knowledge-local")).filter((name) =>
          name.startsWith("candidate.review-"),
        ),
      ).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("discards an interrupted claim only when its review id is already shared", () => {
    const root = setup();
    try {
      const id = "22222222-2222-4222-8222-222222222222";
      const claimRelative = `.project-knowledge-local/candidate.review-${id}.md`;
      renameSync(
        path.join(root, ".project-knowledge-local/candidate.md"),
        path.join(root, claimRelative),
      );
      write(
        root,
        "docs/project-knowledge/shared-memory.md",
        `# Shared memory\n\nProject Knowledge review id: ${id}\n`,
      );

      const listed = run(root, ["--list"]);
      expect(listed.stdout).toContain(`${claimRelative} [already-shared]`);
      const discarded = run(root, ["--discard-applied-claim", claimRelative]);

      expect(discarded.status).toBe(0);
      expect(existsSync(path.join(root, claimRelative))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves both artifacts when a pending claim conflicts with a newer canonical candidate", () => {
    const root = setup();
    try {
      const claimRelative =
        ".project-knowledge-local/candidate.review-33333333-3333-4333-8333-333333333333.md";
      renameSync(
        path.join(root, ".project-knowledge-local/candidate.md"),
        path.join(root, claimRelative),
      );
      write(root, ".project-knowledge-local/candidate.md", candidate().replace("process", "new"));

      const listed = run(root, ["--list"]);
      expect(listed.stdout).toContain(`${claimRelative} [canonical-conflict]`);
      const recovered = run(root, ["--recover", claimRelative]);

      expect(recovered.status).not.toBe(0);
      expect(existsSync(path.join(root, claimRelative))).toBe(true);
      expect(existsSync(path.join(root, ".project-knowledge-local/candidate.md"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("validates metadata before changing shared memory or deleting the candidate", () => {
    const root = setup();
    try {
      write(root, ".project-knowledge-local/candidate.md", candidate("missing-owner.md"));
      const result = run(root, ["--approve", ".project-knowledge-local/candidate.md"]);

      expect(result.status).not.toBe(0);
      expect(readFileSync(path.join(root, "docs/project-knowledge/shared-memory.md"), "utf8")).toBe(
        "# Shared memory\n",
      );
      expect(readFileSync(path.join(root, ".project-knowledge-local/candidate.md"), "utf8")).toBe(
        candidate("missing-owner.md"),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
