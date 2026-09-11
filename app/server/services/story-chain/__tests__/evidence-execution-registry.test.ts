import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import type { EvidenceLedgerExecution } from "@/app/domain/story-chain";
import {
  compileEvidenceExecution,
  executionIdentity,
  executionWithoutId,
  parseLegacyExecutionCommand,
  parseLegacyExecutionCommands,
} from "../evidence-execution-registry";

const temporaryDirectories: string[] = [];

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    rmSync(directory, { recursive: true, force: true });
  });
});

function writeRepositoryFile(root: string, relativePath: string, body = "export {};\n"): void {
  const absolute = path.join(root, relativePath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, body);
}

function repositoryFixture(scripts: Record<string, string> = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), "evidence-execution-"));
  temporaryDirectories.push(root);
  writeRepositoryFile(root, "package.json", JSON.stringify({ scripts }));
  return root;
}

describe("Evidence execution registry", () => {
  it("splits only closed legacy composition while preserving quoted separators", () => {
    expect(
      parseLegacyExecutionCommands(
        'npx vitest run app/a.test.ts -t "A && B" && npm run guard:auth-hot-path',
      ),
    ).toEqual([
      {
        kind: "vitest",
        files: ["app/a.test.ts"],
        testNamePattern: "A && B",
      },
      { kind: "guard", script: "guard:auth-hot-path" },
    ]);

    expect(
      parseLegacyExecutionCommands(
        "npx tsx scripts/evidence-ledger/helpers/contract-check.ts documents gap-context; npm run mc:check-critical-findings",
      ),
    ).toEqual([
      { kind: "contract-check", target: "documents", subcase: "gap-context" },
      { kind: "registered-script", script: "mc-check-critical-findings" },
    ]);
  });

  it.each([
    "npx vitest run ../outside.test.ts",
    "npx vitest run app/a.test.ts && npm run lint",
    "npx vitest run app/a.test.ts | tee result",
    "npm run lint",
    "npx vitest run app/a.test.ts -t",
    'npx vitest run app/a.test.ts -t "A" app/b.test.ts',
    "npx vitest run app/a.test.js",
    "npx vitest run app/a.test.ts.bak",
    "npx vitest run app/../a.test.ts",
    "npx vitest run app/./a.test.ts",
    "npx vitest run /tmp/a.test.ts",
    "npx vitest run -t A",
    "npx vitest run app/a.test.ts -t --runInBand",
    "npx vitest run app/a.test.ts &&",
    "&& npm run guard:auth-hot-path",
    "npx vitest run app/a.test.ts & npm run guard:auth-hot-path",
    'npx vitest run app/a.test.ts -t "unterminated',
    "npx vitest run app/a.test.ts -t A$B",
    "npx tsx scripts/evidence-ledger/helpers/contract-check.ts documents unknown",
    "npm run guard:korean -- --fix",
  ])("rejects an unbounded legacy command: %s", (command) => {
    expect(() => parseLegacyExecutionCommands(command)).toThrow();
  });

  it("recognizes every registered legacy execution shape without substring matching", () => {
    expect(
      parseLegacyExecutionCommand(
        "npx tsx scripts/mission-control/check-message-registry-contract.ts",
      ),
    ).toEqual({ kind: "registered-script", script: "message-registry-contract" });
    expect(
      parseLegacyExecutionCommand(
        "node scripts/evidence-ledger/relationship-seed-sticky-browser-check.mjs",
      ),
    ).toEqual({ kind: "registered-script", script: "relationship-seed-sticky-browser" });
    expect(parseLegacyExecutionCommand("npm run guard:korean")).toEqual({
      kind: "guard",
      script: "guard:korean",
    });

    expect(() =>
      parseLegacyExecutionCommand(
        "echo scripts/mission-control/check-message-registry-contract.ts",
      ),
    ).toThrow("outside the closed Evidence Ledger grammar");
    for (const nearMiss of [
      "tsx scripts/mission-control/check-message-registry-contract.ts",
      "npx node scripts/mission-control/check-message-registry-contract.ts",
      "npx tsx scripts/mission-control/check-message-registry-contract.ts extra",
      "node scripts/evidence-ledger/relationship-seed-sticky-browser-check.mjs extra",
      "tsx scripts/evidence-ledger/relationship-seed-sticky-browser-check.mjs",
      "echo scripts/evidence-ledger/relationship-seed-sticky-browser-check.mjs",
    ]) {
      expect(() => parseLegacyExecutionCommand(nearMiss)).toThrow(
        "outside the closed Evidence Ledger grammar",
      );
    }

    expect(
      parseLegacyExecutionCommand('npx vitest run app/a.test.ts -t "A \\"quoted\\" test"'),
    ).toEqual({
      kind: "vitest",
      files: ["app/a.test.ts"],
      testNamePattern: 'A "quoted" test',
    });
  });

  it("requires exact package dispatch instead of substring target presence", () => {
    const valid = repositoryFixture({
      "guard:auth-hot-path": "node scripts/quality/check-auth-hot-path.mjs",
    });
    writeRepositoryFile(valid, "scripts/quality/check-auth-hot-path.mjs");
    expect(
      compileEvidenceExecution(valid, {
        id: "execution:guard",
        kind: "guard",
        script: "guard:auth-hot-path",
      }),
    ).toEqual({ binary: "npm", argv: ["run", "guard:auth-hot-path"] });

    const falsePositive = repositoryFixture({
      "guard:auth-hot-path": "echo scripts/quality/check-auth-hot-path.mjs",
    });
    writeRepositoryFile(falsePositive, "scripts/quality/check-auth-hot-path.mjs");
    expect(() =>
      compileEvidenceExecution(falsePositive, {
        id: "execution:guard",
        kind: "guard",
        script: "guard:auth-hot-path",
      }),
    ).toThrow("package dispatch differs from the registered exact command");

    const missingTarget = repositoryFixture({
      "guard:auth-hot-path": "node scripts/quality/check-auth-hot-path.mjs",
    });
    expect(() =>
      compileEvidenceExecution(missingTarget, {
        id: "execution:guard",
        kind: "guard",
        script: "guard:auth-hot-path",
      }),
    ).toThrow();

    expect(() =>
      compileEvidenceExecution(valid, {
        id: "execution:guard",
        kind: "guard",
        script: "guard:not-registered",
      } as unknown as EvidenceLedgerExecution),
    ).toThrow("guard is not registered");
  });

  it("passes validated Vitest files as positional filters instead of dropping them after --", () => {
    const file = "app/server/services/story-chain/__tests__/evidence-execution-registry.test.ts";
    const compiled = compileEvidenceExecution(process.cwd(), {
      id: "execution:focused",
      kind: "vitest",
      files: [file],
      testNamePattern: "passes validated Vitest files",
    });

    expect(compiled.argv).toEqual([
      expect.stringMatching(/node_modules\/vitest\/vitest\.mjs$/),
      "run",
      "-t",
      "passes validated Vitest files",
      file,
    ]);
    expect(compiled.argv).not.toContain("--");
  });
});

