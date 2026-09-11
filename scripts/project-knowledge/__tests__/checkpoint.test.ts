import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const CHECKPOINT_SCRIPT = path.join(REPO_ROOT, "scripts/project-knowledge/checkpoint.ts");
const TSX = path.join(REPO_ROOT, "node_modules/.bin/tsx");

describe("Project Knowledge checkpoint", () => {
  it("places the full exact HEAD in candidate source and grounding refs", () => {
    const root = mkdtempSync(path.join(tmpdir(), "project-knowledge-checkpoint-"));
    try {
      mkdirSync(path.join(root, "docs"), { recursive: true });
      writeFileSync(path.join(root, "docs/product-identity.md"), "# Product identity\n", "utf8");
      execFileSync("git", ["init", "-q"], { cwd: root });
      execFileSync("git", ["config", "user.email", "project-knowledge@example.test"], {
        cwd: root,
      });
      execFileSync("git", ["config", "user.name", "Project Knowledge Test"], { cwd: root });
      execFileSync("git", ["add", "docs/product-identity.md"], { cwd: root });
      execFileSync("git", ["commit", "-qm", "test authority"], { cwd: root });
      const head = execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim();
      writeFileSync(
        path.join(root, "docs/product-identity.md"),
        "# Product identity\n\nchanged\n",
        "utf8",
      );

      const result = spawnSync(TSX, [CHECKPOINT_SCRIPT], { cwd: root, encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
      const candidate = readFileSync(
        path.join(root, ".project-knowledge-local/candidate.md"),
        "utf8",
      );

      expect(candidate).toContain(`- commit: ${head}`);
      expect(candidate).toContain(`ref: ${head}`);
      expect(candidate).toContain("## 조직화 검토");
      expect(candidate).toContain("기존 객체 enrich/revise/split");
      expect(candidate).toContain("concept/model의 relation target");
      expect(candidate).toContain("relation 없는 orphan case");
      expect(head).toMatch(/^[0-9a-f]{40}$/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
