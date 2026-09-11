import { describe, expect, it } from "vitest";

import {
  evidenceLedgerRecordSchema,
  parseEvidenceLedgerRecord,
  serializeEvidenceLedgerRecord,
  splitAcceptanceCheckKey,
  splitIntentCheckKey,
} from "../evidence-ledger-record";

const validRecord = evidenceLedgerRecordSchema.parse({
  schemaVersion: 2,
  slug: "example",
  sourcePromises: ["promise:example"],
  appliedAspects: ["aspect:example"],
  intent: { mode: "absorbed", checks: [], delegations: [] },
  acceptanceChecks: [
    {
      key: "promise:example#acceptance-check:works",
      assertion: "The example works.",
      executionRefs: ["execution:example"],
      scenarios: [],
    },
  ],
  executions: [
    {
      id: "execution:example",
      kind: "vitest",
      files: ["app/example.test.ts"],
    },
  ],
  implementationContracts: [],
  verdict: "met",
});

describe("Evidence Ledger YAML v2 record", () => {
  it("round-trips only the canonical single-document representation", () => {
    const source = serializeEvidenceLedgerRecord(validRecord);

    expect(
      parseEvidenceLedgerRecord({
        source,
        file: "docs/contracts/story-chain/evidence-ledgers/example.ledger.yaml",
      }),
    ).toEqual(validRecord);
    expect(() =>
      parseEvidenceLedgerRecord({
        source: `\n${source}`,
        file: "docs/contracts/story-chain/evidence-ledgers/example.ledger.yaml",
      }),
    ).toThrow("not in canonical serialized form");
    expect(
      parseEvidenceLedgerRecord({
        source: `\n${source}`,
        file: "docs/contracts/story-chain/evidence-ledgers/example.ledger.yaml",
        canonical: false,
      }),
    ).toEqual(validRecord);
  });

  it.each([
    ["unknown key", `${serializeEvidenceLedgerRecord(validRecord)}unknown: true\n`],
    ["multi-document", `${serializeEvidenceLedgerRecord(validRecord)}---\nother: true\n`],
    ["duplicate key", `schemaVersion: 2\nschemaVersion: 2\n`],
    ["anchor", `schemaVersion: &version 2\n`],
    ["alias", `schemaVersion: *version\n`],
    ["merge", `schemaVersion: 2\n<<: {}\n`],
    ["tag", `schemaVersion: !!int 2\n`],
  ])("rejects %s", (_label, source) => {
    expect(() =>
      parseEvidenceLedgerRecord({
        source,
        file: "docs/contracts/story-chain/evidence-ledgers/example.ledger.yaml",
        canonical: false,
      }),
    ).toThrow();
  });

  it.each(["../outside.test.ts", "C:/outside.test.ts", "\\\\host\\share.test.ts", "-t.test.ts"])(
    "rejects unsafe test path %s",
    (file) => {
      expect(() =>
        evidenceLedgerRecordSchema.parse({
          ...validRecord,
          executions: [{ ...validRecord.executions[0], files: [file] }],
        }),
      ).toThrow();
    },
  );

  it.each([
    ".",
    "./app/example.test.ts",
    "app/../example.test.ts",
    "app//example.test.ts",
    "app/example.test.ts.bak",
  ])("rejects normalized or suffix-near-miss test path %s", (file) => {
    expect(() =>
      evidenceLedgerRecordSchema.parse({
        ...validRecord,
        executions: [{ ...validRecord.executions[0], files: [file] }],
      }),
    ).toThrow();
  });

  it("rejects dangling, duplicate, and orphan execution references", () => {
    expect(() =>
      evidenceLedgerRecordSchema.parse({
        ...validRecord,
        acceptanceChecks: [
          {
            ...validRecord.acceptanceChecks[0],
            executionRefs: ["execution:example", "execution:example"],
          },
        ],
      }),
    ).toThrow("duplicate execution:example");

    expect(() =>
      evidenceLedgerRecordSchema.parse({
        ...validRecord,
        acceptanceChecks: [
          {
            ...validRecord.acceptanceChecks[0],
            executionRefs: ["execution:missing"],
          },
        ],
      }),
    ).toThrow("unknown execution execution:missing");

    expect(() =>
      evidenceLedgerRecordSchema.parse({
        ...validRecord,
        executions: [
          ...validRecord.executions,
          {
            id: "execution:orphan",
            kind: "vitest",
            files: ["app/orphan.test.ts"],
          },
        ],
      }),
    ).toThrow("unreferenced execution execution:orphan");
  });

  it("enforces the intent mode payload shape", () => {
    expect(() =>
      evidenceLedgerRecordSchema.parse({
        ...validRecord,
        intent: {
          mode: "absorbed",
          checks: [
            {
              key: "promise:example#intent-check:meaning",
              evidence: "evidence",
            },
          ],
          delegations: [],
        },
      }),
    ).toThrow("absorbed mode cannot carry checks or delegations");
    expect(() =>
      evidenceLedgerRecordSchema.parse({
        ...validRecord,
        intent: {
          mode: "absorbed",
          checks: [],
          delegations: [
            {
              key: "promise:example#intent-check:meaning",
              ledger: "delegated-owner",
            },
          ],
        },
      }),
    ).toThrow("absorbed mode cannot carry checks or delegations");
  });

  it("rejects whitespace-only contract evidence and descriptions", () => {
    for (const record of [
      {
        ...validRecord,
        acceptanceChecks: [{ ...validRecord.acceptanceChecks[0], assertion: "   " }],
      },
      {
        ...validRecord,
        intent: {
          mode: "explicit",
          checks: [{ key: "promise:example#intent-check:meaning", evidence: "   " }],
          delegations: [],
        },
      },
      { ...validRecord, implementationContracts: ["   "] },
    ]) {
      expect(() => evidenceLedgerRecordSchema.parse(record)).toThrow("must not be blank");
    }
  });

  it("accepts each intent ownership mode only with its owned payload", () => {
    const explicit = {
      mode: "explicit",
      checks: [
        {
          key: "promise:example#intent-check:meaning",
          evidence: "direct evidence",
        },
      ],
      delegations: [],
    } as const;
    const delegated = {
      mode: "delegated",
      checks: [],
      delegations: [
        {
          key: "promise:example#intent-check:meaning",
          ledger: "delegated-owner",
        },
      ],
    } as const;

    expect(evidenceLedgerRecordSchema.parse({ ...validRecord, intent: explicit }).intent).toEqual(
      explicit,
    );
    expect(evidenceLedgerRecordSchema.parse({ ...validRecord, intent: delegated }).intent).toEqual(
      delegated,
    );
    for (const intent of [
      { mode: "explicit", checks: [], delegations: [] },
      {
        mode: "explicit",
        checks: explicit.checks,
        delegations: delegated.delegations,
      },
      { mode: "delegated", checks: [], delegations: [] },
      {
        mode: "delegated",
        checks: explicit.checks,
        delegations: delegated.delegations,
      },
    ]) {
      expect(() => evidenceLedgerRecordSchema.parse({ ...validRecord, intent })).toThrow();
    }
  });
});

