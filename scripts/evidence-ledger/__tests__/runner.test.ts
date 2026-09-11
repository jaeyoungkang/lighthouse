import { describe, expect, it } from "vitest";

import type { EvidenceLedger, EvidenceLedgerExecution } from "@/app/domain/story-chain";
import {
  collectCitedTestReferences,
  collectKnownContractSubcases,
  filterLedgers,
  findUnmatchedLedgerFilters,
  parseLedgerFilters,
  validateAcceptanceEvidenceBindings,
  validateEvidenceLedgerExecutions,
  validateEvidenceLedgerScriptExecution,
} from "@/scripts/evidence-ledger-run";

function ledger(overrides: Partial<EvidenceLedger> = {}): EvidenceLedger {
  return {
    path: "docs/contracts/story-chain/evidence-ledgers/example.ledger.yaml",
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
        evidence:
          'vitest @ `app/server/services/story-chain/__tests__/evidence-ledger-record.test.ts` ("round-trips only the canonical single-document representation")',
        executionRefs: ["execution:example"],
        sourcePromise: "promise:example",
        scenarioRefs: [],
      },
    ],
    executions: [
      {
        id: "execution:example",
        kind: "vitest",
        files: ["app/server/services/story-chain/__tests__/evidence-ledger-record.test.ts"],
        testNamePattern: "round-trips only the canonical single-document representation",
      },
    ],
    implementationContracts: [],
    verdict: "met",
    ...overrides,
  };
}

type VitestExecution = Extract<EvidenceLedgerExecution, { kind: "vitest" }>;

function vitestExecution(overrides: Partial<VitestExecution> = {}): VitestExecution {
  const execution = ledger().executions[0];
  if (execution.kind !== "vitest") throw new Error("fixture execution must be vitest");
  return { ...execution, ...overrides };
}