describe("Evidence execution registry compilation boundaries", () => {
  it("compiles every structured execution through its exact contained target", () => {
    const root = repositoryFixture({
      "guard:auth-hot-path": "node scripts/quality/check-auth-hot-path.mjs",
      "mc:check-critical-findings": "tsx scripts/mission-control/mc-check-critical-findings.ts",
      "test:db:gap-report-concurrency": "tsx scripts/db-integration/run-gap-report-concurrency.ts",
    });
    for (const file of [
      "node_modules/vitest/vitest.mjs",
      "node_modules/tsx/dist/cli.mjs",
      "app/a.test.ts",
      "scripts/evidence-ledger/helpers/contract-check.ts",
      "scripts/quality/check-auth-hot-path.mjs",
      "scripts/mission-control/mc-check-critical-findings.ts",
      "scripts/mission-control/check-message-registry-contract.ts",
      "scripts/evidence-ledger/relationship-seed-sticky-browser-check.mjs",
      "scripts/db-integration/run-gap-report-concurrency.ts",
    ]) {
      writeRepositoryFile(root, file);
    }
    const canonicalRoot = realpathSync(root);

    expect(
      compileEvidenceExecution(root, {
        id: "execution:vitest",
        kind: "vitest",
        files: ["app/a.test.ts"],
      }),
    ).toEqual({
      binary: process.execPath,
      argv: [path.join(canonicalRoot, "node_modules/vitest/vitest.mjs"), "run", "app/a.test.ts"],
    });
    expect(
      compileEvidenceExecution(root, {
        id: "execution:contract",
        kind: "contract-check",
        target: "documents",
        subcase: "gap-context",
      }),
    ).toEqual({
      binary: process.execPath,
      argv: [
        path.join(canonicalRoot, "node_modules/tsx/dist/cli.mjs"),
        path.join(canonicalRoot, "scripts/evidence-ledger/helpers/contract-check.ts"),
        "documents",
        "gap-context",
      ],
    });
    expect(
      compileEvidenceExecution(root, {
        id: "execution:db",
        kind: "registered-script",
        script: "gap-report-concurrency",
      }),
    ).toEqual({
      binary: "npm",
      argv: ["run", "test:db:gap-report-concurrency"],
    });
    expect(
      compileEvidenceExecution(root, {
        id: "execution:critical",
        kind: "registered-script",
        script: "mc-check-critical-findings",
      }),
    ).toEqual({
      binary: process.execPath,
      argv: [
        path.join(canonicalRoot, "node_modules/tsx/dist/cli.mjs"),
        path.join(canonicalRoot, "scripts/mission-control/mc-check-critical-findings.ts"),
      ],
    });
    expect(
      compileEvidenceExecution(root, {
        id: "execution:message",
        kind: "registered-script",
        script: "message-registry-contract",
      }),
    ).toEqual({
      binary: process.execPath,
      argv: [
        path.join(canonicalRoot, "node_modules/tsx/dist/cli.mjs"),
        path.join(canonicalRoot, "scripts/mission-control/check-message-registry-contract.ts"),
      ],
    });
    expect(
      compileEvidenceExecution(root, {
        id: "execution:browser",
        kind: "registered-script",
        script: "relationship-seed-sticky-browser",
      }),
    ).toEqual({
      binary: process.execPath,
      argv: [
        path.join(
          canonicalRoot,
          "scripts/evidence-ledger/relationship-seed-sticky-browser-check.mjs",
        ),
      ],
    });

    const wrongCriticalDispatch = repositoryFixture({
      "mc:check-critical-findings": "tsx scripts/mission-control/not-the-critical-check.ts",
    });
    writeRepositoryFile(wrongCriticalDispatch, "node_modules/tsx/dist/cli.mjs");
    writeRepositoryFile(
      wrongCriticalDispatch,
      "scripts/mission-control/mc-check-critical-findings.ts",
    );
    expect(() =>
      compileEvidenceExecution(wrongCriticalDispatch, {
        id: "execution:critical",
        kind: "registered-script",
        script: "mc-check-critical-findings",
      }),
    ).toThrow("package dispatch differs from the registry");
  });

  it("rejects a structured test target that resolves through a symlink outside the repository", () => {
    const root = repositoryFixture();
    writeRepositoryFile(root, "node_modules/vitest/vitest.mjs");
    const outside = mkdtempSync(path.join(tmpdir(), "evidence-execution-outside-"));
    temporaryDirectories.push(outside);
    writeRepositoryFile(outside, "escape.test.ts");
    mkdirSync(path.join(root, "app"), { recursive: true });
    symlinkSync(path.join(outside, "escape.test.ts"), path.join(root, "app/escape.test.ts"));

    expect(() =>
      compileEvidenceExecution(root, {
        id: "execution:escape",
        kind: "vitest",
        files: ["app/escape.test.ts"],
      }),
    ).toThrow("execution target resolves outside the repository");
  });

  it("rejects a structured execution target that is not a regular file", () => {
    const root = repositoryFixture();
    writeRepositoryFile(root, "node_modules/vitest/vitest.mjs");
    mkdirSync(path.join(root, "app/not-a-file.test.ts"), { recursive: true });

    expect(() =>
      compileEvidenceExecution(root, {
        id: "execution:directory",
        kind: "vitest",
        files: ["app/not-a-file.test.ts"],
      }),
    ).toThrow("execution target is not a regular file");
  });

  it("keeps execution identity and id removal stable across every execution kind", () => {
    expect(
      executionIdentity({
        kind: "vitest",
        files: ["app/a.test.ts"],
        testNamePattern: "A",
      }),
    ).toBe('["vitest",["app/a.test.ts"],"A"]');
    expect(
      executionIdentity({
        kind: "contract-check",
        target: "documents",
        subcase: "gap-context",
      }),
    ).toBe('["contract-check","documents","gap-context"]');
    expect(executionIdentity({ kind: "guard", script: "guard:korean" })).toBe(
      '["guard","guard:korean"]',
    );
    expect(
      executionIdentity({
        kind: "registered-script",
        script: "relationship-seed-sticky-browser",
      }),
    ).toBe('["registered-script","relationship-seed-sticky-browser"]');
    expect(executionIdentity({ kind: "registered-script", script: "gap-report-concurrency" })).toBe(
      '["registered-script","gap-report-concurrency"]',
    );
    expect(
      executionWithoutId({
        id: "execution:vitest",
        kind: "vitest",
        files: ["app/a.test.ts"],
        testNamePattern: "A",
      }),
    ).toEqual({ kind: "vitest", files: ["app/a.test.ts"], testNamePattern: "A" });
    expect(
      executionWithoutId({
        id: "execution:contract",
        kind: "contract-check",
        target: "documents",
        subcase: "gap-context",
      }),
    ).toEqual({ kind: "contract-check", target: "documents", subcase: "gap-context" });
    expect(
      executionWithoutId({
        id: "execution:guard",
        kind: "guard",
        script: "guard:korean",
      }),
    ).toEqual({ kind: "guard", script: "guard:korean" });
    expect(
      executionWithoutId({
        id: "execution:browser",
        kind: "registered-script",
        script: "relationship-seed-sticky-browser",
      }),
    ).toEqual({ kind: "registered-script", script: "relationship-seed-sticky-browser" });
    expect(
      executionWithoutId({
        id: "execution:db",
        kind: "registered-script",
        script: "gap-report-concurrency",
      }),
    ).toEqual({ kind: "registered-script", script: "gap-report-concurrency" });
  });
});