describe("Evidence Ledger scenario refs", () => {
  it("requires every scenario ref to use the declared scenario prefix", () => {
    const withScenario = (scenario: string) => ({
      ...validRecord,
      acceptanceChecks: [
        {
          ...validRecord.acceptanceChecks[0],
          scenarios: [scenario],
        },
      ],
    });

    expect(
      evidenceLedgerRecordSchema.parse(withScenario("scenario:example")).acceptanceChecks[0]
        .scenarios,
    ).toEqual(["scenario:example"]);

    for (const scenario of ["example", "scenario:", "journey:example"]) {
      expect(() => evidenceLedgerRecordSchema.parse(withScenario(scenario))).toThrow(
        "must be a scenario: ref",
      );
    }
  });
});

describe("Evidence Ledger YAML v2 cross-field validation", () => {
  it("rejects duplicates across every identity-bearing collection", () => {
    const duplicateRecords = [
      { ...validRecord, sourcePromises: ["promise:example", "promise:example"] },
      { ...validRecord, appliedAspects: ["aspect:example", "aspect:example"] },
      {
        ...validRecord,
        intentJudgmentRefs: [
          { promise: "promise:example", anchor: "promise:example" },
          { promise: "promise:example", anchor: "promise:example" },
        ],
      },
      {
        ...validRecord,
        intent: {
          mode: "explicit",
          checks: [
            { key: "promise:example#intent-check:meaning", evidence: "first" },
            { key: "promise:example#intent-check:meaning", evidence: "second" },
          ],
          delegations: [],
        },
      },
      {
        ...validRecord,
        intent: {
          mode: "delegated",
          checks: [],
          delegations: [
            { key: "promise:example#intent-check:meaning", ledger: "owner-one" },
            { key: "promise:example#intent-check:meaning", ledger: "owner-two" },
          ],
        },
      },
      {
        ...validRecord,
        acceptanceChecks: [validRecord.acceptanceChecks[0], validRecord.acceptanceChecks[0]],
      },
      {
        ...validRecord,
        executions: [validRecord.executions[0], validRecord.executions[0]],
      },
    ];

    for (const record of duplicateRecords) {
      expect(() => evidenceLedgerRecordSchema.parse(record)).toThrow("duplicate");
    }
  });

  it("keeps intent judgment ownership inside Source Promises", () => {
    expect(
      evidenceLedgerRecordSchema.parse({
        ...validRecord,
        intentJudgmentRefs: [{ promise: "promise:example", anchor: "promise:anchor" }],
      }).intentJudgmentRefs,
    ).toEqual([{ promise: "promise:example", anchor: "promise:anchor" }]);

    expect(() =>
      evidenceLedgerRecordSchema.parse({
        ...validRecord,
        intentJudgmentRefs: [{ promise: "promise:not-source", anchor: "promise:anchor" }],
      }),
    ).toThrow("is not a Source Promise");
  });

  it("validates contract-check targets, subcases, and registered executable enums", () => {
    const withExecution = (execution: unknown) => ({
      ...validRecord,
      executions: [execution],
    });
    expect(
      evidenceLedgerRecordSchema.parse(
        withExecution({
          id: "execution:example",
          kind: "contract-check",
          target: "documents",
          subcase: "gap-context",
        }),
      ).executions[0],
    ).toMatchObject({ kind: "contract-check", target: "documents", subcase: "gap-context" });
    expect(() =>
      evidenceLedgerRecordSchema.parse(
        withExecution({
          id: "execution:example",
          kind: "contract-check",
          target: "unknown-target",
          subcase: "all",
        }),
      ),
    ).toThrow("unknown contract-check target");
    expect(() =>
      evidenceLedgerRecordSchema.parse(
        withExecution({
          id: "execution:example",
          kind: "contract-check",
          target: "documents",
          subcase: "unknown-subcase",
        }),
      ),
    ).toThrow("unknown subcase");

    for (const execution of [
      { id: "execution:example", kind: "guard", script: "guard:korean" },
      {
        id: "execution:example",
        kind: "registered-script",
        script: "message-registry-contract",
      },
      {
        id: "execution:example",
        kind: "registered-script",
        script: "gap-report-concurrency",
      },
    ]) {
      expect(
        evidenceLedgerRecordSchema.parse(withExecution(execution)).executions[0],
      ).toMatchObject(execution);
    }
    expect(() =>
      evidenceLedgerRecordSchema.parse(
        withExecution({
          id: "execution:example",
          kind: "guard",
          script: "guard:not-registered",
        }),
      ),
    ).toThrow();
  });

  it("binds slug and review pointers to the ledger filename", () => {
    const recordWithReview = {
      ...validRecord,
      review: "reviews/example.reviews.md",
    };
    const source = serializeEvidenceLedgerRecord(recordWithReview);
    expect(
      parseEvidenceLedgerRecord({
        source,
        file: "docs/contracts/story-chain/evidence-ledgers/example.ledger.yaml",
      }).review,
    ).toBe("reviews/example.reviews.md");
    expect(() =>
      parseEvidenceLedgerRecord({
        source,
        file: "docs/contracts/story-chain/evidence-ledgers/renamed.ledger.yaml",
      }),
    ).toThrow("slug must match renamed");
    expect(() =>
      parseEvidenceLedgerRecord({
        source: serializeEvidenceLedgerRecord({
          ...validRecord,
          review: "reviews/wrong.reviews.md",
        }),
        file: "docs/contracts/story-chain/evidence-ledgers/example.ledger.yaml",
      }),
    ).toThrow("review pointer must be reviews/example.reviews.md");
  });

  it("splits only fully qualified Acceptance Check and Intent Check keys", () => {
    expect(
      splitAcceptanceCheckKey("promise:example#acceptance-check:works", "example.ledger.yaml"),
    ).toEqual(["promise:example", "acceptance-check:works"]);
    expect(
      splitIntentCheckKey("promise:example#intent-check:meaning", "example.ledger.yaml"),
    ).toEqual(["promise:example", "intent-check:meaning"]);

    for (const key of [
      "promise:example#acceptance-check:works#extra",
      "not-a-promise#acceptance-check:works",
      "promise:example#intent-check:wrong-kind",
    ]) {
      expect(() => splitAcceptanceCheckKey(key, "example.ledger.yaml")).toThrow(
        "invalid Acceptance Check key",
      );
    }
    expect(() =>
      splitIntentCheckKey("promise:example#acceptance-check:works", "example.ledger.yaml"),
    ).toThrow("invalid Intent Check key");
    expect(() =>
      splitIntentCheckKey("promise:example#intent-check:meaning#extra", "example.ledger.yaml"),
    ).toThrow("invalid Intent Check key");
  });
});
