import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { renderReleaseVerdictDocumentBlock } from "@/app/domain/story-chain";
import type { EvidenceLedgerV2Data } from "@/app/server/services/story-chain/evidence-ledger-v2";
import { serializeEvidenceLedgerV2 } from "@/app/server/services/story-chain/evidence-ledger-v2";
import { buildAlignmentSnapshot } from "@/scripts/mission-control/lib/alignment-audit";
import { parseArgsStringToArgv } from "string-argv";

const fixtureRoots: string[] = [];

function writeText(root: string, relativePath: string, content: string) {
  const absolutePath = join(root, relativePath);
  mkdirSync(join(absolutePath, ".."), { recursive: true });
  writeFileSync(absolutePath, content);
}

function createFixture(params: {
  runCommand: string;
  omitCoverageForAc2?: boolean;
  duplicateAc1InSameLedger?: boolean;
  addAspectLedgerDuplicateForAc1?: boolean;
  omitScenarioCoverage?: boolean;
  momentExperience?: string;
  extraFiles?: Array<{ path: string; content: string }>;
}) {
  const root = mkdtempSync(join(tmpdir(), "alignment-audit-"));
  fixtureRoots.push(root);
  mkdirSync(join(root, "docs/contracts/story-chain/evidence-ledgers/reviews"), {
    recursive: true,
  });
  mkdirSync(join(root, "docs/contracts/story-chain/service-policy-coverage"));
  writeText(root, "docs/mission-control.md", renderReleaseVerdictDocumentBlock());

  writeText(
    root,
    "docs/contracts/story-chain/experiences/operator-alignment-audit.md",
    `---
id: experience:operator-alignment-audit
slug: operator-alignment-audit
title: Operator alignment audit
scope: governance
---

# Operator alignment audit
`,
  );
  writeText(
    root,
    "docs/contracts/story-chain/moments/visibility.md",
    `---
id: moment:visibility
slug: visibility
title: Visibility
experience: ${params.momentExperience ?? "experience:operator-alignment-audit"}
---

# Visibility
`,
  );
  writeText(
    root,
    "docs/contracts/story-chain/promises/snapshot-overview.md",
    `---
id: promise:snapshot-overview
slug: snapshot-overview
title: Snapshot overview
moment: moment:visibility
lane: admin
status: propagated
aspects:
  - aspect:alignment-audit-source-of-truth
acceptanceChecks:
  - acceptance-check:snapshot-overview-ac1
  - acceptance-check:snapshot-overview-ac2
coveringLedgers:
  - docs/contracts/story-chain/evidence-ledgers/alignment-audit.ledger.yaml
verdict: unknown
---

# Snapshot overview

## Promise

I want a deterministic alignment snapshot so that I can inspect the contract chain.

## Acceptance Checks

### acceptance-check:snapshot-overview-ac1

- description: The snapshot resolves the contract chain.
- evidence: docs/contracts/story-chain/evidence-ledgers/alignment-audit.ledger.yaml

### acceptance-check:snapshot-overview-ac2

- description: The snapshot reports findings and summary counts.
- evidence: docs/contracts/story-chain/evidence-ledgers/alignment-audit.ledger.yaml
`,
  );
  writeText(
    root,
    "docs/contracts/story-chain/aspects/alignment-audit-source-of-truth.md",
    `---
id: aspect:alignment-audit-source-of-truth
slug: alignment-audit-source-of-truth
title: Alignment audit source of truth
appliesTo:
  - promise:snapshot-overview
coveringLedger: docs/contracts/story-chain/evidence-ledgers/alignment-audit.ledger.yaml
verdict: unverified
---

# Alignment audit source of truth

## Why

Reads Story Chain and Evidence Ledger files as the canonical audit source.
`,
  );
  writeText(
    root,
    "docs/contracts/story-chain/traceability-cardinality.json",
    JSON.stringify(
      {
        version: 1,
        relations: [
          {
            name: "experience_moments",
            from: "experience",
            to: "moment",
            count: "1 -> 1..*",
            description: "Every Moment belongs to exactly one Experience.",
          },
          {
            name: "moment_promises",
            from: "moment",
            to: "promise",
            count: "1 -> 1..*",
            description: "Every Promise belongs to exactly one Moment.",
          },
          {
            name: "promise_acceptance_checks",
            from: "promise",
            to: "acceptance-check",
            count: "1 -> 1..*",
            description: "Every Promise has at least one Acceptance Check.",
          },
          {
            name: "promise_evidence_ledgers",
            from: "promise",
            to: "evidence-ledger",
            count: "1..* -> 1..*",
            description: "Every Promise is covered by at least one Evidence Ledger.",
          },
          {
            name: "acceptance_check_evidence",
            from: "acceptance-check",
            to: "evidence-ledger-entry",
            count: "1 -> 1..*",
            description: "Every Acceptance Check is cited by at least one evidence entry.",
          },
        ],
        deferredVerificationTriggers: [],
      },
      null,
      2,
    ),
  );

  const args = parseArgsStringToArgv(params.runCommand);
  if (args[0] !== "npx" || args[1] !== "vitest" || args[2] !== "run") {
    throw new Error(`fixture supports vitest commands only: ${params.runCommand}`);
  }
  const files = args.slice(3).filter((argument) => !argument.startsWith("-"));
  const acceptanceChecks: EvidenceLedgerV2Data["acceptanceChecks"] = [
    {
      key: "promise:snapshot-overview#acceptance-check:snapshot-overview-ac1",
      assertion: "The snapshot resolves the contract chain.",
      executionRefs: ["execution:snapshot"],
      scenarios: params.omitScenarioCoverage ? [] : ["scenario:search-basic"],
    },
  ];
  if (params.duplicateAc1InSameLedger) acceptanceChecks.push({ ...acceptanceChecks[0] });
  if (!params.omitCoverageForAc2) {
    acceptanceChecks.push({
      key: "promise:snapshot-overview#acceptance-check:snapshot-overview-ac2",
      assertion: "The snapshot reports findings and summary counts.",
      executionRefs: ["execution:snapshot"],
      scenarios: [],
    });
  }
  const ledger: EvidenceLedgerV2Data = {
    schemaVersion: 2,
    slug: "alignment-audit",
    sourcePromises: ["promise:snapshot-overview"],
    appliedAspects: ["aspect:alignment-audit-source-of-truth"],
    intent: { mode: "absorbed", checks: [], delegations: [] },
    acceptanceChecks,
    executions: [{ id: "execution:snapshot", kind: "vitest", files }],
    implementationContracts: ["scripts/mission-control/lib/alignment-audit.ts"],
    verdict: "unknown",
  };
  writeText(
    root,
    "docs/contracts/story-chain/evidence-ledgers/alignment-audit.ledger.yaml",
    serializeEvidenceLedgerV2(ledger),
  );
  if (params.addAspectLedgerDuplicateForAc1) {
    writeAspectLedgerDuplicate(root, params.runCommand);
  }
  writeText(
    root,
    "docs/contracts/story-chain/evidence-ledgers/foundational/index.md",
    "---\nfoundational: true\n---\n# Index\n",
  );
  writeText(
    root,
    "docs/contracts/story-chain/evidence-ledgers/report.json",
    JSON.stringify({ results: [] }, null, 2),
  );
  writeText(
    root,
    "docs/contracts/story-chain/scenario-catalog.md",
    `# AI reaction scenarios

## 1. Search (search)

### 시나리오 scenario:search-basic: Search basic

상황: 사용자가 "ai for science"를 검색했고 35편이 반환됐다.

\`\`\`txt
title: AI for Science 연구 35편
body: 결과는 연구 공백 탐색으로 이어진다.
followup:
  host-owned: 연구 공백 탐색
\`\`\`
`,
  );

  for (const file of params.extraFiles ?? []) writeText(root, file.path, file.content);
  return root;
}