describe("Evidence Ledger v2 runner", () => {
  it("normalizes repeated and comma-separated ledger filters", () => {
    expect(
      parseLedgerFilters([
        "--ledger=example.ledger.yaml,docs/contracts/story-chain/evidence-ledgers/other.ledger.yaml",
        "--ledgers",
        "third",
      ]),
    ).toEqual(["example", "other", "third"]);
  });

  it("accepts both filter spellings and normalizes shell-shaped values", () => {
    expect(parseLedgerFilters([])).toEqual([]);
    expect(
      parseLedgerFilters([
        "--ledger",
        "'./Example.ledger.md'",
        "--ledgers=docs\\contracts\\story-chain\\evidence-ledgers\\OTHER.ledger.yaml",
        "--ledger=example",
        "--ledger",
        "--dry-run",
      ]),
    ).toEqual(["example", "other"]);
  });

  it("rejects every unmatched filter even when another filter matches", () => {
    const ledgers = [ledger(), ledger({ slug: "other" })];
    expect(filterLedgers(ledgers, ["example", "missing"]).map((item) => item.slug)).toEqual([
      "example",
    ]);
    expect(findUnmatchedLedgerFilters(ledgers, ["example", "missing"])).toEqual(["missing"]);
  });

  it("keeps every ledger when no filter is requested", () => {
    const ledgers = [ledger(), ledger({ slug: "other" })];
    expect(filterLedgers(ledgers, [])).toEqual(ledgers);
    expect(findUnmatchedLedgerFilters(ledgers, [])).toEqual([]);
  });

  it("uses the exported contract-check registry", () => {
    expect(collectKnownContractSubcases().get("search-result-window")).toEqual(
      new Set(["all", "visible-window", "no-llm-critical-path"]),
    );
  });

  it("extracts quoted test titles attached to an assertion citation", () => {
    expect(
      collectCitedTestReferences('vitest @ `app/example.test.ts` ("first title"; "second title").'),
    ).toEqual([{ file: "app/example.test.ts", titles: ["first title", "second title"] }]);
  });

  it("keeps citation title groups scoped to their own files and unescapes quotes", () => {
    expect(
      collectCitedTestReferences(
        'app/first.test.ts ("first \\"title\\"") + (\'second\\\' title\'); scripts/next.test.ts ("next")',
      ),
    ).toEqual([
      { file: "app/first.test.ts", titles: ['first "title"', "second' title"] },
      { file: "scripts/next.test.ts", titles: ["next"] },
    ]);
    expect(collectCitedTestReferences("no executable citation")).toEqual([]);
  });

  it("fails when assertion citations are not connected through executionRefs", () => {
    const value = ledger({
      acceptanceCheckEntries: [
        {
          ...ledger().acceptanceCheckEntries[0],
          evidence: "vitest @ `app/missing.test.ts`",
        },
      ],
    });
    expect(validateAcceptanceEvidenceBindings(value).join("\n")).toContain(
      "assertion cites test file without a referenced vitest execution",
    );
  });

  it("fails when a cited title is excluded by the referenced selector", () => {
    const value = ledger({
      executions: [vitestExecution({ testNamePattern: "a different title" })],
    });
    expect(validateAcceptanceEvidenceBindings(value).join("\n")).toContain(
      "cited test title is excluded by referenced vitest selectors",
    );

    const invalidPattern = ledger({
      executions: [vitestExecution({ testNamePattern: "[" })],
    });
    expect(validateAcceptanceEvidenceBindings(invalidPattern).join("\n")).toContain(
      "cited test title is excluded by referenced vitest selectors",
    );
  });

  it("binds contract-check citations to the exact target and subcase", () => {
    const contractExecution: EvidenceLedgerExecution = {
      id: "execution:contract",
      kind: "contract-check",
      target: "search-result-window",
      subcase: "visible-window",
    };
    const value = ledger({
      executions: [contractExecution],
      acceptanceCheckEntries: [
        {
          ...ledger().acceptanceCheckEntries[0],
          evidence: "contract-check.ts search-result-window visible-window",
          executionRefs: [contractExecution.id],
        },
      ],
    });
    expect(validateAcceptanceEvidenceBindings(value)).toEqual([]);
    expect(
      validateAcceptanceEvidenceBindings({
        ...value,
        acceptanceCheckEntries: [
          {
            ...value.acceptanceCheckEntries[0],
            evidence: "contract-check.ts search-result-window no-llm-critical-path",
          },
        ],
      }).join("\n"),
    ).toContain("assertion cites contract-check without a referenced execution");
  });

  it("binds executable citations to the exact registered guard", () => {
    const guardExecution: EvidenceLedgerExecution = {
      id: "execution:guard",
      kind: "guard",
      script: "guard:korean",
    };
    const value = ledger({
      executions: [guardExecution],
      acceptanceCheckEntries: [
        {
          ...ledger().acceptanceCheckEntries[0],
          evidence: "scripts/quality/check-hardcoded-korean.mjs",
          executionRefs: [guardExecution.id],
        },
      ],
    });
    expect(validateAcceptanceEvidenceBindings(value)).toEqual([]);
    expect(
      validateAcceptanceEvidenceBindings({
        ...value,
        acceptanceCheckEntries: [{ ...value.acceptanceCheckEntries[0], executionRefs: [] }],
      }).join("\n"),
    ).toContain("assertion cites executable script without a referenced execution");
  });

  it("reports invalid structured executions without throwing", () => {
    expect(
      validateEvidenceLedgerScriptExecution(
        {
          id: "execution:missing",
          kind: "vitest",
          files: ["app/missing.test.ts"],
        },
        {},
        process.cwd(),
      ).join("\n"),
    ).toContain("ENOENT");
  });

  it("validates target existence and actual Vitest collection in one dry path", () => {
    expect(validateEvidenceLedgerExecutions([ledger()], process.cwd())).toEqual([]);
  });

  it("fails closed for an empty input, missing executions, and uncollectable selectors", () => {
    expect(validateEvidenceLedgerExecutions([], process.cwd())).toEqual([
      "no Evidence Ledger files found",
    ]);

    const withoutExecutions = ledger({ executions: [] });
    expect(
      validateEvidenceLedgerExecutions([withoutExecutions], process.cwd()).join("\n"),
    ).toContain(`${withoutExecutions.path}: no structured executions found`);

    expect(
      validateEvidenceLedgerExecutions(
        [
          ledger({
            executions: [vitestExecution({ testNamePattern: "this title cannot be collected" })],
            acceptanceCheckEntries: [],
          }),
        ],
        process.cwd(),
      ).join("\n"),
    ).toContain("matches zero collected tests");
  });
});
