import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = process.cwd();
const REMEMBER_SCRIPT = path.join(REPO_ROOT, "scripts/project-knowledge/remember.ts");
const TSX = path.join(REPO_ROOT, "node_modules/.bin/tsx");

function run(root: string, args: string[]) {
  return spawnSync(TSX, [REMEMBER_SCRIPT, ...args], { cwd: root, encoding: "utf8" });
}

function setupRoot(): string {
  return mkdtempSync(path.join(tmpdir(), "project-knowledge-remember-"));
}

function workMemoryPath(root: string): string {
  return path.join(root, ".project-knowledge-local/work-memory.md");
}

function workMemoryLogPath(root: string): string {
  return path.join(root, ".project-knowledge-local/work-memory-log.jsonl");
}

describe("pk:remember --encoding-depth / --role enum validation", () => {
  it("rejects an invalid --encoding-depth before writing any file", () => {
    const root = setupRoot();
    try {
      const result = run(root, [
        "--note",
        "테스트 narrative",
        "--domain-tags",
        "테스트",
        "--encoding-depth",
        "bogus-depth",
      ]);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("--encoding-depth");
      expect(result.stderr).toContain("decision | discovery | discussion | mention");
      expect(existsSync(workMemoryPath(root))).toBe(false);
      expect(existsSync(workMemoryLogPath(root))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects an invalid --role before writing any file", () => {
    const root = setupRoot();
    try {
      const result = run(root, [
        "--note",
        "테스트 narrative",
        "--domain-tags",
        "테스트",
        "--role",
        "bogus-role",
      ]);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("--role");
      expect(result.stderr).toContain("goal | decision | constraint | result | issue");
      expect(existsSync(workMemoryPath(root))).toBe(false);
      expect(existsSync(workMemoryLogPath(root))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(["decision", "discovery", "discussion", "mention"] as const)(
    "accepts a valid --encoding-depth value: %s",
    (depth) => {
      const root = setupRoot();
      try {
        const result = run(root, [
          "--note",
          "테스트 narrative",
          "--domain-tags",
          "테스트",
          "--encoding-depth",
          depth,
        ]);

        expect(result.status, result.stderr).toBe(0);
        const body = readFileSync(workMemoryPath(root), "utf8");
        expect(body).toContain(`encoding_depth: ${depth}`);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it("defaults --encoding-depth to mention when the flag is absent", () => {
    const root = setupRoot();
    try {
      const result = run(root, ["--note", "테스트 narrative", "--domain-tags", "테스트"]);

      expect(result.status, result.stderr).toBe(0);
      const body = readFileSync(workMemoryPath(root), "utf8");
      expect(body).toContain("encoding_depth: mention");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(["goal", "decision", "constraint", "result", "issue"] as const)(
    "accepts a valid --role value: %s",
    (role) => {
      const root = setupRoot();
      try {
        const result = run(root, [
          "--note",
          "테스트 narrative",
          "--domain-tags",
          "테스트",
          "--role",
          role,
        ]);

        expect(result.status, result.stderr).toBe(0);
        const body = readFileSync(workMemoryPath(root), "utf8");
        expect(body).toContain(`role: ${role}`);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it("accepts an absent --role", () => {
    const root = setupRoot();
    try {
      const result = run(root, ["--note", "테스트 narrative", "--domain-tags", "테스트"]);

      expect(result.status, result.stderr).toBe(0);
      const body = readFileSync(workMemoryPath(root), "utf8");
      expect(body).toContain("role: 명시 없음");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("pk:remember empty recall-key warning", () => {
  it("warns on stderr when both --domain-tags and --entities are absent", () => {
    const root = setupRoot();
    try {
      const result = run(root, ["--note", "테스트 narrative"]);

      expect(result.status, result.stderr).toBe(0);
      const stderrLines = result.stderr.trim().split("\n").filter(Boolean);
      expect(stderrLines).toHaveLength(1);
      expect(stderrLines[0]).toContain("회상 키가 비어 있다");
      expect(stderrLines[0]).toContain("docs/project-knowledge/README.md § 회상 키 기준");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not warn when --domain-tags is given", () => {
    const root = setupRoot();
    try {
      const result = run(root, ["--note", "테스트 narrative", "--domain-tags", "태그1"]);

      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).not.toContain("회상 키가 비어 있다");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not warn when --entities is given", () => {
    const root = setupRoot();
    try {
      const result = run(root, ["--note", "테스트 narrative", "--entities", "PostHog"]);

      expect(result.status, result.stderr).toBe(0);
      expect(result.stderr).not.toContain("회상 키가 비어 있다");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