function git(root: string, args: string[]) {
  execFileSync("git", ["-C", root, ...args], { stdio: "ignore" });
}

function writeAspectLedgerDuplicate(root: string, runCommand: string) {
  const args = parseArgsStringToArgv(runCommand);
  writeText(
    root,
    "docs/contracts/story-chain/evidence-ledgers/aspect-intake.ledger.yaml",
    serializeEvidenceLedgerV2({
      schemaVersion: 2,
      slug: "aspect-intake",
      sourcePromises: ["promise:snapshot-overview"],
      appliedAspects: ["aspect:alignment-audit-source-of-truth"],
      intent: { mode: "absorbed", checks: [], delegations: [] },
      acceptanceChecks: [
        {
          key: "promise:snapshot-overview#acceptance-check:snapshot-overview-ac1",
          assertion: "Cross-cut aspect evidence reuses the canonical AC entry.",
          executionRefs: ["execution:snapshot"],
          scenarios: [],
        },
      ],
      executions: [
        {
          id: "execution:snapshot",
          kind: "vitest",
          files: args.slice(3).filter((argument) => !argument.startsWith("-")),
        },
      ],
      implementationContracts: ["scripts/mission-control/lib/alignment-audit.ts"],
      verdict: "met",
    }),
  );
}

describe("alignment-audit", () => {
  afterEach(() => {
    while (fixtureRoots.length > 0) {
      const root = fixtureRoots.pop();
      if (root) rmSync(root, { recursive: true, force: true });
    }
  });

  it("reports a missing target from a structured execution", () => {
    const root = createFixture({
      runCommand: "npx vitest run app/server/services/__tests__/missing.test.ts",
    });
    const snapshot = buildAlignmentSnapshot(root);
    expect(
      snapshot.findings.some((finding) => finding.category === "ac_trace_run_missing_target"),
    ).toBe(true);
    expect(snapshot.runChecks[0]?.missingTargets).toEqual([
      "app/server/services/__tests__/missing.test.ts",
    ]);
  });

  it("fails closed when a Promise Moment points to an undeclared Experience", () => {
    const root = createFixture({
      runCommand: "npx vitest run app/server/services/__tests__/missing.test.ts",
      momentExperience: "experience:missing",
    });

    expect(() => buildAlignmentSnapshot(root)).toThrow(
      /derived Experience experience:missing .* is not declared/,
    );
  });

  it("traces a run check through a test file into imported app code", () => {
    const root = createFixture({
      runCommand: "npx vitest run app/server/services/__tests__/demo.test.ts",
      extraFiles: [
        { path: "app/server/services/demo.ts", content: "export function ok() { return 'ok'; }\n" },
        {
          path: "app/server/services/__tests__/demo.test.ts",
          content:
            'import { describe, expect, it } from "vitest";\nimport { ok } from "@/app/server/services/demo";\ndescribe("demo", () => { it("works", () => { expect(ok()).toBe("ok"); }); });\n',
        },
      ],
    });
    const snapshot = buildAlignmentSnapshot(root);
    expect(
      snapshot.findings.some((finding) => finding.category === "ac_trace_run_missing_target"),
    ).toBe(false);
    expect(snapshot.runChecks[0]?.codeTargets).toContain("app/server/services/demo.ts");
  });

  it("traces a run check through a literal dynamic import into app code", () => {
    const root = createFixture({
      runCommand: "npx vitest run app/server/services/__tests__/demo.test.ts",
      extraFiles: [
        { path: "app/server/services/demo.ts", content: "export function ok() { return 'ok'; }\n" },
        {
          path: "app/server/services/__tests__/demo.test.ts",
          content:
            'import { describe, expect, it } from "vitest";\nasync function loadDemo() { return import("../demo"); }\ndescribe("demo", () => { it("works", async () => { expect((await loadDemo()).ok()).toBe("ok"); }); });\n',
        },
      ],
    });
    const snapshot = buildAlignmentSnapshot(root);
    expect(
      snapshot.findings.some((finding) => finding.category === "ac_trace_code_unreachable"),
    ).toBe(false);
    expect(snapshot.runChecks[0]?.codeTargets).toContain("app/server/services/demo.ts");
  });

  it("reads Source Promises from the structured Evidence Ledger graph", () => {
    const root = createFixture({
      runCommand: "npx vitest run app/server/services/__tests__/demo.test.ts",
    });

    const snapshot = buildAlignmentSnapshot(root);
    expect(snapshot.evidenceLedgers[0]?.sourcePromises).toEqual(["promise:snapshot-overview"]);
  });

  it("reports a missing AC ledger entry from the single structured graph", () => {
    const root = createFixture({
      runCommand: "npx vitest run app/server/services/__tests__/demo.test.ts",
      omitCoverageForAc2: true,
      extraFiles: [
        { path: "app/server/services/demo.ts", content: "export function ok() { return 'ok'; }\n" },
        {
          path: "app/server/services/__tests__/demo.test.ts",
          content:
            'import { describe, expect, it } from "vitest";\nimport { ok } from "@/app/server/services/demo";\ndescribe("demo", () => { it("works", () => { expect(ok()).toBe("ok"); }); });\n',
        },
      ],
    });
    const snapshot = buildAlignmentSnapshot(root);
    const findings = snapshot.findings.filter((f) => f.category === "missing_ac_ledger");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.acceptanceKey).toBe(
      "promise:snapshot-overview#acceptance-check:snapshot-overview-ac2",
    );
  });

  it("reports an active scenario with no owning Evidence Ledger entry", () => {
    const root = createFixture({
      runCommand: "npx vitest run app/server/services/__tests__/demo.test.ts",
      omitScenarioCoverage: true,
    });
    const snapshot = buildAlignmentSnapshot(root);
    const finding = snapshot.findings.find(
      (entry) => entry.category === "missing_scenario_coverage",
    );
    expect(finding?.severity).toBe("critical");
    expect(finding?.title).toContain("scenario:search-basic");
    expect(finding?.detail).toContain("retire the stale scenario");
  });

  it("does not treat foundational Markdown as Acceptance Check evidence", () => {
    const root = createFixture({
      runCommand: "npx vitest run app/server/services/__tests__/demo.test.ts",
      omitCoverageForAc2: true,
      extraFiles: [
        { path: "app/server/services/demo.ts", content: "export function ok() { return 'ok'; }\n" },
        {
          path: "app/server/services/__tests__/demo.test.ts",
          content:
            'import { describe, expect, it } from "vitest";\nimport { ok } from "@/app/server/services/demo";\ndescribe("demo", () => { it("works", () => { expect(ok()).toBe("ok"); }); });\n',
        },
      ],
    });
    const snapshot = buildAlignmentSnapshot(root);
    expect(snapshot.evidenceLedgers.every((ledger) => !ledger.foundational)).toBe(true);
    expect(snapshot.findings.some((f) => f.category === "missing_ac_ledger")).toBe(true);
  });

  it("does not report duplicate AC ledger rows when an Aspect ledger reuses canonical coverage", () => {
    const root = createFixture({
      runCommand: "npx vitest run app/server/services/__tests__/demo.test.ts",
      addAspectLedgerDuplicateForAc1: true,
      extraFiles: [
        { path: "app/server/services/demo.ts", content: "export function ok() { return 'ok'; }\n" },
        {
          path: "app/server/services/__tests__/demo.test.ts",
          content:
            'import { describe, expect, it } from "vitest";\nimport { ok } from "@/app/server/services/demo";\ndescribe("demo", () => { it("works", () => { expect(ok()).toBe("ok"); }); });\n',
        },
      ],
    });

    const snapshot = buildAlignmentSnapshot(root);
    expect(snapshot.findings.some((f) => f.category === "duplicate_ac_ledger")).toBe(false);
  });

  it("rejects duplicate AC entries at the strict schema boundary", () => {
    expect(() =>
      createFixture({
        runCommand: "npx vitest run app/server/services/__tests__/demo.test.ts",
        duplicateAc1InSameLedger: true,
      }),
    ).toThrow(/duplicate Acceptance Check/);
  });

  it("does not require app code reachability for scripts-owned governance checks", () => {
    const root = createFixture({
      runCommand: "npx vitest run scripts/mission-control/lib/__tests__/policy.test.ts",
      extraFiles: [
        {
          path: "scripts/mission-control/lib/__tests__/policy.test.ts",
          content:
            'import { describe, expect, it } from "vitest";\ndescribe("policy", () => { it("checks policy", () => { expect(true).toBe(true); }); });\n',
        },
      ],
    });

    const snapshot = buildAlignmentSnapshot(root);
    expect(snapshot.runChecks[0]?.executionTargets).toEqual([
      "scripts/mission-control/lib/__tests__/policy.test.ts",
    ]);
    expect(snapshot.findings.some((f) => f.category === "ac_trace_code_unreachable")).toBe(false);
  });

  it("reports duplicated high-level Story Chain concept labels as adjustment candidates", () => {
    const root = createFixture({
      runCommand: "npx vitest run app/server/services/__tests__/demo.test.ts",
      extraFiles: [
        {
          path: "docs/contracts/story-chain/experiences/operator-alignment-audit-copy.md",
          content: `---
id: experience:operator-alignment-audit-copy
slug: operator-alignment-audit-copy
title: Operator alignment audit
scope: governance
---

# Operator alignment audit copy
`,
        },
        {
          path: "docs/contracts/story-chain/moments/visibility-copy.md",
          content: `---
id: moment:visibility-copy
slug: visibility-copy
title: Visibility
experience: experience:operator-alignment-audit
---

# Visibility copy
`,
        },
        { path: "app/server/services/demo.ts", content: "export function ok() { return 'ok'; }\n" },
        {
          path: "app/server/services/__tests__/demo.test.ts",
          content:
            'import { describe, expect, it } from "vitest";\nimport { ok } from "@/app/server/services/demo";\ndescribe("demo", () => { it("works", () => { expect(ok()).toBe("ok"); }); });\n',
        },
      ],
    });

    const snapshot = buildAlignmentSnapshot(root);
    const finding = snapshot.findings.find(
      (entry) => entry.category === "duplicate_high_level_concept",
    );

    expect(finding?.severity).toBe("warning");
    expect(finding?.detail).toContain("merge, split, rename, or retire");
    expect(finding?.detail).toContain("experience:operator-alignment-audit-copy");
    expect(finding?.detail).toContain("moment:visibility-copy");
  });

  it("surfaces contract update history and highlights dirty Story Chain files", () => {
    const root = createFixture({
      runCommand: "npx vitest run app/server/services/__tests__/demo.test.ts",
      extraFiles: [
        { path: "app/server/services/demo.ts", content: "export function ok() { return 'ok'; }\n" },
        {
          path: "app/server/services/__tests__/demo.test.ts",
          content:
            'import { describe, expect, it } from "vitest";\nimport { ok } from "@/app/server/services/demo";\ndescribe("demo", () => { it("works", () => { expect(ok()).toBe("ok"); }); });\n',
        },
      ],
    });
    git(root, ["init"]);
    git(root, ["config", "user.email", "fixture@example.com"]);
    git(root, ["config", "user.name", "Fixture"]);
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "Initial Story Chain"]);
    appendFileSync(
      join(root, "docs/contracts/story-chain/promises/snapshot-overview.md"),
      "\n<!-- pending contract update -->\n",
    );

    const snapshot = buildAlignmentSnapshot(root);
    const dirtyPromise = snapshot.contractUpdates.find(
      (update) => update.refId === "promise:snapshot-overview",
    );
    const ledgerUpdate = snapshot.contractUpdates.find((update) =>
      update.path.endsWith("alignment-audit.ledger.yaml"),
    );

    expect(dirtyPromise?.dirty).toBe(true);
    expect(dirtyPromise?.recent).toBe(true);
    expect(dirtyPromise?.summary).toBe("Working tree change pending review");
    expect(ledgerUpdate?.dirty).toBe(false);
    expect(ledgerUpdate?.commitSha).toBeTruthy();
  });
});
