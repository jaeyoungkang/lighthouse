import { describe, expect, it } from "vitest";

import type { EvidenceLedger } from "@/app/domain/story-chain";
import { validateEvidenceLedgerVitestSelectors } from "../zero-test-guard";

function ledger(
  pattern?: string,
  files = ["scripts/evidence-ledger/__tests__/zero-test-guard.test.ts"],
): EvidenceLedger {
  return {
    path: "example.ledger.yaml",
    schemaVersion: 2,
    slug: "example",
    intentMode: "absorbed",
    sourcePromises: ["promise:example"],
    appliedAspects: [],
    intentCheckEntries: [],
    intentDelegations: [],
    acceptanceCheckEntries: [
      {
        key: "promise:example#acceptance-check:example",
        check: "acceptance-check:example",
        evidence: "example",
        executionRefs: ["execution:example"],
        sourcePromise: "promise:example",
        scenarioRefs: [],
      },
    ],
    executions: [
      {
        id: "execution:example",
        kind: "vitest",
        files,
        ...(pattern ? { testNamePattern: pattern } : {}),
      },
    ],
    implementationContracts: [],
    verdict: "met",
  };
}

describe("Evidence Ledger structured zero-test guard", () => {
  it("accepts a selector that Vitest actually collects", () => {
    expect(
      validateEvidenceLedgerVitestSelectors(
        [ledger("accepts a selector that Vitest actually collects")],
        process.cwd(),
      ),
    ).toEqual([]);
  });

  it("rejects a selector that matches zero collected tests", () => {
    expect(
      validateEvidenceLedgerVitestSelectors([ledger("a title that cannot exist")], process.cwd())[0]
        ?.reason,
    ).toContain("matches zero collected tests");
  });

  it("rejects an execution that collects zero tests before applying a selector", () => {
    expect(validateEvidenceLedgerVitestSelectors([ledger(undefined, [])], process.cwd())).toEqual([
      {
        ledger: "example.ledger.yaml",
        execution: "execution:example",
        reason: "structured Vitest execution collects zero tests",
      },
    ]);
  });

  it("rejects a declared file that Vitest cannot collect", () => {
    expect(
      validateEvidenceLedgerVitestSelectors(
        [ledger(undefined, ["scripts/evidence-ledger/__tests__/missing.test.ts"])],
        process.cwd(),
      ),
    ).toEqual([
      {
        ledger: "example.ledger.yaml",
        execution: "execution:example",
        reason: "structured Vitest execution collects zero tests",
      },
    ]);
  });

  it("reports a failed Vitest collection instead of treating it as zero tests", () => {
    expect(
      validateEvidenceLedgerVitestSelectors([ledger()], process.cwd(), () => ({
        stdout: "",
        stderr: "fixture collection failed",
        status: 1,
      })),
    ).toEqual([
      {
        ledger: "<all>",
        execution: "<vitest-list>",
        reason: "vitest list exited 1: fixture collection failed",
      },
    ]);
  });

  it("reports a Vitest process failure instead of treating it as zero tests", () => {
    expect(
      validateEvidenceLedgerVitestSelectors([ledger()], process.cwd(), () => ({
        error: new Error("fixture spawn failed"),
        stdout: "",
        stderr: "",
        status: null,
      })),
    ).toEqual([
      {
        ledger: "<all>",
        execution: "<vitest-list>",
        reason: "fixture spawn failed",
      },
    ]);
  });

  it("reports invalid Vitest collection output instead of accepting it", () => {
    const [violation] = validateEvidenceLedgerVitestSelectors([ledger()], process.cwd(), () => ({
      stdout: "not-json",
      stderr: "",
      status: 0,
    }));

    expect(violation).toMatchObject({ ledger: "<all>", execution: "<vitest-list>" });
    expect(violation.reason).toContain("vitest list returned invalid JSON");
  });

  it("ignores non-Vitest executions", () => {
    const nonVitestLedger: EvidenceLedger = {
      ...ledger(),
      executions: [
        {
          id: "execution:guard",
          kind: "guard",
          script: "guard:state-boundaries",
        },
      ],
    };

    expect(validateEvidenceLedgerVitestSelectors([nonVitestLedger], process.cwd())).toEqual([]);
  });

  it("rejects an invalid regular expression", () => {
    expect(
      validateEvidenceLedgerVitestSelectors([ledger("[")], process.cwd())[0]?.reason,
    ).toContain("not a valid regular expression");
  });
});
